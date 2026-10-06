package br.com.querorevisar.api.records

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

/** F05.3 records: validations, km bump, free-plan 12-month window, patch and soft delete. */
class RecordsIT : IntegrationTest() {
    private val today: LocalDate get() = LocalDate.now(ZoneId.of("America/Sao_Paulo"))

    @Test
    fun `validation messages of the prototype`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        val noItem = post("/v1/records", mapOf("id" to UUID.randomUUID(), "vehicleId" to v, "km" to 1000, "where" to "home"), user)
        assertEquals(400, noItem.status)
        assertEquals("Escolha o item que você trocou", noItem.text("/title"))
        val unknownItem = createRecord(user, v, itemId = "does-not-exist")
        assertEquals("Escolha o item que você trocou", unknownItem.text("/title"))
        val noKm = post("/v1/records", mapOf("id" to UUID.randomUUID(), "vehicleId" to v, "itemId" to "m1", "where" to "home"), user)
        assertEquals("Informe o km de quando trocou", noKm.text("/title"))
        val zeroKm = createRecord(user, v, km = 0)
        assertEquals("Informe o km de quando trocou", zeroKm.text("/title"))
        val future = createRecord(user, v, date = today.plusDays(1).toString())
        assertEquals("A data não pode ser no futuro", future.text("/title"))
        assertEquals("date", future.at("/errors/0/field").asString())
    }

    @Test
    fun `a record above the estimate moves the vehicle km`() {
        val user = newUser()
        val v = createVehicle(user, km = 48000).expect(200).text("/id")
        val r = createRecord(user, v, km = 49500, date = today.toString(), extra = mapOf("costCents" to 18990, "brand" to "Mobil", "where" to "shop")).expect(200)
        assertEquals(18990, r.at("/costCents").asInt())
        assertEquals("shop", r.text("/where"))
        val vehicle = get("/v1/vehicles", user).json.values().first()
        assertEquals(49500, vehicle["km"].asInt())
        createRecord(user, v, km = 30000).expect(200)
        assertEquals(49500, get("/v1/vehicles", user).json.values().first()["km"].asInt())
    }

    @Test
    fun `free plan sees 12 months, undated records always, premium sees all`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        createRecord(user, v, km = 10000, date = today.minusDays(400).toString()).expect(200)
        createRecord(user, v, km = 20000, date = today.minusDays(30).toString()).expect(200)
        createRecord(user, v, km = 15000, date = null).expect(200)
        val free = get("/v1/vehicles/$v/records", user).expect(200)
        assertEquals(2, free.at("/records").size())
        assertTrue(free.at("/locked").asBoolean())
        makePremium(user)
        val premium = get("/v1/vehicles/$v/records", user).expect(200)
        assertEquals(3, premium.at("/records").size())
        assertFalse(premium.at("/locked").asBoolean())
    }

    @Test
    fun `patch and soft delete`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        val id = createRecord(user, v, extra = mapOf("costCents" to 5000)).expect(200).text("/id")
        val patched = patch("/v1/records/$id", mapOf("costCents" to null, "brand" to "Bosch"), user).expect(200)
        assertTrue(patched.at("/costCents").isNull)
        assertEquals("Bosch", patched.text("/brand"))
        assertEquals("m1", patched.text("/itemId"))
        delete("/v1/records/$id", user).expect(204)
        assertEquals(0, get("/v1/vehicles/$v/records", user).at("/records").size())
        assertEquals(404, patch("/v1/records/$id", mapOf("brand" to "x"), user).status)
    }
}
