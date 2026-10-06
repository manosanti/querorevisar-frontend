package br.com.querorevisar.api.internal

import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.io.File
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

/** F08.2 jobs: daily alerts and downgrade, send-alerts (push or e-mail), premium-credits fallback, cleanup; once per day. */
class JobsIT : IntegrationTest() {
    private val internal = mapOf("X-Internal-Token" to "test-internal-token")
    private val today: LocalDate get() = LocalDate.now(ZoneId.of("America/Sao_Paulo"))

    private fun run(job: String) = post("/internal/jobs/$job", key = null, headers = internal).expect(200)

    @BeforeEach
    fun freshDay() {
        jdbc.sql("delete from job_runs").update()
    }

    @Test
    fun `daily writes one alert per vehicle with over and warn items, then send-alerts delivers by e-mail or push`() {
        val withEmail = newUser()
        val v1 = createVehicle(withEmail).expect(200).text("/id")
        createRecord(withEmail, v1, itemId = "m1", km = 37000, date = today.minusDays(400).toString()).expect(200)
        createRecord(withEmail, v1, itemId = "m2", km = 47500, date = today.minusDays(10).toString()).expect(200)

        val withPush = newUser()
        val v2 = createVehicle(withPush).expect(200).text("/id")
        createRecord(withPush, v2, itemId = "m1", km = 30000).expect(200)
        post("/v1/push/subscriptions", mapOf("endpoint" to "https://push.example.com/send/${UUID.randomUUID()}", "keys" to mapOf("p256dh" to "BKey", "auth" to "auth")), withPush).expect(204)

        val daily = run("daily")
        assertEquals("ran", daily.text("/status"))
        assertEquals(today.toString(), daily.text("/runDate"))
        assertEquals("skipped", run("daily").text("/status"))

        val items = jdbc.sql("select items::text from alerts where vehicle_id = :v and run_date = :d")
            .param("v", UUID.fromString(v1)).param("d", today).query(String::class.java).single()
        val parsed = mapper.readTree(items)
        assertEquals(1, parsed.size())
        assertEquals("m1", parsed[0]["itemId"].asString())
        assertEquals("over", parsed[0]["status"].asString())

        val outbox = File("build/test-mail-outbox")
        val before = outbox.listFiles()?.count { it.name.contains("alerta-vencimento") } ?: 0
        run("send-alerts")
        val after = outbox.listFiles()?.count { it.name.contains("alerta-vencimento") } ?: 0
        assertTrue(after > before, "alert e-mail written to the outbox")
        val channels = jdbc.sql("select vehicle_id, channel from alerts where vehicle_id in (:a, :b)")
            .param("a", UUID.fromString(v1)).param("b", UUID.fromString(v2))
            .query { rs, _ -> rs.getObject(1, UUID::class.java).toString() to rs.getString(2) }.list().toMap()
        assertEquals("email", channels[v1])
        assertEquals("push", channels[v2])
    }

    @Test
    fun `daily downgrades expired Premium`() {
        val user = newUser()
        makePremium(user, until = java.time.Instant.now().minusSeconds(3600))
        run("daily")
        assertEquals("free", jdbc.sql("select plan from profiles where user_id = :u").param("u", user.id).query(String::class.java).single())
    }

    @Test
    fun `premium-credits pays the monthly bonus once when the webhook did not`() {
        val user = newUser()
        makePremium(user)
        run("premium-credits")
        assertEquals(2, get("/v1/me", user).at("/credits").asInt())
        jdbc.sql("delete from job_runs").update()
        run("premium-credits")
        assertEquals(2, get("/v1/me", user).at("/credits").asInt())
    }

    @Test
    fun `cleanup removes idempotency keys older than 24 hours`() {
        val user = newUser()
        get("/v1/me", user)
        val key = UUID.randomUUID()
        jdbc.sql("insert into idempotency_keys(user_id, key, request_hash, created_at) values (:u, :k, 'x', :t)")
            .param("u", user.id).param("k", key).param("t", OffsetDateTime.now(ZoneOffset.UTC).minusHours(30)).update()
        val r = run("cleanup")
        assertTrue(r.at("/stats/idempotencyKeys").asInt() >= 1)
        assertEquals(0, jdbc.sql("select count(*) from idempotency_keys where key = :k").param("k", key).query(Int::class.java).single())
    }

    @Test
    fun `fipe-refresh and unknown jobs`() {
        assertEquals("ran", run("fipe-refresh").text("/status"))
        assertEquals(404, post("/internal/jobs/unknown", key = null, headers = internal).status)
    }
}
