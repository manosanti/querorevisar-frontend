package br.com.querorevisar.api.common

import br.com.querorevisar.api.auth.CurrentUserArgumentResolver
import br.com.querorevisar.api.auth.ProfileFilter
import br.com.querorevisar.api.account.ProfileService
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.web.client.RestClient
import org.springframework.web.filter.ShallowEtagHeaderFilter
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.net.http.HttpClient
import java.time.Clock
import java.time.Duration

@Configuration
class WebConfig(private val currentUserResolver: CurrentUserArgumentResolver) : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(currentUserResolver)
    }

    /** Microsecond ticks: what the API answers is exactly what Postgres (timestamptz) stores and returns. */
    @Bean
    fun clock(): Clock = Clock.tick(Clock.systemUTC(), Duration.ofNanos(1_000))

    // ---- servlet filters, in order: request id → Spring Security (-100) → profile → rate limit → ETag → idempotency

    @Bean
    fun requestIdFilter() = FilterRegistrationBean(RequestIdFilter()).apply {
        order = Ordered.HIGHEST_PRECEDENCE
        addUrlPatterns("/*")
    }

    @Bean
    fun profileFilter(profiles: ProfileService, problems: ProblemWriter) = FilterRegistrationBean(ProfileFilter(profiles, problems)).apply {
        order = 5
        addUrlPatterns("/v1/*")
    }

    @Bean
    fun rateLimitFilter(props: AppProperties, problems: ProblemWriter) = FilterRegistrationBean(RateLimitFilter(props, problems)).apply {
        order = 10
        addUrlPatterns("/v1/*")
    }

    /** ETag/304 for GET /v1/me and GET /v1/sync (F04.3). */
    @Bean
    fun etagFilter() = FilterRegistrationBean(ShallowEtagHeaderFilter()).apply {
        order = 15
        addUrlPatterns("/v1/me", "/v1/sync")
    }

    @Bean
    fun idempotencyFilter(jdbc: JdbcClient, problems: ProblemWriter, clock: Clock) =
        FilterRegistrationBean(IdempotencyFilter(jdbc, problems, clock)).apply {
            order = 20
            addUrlPatterns("/v1/*")
        }
}

/** RestClient with the timeouts every external call must have (connect 3 s, read 10 s by default). */
object HttpClients {
    fun restClient(baseUrl: String, connect: Duration, read: Duration): RestClient.Builder {
        val http = HttpClient.newBuilder()
            // HTTP/1.1 for every provider: avoids h2c upgrades on plain-HTTP endpoints (local proxies, WireMock).
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(connect)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build()
        val factory = JdkClientHttpRequestFactory(http).apply { setReadTimeout(read) }
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory)
    }

    fun restClient(baseUrl: String, props: AppProperties, read: Duration = props.http.readTimeout): RestClient.Builder =
        restClient(baseUrl, props.http.connectTimeout, read)
}
