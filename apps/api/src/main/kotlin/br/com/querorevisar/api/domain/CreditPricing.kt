package br.com.querorevisar.api.domain

// Credit packs and pricing (docs/domain.md#créditos), ported from packages/core/src/credits.ts.
// ✏️ Prices are owner decisions (PENDENCIAS.md).

data class CreditPackDef(val id: String, val credits: Int, val priceCents: Int, val tag: String? = null)

object CreditPricing {
    const val DEFAULT_UNIT_PRICE_CENTS = 490

    val PACKS = listOf(
        CreditPackDef("pack-1", 1, 490),
        CreditPackDef("pack-5", 5, 2190),
        CreditPackDef("pack-12", 12, 4790, "Mais escolhido"),
        CreditPackDef("pack-30", 30, 10490),
    )

    /** Index of the highlighted pack ("Mais escolhido"), pre-selected when nothing is missing. */
    const val DEFAULT_PACK_INDEX = 2

    fun find(id: String): CreditPackDef? = PACKS.firstOrNull { it.id == id }

    fun unitPriceCents(p: CreditPackDef): Int = PtBr.jsRound(p.priceCents.toDouble() / p.credits).toInt()

    /** "Economia de N%": N = round((1 − price / (n × unit)) × 100). */
    fun discountPct(p: CreditPackDef, unit: Int = DEFAULT_UNIT_PRICE_CENTS): Int =
        PtBr.jsRound((1 - p.priceCents.toDouble() / (p.credits * unit)) * 100).toInt()

    /** Smallest pack that covers `missing` credits; the highlighted pack when nothing is missing. */
    fun packIndexFor(missing: Int): Int {
        if (missing == 0) return DEFAULT_PACK_INDEX
        val i = PACKS.indexOfFirst { it.credits >= missing }
        return if (i < 0) PACKS.size - 1 else i
    }
}
