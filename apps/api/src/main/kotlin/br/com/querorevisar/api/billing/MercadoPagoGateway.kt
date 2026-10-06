package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.HttpClients
import org.slf4j.LoggerFactory
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import tools.jackson.databind.JsonNode
import java.math.BigDecimal
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * Mercado Pago REST API with Spring RestClient (no SDK, D09): Bearer MP_ACCESS_TOKEN, X-Idempotency-Key on every
 * POST (the internal purchase/subscription id), connect 3 s / read 10 s, up to 2 retries on 5xx and network errors
 * with the same idempotency key.
 */
class MercadoPagoGateway(private val props: AppProperties) : PaymentGateway {
    private val log = LoggerFactory.getLogger(javaClass)
    override val mode: String = props.payments.effectiveMode

    private val client: RestClient = HttpClients.restClient(props.payments.baseUrl.trimEnd('/'), props)
        .defaultHeader("Authorization", "Bearer ${props.payments.accessToken}")
        .build()

    private val expirationFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")

    private fun https(url: String): String? = url.takeIf { it.startsWith("https://") }

    private fun amount(cents: Int): BigDecimal = BigDecimal.valueOf(cents.toLong(), 2)

    private fun call(method: HttpMethod, path: String, body: Any?, idempotencyKey: String?): JsonNode {
        var attempt = 0
        while (true) {
            try {
                val spec = client.method(method).uri(path).accept(MediaType.APPLICATION_JSON)
                if (idempotencyKey != null) spec.header("X-Idempotency-Key", idempotencyKey)
                if (body != null) spec.contentType(MediaType.APPLICATION_JSON).body(body)
                return spec.retrieve().body(JsonNode::class.java) ?: throw PaymentGatewayException("Empty Mercado Pago response")
            } catch (e: Exception) {
                val retryable = e is HttpServerErrorException || e is ResourceAccessException
                if (retryable && attempt < 2) {
                    attempt++
                    log.warn("Mercado Pago {} {} failed ({}), retry {}", method, path.substringBefore('?'), e.javaClass.simpleName, attempt)
                    continue
                }
                val status = (e as? RestClientResponseException)?.statusCode?.value()
                throw PaymentGatewayException("Mercado Pago $method ${path.substringBefore('?')} failed (${status ?: e.javaClass.simpleName})", e)
            }
        }
    }

    private fun JsonNode.text(name: String): String? = get(name)?.takeIf { !it.isNull }?.asString()?.takeIf { it.isNotEmpty() }

    private fun JsonNode.instant(name: String): Instant? = text(name)?.let { runCatching { OffsetDateTime.parse(it).toInstant() }.getOrNull() }

    override fun createPix(req: ChargeRequest): PixCharge {
        val expires = req.expiresAt ?: Instant.now().plusSeconds(props.payments.pixExpirationMinutes * 60)
        val payer = linkedMapOf<String, Any>("email" to (req.payerEmail ?: throw PaymentGatewayException("Pix needs the payer e-mail")))
        req.payerCpf?.filter { it.isDigit() }?.takeIf { it.length == 11 }?.let {
            payer["identification"] = mapOf("type" to "CPF", "number" to it)
        }
        val body = linkedMapOf<String, Any>(
            "transaction_amount" to amount(req.amountCents),
            "description" to req.description,
            "payment_method_id" to "pix",
            "external_reference" to req.purchaseId.toString(),
            "date_of_expiration" to expirationFormat.format(expires.atZone(ZoneId.of("America/Sao_Paulo"))),
            "payer" to payer,
        )
        https(props.payments.notificationUrl)?.let { body["notification_url"] = it }
        val r = call(HttpMethod.POST, "/v1/payments", body, req.purchaseId.toString())
        val tx = r.path("point_of_interaction").path("transaction_data")
        return PixCharge(
            paymentId = r.path("id").asString(),
            qrCode = tx.text("qr_code") ?: throw PaymentGatewayException("Pix without qr_code"),
            qrCodeBase64 = tx.text("qr_code_base64") ?: "",
            expiresAt = r.instant("date_of_expiration") ?: expires,
        )
    }

