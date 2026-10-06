package br.com.querorevisar.api.common

import br.com.querorevisar.api.auth.CurrentUser
import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.web.filter.OncePerRequestFilter
import org.springframework.web.util.ContentCachingResponseWrapper
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.OffsetDateTime
import java.util.HexFormat
import java.util.UUID

/**
 * F04.3: every POST/PUT/PATCH/DELETE under /v1 needs an Idempotency-Key (UUID). The first response (status and
 * body) is stored for 24 h in idempotency_keys; the same key with the same request replays it, the same key with a
 * different request is a 409 `conflict`. 5xx responses are not stored, so a retry runs again.
 */
class IdempotencyFilter(
    private val jdbc: JdbcClient,
    private val problems: ProblemWriter,
    private val clock: Clock,
) : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        val path = request.requestURI.removePrefix(request.contextPath)
        return !path.startsWith("/v1/") || request.method !in WRITE_METHODS || path.startsWith("/v1/mock/")
    }

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val user = CurrentUser.current()
        if (user == null) {
            chain.doFilter(request, response)
            return
        }
        val rawKey = request.getHeader(HEADER)
        if (rawKey.isNullOrBlank()) {
            problems.write(request, response, ApiException.validation("Cabeçalho Idempotency-Key obrigatório.", HEADER))
            return
        }
        val key = runCatching { UUID.fromString(rawKey.trim()) }.getOrNull()
        if (key == null) {
            problems.write(request, response, ApiException.validation("Idempotency-Key precisa ser um UUID.", HEADER))
            return
        }
        val body = request.inputStream.readAllBytes()
        val hash = hash(request, body)

        if (!reserve(user.id, key, hash)) {
            val stored = jdbc.sql(
                """select request_hash, response_status, response_body::text as body, response_content_type
                   from idempotency_keys where user_id = :u and key = :k""",
            ).param("u", user.id).param("k", key).query { rs, _ ->
                Stored(rs.getString(1), rs.getObject(2) as Int?, rs.getString(3), rs.getString(4))
            }.optional().orElse(null)
            when {
                stored == null -> {
                    problems.write(request, response, ApiException.conflict("Tente de novo."))
                    return
                }
                stored.requestHash != hash -> {
                    problems.write(request, response, ApiException.conflict("Esta Idempotency-Key já foi usada em outro pedido."))
                    return
                }
                stored.status == null -> {
                    problems.write(request, response, ApiException.conflict("Este pedido ainda está sendo processado."))
                    return
                }
                else -> {
                    response.status = stored.status
                    response.setHeader("Idempotent-Replayed", "true")
                    if (stored.body != null) {
                        response.contentType = stored.contentType ?: "application/json"
                        response.outputStream.write(stored.body.toByteArray(Charsets.UTF_8))
                    }
                    return
                }
            }
        }

        val wrappedResponse = ContentCachingResponseWrapper(response)
        var failed = true
        try {
            chain.doFilter(CachedBodyRequest(request, body), wrappedResponse)
            failed = false
        } finally {
            val status = wrappedResponse.status
            try {
                if (failed || status >= 500) {
                    jdbc.sql("delete from idempotency_keys where user_id = :u and key = :k").param("u", user.id).param("k", key).update()
                } else {
                    val content = wrappedResponse.contentAsByteArray
                    val text = if (content.isEmpty()) null else String(content, Charsets.UTF_8)
                    jdbc.sql(
                        """update idempotency_keys set response_status = :s, response_body = cast(:b as jsonb),
                           response_content_type = :ct where user_id = :u and key = :k""",
                    ).param("s", status).param("b", text).param("ct", wrappedResponse.contentType)
                        .param("u", user.id).param("k", key).update()
                }
            } catch (e: Exception) {
                Redact.error(log, "Could not store the idempotent response", e)
                runCatching {
                    jdbc.sql("delete from idempotency_keys where user_id = :u and key = :k").param("u", user.id).param("k", key).update()
                }
            }
            wrappedResponse.copyBodyToResponse()
        }
    }

    /** Inserts the key; an entry older than 24 h is replaced. Returns false when the key is already taken. */
    private fun reserve(user: UUID, key: UUID, hash: String): Boolean {
        val expired = OffsetDateTime.now(clock).minus(TTL)
        jdbc.sql("delete from idempotency_keys where user_id = :u and key = :k and created_at < :t")
            .param("u", user).param("k", key).param("t", expired).update()
        return jdbc.sql(
            "insert into idempotency_keys(user_id, key, request_hash) values (:u, :k, :h) on conflict do nothing",
        ).param("u", user).param("k", key).param("h", hash).update() == 1
    }

    private fun hash(request: HttpServletRequest, body: ByteArray): String {
        val md = MessageDigest.getInstance("SHA-256")
        md.update("${request.method} ${request.requestURI}?${request.queryString ?: ""}\n".toByteArray())
        md.update(body)
        return HexFormat.of().formatHex(md.digest())
    }

    private data class Stored(val requestHash: String, val status: Int?, val body: String?, val contentType: String?)

    /** Re-readable request body for the controllers after the filter consumed it. */
    private class CachedBodyRequest(request: HttpServletRequest, private val body: ByteArray) : HttpServletRequestWrapper(request) {
        override fun getInputStream(): ServletInputStream {
            val stream = ByteArrayInputStream(body)
            return object : ServletInputStream() {
                override fun read(): Int = stream.read()
                override fun read(b: ByteArray, off: Int, len: Int): Int = stream.read(b, off, len)
                override fun isFinished(): Boolean = stream.available() == 0
                override fun isReady(): Boolean = true
                override fun setReadListener(listener: ReadListener?) = Unit
            }
        }

        override fun getReader(): BufferedReader = BufferedReader(InputStreamReader(inputStream, characterEncoding ?: "UTF-8"))

        override fun getContentLength(): Int = body.size

        override fun getContentLengthLong(): Long = body.size.toLong()
    }

    companion object {
        const val HEADER = "Idempotency-Key"
        val TTL: Duration = Duration.ofHours(24)
        private val WRITE_METHODS = setOf("POST", "PUT", "PATCH", "DELETE")
    }
}
