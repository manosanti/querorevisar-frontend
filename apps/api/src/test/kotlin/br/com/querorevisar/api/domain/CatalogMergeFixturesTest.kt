package br.com.querorevisar.api.domain

import br.com.querorevisar.api.support.Fixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** fixtures/catalog-merge.json with data/catalog.json and data/planos.json (tolerant FIPE-name plan lookup). */
class CatalogMergeFixturesTest {
    private val catalog: CatalogData = Fixtures.mapper.readValue(Fixtures.data("catalog.json"), CatalogData::class.java)
    private val plans: List<ManufacturerPlanData> = Fixtures.mapper.readTree(Fixtures.data("planos.json"))["plans"]
        .values().map { Fixtures.mapper.treeToValue(it, ManufacturerPlanData::class.java) }

    private data class Picked(val id: String, val km: Int?, val months: Int?, val source: String)

    @Test
    fun `seed keeps every prototype item`() {
        assertEquals(33, catalog.categories.size)
        assertEquals(196, catalog.total)
        assertEquals(catalog.total, catalog.categories.sumOf { it.items.size })
        assertEquals(1, plans.size)
    }

    @TestFactory
    fun `catalog for vehicle`(): List<DynamicTest> = Fixtures.read("catalog-merge.json")["cases"].values().map { c ->
        val v = c["vehicle"]
        DynamicTest.dynamicTest("${v["brand"].asString()} ${v["model"].asString()}") {
            val items = CatalogMerge.catalogForVehicle(
                catalog, plans, VehicleType.valueOf(v["type"].asString()), v["brand"].asString(), v["model"].asString(),
            )
            fun pick(n: tools.jackson.databind.JsonNode) =
                Picked(n["id"].asString(), n["km"].takeIf { !it.isNull }?.asInt(), n["months"].takeIf { !it.isNull }?.asInt(), n["source"].asString())
            fun pick(i: CatalogItem) = Picked(i.id, i.km, i.months, i.source)
            assertEquals(c["count"].asInt(), items.size, "count")
            assertEquals(c["overridden"].values().map { pick(it) }, items.filter { it.source != CatalogMerge.DEFAULT_SOURCE }.map { pick(it) }, "overridden")
            assertEquals(c["sample"].values().map { pick(it) }, items.take(5).map { pick(it) }, "sample")
        }
    }

    @Test
    fun `plan lookup tolerates FIPE names but not other models`() {
        assertEquals("bajaj-pulsar-n150", CatalogMerge.findPlan(plans, "BAJAJ", "PULSAR N150 160")?.id)
        assertEquals("bajaj-pulsar-n150", CatalogMerge.findPlan(plans, "Bajaj", "Pulsar N150")?.id)
        assertNull(CatalogMerge.findPlan(plans, "Bajaj", "Pulsar N1500"))
        assertNull(CatalogMerge.findPlan(plans, "Honda", "CG 160"))
    }
}
