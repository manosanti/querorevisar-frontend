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
        val safe = RedactedException("${ex.javaClass.name}: ${text(ex.message)}")
        safe.stackTrace = ex.stackTrace
        var cause = ex.cause
        var current: Throwable = safe
        var depth = 0
        while (cause != null && depth < 5) {
            val c = RedactedException("${cause.javaClass.name}: ${text(cause.message)}")
            c.stackTrace = cause.stackTrace
            current.initCause(c)
            current = c
            cause = cause.cause
            depth++
        }
        log.error(message, safe)
    }

    private class RedactedException(message: String) : RuntimeException(message, null, false, true) {
        private var causeSet = false

        @Synchronized
        override fun initCause(cause: Throwable?): Throwable {
            if (causeSet) return this
            causeSet = true
            return super.initCause(cause)
        }
    }
}
