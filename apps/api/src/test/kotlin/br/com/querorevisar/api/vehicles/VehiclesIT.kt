package br.com.querorevisar.api.vehicles

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** F05.3 vehicles: plan limit, archive/restore, replace, soft delete, km rules, validations. */
class VehiclesIT : IntegrationTest() {
    @Test
    fun `free plan keeps one active vehicle`() {
        val user = newUser()
        val car = createVehicle(user).expect(200)
        assertEquals(1100, car.at("/kmPerMonth").asInt())
        assertEquals("active", car.text("/status"))
        assertTrue(car.at("/plate").isNull)
        val second = createVehicle(user, type = "moto", brand = "Honda", model = "CG 160").expect(402)
        assertEquals("vehicle-limit", second.text("/code"))
        assertEquals("/problems/vehicle-limit", second.text("/type"))
        assertEquals("O plano grátis acompanha 1 veículo.", second.text("/title"))
    }

    @Test
    fun `premium has no limit and motorcycles start at 900 km per month`() {
        val user = newUser()
        makePremium(user)
        createVehicle(user).expect(200)
        val moto = createVehicle(user, type = "moto", brand = "Honda", model = "CG 160").expect(200)
        assertEquals(900, moto.at("/kmPerMonth").asInt())
        assertEquals(2, get("/v1/vehicles", user).expect(200).json.size())
    }

    @Test
    fun `replacesVehicleId archives the old vehicle in the same transaction`() {
        val user = newUser()
        val old = UUID.fromString(createVehicle(user).expect(200).text("/id"))
        val newId = UUID.randomUUID()
        createVehicle(user, id = newId, model = "Onix Plus", extra = mapOf("replacesVehicleId" to old)).expect(200)
        val list = get("/v1/vehicles", user).expect(200).json.values()
        assertEquals("active", list.first { it["id"].asString() == newId.toString() }["status"].asString())
        val archived = list.first { it["id"].asString() == old.toString() }
        assertEquals("archived", archived["status"].asString())
        assertTrue(!archived["archivedAt"].isNull)
    }

    @Test
    fun `archive and restore (402 on the free plan)`() {
        val user = newUser()
        val id = createVehicle(user).expect(200).text("/id")
        assertEquals("archived", post("/v1/vehicles/$id/archive", user = user).expect(200).text("/status"))
        assertEquals(402, post("/v1/vehicles/$id/restore", user = user).status)
        makePremium(user)
        assertEquals("active", post("/v1/vehicles/$id/restore", user = user).expect(200).text("/status"))
    }

    @Test
    fun `delete is a soft delete together with the records`() {
        val user = newUser()
        val id = createVehicle(user).expect(200).text("/id")
        createRecord(user, id).expect(200)
        delete("/v1/vehicles/$id", user).expect(204)
        assertEquals(0, get("/v1/vehicles", user).json.size())
        assertEquals(404, get("/v1/vehicles/$id/records", user).status)
        val alive = jdbc.sql("select count(*) from maintenance_records where vehicle_id = :v and deleted_at is null")
            .param("v", UUID.fromString(id)).query(Int::class.java).single()
        assertEquals(0, alive)
        assertEquals(404, delete("/v1/vehicles/$id", user).status)
    }

    @Test
    fun `validation messages of the prototype`() {
        val user = newUser()
        val noKm = post("/v1/vehicles", mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to "Fiat", "model" to "Argo", "year" to 2020), user)
        assertEquals(400, noKm.status)
        assertEquals("Informe o km atual do painel", noKm.text("/title"))
        assertEquals("km", noKm.at("/errors/0/field").asString())
        val badYear = post("/v1/vehicles", mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to "Fiat", "model" to "Argo", "year" to 19, "km" to 1), user)
        assertEquals("Ano inválido. Use 4 dígitos, ex.: 2019", badYear.text("/title"))
        val noBrand = post("/v1/vehicles", mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to " ", "model" to "Argo", "year" to 2020, "km" to 1), user)
        assertEquals("Escolha a marca e o modelo", noBrand.text("/title"))
        val badPlate = createVehicle(user, extra = mapOf("plate" to "AB-12"))
        assertEquals(422, badPlate.status)
        assertEquals("invalid-plate", badPlate.text("/code"))
        assertEquals("Placa inválida. Use o formato ABC1D23", badPlate.text("/title"))
    }

    @Test
    fun `patch distinguishes absent from null`() {
        val user = newUser()
        val id = createVehicle(user, extra = mapOf("plate" to "abc1d23", "fipeBrandCode" to "23")).expect(200).text("/id")
        val renamed = patch("/v1/vehicles/$id", mapOf("model" to "Onix Plus"), user).expect(200)
        assertEquals("Onix Plus", renamed.text("/model"))
        assertEquals("ABC1D23", renamed.text("/plate"))
        val cleared = patch("/v1/vehicles/$id", mapOf("plate" to null), user).expect(200)
        assertTrue(cleared.at("/plate").isNull)
        assertEquals("23", cleared.text("/fipeBrandCode"))
    }

    @Test
    fun `km update rules`() {
        val user = newUser()
        val id = createVehicle(user, km = 48000).expect(200).text("/id")
        createRecord(user, id, km = 47000).expect(200)
        val below = post("/v1/vehicles/$id/km", mapOf("km" to 46000), user)
        assertEquals(400, below.status)
        assertEquals("Km menor que a última troca registrada (47.000 km)", below.text("/title"))
        val nothing = post("/v1/vehicles/$id/km", mapOf<String, Any>(), user)
        assertEquals("Digite o km do painel ou toque em \"Está certo\"", nothing.text("/title"))
        // Two months ago at 48.000 → 50.600 now gives a new monthly average.
        jdbc.sql("update vehicles set km_at = :t where id = :id")
            .param("t", OffsetDateTime.now(ZoneOffset.UTC).minusDays(61)).param("id", UUID.fromString(id)).update()
        val updated = post("/v1/vehicles/$id/km", mapOf("km" to 50600), user).expect(200)
        assertEquals(50600, updated.at("/km").asInt())
        assertEquals(1297, updated.at("/kmPerMonth").asInt())
        val confirmed = post("/v1/vehicles/$id/km", mapOf("confirmEstimate" to true), user).expect(200)
        assertEquals(50600, confirmed.at("/km").asInt())
        assertEquals(1297, confirmed.at("/kmPerMonth").asInt())
        assertTrue(Instant.parse(confirmed.text("/kmAt")).isAfter(Instant.now().minusSeconds(60)))
    }

    @Test
    fun `an existing id is a conflict`() {
        val user = newUser()
        makePremium(user)
        val id = UUID.randomUUID()
        createVehicle(user, id = id).expect(200)
        assertEquals(409, createVehicle(user, id = id).status)
    }
}
