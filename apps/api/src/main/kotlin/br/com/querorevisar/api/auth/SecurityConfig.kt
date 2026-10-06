package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.ProblemWriter
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.annotation.web.invoke
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.security.web.access.intercept.AuthorizationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import java.time.Duration

/**
 * F04.2: Supabase JWT resource server (or dev tokens in the local profile),  public routes, `/internal/...` for the
 * scheduler and CORS restricted to WEB_ORIGINS.
 */
@Configuration
@EnableWebSecurity
class SecurityConfig(private val props: AppProperties, private val problems: ProblemWriter) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Bean
    fun jwtDecoder(devTokens: DevTokens): JwtDecoder =
        if (props.auth.mode == "dev") {
            log.warn("AUTH_MODE=dev: the API issues and accepts local development tokens (/dev/auth/*)")
            devTokens.decoder()
        } else {
            SupabaseJwtDecoder(props)
        }

    private val entryPoint = AuthenticationEntryPoint { request, response, _ ->
        response.setHeader("WWW-Authenticate", "Bearer")
        problems.write(request, response, ApiException(ProblemCode.UNAUTHORIZED))
    }

    private val denied = AccessDeniedHandler { request, response, _ ->
        problems.write(
            request, response,
            ApiException(ProblemCode.UNAUTHORIZED, "Você não tem acesso a isso.", status = HttpStatus.FORBIDDEN),
        )
    }

    @Bean
    @Order(1)
    fun internalChain(http: HttpSecurity): SecurityFilterChain {
        http {
            securityMatcher("/internal/**")
            csrf { disable() }
            cors { disable() }
            sessionManagement { sessionCreationPolicy = SessionCreationPolicy.STATELESS }
            requestCache { requestCache = org.springframework.security.web.savedrequest.NullRequestCache() }
            anonymous { disable() }
            authorizeHttpRequests { authorize(anyRequest, hasRole("INTERNAL")) }
            addFilterBefore<AuthorizationFilter>(InternalAuthFilter(props))
            exceptionHandling {
                authenticationEntryPoint = entryPoint
                accessDeniedHandler = AccessDeniedHandler { request, response, _ ->
                    problems.write(request, response, ApiException(ProblemCode.UNAUTHORIZED))
                }
            }
        }
        return http.build()
    }

    @Bean
    @Order(2)
    fun apiChain(http: HttpSecurity, jwtDecoder: JwtDecoder): SecurityFilterChain {
        http {
            csrf { disable() }
            cors { }
            httpBasic { disable() }
            formLogin { disable() }
            logout { disable() }
            requestCache { requestCache = org.springframework.security.web.savedrequest.NullRequestCache() }
            sessionManagement { sessionCreationPolicy = SessionCreationPolicy.STATELESS }
            authorizeHttpRequests {
                authorize(HttpMethod.OPTIONS, "/**", permitAll)
                authorize("/actuator/health", permitAll)
                authorize("/actuator/health/**", permitAll)
                authorize(HttpMethod.GET, "/v1/catalog/version", permitAll)
                authorize(HttpMethod.POST, "/webhooks/mercadopago", permitAll)
                authorize("/dev/auth/**", permitAll)
                authorize("/v3/api-docs", permitAll)
                authorize("/v3/api-docs/**", permitAll)
                authorize("/swagger-ui/**", permitAll)
                authorize("/swagger-ui.html", permitAll)
                authorize("/error", permitAll)
                authorize(anyRequest, authenticated)
            }
            oauth2ResourceServer {
                jwt { this.jwtDecoder = jwtDecoder }
                authenticationEntryPoint = entryPoint
                accessDeniedHandler = denied
            }
            exceptionHandling {
                authenticationEntryPoint = entryPoint
                accessDeniedHandler = denied
            }
        }
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val config = CorsConfiguration().apply {
            allowedOrigins = props.webOrigins.map { it.trim().trimEnd('/') }.filter { it.isNotBlank() }
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type", "Idempotency-Key", "If-None-Match", "X-Request-Id")
            exposedHeaders = listOf("ETag", "Retry-After", "X-Request-Id", "Idempotent-Replayed")
            allowCredentials = false
            setMaxAge(Duration.ofHours(1))
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/**", config) }
    }
}
