package br.com.querorevisar.api.account

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.HttpClients
import br.com.querorevisar.api.common.Secrets
import com.github.benmanes.caffeine.cache.Caffeine
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

/**
 * F12.3 feature flags. With POSTHOG_KEY, flags come from PostHog (`POST {host}/flags?v=2`, cached 10 min per user);
 * otherwise (or when PostHog fails) the defaults apply: apple_login off, parts_marketplace off, ads on (free plan
 * only), vehicle_lookups on, fipe_card on. Only the pseudonymous user id is sent to PostHog.
 */
@Service
class FlagsService(private val props: AppProperties) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val enabled = Secrets.isSet(props.posthog.key)
    private val cache = Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(10)).maximumSize(50_000).build<UUID, Map<String, Boolean>>()
    private val client by lazy { HttpClients.restClient(props.posthog.host.trimEnd('/'), props).build() }

    init {
        if (!enabled) log.warn("POSTHOG_KEY not set: feature flags use the defaults")
    }

    fun flags(userId: UUID, plan: Plan): Flags {
        val remote = if (enabled) cache.get(userId) { fetch(it) } else emptyMap()
        val ads = (remote["ads"] ?: true) && plan == Plan.free
        return Flags(
            appleLogin = remote["apple_login"] ?: false,
            partsMarketplace = remote["parts_marketplace"] ?: false,
            ads = ads,
            vehicleLookups = remote["vehicle_lookups"] ?: true,
            fipeCard = remote["fipe_card"] ?: true,
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun fetch(userId: UUID): Map<String, Boolean> = try {
        val body = client.post().uri("/flags?v=2").contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("api_key" to props.posthog.key, "distinct_id" to userId.toString()))
            .retrieve().body(Map::class.java) as Map<String, Any?>? ?: emptyMap()
        val flags = body["flags"] as? Map<String, Any?>
        if (flags != null) {
            flags.mapNotNull { (k, v) -> ((v as? Map<String, Any?>)?.get("enabled") as? Boolean)?.let { k to it } }.toMap()
        } else {
            // Older /decide shape: { featureFlags: { key: true|"variant" } }
            (body["featureFlags"] as? Map<String, Any?>)?.mapValues { (_, v) -> v == true || v is String }.orEmpty()
        }
    } catch (e: Exception) {
        log.warn("PostHog flags unavailable ({}); using defaults", e.javaClass.simpleName)
        emptyMap()
    }
}
