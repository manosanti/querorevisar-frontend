package br.com.querorevisar.api.domain

import java.text.Normalizer
import java.time.YearMonth

/** pt-BR formatting helpers, mirroring packages/core/src/format.ts. Money is carried in cents. */
object PtBr {
    private const val NBSP = ' '

    /** JavaScript `Math.round`: halves go up (towards +infinity). */
    fun jsRound(x: Double): Long = Math.round(x)

    /** Rounded integer with pt-BR grouping ("48.000"). Never prints "-0". */
    fun int(n: Double): String = group(jsRound(n))

    fun int(n: Long): String = group(n)

    fun int(n: Int): String = group(n.toLong())

    private fun group(v: Long): String {
        if (v == 0L) return "0"
        val digits = Math.abs(v).toString()
        val sb = StringBuilder()
        digits.forEachIndexed { i, c ->
            if (i > 0 && (digits.length - i) % 3 == 0) sb.append('.')
            sb.append(c)
        }
        return if (v < 0) "-$sb" else sb.toString()
    }

    /** "R$ 14,90" with a no-break space after R$, like Intl.NumberFormat('pt-BR', BRL). */
    fun money(cents: Long): String {
        val abs = Math.abs(cents)
        val text = "R$" + NBSP + group(abs / 100) + "," + (abs % 100).toString().padStart(2, '0')
        return if (cents < 0) "-$text" else text
    }

    /** Parses "R$ 62.400,00" (FIPE) into cents; null when there is no number. */
    fun parseMoneyToCents(text: String?): Long? {
        if (text.isNullOrBlank()) return null
        val cleaned = text.replace(Regex("[^0-9,.-]"), "")
        if (cleaned.isEmpty()) return null
        val normalized = cleaned.replace(".", "").replace(',', '.')
        val value = normalized.toBigDecimalOrNull() ?: return null
        return value.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).toLong()
    }

    /** Lowercase, accent-free text for search and plan matching. */
    fun normalizeText(s: String?): String =
        Normalizer.normalize((s ?: "").lowercase(), Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "")

    fun credits(n: Int): String = if (n == 1) "1 crédito" else "$n créditos"

    val MONTHS = listOf(
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    )

    /** "outubro de 2026". */
    fun monthYear(ym: YearMonth): String = "${MONTHS[ym.monthValue - 1]} de ${ym.year}"

    /** Parses "outubro de 2026" (FIPE reference month); null when the text is not in that shape. */
    fun parseMonthYear(text: String?): YearMonth? {
        val m = Regex("^\\s*([\\p{L}]+)\\s+de\\s+(\\d{4})\\s*$").find(normalizeText(text)) ?: return null
        val idx = MONTHS.map { normalizeText(it) }.indexOf(m.groupValues[1])
        if (idx < 0) return null
        return YearMonth.of(m.groupValues[2].toInt(), idx + 1)
    }
}
