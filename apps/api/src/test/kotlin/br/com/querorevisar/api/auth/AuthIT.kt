package br.com.querorevisar.api.auth

import br.com.querorevisar.api.support.IntegrationTest
import br.com.querorevisar.api.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID

/** F04.2: Supabase JWTs (legacy HS256 and JWKS ES256), public routes, internal routes, problems on 401. */
class AuthIT : IntegrationTest() {
    @Test
    fun `no token is a 401 problem`() {
        val r = get("/v1/me").expect(401)
        assertEquals("application/problem+json", r.header("Content-Type"))
        assertEquals("unauthorized", r.text("/code"))
        assertEquals("/problems/unauthorized", r.text("/type"))
    }

    @Test
    fun `invalid, expired and anon-key tokens are rejected`() {
        val id = UUID.randomUUID()
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer not-a-jwt")).status)
        val wrongSecret = TestTokens.hs256(TestTokens.claims(id), secret = "another-secret-another-secret-another-secret")
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer $wrongSecret")).status)
        val expired = TestTokens.hs256(TestTokens.claims(id, expiresAt = Instant.now().minusSeconds(3600)))
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer $expired")).status)
        val anonKey = TestTokens.hs256(TestTokens.claims(id, role = "anon", audience = "anon"))
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer $anonKey")).status)
    }

    @Test
    fun `legacy HS256 token works and creates the profile`() {
        val user = newUser(name = "Ana")
        val me = get("/v1/me", user).expect(200)
        assertEquals(user.id.toString(), me.text("/id"))
        assertEquals(false, me.at("/isAnonymous").asBoolean())
        assertEquals("Ana", me.text("/name"))
        assertEquals(user.email, me.text("/email"))
        assertEquals("free", me.text("/plan"))
        val profiles = jdbc.sql("select count(*) from profiles where user_id = :u").param("u", user.id).query(Int::class.java).single()
        assertEquals(1, profiles)
    }

    @Test
    fun `ES256 token verified through the JWKS`() {
        val id = UUID.randomUUID()
        jdbc.sql("insert into auth.users(id, is_anonymous) values (:id, true)").param("id", id).update()
        val token = TestTokens.es256(TestTokens.claims(id, anonymous = true))
        val me = get("/v1/me", headers = mapOf("Authorization" to "Bearer $token")).expect(200)
        assertEquals(true, me.at("/isAnonymous").asBoolean())
        val forged = TestTokens.es256(TestTokens.claims(id), com.nimbusds.jose.jwk.gen.ECKeyGenerator(com.nimbusds.jose.jwk.Curve.P_256).keyID("test-es256").generate())
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer $forged")).status)
    }

    @Test
    fun `a valid token of a deleted auth user is refused`() {
        val id = UUID.randomUUID()
        val token = TestTokens.hs256(TestTokens.claims(id))
        assertEquals(401, get("/v1/me", headers = mapOf("Authorization" to "Bearer $token")).status)
    }

    @Test
    fun `public routes`() {
        get("/actuator/health").expect(200)
        get("/actuator/health/liveness").expect(200)
        get("/actuator/health/readiness").expect(200)
        val v = get("/v1/catalog/version").expect(200)
        assertEquals(1, v.at("/version").asInt())
        assertEquals("/catalog.v1.json", v.text("/url"))
    }

    @Test
    fun `dev auth answers 404 outside AUTH_MODE=dev`() {
        assertEquals(404, post("/dev/auth/anonymous", key = null).status)
    }

    @Test
    fun `internal jobs need the internal token`() {
        assertEquals(401, post("/internal/jobs/cleanup", key = null).status)
        assertEquals(401, post("/internal/jobs/cleanup", key = null, headers = mapOf("X-Internal-Token" to "wrong")).status)
        val user = newUser()
        assertEquals(401, post("/internal/jobs/cleanup", user = user, key = null).status)
        val ok = post("/internal/jobs/cleanup", key = null, headers = mapOf("X-Internal-Token" to "test-internal-token")).expect(200)
        assertEquals("cleanup", ok.text("/job"))
        assertTrue(ok.text("/status") in setOf("ran", "skipped"))
    }

    @Test
    fun `CORS only for WEB_ORIGINS`() {
        val allowed = mvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/v1/me")
                .header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "GET"),
        ).andReturn().response
        assertEquals("http://localhost:5173", allowed.getHeader("Access-Control-Allow-Origin"))
        val denied = mvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/v1/me")
                .header("Origin", "https://evil.example").header("Access-Control-Request-Method", "GET"),
        ).andReturn().response
        assertEquals(403, denied.status)
    }
}
