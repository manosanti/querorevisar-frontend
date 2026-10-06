package br.com.querorevisar.api.billing

import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Mercado Pago webhook signature (docs/mercadopago.md#assinatura): `x-signature: ts=<ts>,v1=<hex>`, manifest
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (absent parts omitted), HMAC-SHA256 with MP_WEBHOOK_SECRET,
 * constant-time comparison and a 10-minute window on `ts` (seconds, or milliseconds when that large).
 * The official SDKs sign data.id as received; the docs say lowercase — both are accepted.
 */
object WebhookSignature {
    fun manifest(dataId: String?, requestId: String?, ts: String): String = buildString {
        if (!dataId.isNullOrEmpty()) append("id:").append(dataId).append(';')
        if (!requestId.isNullOrEmpty()) append("request-id:").append(requestId).append(';')
        append("ts:").append(ts).append(';')
    }

    fun hmacHex(secret: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return HexFormat.of().formatHex(mac.doFinal(message.toByteArray(Charsets.UTF_8)))
    }

    fun parse(header: String?): Pair<String, String>? {
        if (header.isNullOrBlank()) return null
        val parts = header.split(',').mapNotNull { p ->
            val kv = p.split('=', limit = 2)
            if (kv.size == 2) kv[0].trim() to kv[1].trim() else null
        }.toMap()
        val ts = parts["ts"]?.takeIf { it.isNotEmpty() } ?: return null
        val v1 = parts["v1"]?.takeIf { it.isNotEmpty() } ?: return null
        return ts to v1
    }

    fun verify(
        header: String?,
        requestId: String?,
        dataId: String?,
        secret: String,
        now: Instant,
        tolerance: Duration = Duration.ofMinutes(10),
    ): Boolean {
        val (ts, v1) = parse(header) ?: return false
        val tsNumber = ts.toLongOrNull() ?: return false
        val signedAt = if (tsNumber > 100_000_000_000L) Instant.ofEpochMilli(tsNumber) else Instant.ofEpochSecond(tsNumber)
        if (Duration.between(signedAt, now).abs() > tolerance) return false
        val expected = v1.lowercase().toByteArray(Charsets.US_ASCII)
        return listOf(dataId, dataId?.lowercase()).distinct().any { id ->
            MessageDigest.isEqual(hmacHex(secret, manifest(id, requestId, ts)).toByteArray(Charsets.US_ASCII), expected)
        }
    }
}
