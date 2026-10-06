package br.com.querorevisar.api.domain

import java.time.Instant

// Km update rules from docs/domain.md#km, ported from packages/core/src/km.ts (fixtures/km-update.json).

sealed interface KmUpdateResult {
    data class Ok(val km: Int, val kmAt: Instant, val kmPerMonth: Int) : KmUpdateResult

    data class Rejected(val error: String) : KmUpdateResult
}

object KmRules {
    fun belowLastRecordMessage(maxRecordKm: Int): String =
        "Km menor que a última troca registrada (${PtBr.int(maxRecordKm)} km)"

    /**
     * Saving a new panel km: rejects values below the highest record km; recalculates kmPerMonth when more than
     * half a month passed and the km went up (never below 1 km/month); otherwise keeps it.
     */
    fun applyKmUpdate(v: KmState, newKm: Int, maxRecordKm: Int, now: Instant): KmUpdateResult {
        if (newKm < maxRecordKm) return KmUpdateResult.Rejected(belowLastRecordMessage(maxRecordKm))
        val months = (now.toEpochMilli() - v.kmAt.toEpochMilli()) / DomainConstants.MONTH_MS
        val kmPerMonth = if (months > 0.5 && newKm > v.km) {
            maxOf(1L, PtBr.jsRound((newKm - v.km) / months)).toInt()
        } else {
            v.kmPerMonth
        }
        return KmUpdateResult.Ok(newKm, now, kmPerMonth)
    }

    /** "Está certo": accepts the estimate as the current km without touching kmPerMonth. */
    fun confirmEstimate(v: KmState, now: Instant): KmUpdateResult.Ok =
        KmUpdateResult.Ok(DueCalculator.estimateKm(v, now), now, v.kmPerMonth)

    /** A record above the estimated km moves the vehicle km forward (docs/domain.md#registro). */
    fun kmAfterRecord(v: KmState, recordKm: Int, now: Instant): Pair<Int, Instant>? =
        if (recordKm > DueCalculator.estimateKm(v, now)) recordKm to now else null
}
