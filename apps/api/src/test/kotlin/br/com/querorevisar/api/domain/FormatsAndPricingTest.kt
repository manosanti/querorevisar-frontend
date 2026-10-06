package br.com.querorevisar.api.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.YearMonth

class FormatsAndPricingTest {
    @Test
    fun `pt-BR integers never print -0`() {
        assertEquals("48.000", PtBr.int(48000))
        assertEquals("1.000", PtBr.int(1000))
        assertEquals("999", PtBr.int(999))
        assertEquals("0", PtBr.int(-0.0))
        assertEquals("0", PtBr.int(-0.4))
        assertEquals("-2.300", PtBr.int(-2300))
        assertEquals("1.234.567", PtBr.int(1234567))
    }

    @Test
    fun `money in cents with a no-break space`() {
        assertEquals("R$ 14,90", PtBr.money(1490))
        assertEquals("R$ 64.230,00", PtBr.money(6423000))
        assertEquals("R$ 0,05", PtBr.money(5))
    }

    @Test
    fun `parses FIPE prices to cents`() {
        assertEquals(6240000L, PtBr.parseMoneyToCents("R$ 62.400,00"))
        assertEquals(8475300L, PtBr.parseMoneyToCents("R$ 84.753,00"))
        assertEquals(18990L, PtBr.parseMoneyToCents("189,90"))
        assertNull(PtBr.parseMoneyToCents(""))
        assertNull(PtBr.parseMoneyToCents(null))
    }

    @Test
    fun `reference months in pt-BR`() {
        assertEquals("outubro de 2026", PtBr.monthYear(YearMonth.of(2026, 10)))
        assertEquals("março de 2026", PtBr.monthYear(YearMonth.of(2026, 3)))
        assertEquals(YearMonth.of(2026, 3), PtBr.parseMonthYear("março de 2026"))
        assertEquals(YearMonth.of(2026, 10), PtBr.parseMonthYear(" Outubro de 2026 "))
        assertNull(PtBr.parseMonthYear("2026-10"))
    }

    @Test
    fun `normalizes text for plan matching`() {
        assertEquals("oleo do motor", PtBr.normalizeText("Óleo do Motor"))
        assertEquals("", PtBr.normalizeText(null))
    }

    @Test
    fun plates() {
        assertEquals("ABC1D23", Plates.normalize("abc-1d23x"))
        assertTrue(Plates.isValid("ABC1D23"))
        assertTrue(Plates.isValid("ABC1234"))
        assertFalse(Plates.isValid("AB1D234"))
        assertEquals("ABC1***", Plates.mask("ABC1D23"))
        assertEquals("Placa inválida. Use o formato ABC1D23", Plates.ERROR)
    }

    @Test
    fun `credit packs like the prototype`() {
        val out = CreditPricing.PACKS.map { listOf(it.credits, CreditPricing.unitPriceCents(it), CreditPricing.discountPct(it)) }
        assertEquals(listOf(listOf(1, 490, 0), listOf(5, 438, 11), listOf(12, 399, 19), listOf(30, 350, 29)), out)
        assertEquals(listOf("pack-1", "pack-5", "pack-12", "pack-30"), CreditPricing.PACKS.map { it.id })
        assertEquals(listOf(490, 2190, 4790, 10490), CreditPricing.PACKS.map { it.priceCents })
        assertEquals("Mais escolhido", CreditPricing.PACKS[2].tag)
        assertEquals(2, CreditPricing.packIndexFor(0))
        assertEquals(0, CreditPricing.packIndexFor(1))
        assertEquals(1, CreditPricing.packIndexFor(4))
        assertEquals(2, CreditPricing.packIndexFor(6))
        assertEquals(3, CreditPricing.packIndexFor(99))
    }

    @Test
    fun `lookup products and summary`() {
        assertEquals(listOf(6, 2, 3, 2, 1, 0), LookupCatalog.PRODUCTS.map { it.credits })
        val sections = listOf(
            LookupSection("leilao", "Leilão e sinistro", listOf(LookupRow("Leilão", "Consta em 2023", Tone.over))),
            LookupSection("debitos", "Débitos", listOf(LookupRow("Multas", "2 em aberto", Tone.warn))),
        )
        assertEquals(LookupResultSummary(2, "2 pontos de atenção: leilão, multas", Tone.over), LookupCatalog.summary(sections))
        assertEquals(LookupResultSummary(0, "Nada consta nas bases consultadas", Tone.ok), LookupCatalog.summary(emptyList()))
    }
}
