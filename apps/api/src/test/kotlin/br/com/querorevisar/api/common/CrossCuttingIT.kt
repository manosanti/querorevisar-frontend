package br.com.querorevisar.api.common

import br.com.querorevisar.api.support.IntegrationTest
import br.com.querorevisar.api.support.Resp
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

/** F04.3: Idempotency-Key, problem details, ETag/304, rate limits, request id. */
class CrossCuttingIT : IntegrationTest() {
    @Test
    fun `writes need an Idempotency-Key`() {
        val user = newUser()
        val r = post("/v1/vehicles", mapOf("id" to UUID.randomUUID()), user, key = null)
        assertEquals(400, r.status)
        assertEquals("validation", r.text("/code"))
        assertEquals("Cabeçalho Idempotency-Key obrigatório.", r.text("/title"))
        assertEquals(400, post("/v1/vehicles", mapOf("id" to UUID.randomUUID()), user, key = "not-a-uuid").status)
    }

    @Test
    fun `same key and same body replays, different body is a conflict`() {
        val user = newUser()
        makePremium(user)
        val key = UUID.randomUUID().toString()
        val body = mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to "Fiat", "model" to "Argo", "year" to 2020, "km" to 1000)
        val first = post("/v1/vehicles", body, user, key = key).expect(200)
        val replay = post("/v1/vehicles", body, user, key = key).expect(200)
        assertEquals("true", replay.header("Idempotent-Replayed"))
        assertEquals(first.json, replay.json)
        assertEquals(1, get("/v1/vehicles", user).json.size())
        val other = post("/v1/vehicles", body + ("model" to "Mobi"), user, key = key)
        assertEquals(409, other.status)
        assertEquals("conflict", other.text("/code"))
        // Errors are replayed too (same request, same answer).
        val badKey = UUID.randomUUID().toString()
        val bad = mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to "Fiat", "model" to "Argo", "year" to 20, "km" to 1)
        assertEquals(400, post("/v1/vehicles", bad, user, key = badKey).status)
        val badReplay = post("/v1/vehicles", bad, user, key = badKey)
        assertEquals(400, badReplay.status)
        assertTrue(badReplay.header("Content-Type")!!.startsWith("application/problem+json"))
    }

    @Test
    fun `keys are per user`() {
        val a = newUser()
        val b = newUser()
        val key = UUID.randomUUID().toString()
        fun body() = mapOf("id" to UUID.randomUUID(), "type" to "car", "brand" to "Fiat", "model" to "Uno", "year" to 2010, "km" to 1)
        post("/v1/vehicles", body(), a, key = key).expect(200)
        post("/v1/vehicles", body(), b, key = key).expect(200)
    }

    @Test
    fun `problem details for malformed input and unknown routes`() {
        val user = newUser()
        val malformed = post("/v1/vehicles", "{not json", user)
        assertEquals(400, malformed.status)
        assertTrue(malformed.header("Content-Type")!!.startsWith("application/problem+json"))
        assertEquals("validation", malformed.text("/code"))
        assertEquals(404, get("/v1/vehicles/not-a-uuid/records", user).status)
        assertEquals("not-found", get("/v1/nothing-here", user).text("/code"))
    }

    @Test
    fun `ETag and 304 on me and sync`() {
        val user = newUser()
        val me = get("/v1/me", user).expect(200)
        val etag = me.header("ETag")
        assertNotNull(etag)
        assertEquals(304, get("/v1/me", user, mapOf("If-None-Match" to etag!!)).status)
        val sync = get("/v1/sync", user).expect(200)
        assertEquals(304, get("/v1/sync", user, mapOf("If-None-Match" to sync.header("ETag")!!)).status)
        createVehicle(user).expect(200)
        assertEquals(200, get("/v1/sync", user, mapOf("If-None-Match" to sync.header("ETag")!!)).status)
    }

    @Test
    fun `lookups are limited to 20 per minute`() {
        val user = newUser()
        var limited: Resp? = null
        for (i in 1..25) {
            val r = post("/v1/lookups", mapOf("plate" to "X", "product" to "fipe", "mine" to false), user)
            if (r.status == 429) {
                limited = r
                break
            }
            assertEquals(422, r.status)
        }
        assertNotNull(limited, "expected a 429")
        assertEquals("rate-limited", limited!!.text("/code"))
        assertTrue(limited.header("Retry-After")!!.toInt() >= 1)
        // other categories keep their own budget
        assertEquals(200, get("/v1/me", user).status)
    }

    @Test
    fun `request id is echoed`() {
        val r = get("/actuator/health", headers = mapOf("X-Request-Id" to "req-12345678"))
        assertEquals("req-12345678", r.header("X-Request-Id"))
        assertNotNull(get("/actuator/health").header("X-Request-Id"))
    }
}
