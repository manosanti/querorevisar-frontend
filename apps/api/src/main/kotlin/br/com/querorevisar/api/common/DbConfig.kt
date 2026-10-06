package br.com.querorevisar.api.common

import org.slf4j.LoggerFactory
import org.springframework.boot.flyway.autoconfigure.FlywayConfigurationCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DbConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Plain Postgres (embedded locally, tests) has no Supabase `auth` schema: DB_AUTH_STUB=true adds
     * db/auth-stub (auth.users) before V1. Dev and prod run on Supabase and never include it.
     */
    @Bean
    fun authStubMigrations(props: AppProperties) = FlywayConfigurationCustomizer { config ->
        if (props.db.authStub) {
            log.info("DB_AUTH_STUB=true: applying the auth.users stub migration")
            val locations = config.locations.toMutableList()
            locations += org.flywaydb.core.api.Location("classpath:db/auth-stub")
            config.locations(*locations.toTypedArray())
        }
    }
}
