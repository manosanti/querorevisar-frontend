package br.com.querorevisar.api.auth

import br.com.querorevisar.api.support.IntegrationTest
import br.com.querorevisar.api.support.Resp
import br.com.querorevisar.api.support.TestUser
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import java.io.File
import java.util.UUID

/** AUTH_MODE=dev (local profile): the dev auth endpoints emulate Supabase Auth against the auth.users stub. */
@ActiveProfiles("local", "test")
@TestPropertySource(properties = ["app.auth.mode=dev", "app.auth.dev-secret=dev-auth-secret-for-tests-0123456789abcdef"])
class DevAuthIT : IntegrationTest() {
    private fun session(r: Resp): TestUser =
        TestUser(UUID.fromString(r.text("/user/id")), r.text("/accessToken"), r.at("/user/email").takeIf { !it.isNull }?.asString())

    private fun noKey(path: String, body: Any? = null, user: TestUser? = null) = post(path, body, user, key = null)

    @Test
    fun `anonymous user signs up keeping the same id and data`() {
        val anon = session(noKey("/dev/auth/anonymous").expect(200))
        assertTrue(noKey("/dev/auth/anonymous").at("/user/isAnonymous").asBoolean())
        createVehicle(anon).expect(200)
        val email = "dev-${UUID.randomUUID().toString().take(8)}@local.test"
        val signed = noKey("/dev/auth/signup", mapOf("email" to email, "password" to "segredo1", "name" to "Rui"), anon).expect(200)
        assertEquals(anon.id.toString(), signed.text("/user/id"))
        assertFalse(signed.at("/user/isAnonymous").asBoolean())
        val user = session(signed)
        val me = get("/v1/me", user).expect(200)
        assertEquals(email, me.text("/email"))
        assertEquals("Rui", me.text("/name"))
        assertEquals(1, get("/v1/vehicles", user).json.size())

        val again = session(noKey("/dev/auth/signin", mapOf("email" to email, "password" to "segredo1")).expect(200))
        assertEquals(anon.id, again.id)
        assertEquals(401, noKey("/dev/auth/signin", mapOf("email" to email, "password" to "errada")).status)
        assertEquals(409, noKey("/dev/auth/signup", mapOf("email" to email, "password" to "outra123", "name" to "X")).status)
        assertEquals("A senha precisa ter pelo menos 6 caracteres", noKey("/dev/auth/signup", mapOf("email" to "a@b.co", "password" to "123", "name" to "X")).text("/title"))
        assertEquals("E-mail inválido. Confira e tente de novo", noKey("/dev/auth/signup", mapOf("email" to "nope", "password" to "123456", "name" to "X")).text("/title"))
    }

    @Test
    fun `fake Google login links the anonymous user, then signs in the same account`() {
        jdbc.sql("delete from auth.users where email = 'google-user@local.test'").update()
        val anon = session(noKey("/dev/auth/anonymous").expect(200))
        val linked = noKey("/dev/auth/oauth", mapOf("provider" to "google"), anon).expect(200)
        assertEquals(anon.id.toString(), linked.text("/user/id"))
        assertEquals("google-user@local.test", linked.text("/user/email"))
        val again = noKey("/dev/auth/oauth", mapOf("provider" to "google")).expect(200)
        assertEquals(anon.id.toString(), again.text("/user/id"))
    }

    @Test
    fun `recover writes the e-mail to the outbox`() {
        val email = "rec-${UUID.randomUUID().toString().take(8)}@local.test"
        noKey("/dev/auth/signup", mapOf("email" to email, "password" to "segredo1", "name" to "Ana")).expect(200)
        val outbox = File("build/test-mail-outbox")
        val before = outbox.listFiles()?.count { it.name.contains("recuperar-senha") } ?: 0
        noKey("/dev/auth/recover", mapOf("email" to email)).expect(204)
        noKey("/dev/auth/recover", mapOf("email" to "unknown@local.test")).expect(204)
        assertEquals(before + 1, outbox.listFiles()?.count { it.name.contains("recuperar-senha") } ?: 0)
    }

    @Test
    fun `dev tokens carry the Supabase claims`() {
        val token = noKey("/dev/auth/anonymous").expect(200).text("/accessToken")
        val claims = com.nimbusds.jwt.SignedJWT.parse(token).jwtClaimsSet
        assertEquals("authenticated", claims.getStringClaim("role"))
        assertEquals(listOf("authenticated"), claims.audience)
        assertEquals(true, claims.getBooleanClaim("is_anonymous"))
        val days = (claims.expirationTime.time - System.currentTimeMillis()) / 86_400_000.0
        assertTrue(days > 6.9 && days <= 7.0)
    }
}
