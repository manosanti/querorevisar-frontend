package br.com.querorevisar.api.common

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID

/** Puts a request id in the MDC (structured logs) and echoes it in X-Request-Id. */
class RequestIdFilter : OncePerRequestFilter() {
    private val valid = Regex("^[A-Za-z0-9._-]{8,64}$")

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val incoming = request.getHeader(HEADER)?.takeIf { valid.matches(it) }
        val id = incoming ?: UUID.randomUUID().toString()
        MDC.put(MDC_KEY, id)
        response.setHeader(HEADER, id)
        try {
            chain.doFilter(request, response)
        } finally {
            MDC.remove(MDC_KEY)
            MDC.remove("userId")
        }
    }

    companion object {
        const val HEADER = "X-Request-Id"
        const val MDC_KEY = "requestId"
    }
}
