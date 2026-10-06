package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.common.Secrets
import br.com.querorevisar.api.common.odt
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Duration

/**
 * F09.4: validates x-signature (401 when invalid), stores the event in webhook_events (unique id) before processing,
 * re-fetches the resource through [PaymentEvents] and answers 200 quickly. Failures stay in webhook_events.error and
 * are retried by the `cleanup` job.
 */
@Service
class WebhookService(
    private val events: PaymentEvents,
    private val jdbc: JdbcClient,
    private val mapper: JsonMapper,
    private val props: AppProperties,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    init {
        if (!Secrets.isSet(props.payments.webhookSecret)) {
            log.warn("MP_WEBHOOK_SECRET not set: /webhooks/mercadopago rejects every notification (401)")
        }
    }

    enum class Outcome { PROCESSED, DUPLICATE, FAILED, INVALID_SIGNATURE, IGNORED }

    fun receive(dataId: String?, type: String?, signature: String?, requestId: String?, body: Map<String, Any?>?): Outcome {
        val secret = props.payments.webhookSecret
        val id = dataId ?: ((body?.get("data") as? Map<*, *>)?.get("id"))?.toString()
        if (!Secrets.isSet(secret) ||
            !WebhookSignature.verify(signature, requestId, id, secret, clock.instant(), props.payments.webhookTolerance)
        ) {
            log.warn("Rejected Mercado Pago webhook: invalid signature")
            return Outcome.INVALID_SIGNATURE
        }
        val eventType = type ?: body?.get("type")?.toString()
        if (id.isNullOrBlank() || eventType.isNullOrBlank()) return Outcome.IGNORED
        val ts = WebhookSignature.parse(signature)?.first
        val eventId = "mercadopago:$eventType:$id:${requestId ?: ts}"
        val payload = mapOf("query" to mapOf("data.id" to id, "type" to eventType), "body" to body)
        val inserted = jdbc.sql(
            """insert into webhook_events(id, provider, type, payload, received_at) values (:id, 'mercadopago', :t, cast(:p as jsonb), :r)
               on conflict (id) do nothing""",
        ).param("id", eventId).param("t", eventType).param("p", mapper.writeValueAsString(payload))
            .param("r", clock.instant().odt()).update() == 1
        if (!inserted) {
            val processed = jdbc.sql("select processed_at is not null from webhook_events where id = :id").param("id", eventId)
                .query(Boolean::class.java).single()
            if (processed) return Outcome.DUPLICATE
        }
        return process(eventId, eventType, id)
    }

    private fun process(eventId: String, type: String, dataId: String): Outcome = try {
        events.handle(type, dataId)
        jdbc.sql("update webhook_events set processed_at = :t, error = null where id = :id")
            .param("t", clock.instant().odt()).param("id", eventId).update()
        Outcome.PROCESSED
    } catch (e: Exception) {
        Redact.error(log, "Webhook processing failed ($type)", e)
        jdbc.sql("update webhook_events set error = :e where id = :id")
            .param("e", "${e.javaClass.simpleName}: ${Redact.text(e.message)?.take(500)}").param("id", eventId).update()
        Outcome.FAILED
    }

    /** cleanup job: re-processes failed events of the last 3 days. */
    fun retryFailed(): Map<String, Int> {
        val failed = jdbc.sql(
            """select id, type, payload->'query'->>'data.id' as data_id from webhook_events
               where processed_at is null and error is not null and received_at > :since order by received_at limit 200""",
        ).param("since", clock.instant().minus(Duration.ofDays(3)).odt())
            .query { rs, _ -> Triple(rs.getString("id"), rs.getString("type"), rs.getString("data_id")) }.list()
        var ok = 0
        for ((id, type, dataId) in failed) {
            if (type != null && dataId != null && process(id, type, dataId) == Outcome.PROCESSED) ok++
        }
        return mapOf("retried" to failed.size, "recovered" to ok)
    }

    /** cleanup job: processed events older than 30 days are removed. */
    fun deleteOld(): Int =
        jdbc.sql("delete from webhook_events where processed_at is not null and received_at < :t")
            .param("t", clock.instant().minus(Duration.ofDays(30)).odt()).update()
}
