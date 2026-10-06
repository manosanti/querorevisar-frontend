package br.com.querorevisar.api.domain

import br.com.querorevisar.api.support.Fixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.time.Instant

/** fixtures/km-update.json (docs/domain.md#km), shared with packages/core. */
class KmRulesFixturesTest {
    private val fx = Fixtures.read("km-update.json")
    private val now = Instant.parse(fx["now"].asString())
    private val day = 86_400_000L

    @TestFactory
    fun `km update`(): List<DynamicTest> = fx["cases"].values().map { c ->
        DynamicTest.dynamicTest(c["name"].asString()) {
            val v = c["vehicle"]
            val state = KmState(v["km"].asInt(), Instant.parse(v["kmAt"].asString()), v["kmPerMonth"].asInt())
            val out = KmRules.applyKmUpdate(state, c["newKm"].asInt(), c["maxRecordKm"].asInt(), now)
            val e = c["expected"]
            if (e.has("error")) {
                assertEquals(KmUpdateResult.Rejected(e["error"].asString()), out)
            } else {
                assertEquals(KmUpdateResult.Ok(e["km"].asInt(), Instant.parse(e["kmAt"].asString()), e["kmPerMonth"].asInt()), out)
            }
        }
    }

    @Test
    fun `Esta certo keeps kmPerMonth and stores the estimate`() {
        val v = KmState(48000, now.minusMillis(61 * day), 1100)
        assertEquals(KmUpdateResult.Ok(DueCalculator.estimateKm(v, now), now, 1100), KmRules.confirmEstimate(v, now))
    }

    @Test
    fun `a record above the estimate moves the vehicle km forward`() {
        val v = KmState(48000, now, 1100)
        assertEquals(49000 to now, KmRules.kmAfterRecord(v, 49000, now))
        assertNull(KmRules.kmAfterRecord(v, 47000, now))
    }

    @Test
    fun `kmPerMonth never drops below 1`() {
        val v = KmState(1000, now.minusMillis(400 * day), 1100)
        val out = KmRules.applyKmUpdate(v, 1001, 0, now) as KmUpdateResult.Ok
        assertEquals(1, out.kmPerMonth)
    }
}
