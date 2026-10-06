package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Secrets
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtTimestampValidator
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.web.client.RestTemplate
import org.springframework.web.filter.OncePerRequestFilter
import java.net.InetAddress
import java.security.MessageDigest

/**
 * `/internal/...` (Cloud Scheduler jobs): a Google OIDC ID token whose audience is INTERNAL_JOBS_AUDIENCE, or the
 * X-Internal-Token header equal to INTERNAL_TOKEN. In the local profile, without INTERNAL_TOKEN, loopback calls pass.
 */
class InternalAuthFilter(private val props: AppProperties) : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)

    private val googleDecoder: JwtDecoder? by lazy {
        val audience = props.internal.audience
        if (!Secrets.isSet(audience)) return@lazy null
        val factory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(props.http.connectTimeout)
            setReadTimeout(props.http.readTimeout)
        }
        val validator = OAuth2TokenValidator<Jwt> { jwt ->
            val issuerOk = jwt.getClaimAsString("iss") in setOf("https://accounts.google.com", "accounts.google.com")
            val audOk = jwt.audience.orEmpty().contains(audience)
            val sa = props.internal.serviceAccount
            val emailOk = sa.isBlank() || (jwt.getClaimAsString("email") == sa && jwt.claims["email_verified"] == true)
            if (issuerOk && audOk && emailOk) OAuth2TokenValidatorResult.success()
            else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "not a scheduler token", null))
        }
        NimbusJwtDecoder.withJwkSetUri(props.internal.googleJwksUrl)
            .jwsAlgorithm(SignatureAlgorithm.RS256)
            .restOperations(RestTemplate(factory))
            .build()
            .also { it.setJwtValidator(DelegatingOAuth2TokenValidator(JwtTimestampValidator(), validator)) }
    }

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        if (authorized(request)) {
            SecurityContextHolder.getContext().authentication = UsernamePasswordAuthenticationToken.authenticated(
                "internal-jobs", null, listOf(SimpleGrantedAuthority("ROLE_INTERNAL")),
            )
        }
        chain.doFilter(request, response)
    }

    private fun authorized(request: HttpServletRequest): Boolean {
        val configured = props.internal.token
        val header = request.getHeader("X-Internal-Token")
        if (Secrets.isSet(configured) && header != null &&
            MessageDigest.isEqual(header.toByteArray(), configured.toByteArray())
        ) return true
        if (!Secrets.isSet(configured) && props.internal.allowLoopback && isLoopback(request.remoteAddr)) return true
        val bearer = request.getHeader("Authorization")?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }?.substring(7)
        val decoder = googleDecoder
        if (bearer != null && decoder != null) {
            return try {
                decoder.decode(bearer)
                true
            } catch (e: Exception) {
                log.warn("Rejected internal token: {}", e.javaClass.simpleName)
                false
            }
        }
        return false
    }

    private fun isLoopback(addr: String?): Boolean =
        addr != null && runCatching { InetAddress.getByName(addr).isLoopbackAddress }.getOrDefault(false)
}
