package br.com.querorevisar.api.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

// Due-status rules from docs/domain.md#vencimento, ported from packages/core/src/due.ts.
// Both implementations run fixtures/due-status.json (DueCalculatorFixturesTest).

@Suppress("EnumEntryName")
enum class VehicleType { car, moto }

object DomainConstants {
    const val DAY_MS = 864e5
    const val MONTH_DAYS = 30.44
    const val MONTH_MS = MONTH_DAYS * DAY_MS

    /** Free plan shows the last 12 months of history. */
    const val FREE_HISTORY_DAYS = 365L

    fun initialKmPerMonth(type: VehicleType): Int = if (type == VehicleType.car) 1100 else 900

    /** Painel "Sem registro" key items (docs/domain.md). */
    val KEY_ITEMS = listOf(
        "Óleo do motor", "Filtro de óleo", "Filtro de ar", "Velas de ignição", "Fluido de freio",
        "Pastilhas de freio dianteiras", "Correia dentada", "Fluido de arrefecimento",
        "Kit relação (corrente, coroa e pinhão)",
    )
}

data class KmState(val km: Int, val kmAt: Instant, val kmPerMonth: Int)

data class IntervalItem(val id: String, val km: Int?, val months: Int?)

/** A maintenance record as the due-status math sees it. `date` is interpreted as UTC midnight. */
data class RecordLike(val itemId: String, val km: Int, val date: LocalDate?)

@Suppress("EnumEntryName")
enum class DueStatusKey(val label: String) {
    none("Sem registro"), ok("Em dia"), warn("Atenção"), over("Vencido")
}

data class DueStatus(
    val key: DueStatusKey,
    val record: RecordLike?,
    val pct: Double,
    val kmLeft: Int?,
    val monthsLeft: Double?,
    val monthsUsed: Double?,
    val byTime: Boolean,
    val dueKm: Int?,
)

object DueCalculator {
    private fun elapsedMs(now: Instant, then: Instant): Double = (now.toEpochMilli() - then.toEpochMilli()).toDouble()

    /** Midnight UTC of a YYYY-MM-DD date, like `new Date('YYYY-MM-DD')`. */
    fun dateToInstant(date: LocalDate): Instant = date.atStartOfDay().toInstant(ZoneOffset.UTC)

    /** estimatedKm = round(km + kmPerMonth × max(0, (now − kmAt) / MONTH)). */
    fun estimateKm(v: KmState, now: Instant): Int =
        PtBr.jsRound(v.km + v.kmPerMonth * maxOf(0.0, elapsedMs(now, v.kmAt) / DomainConstants.MONTH_MS)).toInt()

    /** "Km estimada" when the last informed km is older than 3 days, otherwise "Km atual". */
    fun kmLabel(v: KmState, now: Instant): String =
        if (elapsedMs(now, v.kmAt) > 3 * DomainConstants.DAY_MS) "Km estimada" else "Km atual"

    /** The record with the highest km for the item (first one wins on ties), or null. */
    fun <R : RecordLike> lastRecord(records: Iterable<R>, itemId: String): R? {
        var best: R? = null
        for (r in records) if (r.itemId == itemId && (best == null || r.km > best.km)) best = r
        return best
    }

    private fun truthy(n: Int?): Boolean = n != null && n != 0

    fun itemStatus(item: IntervalItem, records: Iterable<RecordLike>, estimatedKm: Int, now: Instant): DueStatus {
        val r = lastRecord(records, item.id)
            ?: return DueStatus(DueStatusKey.none, null, 0.0, null, null, null, false, null)
        val used = estimatedKm - r.km
        val pKm = if (truthy(item.km)) used.toDouble() / item.km!! else 0.0
        val monthsUsed = r.date?.let { elapsedMs(now, dateToInstant(it)) / DomainConstants.MONTH_MS }
        val pT = if (monthsUsed != null && truthy(item.months)) monthsUsed / item.months!! else 0.0
        val pct = maxOf(pKm, pT)
        val key = when {
            pct >= 1 -> DueStatusKey.over
            pct >= 0.8 -> DueStatusKey.warn
            else -> DueStatusKey.ok
        }
        return DueStatus(
            key = key,
            record = r,
            pct = pct,
            kmLeft = if (truthy(item.km)) item.km!! - used else null,
            monthsLeft = if (monthsUsed != null && truthy(item.months)) item.months!! - monthsUsed else null,
            monthsUsed = monthsUsed,
            byTime = pT > pKm,
            dueKm = if (truthy(item.km)) r.km + item.km!! else null,
        )
    }

    /** "{km} km ou {meses} meses", omitting what doesn't exist. */
    fun intervalText(km: Int?, months: Int?): String {
        val parts = mutableListOf<String>()
        if (truthy(km)) parts += "${PtBr.int(km!!)} km"
        if (truthy(months)) parts += "$months meses"
        return parts.joinToString(" ou ")
    }

    fun intervalText(item: IntervalItem): String = intervalText(item.km, item.months)

    fun timeText(kmLeft: Int, kmPerMonth: Int): String {
        val weeks = kmLeft / (maxOf(1, kmPerMonth) / 4.345)
        return when {
            weeks < 1.5 -> "esta semana"
            weeks < 8 -> "cerca de ${PtBr.jsRound(weeks)} semanas"
            else -> "cerca de ${PtBr.jsRound(weeks / 4.345)} meses"
        }
    }

    fun statusLine(item: IntervalItem, s: DueStatus, kmPerMonth: Int): String {
        if (s.key == DueStatusKey.none) return "A cada ${intervalText(item)}"
        if (s.key == DueStatusKey.over) {
            if (s.byTime) return "Trocado há ${PtBr.jsRound(s.monthsUsed ?: 0.0)} meses · limite ${item.months ?: ""}"
            return "Passou ${PtBr.int(-(s.kmLeft ?: 0))} km do limite"
        }
        if (s.byTime && s.monthsLeft != null) {
            return "Vence em ~${maxOf(1L, PtBr.jsRound(s.monthsLeft))} meses pelo tempo"
        }
        if (s.kmLeft == null) return "A cada ${intervalText(item)}"
        return "Faltam ~${PtBr.int(s.kmLeft)} km · ${timeText(s.kmLeft, kmPerMonth)}"
    }

    /** Badge text: "{pct}%" for warn, otherwise the status label. */
    fun statusBadge(s: DueStatus): String =
        if (s.key == DueStatusKey.warn) "${PtBr.jsRound(s.pct * 100)}%" else s.key.label

    /** Progress bar width in percent, capped at 100. */
    fun barPercent(s: DueStatus): Int =
        if (s.key == DueStatusKey.none) 0 else minOf(100L, PtBr.jsRound(s.pct * 100)).toInt()

    /** Painel "Precisa de atenção": over first, then warn, each by highest pct. */
    val attentionOrder: Comparator<DueStatus> = Comparator { a, b ->
        if (a.key == b.key) b.pct.compareTo(a.pct) else if (a.key == DueStatusKey.over) -1 else 1
    }
}
