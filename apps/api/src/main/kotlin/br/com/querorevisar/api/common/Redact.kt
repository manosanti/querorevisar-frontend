package br.com.querorevisar.api.common

import org.slf4j.Logger

/** LGPD helpers: e-mails, plates and tokens never reach the logs (CLAUDE.md). */
object Redact {
    private val EMAIL = Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
    private val PLATE = Regex("\\b([A-Z]{3}[0-9])[A-Z0-9][0-9]{2}\\b")
    private val JWT = Regex("eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+")
    private val BEARER = Regex("(?i)(bearer\\s+)[A-Za-z0-9._~+/=-]+")

    fun text(s: String?): String? = s
        ?.replace(JWT, "<jwt>")
        ?.replace(BEARER, "$1<token>")
        ?.replace(EMAIL, "<email>")
        ?.replace(PLATE, "$1***")

    /** "a***@d***.com" style, for the rare case where a hint helps support. */
    fun email(email: String?): String = if (email.isNullOrBlank()) "-" else "<email>"

    /** Logs an exception with its message redacted (stack trace kept). */
    fun error(log: Logger, message: String, ex: Throwable) {
        log.error(message, redacted(ex))
    }

    /**
     * The exception and up to 5 causes with redacted messages. Built from the deepest cause up: a cause given to the
     * constructor (even null) can't be replaced by initCause, which threw here and hid the original error.
     */
    internal fun redacted(ex: Throwable, depth: Int = 0): Throwable {
        val cause = ex.cause?.takeIf { depth < 5 }?.let { redacted(it, depth + 1) }
        return RedactedException("${ex.javaClass.name}: ${text(ex.message)}", cause).also { it.stackTrace = ex.stackTrace }
    }

    private class RedactedException(message: String, cause: Throwable?) : RuntimeException(message, cause, false, true)
}
