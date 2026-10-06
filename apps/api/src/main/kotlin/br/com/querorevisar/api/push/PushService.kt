package br.com.querorevisar.api.push

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.odt
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import nl.martijndwars.webpush.Encoding
import nl.martijndwars.webpush.Notification
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.security.Security
import java.time.Clock
import java.util.UUID

@ApiDto
data class PushKeys(
    @NotBlank(message = "Assinatura de push inválida")
    val p256dh: String?,
    @NotBlank(message = "Assinatura de push inválida")
    val auth: String?,
)

@ApiDto
data class PushSubscriptionCreate(
    @NotBlank(message = "Assinatura de push inválida") @Size(max = 1000, message = "Assinatura de push inválida")
    val endpoint: String?,
    @NotNull(message = "Assinatura de push inválida") @Valid
    val keys: PushKeys?,
    val userAgent: String? = null,
)

@ApiDto
data class PushSubscriptionDelete(
    @NotBlank(message = "Assinatura de push inválida")
    val endpoint: String?,
)

data class PushSubscriptionRow(val id: UUID, val userId: UUID, val endpoint: String, val p256dh: String, val auth: String)

data class PushMessage(val title: String, val body: String, val url: String, val tag: String)

enum class PushResult { SENT, GONE, FAILED }

interface PushSender {
    fun send(sub: PushSubscriptionRow, payload: String): PushResult
}

/** PUSH_MODE=log (default): only logs (endpoint host only, never the full endpoint). */
class LogPushSender : PushSender {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun send(sub: PushSubscriptionRow, payload: String): PushResult {
        log.info("Push (log mode) to {}: {}", runCatching { URI(sub.endpoint).host }.getOrDefault("?"), payload)
        return PushResult.SENT
    }
}

/** PUSH_MODE=live: Web Push with VAPID (nl.martijndwars:web-push + BouncyCastle). */
class WebPushSender(props: AppProperties) : PushSender {
    private val log = LoggerFactory.getLogger(javaClass)
    private val service: nl.martijndwars.webpush.PushService

    init {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) Security.addProvider(BouncyCastleProvider())
        service = nl.martijndwars.webpush.PushService(props.push.vapidPublicKey, props.push.vapidPrivateKey, props.push.vapidSubject)
    }

    override fun send(sub: PushSubscriptionRow, payload: String): PushResult = try {
        val response = service.send(Notification(sub.endpoint, sub.p256dh, sub.auth, payload.toByteArray(Charsets.UTF_8)), Encoding.AES128GCM)
        when (val code = response.statusLine.statusCode) {
            in 200..299 -> PushResult.SENT
            404, 410 -> PushResult.GONE
            else -> {
                log.warn("Web Push answered {}", code)
                PushResult.FAILED
            }
        }
    } catch (e: Exception) {
        log.warn("Web Push failed: {}", e.javaClass.simpleName)
        PushResult.FAILED
    }
}

@Configuration
class PushConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    @Bean
    fun pushSender(props: AppProperties): PushSender =
        if (props.push.isLive) {
            WebPushSender(props)
        } else {
            log.warn("PUSH_MODE=log: push notifications are only logged")
            LogPushSender()
        }
}

/** F08.1 push subscriptions and delivery; subscriptions answering 404/410 are removed. */
@Service
class PushService(
    private val jdbc: JdbcClient,
    private val sender: PushSender,
    private val mapper: JsonMapper,
    private val clock: Clock,
) {
    fun subscribe(userId: UUID, req: PushSubscriptionCreate) {
        val endpoint = req.endpoint!!.trim()
        if (!endpoint.startsWith("https://")) throw ApiException.validation("Assinatura de push inválida", "endpoint")
        jdbc.sql(
            """insert into push_subscriptions(user_id, endpoint, p256dh, auth, user_agent) values (:u, :e, :p, :a, :ua)
               on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh,
               auth = excluded.auth, user_agent = excluded.user_agent""",
        ).param("u", userId).param("e", endpoint).param("p", req.keys!!.p256dh).param("a", req.keys.auth)
            .param("ua", req.userAgent?.take(300)).update()
    }

    fun unsubscribe(userId: UUID, endpoint: String) {
        jdbc.sql("delete from push_subscriptions where user_id = :u and endpoint = :e").param("u", userId).param("e", endpoint.trim()).update()
    }

    fun subscriptions(userId: UUID): List<PushSubscriptionRow> =
        jdbc.sql("select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = :u").param("u", userId)
            .query { rs, _ ->
                PushSubscriptionRow(
                    rs.getObject("id", UUID::class.java), rs.getObject("user_id", UUID::class.java), rs.getString("endpoint"),
                    rs.getString("p256dh"), rs.getString("auth"),
                )
            }.list()

    /** Sends to every subscription of the user; returns how many were delivered. */
    fun sendToUser(userId: UUID, message: PushMessage): Int {
        val payload = mapper.writeValueAsString(message)
        var delivered = 0
        for (sub in subscriptions(userId)) {
            when (sender.send(sub, payload)) {
                PushResult.SENT -> {
                    delivered++
                    jdbc.sql("update push_subscriptions set last_success_at = :t where id = :id")
                        .param("t", clock.instant().odt()).param("id", sub.id).update()
                }
                PushResult.GONE -> jdbc.sql("delete from push_subscriptions where id = :id").param("id", sub.id).update()
                PushResult.FAILED -> Unit
            }
        }
        return delivered
    }
}
