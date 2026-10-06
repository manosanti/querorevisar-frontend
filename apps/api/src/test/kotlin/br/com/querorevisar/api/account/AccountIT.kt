package br.com.querorevisar.api.account

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File
import java.util.UUID

/** /v1/me, flags (F12.3), LGPD export and deletion (F12.4), push subscriptions (F08.1), welcome e-mail. */
class AccountIT : IntegrationTest() {
    @Test
    fun `update name with validation`() {
        val user = newUser(name = null)
        assertEquals("Informe seu nome", patch("/v1/me", mapOf("name" to " "), user).text("/title"))
        assertEquals("Maria", patch("/v1/me", mapOf("name" to "Maria"), user).expect(200).text("/name"))
        assertEquals("Maria", get("/v1/me", user).text("/name"))
    }

    @Test
    fun `default flags and no ads for Premium`() {
        val user = newUser()
        val flags = get("/v1/me", user).at("/flags")
        assertFalse(flags["appleLogin"].asBoolean())
        assertFalse(flags["partsMarketplace"].asBoolean())
        assertTrue(flags["ads"].asBoolean())
        assertTrue(flags["vehicleLookups"].asBoolean())
        assertTrue(flags["fipeCard"].asBoolean())
        makePremium(user)
        assertFalse(get("/v1/me", user).at("/flags/ads").asBoolean())
    }

    @Test
    fun `welcome e-mail once for permanent accounts`() {
        val outbox = File("build/test-mail-outbox")
        val before = outbox.listFiles()?.count { it.name.contains("boas-vindas") } ?: 0
        val user = newUser()
        get("/v1/me", user)
        get("/v1/me", user)
        val after = outbox.listFiles()?.count { it.name.contains("boas-vindas") } ?: 0
        assertEquals(before + 1, after)
        newUser(anonymous = true).let { get("/v1/me", it) }
        assertEquals(after, outbox.listFiles()?.count { it.name.contains("boas-vindas") } ?: 0)
    }

    @Test
    fun `export has every piece of data`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        createRecord(user, v).expect(200)
        giveCredits(user, 3)
        post("/v1/lookups", mapOf("plate" to "ABC1D23", "product" to "basica", "mine" to false), user).expect(200)
        val export = get("/v1/me/export", user).expect(200)
        assertEquals(user.id.toString(), export.text("/me/id"))
        assertEquals(1, export.at("/vehicles").size())
        assertEquals(1, export.at("/records").size())
        assertEquals(1, export.at("/lookups").size())
        assertEquals("Dados do veículo", export.at("/lookups/0/sections/0/title").asString())
        assertEquals(2, export.at("/ledger").size())
        assertTrue(export.text("/exportedAt").isNotBlank())
    }

    @Test
    fun `delete account removes the data and the auth user`() {
        val user = newUser()
        val v = createVehicle(user).expect(200).text("/id")
        createRecord(user, v).expect(200)
        delete("/v1/me", user).expect(204)
        assertEquals(401, get("/v1/me", user).status)
        for (table in listOf("profiles", "vehicles", "maintenance_records", "credit_ledger")) {
            val n = jdbc.sql("select count(*) from $table where user_id = :u").param("u", user.id).query(Int::class.java).single()
            assertEquals(0, n, table)
        }
        assertEquals(0, jdbc.sql("select count(*) from auth.users where id = :u").param("u", user.id).query(Int::class.java).single())
    }

    @Test
    fun `push subscriptions`() {
        val user = newUser()
        val endpoint = "https://fcm.googleapis.com/fcm/send/${UUID.randomUUID()}"
        val body = mapOf("endpoint" to endpoint, "keys" to mapOf("p256dh" to "BNcRd", "auth" to "tBHI"), "userAgent" to "Test")
        post("/v1/push/subscriptions", body, user).expect(204)
        post("/v1/push/subscriptions", body, user).expect(204)
        assertEquals(1, jdbc.sql("select count(*) from push_subscriptions where user_id = :u").param("u", user.id).query(Int::class.java).single())
        assertEquals(400, post("/v1/push/subscriptions", body + ("endpoint" to "http://insecure.example"), user).status)
        assertEquals(400, post("/v1/push/subscriptions", mapOf("endpoint" to endpoint), user).status)
        delete("/v1/push/subscriptions", user, mapOf("endpoint" to endpoint)).expect(204)
        assertEquals(0, jdbc.sql("select count(*) from push_subscriptions where user_id = :u").param("u", user.id).query(Int::class.java).single())
    }
}
