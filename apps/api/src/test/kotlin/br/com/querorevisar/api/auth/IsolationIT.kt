package br.com.querorevisar.api.auth

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.UUID

/** F04.2 / F14.2: user B never reads or writes user A's data. */
class IsolationIT : IntegrationTest() {
    @Test
    fun `cross-user access is not found`() {
        val a = newUser()
        val b = newUser()
        val vehicle = createVehicle(a).expect(200).text("/id")
        val record = createRecord(a, vehicle).expect(200).text("/id")
        giveCredits(a, 10)
        val lookup = post("/v1/lookups", mapOf("plate" to "ABC1D23", "product" to "basica", "mine" to false), a).expect(200).text("/id")
        val purchase = post("/v1/credits/purchases", mapOf("packId" to "pack-1", "method" to "card"), a).expect(200).text("/purchaseId")

        // reads
        assertEquals(0, get("/v1/vehicles", b).json.size())
        assertEquals(404, get("/v1/vehicles/$vehicle/records", b).status)
        assertEquals(404, get("/v1/vehicles/$vehicle/fipe", b).status)
        assertEquals(404, get("/v1/lookups/$lookup", b).status)
        assertEquals(0, get("/v1/lookups", b).json.size())
        assertEquals(404, get("/v1/credits/purchases/$purchase", b).status)
        val sync = get("/v1/sync", b).expect(200)
        assertEquals(0, sync.at("/vehicles").size())
        assertEquals(0, sync.at("/records").size())
        assertEquals(0, sync.at("/lookups").size())

        // writes
        assertEquals(404, patch("/v1/vehicles/$vehicle", mapOf("model" to "Hacked"), b).status)
        assertEquals(404, post("/v1/vehicles/$vehicle/km", mapOf("km" to 99999), b).status)
        assertEquals(404, post("/v1/vehicles/$vehicle/archive", user = b).status)
        assertEquals(404, delete("/v1/vehicles/$vehicle", b).status)
        assertEquals(404, patch("/v1/records/$record", mapOf("km" to 1), b).status)
        assertEquals(404, delete("/v1/records/$record", b).status)
        assertEquals(404, createRecord(b, vehicle).status)
        assertEquals(404, post("/v1/mock/payments/$purchase/approve", user = b, key = null).status)
        assertEquals(409, createVehicle(b, id = UUID.fromString(vehicle)).status)
        val pushed = post(
            "/v1/sync",
            mapOf(
                "mutations" to listOf(
                    mapOf("id" to UUID.randomUUID(), "type" to "vehicle.delete", "clientTime" to "2030-01-01T00:00:00Z", "payload" to mapOf("id" to vehicle)),
                    mapOf("id" to UUID.randomUUID(), "type" to "record.delete", "clientTime" to "2030-01-01T00:00:00Z", "payload" to mapOf("id" to record)),
                ),
            ),
            b,
        ).expect(200)
        assertEquals(2, pushed.at("/applied").size()) // unknown ids for B: no-op

        // A still has everything
        val mine = get("/v1/vehicles", a).json.values().first()
        assertEquals("Onix", mine["model"].asString())
        assertEquals(48000, mine["km"].asInt())
        assertEquals(1, get("/v1/vehicles/$vehicle/records", a).at("/records").size())
    }
}