    override fun createPreference(req: ChargeRequest): CheckoutPreference {
        val body = linkedMapOf<String, Any>(
            "items" to listOf(
                mapOf("id" to req.packId, "title" to req.description, "quantity" to 1, "currency_id" to "BRL", "unit_price" to amount(req.amountCents)),
            ),
            "external_reference" to req.purchaseId.toString(),
            "payment_methods" to mapOf("excluded_payment_types" to listOf(mapOf("id" to "ticket"))),
        )
        https(props.payments.notificationUrl)?.let { body["notification_url"] = it }
        val success = https(props.payments.backUrlSuccess)
        if (success != null) {
            body["back_urls"] = mapOf(
                "success" to success,
                "pending" to (https(props.payments.backUrlPending) ?: success),
                "failure" to (https(props.payments.backUrlFailure) ?: success),
            )
            body["auto_return"] = "approved"
        }
        val r = call(HttpMethod.POST, "/checkout/preferences", body, req.purchaseId.toString())
        // MP now asks to use init_point for tests too (sandbox_init_point is deprecated).
        return CheckoutPreference(r.path("id").asString(), r.text("init_point") ?: throw PaymentGatewayException("Preference without init_point"))
    }

    override fun getPayment(id: String): GatewayPayment {
        val r = call(HttpMethod.GET, "/v1/payments/$id", null, null)
        return GatewayPayment(r.path("id").asString(), r.text("status") ?: "unknown", r.text("external_reference"), r.instant("date_approved"))
    }

    /**
     * Subscription without a plan, status pending: the payer authorizes the card on the MP page (init_point). With a
     * plan MP requires card_token_id, i.e. our own card form (docs/mercadopago.md).
     */
    override fun createSubscription(subscriptionId: UUID, userId: UUID, payerEmail: String?, priceCents: Int): GatewayPreapproval {
        val body = linkedMapOf<String, Any>(
            "reason" to "QueroRevisar Premium",
            "external_reference" to userId.toString(),
            "payer_email" to (payerEmail ?: throw PaymentGatewayException("Subscription needs the payer e-mail")),
            "auto_recurring" to mapOf(
                "frequency" to 1, "frequency_type" to "months", "transaction_amount" to amount(priceCents), "currency_id" to "BRL",
            ),
            "back_url" to props.payments.backUrlSuccess,
            "status" to "pending",
        )
        return preapproval(call(HttpMethod.POST, "/preapproval", body, subscriptionId.toString()))
    }

    override fun getPreapproval(id: String): GatewayPreapproval = preapproval(call(HttpMethod.GET, "/preapproval/$id", null, null))

    override fun cancelPreapproval(id: String) {
        call(HttpMethod.PUT, "/preapproval/$id", mapOf("status" to "cancelled"), null)
    }

    override fun getAuthorizedPayment(id: String): GatewayAuthorizedPayment {
        val r = call(HttpMethod.GET, "/authorized_payments/$id", null, null)
        val payment = r.path("payment")
        return GatewayAuthorizedPayment(
            id = r.path("id").asString(),
            preapprovalId = r.text("preapproval_id"),
            status = normalizeMpStatus(r.text("status")),
            paymentId = payment.text("id"),
            paymentStatus = payment.text("status"),
            debitDate = r.instant("debit_date") ?: r.instant("date_created"),
        )
    }

    /** POST /preapproval_plan (./gradlew :apps:api:createPremiumPlan). Returns (id, init_point). */
    fun createPlan(priceCents: Int, backUrl: String): Pair<String, String?> {
        val body = mapOf(
            "reason" to "QueroRevisar Premium",
            "auto_recurring" to mapOf(
                "frequency" to 1, "frequency_type" to "months", "transaction_amount" to amount(priceCents), "currency_id" to "BRL",
            ),
            "back_url" to backUrl,
        )
        val r = call(HttpMethod.POST, "/preapproval_plan", body, UUID.randomUUID().toString())
        return r.path("id").asString() to r.text("init_point")
    }

    private fun preapproval(r: JsonNode) = GatewayPreapproval(
        id = r.path("id").asString(),
        status = normalizeMpStatus(r.text("status")),
        externalReference = r.text("external_reference"),
        nextPaymentDate = r.instant("next_payment_date"),
        initPoint = r.text("init_point"),
    )
}
