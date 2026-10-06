package br.com.querorevisar.api.sync

import br.com.querorevisar.api.support.IntegrationTest
import br.com.querorevisar.api.support.TestUser
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** F05.4 sync: full and incremental pull with cursor, offline queue applied once, last-write-wins. */
class SyncIT : IntegrationTest() {
    private fun mutation(type: String, payload: Map<String, Any?>, clientTime: Instant = Instant.now(), id: UUID = UUID.randomUUID()) =
        mapOf("id" to id, "type" to type, "clientTime" to clientTime.toString(), "payload" to payload)

    private fun push(user: TestUser, vararg mutations: Map<String, Any?>) =
        post("/v1/sync", mapOf("mutations" to mutations.toList()), user).expect(200)

    @Test
    fun `full pull without cursor, then incremental with deletions`() {
        val user = newUser(anonymous = true)
        val full0 = get("/v1/sync", user).expect(200)
        assertTrue(full0.at("/full").asBoolean())
        assertEquals(1, full0.at("/catalogVersion").asInt())
        assertTrue(full0.at("/me/isAnonymous").asBoolean())

        val v = createVehicle(user).expect(200).text("/id")
        val r1 = createRecord(user, v, km = 40000).expect(200).text("/id")
        val full = get("/v1/sync", user).expect(200)
        assertEquals(1, full.at("/vehicles").size())
        assertEquals(1, full.at("/records").size())
        val cursor = full.text("/cursor")

        // Pretend the client synced a while ago: changes older than the overlap window are not re-sent.
        jdbc.sql("update vehicles set updated_at = updated_at - interval '1 hour' where id = :id").param("id", UUID.fromString(v)).update()
        jdbc.sql("update maintenance_records set updated_at = updated_at - interval '1 hour' where id = :id").param("id", UUID.fromString(r1)).update()
        val old = SyncCursor.encode(Instant.now().minusSeconds(1800))
        val quiet = get("/v1/sync?since=$old", user).expect(200)
        assertFalse(quiet.at("/full").asBoolean())
        assertEquals(0, quiet.at("/vehicles").size())
        assertEquals(0, quiet.at("/records").size())

        delete("/v1/records/$r1", user).expect(204)
        val inc = get("/v1/sync?since=$old", user).expect(200)
        assertEquals(listOf(r1), inc.at("/deleted/records").values().map { it.asString() })
        assertEquals(0, inc.at("/records").size())
        assertTrue(cursor.isNotBlank())
        assertTrue(get("/v1/sync?since=garbage", user).at("/full").asBoolean())
    }

    @Test
    fun `offline queue is applied in order and only once`() {
        val user = newUser()
        val vehicleId = UUID.randomUUID()
        val recordId = UUID.randomUUID()
        val t0 = Instant.now().minusSeconds(600)
        val m1 = mutation("vehicle.upsert", mapOf("id" to vehicleId, "type" to "car", "brand" to "Fiat", "model" to "Argo", "year" to 2020, "km" to 30000), t0)
        // Edited offline after creation: same batch, must not conflict with the server's fresh updated_at.
        val m2 = mutation("vehicle.upsert", mapOf("id" to vehicleId, "type" to "car", "brand" to "Fiat", "model" to "Argo Trekking", "year" to 2020, "km" to 30000), t0.plusSeconds(60))
        val m3 = mutation("record.upsert", mapOf("id" to recordId, "vehicleId" to vehicleId, "itemId" to "m1", "km" to 31000, "where" to "home"), t0.plusSeconds(120))
        val m4 = mutation("vehicle.km", mapOf("id" to vehicleId, "km" to 32000), t0.plusSeconds(180))
        val result = push(user, m1, m2, m3, m4)
        assertEquals(4, result.at("/applied").size(), result.body)
        assertEquals(0, result.at("/rejected").size())
        assertTrue(result.text("/cursor").isNotBlank())

        val again = push(user, m1, m2, m3, m4)
        assertEquals(4, again.at("/applied").size())
        val records = jdbc.sql("select count(*) from maintenance_records where vehicle_id = :v").param("v", vehicleId).query(Int::class.java).single()
        assertEquals(1, records)
        val vehicle = get("/v1/vehicles", user).json.values().first()
        assertEquals("Argo Trekking", vehicle["model"].asString())
        assertEquals(32000, vehicle["km"].asInt())
    }

    @Test
    fun `last write wins by the server updated_at and rejections are stored`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        // Another device changed the vehicle "now"; an offline edit made an hour ago loses.
        val stale = mutation(
            "vehicle.upsert",
            mapOf("id" to v, "type" to "car", "brand" to "Chevrolet", "model" to "Old name", "year" to 2019, "km" to 48000),
            Instant.now().minusSeconds(3600),
        )
        val r = push(user, stale)
        assertEquals(0, r.at("/applied").size())
        assertEquals("conflict", r.at("/rejected/0/problem/code").asString())
        assertEquals(stale["id"].toString(), r.at("/rejected/0/id").asString())
        // replay returns the stored rejection
        assertEquals("conflict", push(user, stale).at("/rejected/0/problem/code").asString())
        assertEquals("Onix", get("/v1/vehicles", user).json.values().first()["model"].asString())

        val invalid = push(user, mutation("record.upsert", mapOf("id" to UUID.randomUUID(), "vehicleId" to v, "km" to 100, "where" to "home")))
        assertEquals("Escolha o item que você trocou", invalid.at("/rejected/0/problem/title").asString())
        val limit = push(user, mutation("vehicle.upsert", mapOf("id" to UUID.randomUUID(), "type" to "moto", "brand" to "Honda", "model" to "CG 160", "year" to 2020, "km" to 1)))
        assertEquals("vehicle-limit", limit.at("/rejected/0/problem/code").asString())
        val unknown = push(user, mutation("vehicle.fly", mapOf("id" to v)))
        assertEquals("validation", unknown.at("/rejected/0/problem/code").asString())
    }

    @Test
    fun `archive, restore and delete mutations`() {
        val user = newUser()
        makePremium(user)
        val v = createVehicle(user).expect(200).text("/id")
        jdbc.sql("update vehicles set updated_at = :t where id = :id")
            .param("t", OffsetDateTime.now(ZoneOffset.UTC).minusHours(1)).param("id", UUID.fromString(v)).update()
        val res = push(
            user,
            mutation("vehicle.archive", mapOf("id" to v)),
            mutation("vehicle.restore", mapOf("id" to v)),
            mutation("vehicle.delete", mapOf("id" to v)),
            mutation("vehicle.delete", mapOf("id" to v)),
        )
        assertEquals(4, res.at("/applied").size(), res.body)
        assertEquals(0, get("/v1/vehicles", user).json.size())
    }
}
