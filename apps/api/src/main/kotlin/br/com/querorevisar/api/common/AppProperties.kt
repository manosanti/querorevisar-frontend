package br.com.querorevisar.api.common

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/** Placeholders from env/(name).env.example: any of them means "not configured" and the integration runs in mock mode. */
object Secrets {
    fun isSet(value: String?): Boolean =
        !value.isNullOrBlank() && !value.contains("<SEM_TOKEN>") && !value.contains("<PREENCHER>")
}

/** Every setting comes from the environment (env/api.env.example) through application.yml. */
@ConfigurationProperties("app")
data class AppProperties(
    val appUrl: String = "http://localhost:5173",
    val apiUrl: String = "http://localhost:8080",
    val webOrigins: List<String> = listOf("http://localhost:5173"),
    val timezone: String = "America/Sao_Paulo",
    val supabase: Supabase = Supabase(),
    val auth: Auth = Auth(),
    val db: Db = Db(),
    val internal: Internal = Internal(),
    val payments: Payments = Payments(),
    val credits: Credits = Credits(),
    val fipe: Fipe = Fipe(),
    val vehicleData: VehicleData = VehicleData(),
    val push: Push = Push(),
    val email: Email = Email(),
    val posthog: PostHog = PostHog(),
    val rateLimit: RateLimit = RateLimit(),
    val http: Http = Http(),
) {
    data class Supabase(
        val url: String = "http://127.0.0.1:54321",
        val jwksUrl: String = "http://127.0.0.1:54321/auth/v1/.well-known/jwks.json",
        val jwtSecret: String = "<SEM_TOKEN>",
        val serviceRoleKey: String = "<SEM_TOKEN>",
    )

    /** mode: supabase (JWKS/HS256 from Supabase Auth) or dev (tokens issued by /dev/auth, local profile only). */
    data class Auth(
        val mode: String = "supabase",
        val devSecret: String = "",
        val devSecretFile: String = "build/dev-auth-secret",
        val devTokenTtl: Duration = Duration.ofDays(7),
    )

    data class Db(val authStub: Boolean = false)

    data class Internal(
        val audience: String = "<PREENCHER>",
        val token: String = "<SEM_TOKEN>",
        val serviceAccount: String = "",
        val allowLoopback: Boolean = false,
        val googleJwksUrl: String = "https://www.googleapis.com/oauth2/v3/certs",
    )

    data class Payments(
        val mode: String = "mock",
        val baseUrl: String = "https://api.mercadopago.com",
        val accessToken: String = "<SEM_TOKEN>",
        val webhookSecret: String = "<SEM_TOKEN>",
        val premiumPlanId: String = "<PREENCHER>",
        val premiumPriceCents: Int = 1490,
        val backUrlSuccess: String = "http://localhost:5173/conta?pagamento=ok",
        val backUrlPending: String = "http://localhost:5173/conta?pagamento=pendente",
        val backUrlFailure: String = "http://localhost:5173/conta?pagamento=erro",
        val notificationUrl: String = "http://localhost:8080/webhooks/mercadopago",
        val pixExpirationMinutes: Long = 30,
        val mockAutoApproveDelay: Duration = Duration.ofSeconds(3),
        /** Mock approvals (auto Pix and /v1/mock/payments) — off in prod, where mock mode means "payments unavailable". */
        val mockApprovals: Boolean = true,
        val webhookTolerance: Duration = Duration.ofMinutes(10),
    ) {
        /** mock when PAYMENTS_MODE=mock or the access token is a placeholder. */
        val effectiveMode: String get() = if (mode == "mock" || !Secrets.isSet(accessToken)) "mock" else mode
        val isMock: Boolean get() = effectiveMode == "mock"
    }

    data class Credits(val unitPriceCents: Int = 490, val premiumMonthly: Int = 2)

    data class Fipe(
        val mode: String = "live",
        val baseUrl: String = "https://fipe.parallelum.com.br/api/v2",
        val token: String = "<SEM_TOKEN>",
        val cacheDays: Long = 7,
        val referenceCacheDays: Long = 30,
        val dailyBudget: Int = 450,
    )

    data class VehicleData(
        val mode: String = "mock",
        val provider: String = "<PREENCHER>",
        val baseUrl: String = "<PREENCHER>",
        val apiKey: String = "<SEM_TOKEN>",
        val readTimeout: Duration = Duration.ofSeconds(15),
    ) {
        val isMock: Boolean get() = mode != "live" || !Secrets.isSet(apiKey) || !Secrets.isSet(baseUrl)
    }

    data class Push(
        val mode: String = "log",
        val vapidPublicKey: String = "<PREENCHER>",
        val vapidPrivateKey: String = "<SEM_TOKEN>",
        val vapidSubject: String = "mailto:<PREENCHER>",
    ) {
        val isLive: Boolean get() = mode == "live" && Secrets.isSet(vapidPublicKey) && Secrets.isSet(vapidPrivateKey)
    }

    data class Email(
        val mode: String = "log",
        val resendApiKey: String = "<SEM_TOKEN>",
        val from: String = "QueroRevisar <alertas@<PREENCHER>>",
        val outboxDir: String = "build/mail-outbox",
        val resendBaseUrl: String = "https://api.resend.com",
    ) {
        val isLive: Boolean get() = mode == "live" && Secrets.isSet(resendApiKey) && Secrets.isSet(from)
    }

    data class PostHog(val key: String = "<SEM_TOKEN>", val host: String = "https://us.i.posthog.com")

    data class RateLimit(
        val enabled: Boolean = true,
        val readsPerMinute: Long = 300,
        val writesPerMinute: Long = 60,
        val purchasesPerMinute: Long = 10,
        val lookupsPerMinute: Long = 20,
    )

    /** Timeouts for every external call (F04.3). */
    data class Http(
        val connectTimeout: Duration = Duration.ofSeconds(3),
        val readTimeout: Duration = Duration.ofSeconds(10),
    )
}
