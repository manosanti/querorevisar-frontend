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
        val mirror = env.getProperty("app.db.mirror-auth-users", Boolean::class.java, false)
        check(!mirror || (env.getProperty("app.db.auth-stub", Boolean::class.java, false) && "local" in profiles)) {
            "DB_MIRROR_AUTH_USERS=true needs DB_AUTH_STUB=true and the local profile"
        }
        val payments = env.getProperty("app.payments.mode", "mock")
        check(payments in setOf("mock", "sandbox", "live")) { "PAYMENTS_MODE must be mock, sandbox or live (got '$payments')" }
        if ("prod" in profiles) {
            val missing = productionProblems(env)
            check(missing.isEmpty()) {
                "Production configuration is incomplete (${missing.size}):\n" + missing.joinToString("\n") { "- $it" }
            }
        }
    }

    /** Everything the prod profile needs and does not have, all at once so one deploy attempt shows the whole list. */
    fun productionProblems(env: Environment): List<String> {
        val problems = mutableListOf<String>()
        fun set(key: String) = Secrets.isSet(env.getProperty(key))
        if (env.getProperty("app.push.mode") != "live") problems += "PUSH_MODE must be live"
        if (env.getProperty("app.email.mode") != "live") problems += "EMAIL_MODE must be live"
        if (!set("app.payments.access-token")) problems += "MP_ACCESS_TOKEN is missing (Mercado Pago)"
        if (!set("app.payments.webhook-secret")) problems += "MP_WEBHOOK_SECRET is missing (Mercado Pago webhook signature)"
        if (!set("DATABASE_DIRECT_URL")) problems += "DATABASE_DIRECT_URL is missing (migrations need the Session pooler)"
        if (!set("app.internal.audience")) problems += "INTERNAL_JOBS_AUDIENCE is missing"
        if (!set("app.internal.service-account")) {
            problems += "INTERNAL_JOBS_SERVICE_ACCOUNT is missing (without it any Google token with the same audience runs /internal/jobs/*)"
        }
        if (set("app.internal.token")) problems += "INTERNAL_TOKEN must not be set in production"
        for ((name, key) in listOf("APP_URL" to "app.app-url", "API_URL" to "app.api-url")) {
            val value = env.getProperty(key).orEmpty()
            if (!value.startsWith("https://")) problems += "$name must start with https:// (got '${value.take(60)}')"
        }
        val origins = env.getProperty("app.web-origins").orEmpty().split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (origins.isEmpty() || origins.any { !it.startsWith("https://") }) {
            problems += "WEB_ORIGINS must list only https:// origins"
        }
        return problems
    }
}
