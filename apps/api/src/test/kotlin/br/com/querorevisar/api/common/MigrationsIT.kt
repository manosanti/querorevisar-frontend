package br.com.querorevisar.api.common

import br.com.querorevisar.api.support.TestDb
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.sql.DriverManager

/** F03.1: every migration applies from scratch on an empty database (Testcontainers on CI, embedded locally). */
class MigrationsIT {
    @Test
    fun `migrations apply from scratch and are idempotent`() {
        val url = TestDb.newDatabase()
        val flyway = Flyway.configure()
            .dataSource(url, TestDb.server.username, TestDb.server.password)
            .locations("classpath:db/migration", "classpath:db/auth-stub")
            .load()
        val result = flyway.migrate()
        assertEquals(3, result.migrationsExecuted)
        assertEquals(0, flyway.migrate().migrationsExecuted)

        DriverManager.getConnection(url, TestDb.server.username, TestDb.server.password).use { c ->
            val tables = mutableSetOf<String>()
            c.metaData.getTables(null, "public", "%", arrayOf("TABLE", "VIEW")).use { rs ->
                while (rs.next()) tables += rs.getString("TABLE_NAME")
            }
            val expected = setOf(
                "profiles", "catalog_items", "manufacturer_plans", "vehicles", "maintenance_records", "alerts",
                "push_subscriptions", "subscriptions", "credit_purchases", "credit_ledger", "credit_balances",
                "vehicle_lookups", "fipe_reference", "fipe_prices", "fipe_price_history", "webhook_events",
                "idempotency_keys", "job_runs", "shedlock", "sync_mutations", "fipe_usage",
            )
            assertTrue(tables.containsAll(expected), "missing: ${expected - tables}")
            c.createStatement().use { st ->
                st.executeQuery("select count(*) from pg_tables where schemaname = 'public' and rowsecurity").use { rs ->
                    rs.next()
                    assertTrue(rs.getInt(1) >= 20, "RLS enabled on the public tables")
                }
            }
        }
    }
}
