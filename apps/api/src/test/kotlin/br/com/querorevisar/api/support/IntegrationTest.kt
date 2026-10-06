package br.com.querorevisar.api.support

import org.junit.jupiter.api.Assertions.assertEquals
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

data class TestUser(val id: UUID, val token: String, val email: String?)

class Resp(val status: Int, val body: String, val headers: Map<String, String>, private val mapper: JsonMapper) {
    val json: JsonNode by lazy { mapper.readTree(body.ifBlank { "null" }) }

    fun at(pointer: String): JsonNode = json.at(pointer)

    fun text(pointer: String): String = at(pointer).asString()

    fun header(name: String): String? = headers.entries.firstOrNull { it.key.equals(name, ignoreCase = true) }?.value

    fun expect(status: Int): Resp {
        assertEquals(status, this.status, "unexpected status, body: $body")
        return this
    }
}

/** Spring context with MockMvc on the shared test Postgres; users are created directly in the auth.users stub. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Autowired
    lateinit var jdbc: JdbcClient

    @Autowired
    lateinit var mapper: JsonMapper

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun database(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { TestDb.server.jdbcUrl }
            registry.add("spring.datasource.username") { TestDb.server.username }
            registry.add("spring.datasource.password") { TestDb.server.password }
            registry.add("spring.flyway.url") { TestDb.server.jdbcUrl }
            registry.add("spring.flyway.user") { TestDb.server.username }
            registry.add("spring.flyway.password") { TestDb.server.password }
            registry.add("app.supabase.jwks-url") { TestTokens.jwksUrl }
        }
    }

    fun newUser(anonymous: Boolean = false, email: String? = null, name: String? = "Teste"): TestUser {
        val id = UUID.randomUUID()
        val mail = if (anonymous) null else email ?: "user-${id.toString().take(8)}@test.local"
        jdbc.sql("insert into auth.users(id, email, is_anonymous, raw_user_meta_data) values (:id, :e, :a, '{}'::jsonb)")
            .param("id", id).param("e", mail).param("a", anonymous).update()
        return TestUser(id, TestTokens.hs256(TestTokens.claims(id, anonymous, mail, name)), mail)
    }

    /** Premium until `until` (profile row created if needed). */
    fun makePremium(user: TestUser, until: Instant = Instant.now().plusSeconds(30L * 86400)) {
        jdbc.sql(
            """insert into profiles(user_id, plan, premium_until) values (:u, 'premium', :p)
               on conflict (user_id) do update set plan = 'premium', premium_until = :p""",
        ).param("u", user.id).param("p", OffsetDateTime.ofInstant(until, ZoneOffset.UTC)).update()
    }

    fun giveCredits(user: TestUser, n: Int) {
        get("/v1/me", user) // creates the profile
        jdbc.sql("insert into credit_ledger(user_id, delta, reason, ref_type, ref_id) values (:u, :d, 'admin', 'test', :r)")
            .param("u", user.id).param("d", n).param("r", UUID.randomUUID().toString()).update()
    }

    private fun perform(builder: MockHttpServletRequestBuilder, user: TestUser?, headers: Map<String, String>): Resp {
        if (user != null) builder.header("Authorization", "Bearer ${user.token}")
        headers.forEach { (k, v) -> builder.header(k, v) }
        val r = mvc.perform(builder).andReturn().response
        val hs = r.headerNames.associateWith { r.getHeader(it) ?: "" }
        return Resp(r.status, r.getContentAsString(Charsets.UTF_8), hs, mapper)
    }

    fun get(path: String, user: TestUser? = null, headers: Map<String, String> = emptyMap()): Resp =
        perform(MockMvcRequestBuilders.get(path), user, headers)

    fun write(
        method: String,
        path: String,
        body: Any? = null,
        user: TestUser? = null,
        key: String? = UUID.randomUUID().toString(),
        headers: Map<String, String> = emptyMap(),
    ): Resp {
        val builder = MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method), path)
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(if (body is String) body else mapper.writeValueAsString(body))
        }
        val all = if (key != null) headers + ("Idempotency-Key" to key) else headers
        return perform(builder, user, all)
    }

    fun post(path: String, body: Any? = null, user: TestUser? = null, key: String? = UUID.randomUUID().toString(), headers: Map<String, String> = emptyMap()) =
        write("POST", path, body, user, key, headers)

    fun patch(path: String, body: Any?, user: TestUser? = null) = write("PATCH", path, body, user)

    fun delete(path: String, user: TestUser? = null, body: Any? = null) = write("DELETE", path, body, user)

    fun createVehicle(
        user: TestUser,
        id: UUID = UUID.randomUUID(),
        type: String = "car",
        brand: String = "Chevrolet",
        model: String = "Onix",
        km: Int = 48000,
        extra: Map<String, Any?> = emptyMap(),
    ): Resp = post("/v1/vehicles", mapOf("id" to id, "type" to type, "brand" to brand, "model" to model, "year" to 2019, "km" to km) + extra, user)

    fun createRecord(user: TestUser, vehicleId: Any, itemId: String = "m1", km: Int = 47000, date: String? = null, extra: Map<String, Any?> = emptyMap()): Resp =
        post(
            "/v1/records",
            mapOf("id" to UUID.randomUUID(), "vehicleId" to vehicleId, "itemId" to itemId, "km" to km, "date" to date, "where" to "home") + extra,
            user,
        )

    /** Polls until the block returns true (async work such as the mock Pix approval). */
    fun eventually(timeoutMs: Long = 5000, block: () -> Boolean) {
        val end = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < end) {
            if (block()) return
            Thread.sleep(100)
        }
        throw AssertionError("condition not met in ${timeoutMs}ms")
    }
}
