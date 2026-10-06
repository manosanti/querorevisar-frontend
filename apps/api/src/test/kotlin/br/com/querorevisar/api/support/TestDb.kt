package br.com.querorevisar.api.support

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres
import org.slf4j.LoggerFactory
import org.testcontainers.DockerClientFactory
import org.testcontainers.postgresql.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName
import java.sql.DriverManager
import java.util.UUID

/**
 * One PostgreSQL per test JVM: Testcontainers when Docker is available (CI), otherwise zonky embedded Postgres
 * (developer machines without Docker). Every Spring context migrates it with Flyway from scratch.
 */
object TestDb {
    private val log = LoggerFactory.getLogger(javaClass)

    data class Server(val jdbcUrl: String, val username: String, val password: String, val kind: String)

    val server: Server by lazy { start() }

    private fun dockerAvailable(): Boolean = try {
        DockerClientFactory.instance().isDockerAvailable
    } catch (e: Throwable) {
        false
    }

    private fun start(): Server {
        if (System.getProperty("testdb.embedded") != "true" && dockerAvailable()) {
            val container = PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
            container.start()
            log.info("Tests use Testcontainers Postgres")
            return Server(container.jdbcUrl, container.username, container.password, "testcontainers")
        }
        val pg = EmbeddedPostgres.builder().start()
        Runtime.getRuntime().addShutdownHook(Thread { runCatching { pg.close() } })
        log.info("Docker not available: tests use embedded Postgres (zonky)")
        return Server(pg.getJdbcUrl("postgres", "postgres"), "postgres", "postgres", "embedded")
    }

    /** A brand-new empty database on the same server (migrations from scratch). */
    fun newDatabase(): String {
        val name = "fresh_" + UUID.randomUUID().toString().replace("-", "").take(12)
        DriverManager.getConnection(server.jdbcUrl, server.username, server.password).use { c ->
            c.createStatement().use { it.execute("create database $name") }
        }
        return server.jdbcUrl.replaceFirst(Regex("/[^/?]+(\\?|$)"), "/$name$1")
    }
}
