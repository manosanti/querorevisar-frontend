package br.com.querorevisar.api.auth

import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.ProblemWriter
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.web.filter.OncePerRequestFilter

/** Upserts the `profiles` row on the first authenticated request and tags the logs with the (pseudonymous) user id. */
class ProfileFilter(private val profiles: ProfileService, private val problems: ProblemWriter) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val user = CurrentUser.current()
        if (user != null) {
            MDC.put("userId", user.id.toString())
            try {
                profiles.ensure(user)
            } catch (e: ApiException) {
                problems.write(request, response, e)
                return
            }
        }
        chain.doFilter(request, response)
    }
}
