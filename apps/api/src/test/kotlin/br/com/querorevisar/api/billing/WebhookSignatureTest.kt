package br.com.querorevisar.api.billing

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

/** docs/mercadopago.md#assinatura: the mandatory signature cases. */
class WebhookSignatureTest {
    private val secret = "test-webhook-secret"
    private val now = Instant.parse("2026-10-06T15:00:00Z")
    private val ts = now.epochSecond.toString()
    private val dataId = "123456789"
    private val requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e"

    private fun header(v1: String, t: String = ts) = "ts=$t,v1=$v1"

    private fun sign(id: String? = dataId, rid: String? = requestId, t: String = ts, key: String = secret) =
        WebhookSignature.hmacHex(key, WebhookSignature.manifest(id, rid, t))

    @Test
    fun `manifest follows the documented template`() {
        assertEquals("id:123456789;request-id:$requestId;ts:$ts;", WebhookSignature.manifest(dataId, requestId, ts))
        assertEquals("request-id:$requestId;ts:$ts;", WebhookSignature.manifest(null, requestId, ts))
        assertEquals("id:123456789;ts:$ts;", WebhookSignature.manifest(dataId, null, ts))
    }

    @Test
    fun `valid signature`() = assertTrue(WebhookSignature.verify(header(sign()), requestId, dataId, secret, now))

    @Test
    fun `altered v1`() {
        val good = sign()
        val bad = (if (good[0] == 'a') "b" else "a") + good.substring(1)
        assertFalse(WebhookSignature.verify(header(bad), requestId, dataId, secret, now))
    }

    @Test
    fun `wrong secret`() = assertFalse(WebhookSignature.verify(header(sign(key = "another-secret")), requestId, dataId, secret, now))

    @Test
    fun `altered ts`() {
        val signed = sign()
        val alteredTs = (now.epochSecond + 1).toString()
        assertFalse(WebhookSignature.verify(header(signed, alteredTs), requestId, dataId, secret, now))
    }

    @Test
    fun `missing or malformed header`() {
        assertFalse(WebhookSignature.verify(null, requestId, dataId, secret, now))
        assertFalse(WebhookSignature.verify("", requestId, dataId, secret, now))
        assertFalse(WebhookSignature.verify("v1=abc", requestId, dataId, secret, now))
    }

    @Test
    fun `old timestamps are replays`() {
        val old = (now.epochSecond - 3600).toString()
        assertFalse(WebhookSignature.verify(header(sign(t = old), old), requestId, dataId, secret, now))
    }

    @Test
    fun `milliseconds timestamps and lowercased ids are accepted`() {
        val ms = now.toEpochMilli().toString()
        assertTrue(WebhookSignature.verify(header(sign(t = ms), ms), requestId, dataId, secret, now))
        val alnum = "ABC123def"
        assertTrue(WebhookSignature.verify(header(sign(id = alnum.lowercase())), requestId, alnum, secret, now))
        assertTrue(WebhookSignature.verify(header(sign(id = alnum)), requestId, alnum, secret, now))
    }
}
