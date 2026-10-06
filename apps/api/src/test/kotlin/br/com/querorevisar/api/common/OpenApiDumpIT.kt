package br.com.querorevisar.api.common

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * Dumps the live springdoc document to apps/api/build/openapi.json for
 * `node packages/api-client/scripts/compare-contract.ts apps/api/build/openapi.json` (and `pnpm api:gen`).
 */
class OpenApiDumpIT : IntegrationTest() {
    @Test
    fun `dumps the OpenAPI document`() {
        val r = get("/v3/api-docs").expect(200)
        val out = File(System.getProperty("openapi.out") ?: "build/openapi.json")
        out.parentFile.mkdirs()
        out.writeText(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(r.json))
        assertTrue(r.text("/openapi").startsWith("3.1"))
        val schemas = r.at("/components/schemas")
        for (name in listOf("Vehicle", "VehicleCreate", "SyncResponse", "LookupResult", "Problem", "Me", "CreditPurchase")) {
            assertTrue(schemas.has(name), "schema $name")
        }
        val required = schemas["Vehicle"]["required"].values().map { it.asString() }.toSet()
        assertTrue("plate" in required)
        assertEquals(listOf("string", "null"), schemas["Vehicle"]["properties"]["plate"]["type"].values().map { it.asString() })
    }
}
