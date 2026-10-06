package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.domain.LookupAssembler
import br.com.querorevisar.api.domain.LookupCatalog
import br.com.querorevisar.api.domain.LookupData
import br.com.querorevisar.api.domain.LookupPart
import br.com.querorevisar.api.domain.LookupProductId
import br.com.querorevisar.api.domain.LookupResultSummary
import br.com.querorevisar.api.domain.LookupSection
import br.com.querorevisar.api.support.Fixtures
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.time.Instant
import java.time.ZoneId

/** fixtures/lookup-mock.json: the mock provider reproduces the prototype exactly (sections, rows, summary). */
class LookupMockFixturesTest {
    private val fx = Fixtures.read("lookup-mock.json")
    private val now = Instant.parse(fx["now"].asString())
    private val provider = MockVehicleDataProvider()

    @TestFactory
    fun `mock provider`(): List<DynamicTest> = fx["cases"].mapIndexed { i, c ->
        val input = c["input"]
        DynamicTest.dynamicTest("#$i ${input["product"].asString()} mine=${input["mine"].asBoolean()}") {
            val plate = input["plate"].asString()
            val mine = input["mine"].asBoolean()
            assertEquals(c["plateHash"].asInt(), MockVehicleDataProvider.plateHash(plate), "plateHash")
            val my = fx["myVehicle"]
            val own = if (mine) OwnVehicle(my["model"].asString(), my["year"].asString(), my["color"].asString(), my["fipeCents"].asLong()) else null
            val q = PlateQuery(plate, mine, own, now)
            val product = LookupCatalog.product(LookupProductId.valueOf(input["product"].asString()))
            val parts = product.parts.toSet()
            val data = LookupData(
                basic = provider.basic(q),
                restrictions = if (LookupPart.restricoes in parts) provider.restrictions(q) else null,
                auction = if (LookupPart.leilao in parts) provider.auctionAndClaims(q) else null,
                debts = if (LookupPart.debitos in parts) provider.debts(q) else null,
                fipe = if (LookupPart.fipe in parts) provider.fipeHint(q) else null,
            )
            val vehicle = c["vehicle"]
            assertEquals(vehicle["model"].asString(), data.basic.model)
            assertEquals(vehicle["year"].asString(), data.basic.year)
            assertEquals(vehicle["color"].asString(), data.basic.color)

            val year = now.atZone(ZoneId.of("America/Sao_Paulo")).year
            val sections = LookupAssembler.sections(product, data, year)
            val expected = c["expected"]
            val expectedSections: List<LookupSection> = expected["sections"].values().map { Fixtures.mapper.treeToValue(it, LookupSection::class.java) }
            assertEquals(expectedSections, sections)
            assertEquals(Fixtures.mapper.treeToValue(expected["summary"], LookupResultSummary::class.java), LookupCatalog.summary(sections))
        }
    }
}
