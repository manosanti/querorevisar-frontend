package br.com.querorevisar.api.common

import org.springframework.core.env.Environment

/** Configuration checks that must stop the application before anything starts. */
object StartupGuard {
    private val KNOWN_PROFILES = setOf("local", "dev", "prod", "test")

    fun check(env: Environment) {
        // Build-time AOT processing (processAot, native image) refreshes the context without a profile.
        if (System.getProperty("spring.aot.processing").toBoolean()) return
        val profiles = env.activeProfiles.toSet()
        check(profiles.any { it in KNOWN_PROFILES }) {
            "No profile active. Set SPRING_PROFILES_ACTIVE to local, dev or prod (./gradlew :apps:api:bootRun uses local)."
        }
        val authMode = env.getProperty("app.auth.mode", "supabase")
        check(authMode in setOf("supabase", "dev")) { "AUTH_MODE must be supabase or dev (got '$authMode')" }
        check(authMode != "dev" || "local" in profiles) {
            "AUTH_MODE=dev is only allowed with the local profile (active: ${profiles.joinToString()})"
        }
        val payments = env.getProperty("app.payments.mode", "mock")
        check(payments in setOf("mock", "sandbox", "live")) { "PAYMENTS_MODE must be mock, sandbox or live (got '$payments')" }
    }
}
