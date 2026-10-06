package br.com.querorevisar.api.domain

import br.com.querorevisar.api.support.Fixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import tools.jackson.databind.JsonNode
import java.time.Instant
import java.time.LocalDate

/** F05.2: the Kotlin port runs the same fixtures/due-status.json as packages/core (every expected field). */
class DueCalculatorFixturesTest {
    private val fx = Fixtures.read("due-status.json")
    private val now = Instant.parse(fx["now"].asString())

    private fun JsonNode.intOrNull(): Int? = if (isNull || isMissingNode) null else asInt()

    private fun JsonNode.doubleOrNull(): Double? = if (isNull || isMissingNode) null else asDouble()

    @Test
    fun `has at least 30 cases`() {
        assertTrue(fx["cases"].size() >= 30)
        assertEquals(30.44, fx["monthDays"].asDouble())
        assertEquals(30.44, DomainConstants.MONTH_DAYS)
    }

    @TestFactory
    fun `due status`(): List<DynamicTest> = fx["cases"].values().map { c ->
        DynamicTest.dynamicTest(c["name"].asString()) {
            val v = c["vehicle"]
            val vehicle = KmState(v["km"].asInt(), Instant.parse(v["kmAt"].asString()), v["kmPerMonth"].asInt())
            val i = c["item"]
            val item = IntervalItem(i["id"].asString(), i["km"].intOrNull(), i["months"].intOrNull())
            val records = c["records"].values().map { r ->
                RecordLike(r["itemId"].asString(), r["km"].asInt(), r["date"].takeIf { !it.isNull }?.let { LocalDate.parse(it.asString()) })
            }
            val e = c["expected"]

            val est = DueCalculator.estimateKm(vehicle, now)
            assertEquals(e["estimatedKm"].asInt(), est, "estimatedKm")
            val s = DueCalculator.itemStatus(item, records, est, now)
            assertEquals(e["status"].asString(), s.key.name, "status")
            assertEquals(e["recordKm"].intOrNull(), s.record?.km, "recordKm")
            val pct = e["pct"].doubleOrNull()
            if (pct == null) assertEquals(0.0, s.pct, "pct") else assertEquals(pct, s.pct, 1e-5, "pct")
            assertEquals(e["kmLeft"].intOrNull(), s.kmLeft, "kmLeft")
            val monthsLeft = e["monthsLeft"].doubleOrNull()
            if (monthsLeft == null) assertNull(s.monthsLeft, "monthsLeft") else assertEquals(monthsLeft, s.monthsLeft!!, 1e-5, "monthsLeft")
            assertEquals(e["byTime"].asBoolean(), s.byTime, "byTime")
            assertEquals(e["dueKm"].intOrNull(), s.dueKm, "dueKm")
            assertEquals(e["line"].asString(), DueCalculator.statusLine(item, s, vehicle.kmPerMonth), "line")
            assertEquals(e["badge"].asString(), DueCalculator.statusBadge(s), "badge")
            assertEquals(e["barPct"].asInt(), DueCalculator.barPercent(s), "barPct")
            assertEquals(e["intervalText"].asString(), DueCalculator.intervalText(item), "intervalText")
        }
    }

    @Test
    fun `attention order puts over first, then the highest pct`() {
        fun st(key: DueStatusKey, pct: Double) = DueStatus(key, null, pct, null, null, null, false, null)
        val sorted = listOf(st(DueStatusKey.warn, 0.9), st(DueStatusKey.over, 1.1), st(DueStatusKey.warn, 0.95), st(DueStatusKey.over, 1.5))
            .sortedWith(DueCalculator.attentionOrder)
        assertEquals(listOf(1.5, 1.1, 0.95, 0.9), sorted.map { it.pct })
    }

    @Test
    fun `km label is estimated after 3 days`() {
        val day = 86_400_000L
        assertEquals("Km atual", DueCalculator.kmLabel(KmState(1, now.minusMillis(2 * day), 1), now))
        assertEquals("Km estimada", DueCalculator.kmLabel(KmState(1, now.minusMillis(4 * day), 1), now))
    }
}
