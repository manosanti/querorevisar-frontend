package br.com.querorevisar.api.account

import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * Read access to auth.users for background work (alert and billing e-mails) where no JWT is at hand. Works with the
 * Supabase auth schema and with the local stub (V0_1__auth_stub.sql).
 */
@Component
class AuthUsers(private val jdbc: JdbcClient) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** E-mail of a permanent account; null for anonymous users or when auth.users is not readable. */
    fun email(userId: UUID): String? = try {
        jdbc.sql("select email from auth.users where id = :id and coalesce(is_anonymous, false) = false")
            .param("id", userId).query(String::class.java).optional().orElse(null)?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        log.warn("auth.users not readable ({})", e.javaClass.simpleName)
        null
    }
}
