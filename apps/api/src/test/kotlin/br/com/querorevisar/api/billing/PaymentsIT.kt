package br.com.querorevisar.api.billing

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/** F09: credit packs and purchases (mock Pix auto-approval, card), Premium, webhook signature and replay. */
class PaymentsIT : IntegrationTest() {
    @Autowired
    lateinit var gateway: PaymentGateway

    private val mock get() = gateway as MockPaymentGateway

    private fun balance(user: br.com.querorevisar.api.support.TestUser) = get("/v1/me", user).expect(200).at("/credits").asInt()

    @Test
    fun `credit packs`() {
        val user = newUser()
        val packs = get("/v1/credits/packs", user).expect(200).json.values().toList()
        assertEquals(listOf("pack-1", "pack-5", "pack-12", "pack-30"), packs.map { it["id"].asString() })
        assertEquals(listOf(490, 2190, 4790, 10490), packs.map { it["priceCents"].asInt() })
        assertEquals(listOf(490, 438, 399, 350), packs.map { it["unitPriceCents"].asInt() })
        assertEquals(listOf(0, 11, 19, 29), packs.map { it["discountPct"].asInt() })
        assertEquals("Mais escolhido", packs[2]["tag"].asString())
        assertTrue(packs[0]["tag"].isNull)
    }

    @Test
    fun `pix purchase is approved by the mock after the delay and credits once`() {
        val user = newUser()
        val p = post("/v1/credits/purchases", mapOf("packId" to "pack-12", "method" to "pix"), user).expect(200)
        assertEquals("pending", p.text("/status"))
        assertEquals("pix", p.text("/method"))
        assertEquals(12, p.at("/credits").asInt())
        assertEquals(4790, p.at("/amountCents").asInt())
        assertTrue(p.text("/qrCode").startsWith("000201"))
        assertTrue(p.text("/qrCodeBase64").length > 100)
        val expires = Instant.parse(p.text("/expiresAt"))
        assertTrue(expires.isAfter(Instant.now().plusSeconds(29 * 60)))
        val id = p.text("/purchaseId")
        eventually { get("/v1/credits/purchases/$id", user).text("/status") == "approved" }
        assertEquals(12, balance(user))
        // The mock approval endpoint runs the same handler: still credited once.
        post("/v1/mock/payments/$id/approve", user = user, key = null).expect(204)
        assertEquals(12, balance(user))
        val ledger = get("/v1/credits/ledger", user).expect(200).json.values().toList()
        assertEquals(listOf("purchase"), ledger.map { it["reason"].asString() })
    }

    @Test
    fun `card purchase goes through the mock checkout page`() {
        val user = newUser()
        val p = post("/v1/credits/purchases", mapOf("packId" to "pack-5", "method" to "card"), user).expect(200)
        val id = p.text("/purchaseId")
        assertEquals("http://localhost:5173/mock/checkout?kind=credits&id=$id", p.text("/initPoint"))
        assertTrue(p.at("/qrCode").isNull)
        Thread.sleep(600)
        assertEquals("pending", get("/v1/credits/purchases/$id", user).text("/status"))
        post("/v1/mock/payments/$id/approve", user = user, key = null).expect(204)
        assertEquals("approved", get("/v1/credits/purchases/$id", user).text("/status"))
        assertEquals(5, balance(user))
        assertEquals(400, post("/v1/credits/purchases", mapOf("packId" to "pack-999", "method" to "pix"), user).status)
    }

    @Test
    fun `premium checkout, approval, status and cancel`() {
        val user = newUser()
        get("/v1/billing/premium", user).expect(200).let { assertEquals("none", it.text("/status")) }
        val checkout = post("/v1/billing/premium/checkout", user = user).expect(200)
        val initPoint = checkout.text("/initPoint")
        assertTrue(initPoint.startsWith("http://localhost:5173/mock/checkout?kind=premium&id="))
        assertEquals("pending", get("/v1/billing/premium", user).text("/status"))
        val id = initPoint.substringAfter("id=")
        post("/v1/mock/payments/$id/approve", user = user, key = null).expect(204)
        val me = get("/v1/me", user).expect(200)
        assertEquals("premium", me.text("/plan"))
        assertEquals(2, me.at("/credits").asInt())
        val until = Instant.parse(me.text("/premiumUntil")).atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate()
        val expected = java.time.LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusMonths(1)
        assertTrue(!until.isBefore(expected.minusDays(1)) && !until.isAfter(expected.plusDays(1)), "premiumUntil $until")
        val status = get("/v1/billing/premium", user).expect(200)
        assertEquals("authorized", status.text("/status"))
        assertTrue(!status.at("/nextBillingDate").isNull)
        assertEquals(409, post("/v1/billing/premium/checkout", user = user).status)
        // approving again does not double the bonus
        post("/v1/mock/payments/$id/approve", user = user, key = null).expect(204)
        assertEquals(2, balance(user))

        val cancelled = post("/v1/billing/premium/cancel", user = user).expect(200)
        assertEquals("cancelled", cancelled.text("/status"))
        assertEquals("premium", get("/v1/me", user).text("/plan"), "stays Premium until premium_until")
        assertEquals(404, post("/v1/billing/premium/cancel", user = user).status)
    }

    // ---- webhook ------------------------------------------------------------------------------------------

    private fun webhook(dataId: String, type: String, secret: String = "test-webhook-secret", requestId: String = UUID.randomUUID().toString(), tsOverride: String? = null): Int {
        val ts = Instant.now().epochSecond.toString()
        val v1 = WebhookSignature.hmacHex(secret, WebhookSignature.manifest(dataId, requestId, ts))
        val headers = mapOf("x-signature" to "ts=${tsOverride ?: ts},v1=$v1", "x-request-id" to requestId)
        val body = mapOf("action" to "payment.updated", "type" to type, "data" to mapOf("id" to dataId), "live_mode" to false)
        return post("/webhooks/mercadopago?data.id=$dataId&type=$type", body, key = null, headers = headers).status
    }

    @Test
    fun `webhook validates the signature, re-fetches the payment and credits once`() {
        val user = newUser()
        val purchase = post("/v1/credits/purchases", mapOf("packId" to "pack-1", "method" to "card"), user).expect(200).text("/purchaseId")
        val paymentId = MockPaymentGateway.cardPaymentId(UUID.fromString(purchase))
        // Not approved at the gateway yet: the webhook is accepted but nothing is credited.
        assertEquals(200, webhook(paymentId, "payment"))
        assertEquals(0, balance(user))
        mock.markApproved(paymentId)
        val requestId = UUID.randomUUID().toString()
        assertEquals(200, webhook(paymentId, "payment", requestId = requestId))
        assertEquals(1, balance(user))
        // same event again, and the same payment through another notification: still one credit
        assertEquals(200, webhook(paymentId, "payment", requestId = requestId))
        assertEquals(200, webhook(paymentId, "payment"))
        assertEquals(1, balance(user))
        val processed = jdbc.sql("select count(*) from webhook_events where id like :p and processed_at is not null")
            .param("p", "mercadopago:payment:$paymentId:%").query(Int::class.java).single()
        assertEquals(3, processed)
    }

    @Test
    fun `webhook with a bad signature is 401`() {
        assertEquals(401, webhook("123", "payment", secret = "wrong-secret"))
        assertEquals(401, webhook("123", "payment", tsOverride = (Instant.now().epochSecond - 5).toString()))
        assertEquals(401, post("/webhooks/mercadopago?data.id=123&type=payment", mapOf("type" to "payment"), key = null).status)
    }
}
