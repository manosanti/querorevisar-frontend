package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.client.WireMock.aResponse
import com.github.tomakehurst.wiremock.client.WireMock.equalTo
import com.github.tomakehurst.wiremock.client.WireMock.equalToJson
import com.github.tomakehurst.wiremock.client.WireMock.get
import com.github.tomakehurst.wiremock.client.WireMock.matchingJsonPath
import com.github.tomakehurst.wiremock.client.WireMock.okJson
import com.github.tomakehurst.wiremock.client.WireMock.post
import com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor
import com.github.tomakehurst.wiremock.client.WireMock.put
import com.github.tomakehurst.wiremock.client.WireMock.putRequestedFor
import com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo
import com.github.tomakehurst.wiremock.core.WireMockConfiguration
import com.github.tomakehurst.wiremock.stubbing.Scenario
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID

/** Mercado Pago REST calls (sandbox/live) against WireMock: request shapes, idempotency key, retries. */
class MercadoPagoGatewayTest {
    private val server = WireMockServer(WireMockConfiguration.options().dynamicPort())

    @BeforeEach
    fun start() = server.start()

    @AfterEach
    fun stop() = server.stop()

    private fun gateway() = MercadoPagoGateway(
        AppProperties(
            payments = AppProperties.Payments(
                mode = "sandbox", baseUrl = server.baseUrl(), accessToken = "TEST-token",
                notificationUrl = "https://api.example.com/webhooks/mercadopago",
                backUrlSuccess = "https://app.example.com/conta?pagamento=ok",
            ),
        ),
    )

    private val purchaseId = UUID.fromString("7f0c9a8e-1d2b-4c3d-9e8f-0a1b2c3d4e5f")

    private fun charge() = ChargeRequest(purchaseId, "pack-12", 12, 4790, "QueroRevisar · 12 créditos", "comprador@test.local", "123.456.789-09", Instant.parse("2026-10-06T15:30:00Z"))

    @Test
    fun `pix payment`() {
        server.stubFor(
            post("/v1/payments").willReturn(
                okJson(
                    """{"id":1325467890,"status":"pending","date_of_expiration":"2026-10-06T12:30:00.000-03:00",
                       "point_of_interaction":{"transaction_data":{"qr_code":"00020126580014br.gov.bcb.pix","qr_code_base64":"iVBORw0KGgo="}}}""",
                ),
            ),
        )
        val pix = gateway().createPix(charge())
        assertEquals("1325467890", pix.paymentId)
        assertEquals("00020126580014br.gov.bcb.pix", pix.qrCode)
        assertEquals(Instant.parse("2026-10-06T15:30:00Z"), pix.expiresAt)
        server.verify(
            postRequestedFor(urlEqualTo("/v1/payments"))
                .withHeader("Authorization", equalTo("Bearer TEST-token"))
                .withHeader("X-Idempotency-Key", equalTo(purchaseId.toString()))
                .withRequestBody(matchingJsonPath("$.payment_method_id", equalTo("pix")))
                .withRequestBody(matchingJsonPath("$[?(@.transaction_amount == 47.9)]"))
                .withRequestBody(matchingJsonPath("$.external_reference", equalTo(purchaseId.toString())))
                .withRequestBody(matchingJsonPath("$.date_of_expiration", equalTo("2026-10-06T12:30:00.000-03:00")))
                .withRequestBody(matchingJsonPath("$.payer.identification.number", equalTo("12345678909")))
                .withRequestBody(matchingJsonPath("$.notification_url", equalTo("https://api.example.com/webhooks/mercadopago"))),
        )
    }

    @Test
    fun `retries 5xx with the same idempotency key`() {
        server.stubFor(post("/checkout/preferences").inScenario("retry").whenScenarioStateIs(Scenario.STARTED)
            .willReturn(aResponse().withStatus(502)).willSetStateTo("ok"))
        server.stubFor(post("/checkout/preferences").inScenario("retry").whenScenarioStateIs("ok")
            .willReturn(okJson("""{"id":"123-abc","init_point":"https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-abc"}""")))
        val pref = gateway().createPreference(charge())
        assertEquals("123-abc", pref.preferenceId)
        assertEquals("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-abc", pref.initPoint)
        server.verify(2, postRequestedFor(urlEqualTo("/checkout/preferences")).withHeader("X-Idempotency-Key", equalTo(purchaseId.toString())))
        server.verify(
            postRequestedFor(urlEqualTo("/checkout/preferences"))
                .withRequestBody(matchingJsonPath("$.items[?(@.unit_price == 47.9)]"))
                .withRequestBody(matchingJsonPath("$.back_urls.success", equalTo("https://app.example.com/conta?pagamento=ok")))
                .withRequestBody(matchingJsonPath("$.auto_return", equalTo("approved"))),
        )
    }

    @Test
    fun `payment, subscription and authorized payment reads`() {
        server.stubFor(get("/v1/payments/99").willReturn(okJson("""{"id":99,"status":"approved","external_reference":"$purchaseId","date_approved":"2026-10-06T12:01:00.000-03:00"}""")))
        server.stubFor(post("/preapproval").willReturn(okJson("""{"id":"2c938084","status":"pending","init_point":"https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c938084","external_reference":"u1"}""")))
        server.stubFor(get("/preapproval/2c938084").willReturn(okJson("""{"id":"2c938084","status":"canceled","next_payment_date":"2026-11-06T12:00:00.000-03:00","external_reference":"u1"}""")))
        server.stubFor(put("/preapproval/2c938084").willReturn(okJson("""{"id":"2c938084","status":"cancelled"}""")))
        server.stubFor(get("/authorized_payments/6114264375").willReturn(okJson("""{"id":6114264375,"preapproval_id":"2c938084","status":"processed","debit_date":"2026-10-06T12:00:00.000-03:00","payment":{"id":555,"status":"approved"}}""")))

        val g = gateway()
        val p = g.getPayment("99")
        assertEquals("approved", p.status)
        assertEquals(purchaseId.toString(), p.externalReference)
        val sub = g.createSubscription(UUID.randomUUID(), UUID.randomUUID(), "assinante@test.local", 1490)
        assertEquals("https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=2c938084", sub.initPoint)
        server.verify(
            postRequestedFor(urlEqualTo("/preapproval"))
                .withRequestBody(matchingJsonPath("$.status", equalTo("pending")))
                .withRequestBody(matchingJsonPath("$.auto_recurring[?(@.transaction_amount == 14.9)]"))
                .withRequestBody(matchingJsonPath("$.auto_recurring.frequency_type", equalTo("months"))),
        )
        assertEquals("cancelled", g.getPreapproval("2c938084").status)
        g.cancelPreapproval("2c938084")
        server.verify(putRequestedFor(urlEqualTo("/preapproval/2c938084")).withRequestBody(equalToJson("""{"status":"cancelled"}""")))
        val ap = g.getAuthorizedPayment("6114264375")
        assertEquals("approved", ap.paymentStatus)
        assertEquals("555", ap.paymentId)
        assertEquals("2c938084", ap.preapprovalId)
    }

    @Test
    fun `client errors are not retried`() {
        server.stubFor(post("/v1/payments").willReturn(aResponse().withStatus(400).withBody("""{"message":"invalid"}""")))
        assertThrows(PaymentGatewayException::class.java) { gateway().createPix(charge()) }
        server.verify(1, postRequestedFor(urlEqualTo("/v1/payments")))
    }
}
