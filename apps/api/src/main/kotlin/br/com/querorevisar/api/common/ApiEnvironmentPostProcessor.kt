package br.com.querorevisar.api.common

import org.springframework.boot.EnvironmentPostProcessor
import org.springframework.boot.SpringApplication
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.MapPropertySource
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

/**
 * Translates the environment of env/api.env.example into Spring properties:
 * - DATABASE_URL / DATABASE_DIRECT_URL (`postgresql://user:pass@host:port/db?params`) into JDBC settings for the
 *   pool and for Flyway (migrations use the direct connection, the pool may use the Supabase pooler);
 * - `<SEM_TOKEN>` in SENTRY_DSN disables Sentry instead of failing on an invalid DSN.
 * Explicit spring.datasource.* settings (tests) win: this source is added last.
 */
class ApiEnvironmentPostProcessor : EnvironmentPostProcessor {
    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        val props = LinkedHashMap<String, Any>()
        val dbUrl = environment.getProperty("DATABASE_URL") ?: DEFAULT_DATABASE_URL
        val directUrl = environment.getProperty("DATABASE_DIRECT_URL")?.takeIf { it.isNotBlank() && it != dbUrl }
        toJdbc(dbUrl)?.let { db ->
            props["spring.datasource.url"] = db.url
            db.user?.let { props["spring.datasource.username"] = it }
            db.password?.let { props["spring.datasource.password"] = it }
        }
        // Without a separate direct URL Flyway simply uses the pool's DataSource.
        toJdbc(directUrl)?.let { db ->
            props["spring.flyway.url"] = db.url
            db.user?.let { props["spring.flyway.user"] = it }
            db.password?.let { props["spring.flyway.password"] = it }
        }
        val dsn = environment.getProperty("SENTRY_DSN")
        props["sentry.dsn"] = if (Secrets.isSet(dsn)) dsn!! else ""
        environment.propertySources.addLast(MapPropertySource("querorevisarEnvironment", props))
        StartupGuard.check(environment)
    }

    data class JdbcSettings(val url: String, val user: String?, val password: String?)

    companion object {
        const val DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

        /** `postgresql://user:pass@host:port/db?x=y` → JDBC; a value that already starts with `jdbc:` passes through. */
        fun toJdbc(raw: String?): JdbcSettings? {
            if (raw.isNullOrBlank() || !Secrets.isSet(raw)) return null
            if (raw.startsWith("jdbc:")) return JdbcSettings(raw, null, null)
            val uri = URI(raw.replaceFirst(Regex("^postgres(ql)?://"), "http://"))
            val userInfo = uri.rawUserInfo?.split(":", limit = 2)
            val decode = { s: String -> URLDecoder.decode(s, StandardCharsets.UTF_8) }
            val port = if (uri.port > 0) uri.port else 5432
            val params = mutableListOf<String>()
            uri.rawQuery?.takeIf { it.isNotBlank() }?.let { params += it }
            // The Supabase pooler in transaction mode (port 6543) does not support server-side prepared statements.
            val pooler = port == 6543 || (uri.host ?: "").contains("pooler.supabase.com")
            if (pooler && params.none { it.contains("prepareThreshold") }) params += "prepareThreshold=0"
            val query = if (params.isEmpty()) "" else "?" + params.joinToString("&")
            val url = "jdbc:postgresql://${uri.host}:$port${uri.rawPath.ifBlank { "/postgres" }}$query"
            return JdbcSettings(url, userInfo?.getOrNull(0)?.let(decode), userInfo?.getOrNull(1)?.let(decode))
        }
    }
}
