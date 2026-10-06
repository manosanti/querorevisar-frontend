package br.com.querorevisar.api.common

import br.com.querorevisar.api.auth.CurrentUser
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import io.github.bucket4j.Bandwidth
import io.github.bucket4j.Bucket
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Duration

/**
 * F04.3 in-memory limits per user (Bucket4j): reads 300/min, writes 60/min, purchases 10/min, vehicle lookups
 * 20/min. Over the limit → 429 `rate-limited` with Retry-After (seconds).
 */
class RateLimitFilter(private val props: AppProperties, private val problems: ProblemWriter) : OncePerRequestFilter() {
    enum class Category { READS, WRITES, PURCHASES, LOOKUPS }

    private val buckets: Cache<String, Bucket> = Caffeine.newBuilder()
        .expireAfterAccess(Duration.ofMinutes(10))
        .maximumSize(200_000)
        .build()

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !props.rateLimit.enabled || !request.requestURI.removePrefix(request.contextPath).startsWith("/v1/")

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        // Public reads (catalog version) are cached and cheap; limits apply per authenticated user.
        val user = CurrentUser.current()
        if (user == null) {
            chain.doFilter(request, response)
            return
        }
        val category = categoryOf(request.method, request.requestURI.removePrefix(request.contextPath))
        val bucket = buckets.get("${category.name}:${user.id}") { newBucket(limitOf(category)) }
        val probe = bucket.tryConsumeAndReturnRemaining(1)
        if (!probe.isConsumed) {
            val seconds = maxOf(1L, Math.ceil(probe.nanosToWaitForRefill / 1e9).toLong())
            problems.write(
                request, response,
                ApiException(ProblemCode.RATE_LIMITED, headers = mapOf("Retry-After" to seconds.toString())),
            )
            return
        }
        chain.doFilter(request, response)
    }

    private fun limitOf(c: Category): Long = when (c) {
        Category.READS -> props.rateLimit.readsPerMinute
        Category.WRITES -> props.rateLimit.writesPerMinute
        Category.PURCHASES -> props.rateLimit.purchasesPerMinute
        Category.LOOKUPS -> props.rateLimit.lookupsPerMinute
    }

    private fun newBucket(perMinute: Long): Bucket = Bucket.builder()
        .addLimit(Bandwidth.builder().capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)).build())
        .build()

    companion object {
        fun categoryOf(method: String, path: String): Category = when {
            method == "GET" || method == "HEAD" -> Category.READS
            method == "POST" && path == "/v1/lookups" -> Category.LOOKUPS
            method == "POST" && (path == "/v1/credits/purchases" || path == "/v1/billing/premium/checkout") -> Category.PURCHASES
            else -> Category.WRITES
        }
    }
}
