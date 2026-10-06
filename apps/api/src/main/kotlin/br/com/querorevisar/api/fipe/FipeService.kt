package br.com.querorevisar.api.fipe

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.Zones
import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.domain.PtBr
import br.com.querorevisar.api.domain.VehicleType
import br.com.querorevisar.api.vehicles.VehicleRepository
import br.com.querorevisar.api.vehicles.VehicleRow
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@ApiDto
data class VehicleFipe(
    val valueCents: Long,
    /** e.g. "outubro de 2026". */
    val referenceMonth: String,
    /** Percentage; 1.2 means +1,2%. 0 without a previous reference month. */
    val deltaPct30d: Double,
    val updatedAt: Instant,
)

/** A cached FIPE price for a vehicle. */
data class FipeQuoteRow(val fipeCode: String, val yearCode: String, val valueCents: Long, val referenceMonth: String, val fetchedAt: Instant)

/**
 * F10.1: FIPE lists (brands/models/years, 30-day cache in fipe_reference), vehicle prices (7-day cache in
 * fipe_prices), our own monthly history (fipe_price_history) for the 30-day variation and a daily request budget
 * (FIPE_DAILY_BUDGET) after which stale cache is served.
 */
@Service
class FipeService(
    private val client: FipeClient,
    private val jdbc: JdbcClient,
    private val mapper: JsonMapper,
    private val props: AppProperties,
    private val clock: Clock,
    private val vehicles: VehicleRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val optionsType = object : TypeReference<List<FipeOption>>() {}
    private val codePattern = Regex("^[0-9A-Za-z-]{1,24}$")

    private fun unavailable() = ApiException(ProblemCode.PROVIDER_UNAVAILABLE, "A tabela FIPE está indisponível no momento.")

    fun brands(type: VehicleType): List<FipeOption> {
        val t = FipeClient.apiType(type)
        return reference("$t/brands") { client.brands(t) }
    }

    fun models(type: VehicleType, brand: String): List<FipeOption> {
        checkCode(brand)
        val t = FipeClient.apiType(type)
        return reference("$t/brands/$brand/models") { client.models(t, brand) }
    }

    fun years(type: VehicleType, brand: String, model: String): List<FipeOption> {
        checkCode(brand)
        checkCode(model)
        val t = FipeClient.apiType(type)
        return reference("$t/brands/$brand/models/$model/years") { client.years(t, brand, model) }
    }

    private fun checkCode(code: String) {
        if (!codePattern.matches(code)) throw ApiException.notFound()
    }

    private fun reference(key: String, fetch: () -> List<FipeOption>): List<FipeOption> {
        val cached = jdbc.sql("select data::text as data, fetched_at from fipe_reference where key = :k").param("k", key)
            .query { rs, _ -> mapper.readValue(rs.getString("data"), optionsType) to rs.instantOrThrow("fetched_at") }
            .optional().orElse(null)
        val now = clock.instant()
        if (cached != null && cached.second.isAfter(now.minus(Duration.ofDays(props.fipe.referenceCacheDays)))) return cached.first
        if (!consumeBudget()) return cached?.first ?: throw unavailable()
        return try {
            val fresh = fetch()
            jdbc.sql(
                """insert into fipe_reference(key, data, fetched_at) values (:k, cast(:d as jsonb), :t)
                   on conflict (key) do update set data = excluded.data, fetched_at = excluded.fetched_at""",
            ).param("k", key).param("d", mapper.writeValueAsString(fresh)).param("t", now.odt()).update()
            fresh
        } catch (e: FipeUnavailableException) {
            log.warn("FIPE list {} unavailable: {}", key, e.message)
            cached?.first ?: throw unavailable()
        }
    }

    /** Counts one external call against FIPE_DAILY_BUDGET (São Paulo day). False when the budget is exhausted. */
    fun consumeBudget(): Boolean {
        val day = LocalDate.now(clock.withZone(Zones.SAO_PAULO))
        val calls = jdbc.sql(
            """insert into fipe_usage(day, calls) values (:d, 1)
               on conflict (day) do update set calls = fipe_usage.calls + 1 where fipe_usage.calls < :b
               returning calls""",
        ).param("d", day).param("b", props.fipe.dailyBudget).query(Int::class.java).optional()
        val ok = calls.isPresent && calls.get() <= props.fipe.dailyBudget
        if (!ok) log.warn("FIPE daily budget ({}) exhausted; serving cached data", props.fipe.dailyBudget)
        return ok
    }

    fun remainingBudget(): Int {
        val day = LocalDate.now(clock.withZone(Zones.SAO_PAULO))
        val used = jdbc.sql("select calls from fipe_usage where day = :d").param("d", day).query(Int::class.java).optional().orElse(0)
        return maxOf(0, props.fipe.dailyBudget - used)
    }

    fun hasFipeData(v: VehicleRow): Boolean =
        v.fipeYearCode != null && (v.fipeCode != null || (v.fipeBrandCode != null && v.fipeModelCode != null))

    /** GET /v1/vehicles/{id}/fipe. */
    fun vehicleFipe(userId: UUID, vehicleId: UUID): VehicleFipe {
        val v = vehicles.find(userId, vehicleId) ?: throw ApiException.notFound("Veículo não encontrado.")
        if (!hasFipeData(v)) throw ApiException.notFound("Este veículo não tem os códigos da tabela FIPE.")
        val quote = quote(v, allowFetch = true) ?: throw unavailable()
        return VehicleFipe(quote.valueCents, quote.referenceMonth, deltaPct(quote), quote.fetchedAt)
    }

    /**
     * The vehicle's FIPE price: from fipe_prices when younger than FIPE_CACHE_DAYS, otherwise fetched (within the
     * budget) and recorded in fipe_price_history. Falls back to the stale cache; null when nothing is known.
     */
    fun quote(v: VehicleRow, allowFetch: Boolean): FipeQuoteRow? {
        val year = v.fipeYearCode ?: return null
        val cached = v.fipeCode?.let { cachedPrice(it, year) }
        val now = clock.instant()
        if (cached != null && cached.fetchedAt.isAfter(now.minus(Duration.ofDays(props.fipe.cacheDays)))) return cached
        if (!allowFetch || !consumeBudget()) return cached
        val t = FipeClient.apiType(v.type)
        return try {
            val price = if (v.fipeCode != null) {
                client.priceByCode(t, v.fipeCode, year)
            } else {
                client.price(t, v.fipeBrandCode!!, v.fipeModelCode!!, year)
            }
            if (v.fipeCode != price.fipeCode) vehicles.setFipeCode(v.id, price.fipeCode)
            store(price, year, now)
        } catch (e: FipeUnavailableException) {
            log.warn("FIPE price unavailable: {}", e.message)
            cached
        }
    }

    private fun cachedPrice(fipeCode: String, year: String): FipeQuoteRow? =
        jdbc.sql("select * from fipe_prices where fipe_code = :c and year_code = :y").param("c", fipeCode).param("y", year)
            .query { rs, _ ->
                FipeQuoteRow(
                    rs.getString("fipe_code"), rs.getString("year_code"), rs.getLong("value_cents"),
                    rs.getString("reference_month"), rs.instantOrThrow("fetched_at"),
                )
            }.optional().orElse(null)

    private fun store(price: FipePrice, year: String, now: Instant): FipeQuoteRow {
        jdbc.sql(
            """insert into fipe_prices(fipe_code, year_code, value_cents, reference_month, fetched_at)
               values (:c, :y, :v, :m, :t) on conflict (fipe_code, year_code) do update set value_cents = excluded.value_cents,
               reference_month = excluded.reference_month, fetched_at = excluded.fetched_at""",
        ).param("c", price.fipeCode).param("y", year).param("v", price.valueCents).param("m", price.referenceMonth)
            .param("t", now.odt()).update()
        jdbc.sql(
            """insert into fipe_price_history(fipe_code, year_code, reference_month, value_cents) values (:c, :y, :m, :v)
               on conflict (fipe_code, year_code, reference_month) do update set value_cents = excluded.value_cents""",
        ).param("c", price.fipeCode).param("y", year).param("m", price.referenceMonth).param("v", price.valueCents).update()
        return FipeQuoteRow(price.fipeCode, year, price.valueCents, price.referenceMonth, now)
    }

    /** (current − previous reference month) / previous × 100, rounded to 2 decimals; 0 without history. */
    fun deltaPct(q: FipeQuoteRow): Double {
        val current = PtBr.parseMonthYear(q.referenceMonth) ?: return 0.0
        val previous = jdbc.sql("select reference_month, value_cents from fipe_price_history where fipe_code = :c and year_code = :y")
            .param("c", q.fipeCode).param("y", q.yearCode)
            .query { rs, _ -> PtBr.parseMonthYear(rs.getString(1)) to rs.getLong(2) }.list()
            .filter { it.first != null && it.first!! < current }
            .maxByOrNull { it.first!! } ?: return 0.0
        if (previous.second <= 0) return 0.0
        val pct = (q.valueCents - previous.second) * 100.0 / previous.second
        return Math.round(pct * 100) / 100.0
    }

    /** Job fipe-refresh: vehicles whose price is older than FIPE_CACHE_DAYS, within the remaining budget. */
    fun refreshStale(): Map<String, Any> {
        val cutoff = clock.instant().minus(Duration.ofDays(props.fipe.cacheDays))
        val candidates = vehicles.allActive().filter { hasFipeData(it) }
        var refreshed = 0
        var skipped = 0
        val seen = HashSet<String>()
        for (v in candidates) {
            val key = "${v.fipeCode ?: (v.fipeBrandCode + "/" + v.fipeModelCode)}:${v.fipeYearCode}"
            if (!seen.add(key)) continue
            val cached = v.fipeCode?.let { cachedPrice(it, v.fipeYearCode!!) }
            if (cached != null && cached.fetchedAt.isAfter(cutoff)) continue
            if (remainingBudget() <= 0) {
                skipped++
                continue
            }
            val q = quote(v, allowFetch = true)
            if (q != null && q.fetchedAt.isAfter(cutoff)) refreshed++ else skipped++
        }
        return mapOf("vehicles" to candidates.size, "refreshed" to refreshed, "skipped" to skipped)
    }
}
