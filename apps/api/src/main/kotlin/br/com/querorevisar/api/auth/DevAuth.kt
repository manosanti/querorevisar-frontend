package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.mail.MailTemplates
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

private const val EMAIL_MESSAGE = "E-mail inválido. Confira e tente de novo"
private const val PASSWORD_MESSAGE = "A senha precisa ter pelo menos 6 caracteres"

@ApiDto
data class DevUser(
    val id: UUID,
    @JsonProperty("isAnonymous") val isAnonymous: Boolean,
    val email: String?,
    val name: String?,
)

@ApiDto
data class DevSession(val accessToken: String, val expiresAt: Instant, val user: DevUser)

@ApiDto
data class DevSignup(
    @NotBlank(message = EMAIL_MESSAGE) val email: String?,
    @NotNull(message = PASSWORD_MESSAGE) @Size(min = 6, message = PASSWORD_MESSAGE) val password: String?,
    @NotBlank(message = "Informe seu nome") val name: String?,
)

@ApiDto
data class DevSignin(
    @NotBlank(message = EMAIL_MESSAGE) val email: String?,
    @NotBlank(message = "Digite sua senha") val password: String?,
)

@Suppress("EnumEntryName")
enum class DevOauthProvider { google, apple }

@ApiDto
data class DevOauth(@NotNull(message = "Escolha Google ou Apple") val provider: DevOauthProvider?)

@ApiDto
data class DevRecover(@NotBlank(message = "Digite seu e-mail para recuperar a senha") val email: String?)

/**
 * AUTH_MODE=dev (local profile, no Supabase): emulates the Supabase Auth flows the web uses against the auth.users
 * stub. Tokens look like Supabase access tokens (sub, role, aud, is_anonymous, email, user_metadata.name, exp 7 days).
 */
@Service
class DevAuthService(
    private val jdbc: JdbcClient,
    private val tokens: DevTokens,
    private val mail: MailService,
    private val mapper: JsonMapper,
    private val props: AppProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val encoder = BCryptPasswordEncoder()
    private val emailRegex = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")

    private data class StubUser(val id: UUID, val email: String?, val passwordHash: String?, val anonymous: Boolean, val name: String?)

    fun requireDevMode() {
        if (props.auth.mode != "dev") throw ApiException.notFound()
    }

    private fun session(u: StubUser): DevSession {
        val issued = tokens.issue(u.id, u.anonymous, u.email, u.name)
        return DevSession(issued.token, issued.expiresAt, DevUser(u.id, u.anonymous, u.email, u.name))
    }

    private fun find(where: String, value: Any): StubUser? =
        jdbc.sql("select id, email, encrypted_password, is_anonymous, raw_user_meta_data->>'name' as name from auth.users where $where = :v")
            .param("v", value).query { rs, _ ->
                StubUser(
                    rs.getObject("id", UUID::class.java), rs.getString("email"), rs.getString("encrypted_password"),
                    rs.getBoolean("is_anonymous"), rs.getString("name"),
                )
            }.optional().orElse(null)

    private fun meta(name: String?) = mapper.writeValueAsString(if (name != null) mapOf("name" to name) else emptyMap<String, String>())

    private fun normalizeEmail(raw: String?): String {
        val email = raw?.trim()?.lowercase().orEmpty()
        if (!emailRegex.matches(email)) throw ApiException.validation(EMAIL_MESSAGE, "email")
        return email
    }

    fun anonymous(): DevSession {
        val id = UUID.randomUUID()
        jdbc.sql("insert into auth.users(id, is_anonymous, raw_user_meta_data) values (:id, true, '{}'::jsonb)").param("id", id).update()
        return session(StubUser(id, null, null, true, null))
    }

    /** With an anonymous bearer token the same user id becomes permanent (linkIdentity / updateUser). */
    fun signup(current: CurrentUser?, req: DevSignup): DevSession {
        val email = normalizeEmail(req.email)
        val name = req.name!!.trim()
        val taken = find("email", email)
        if (taken != null && taken.id != current?.id) {
            throw ApiException(ProblemCode.CONFLICT, "Este e-mail já tem conta. Entre com a sua senha.")
        }
        val hash = encoder.encode(req.password!!)
        val id = if (current != null && current.isAnonymous && find("id", current.id) != null) {
            jdbc.sql(
                """update auth.users set email = :e, encrypted_password = :p, is_anonymous = false,
                   raw_user_meta_data = cast(:m as jsonb) where id = :id""",
            ).param("e", email).param("p", hash).param("m", meta(name)).param("id", current.id).update()
            jdbc.sql("update profiles set name = :n where user_id = :id").param("n", name).param("id", current.id).update()
            current.id
        } else {
            val newId = UUID.randomUUID()
            jdbc.sql(
                """insert into auth.users(id, email, encrypted_password, is_anonymous, raw_user_meta_data)
                   values (:id, :e, :p, false, cast(:m as jsonb))""",
            ).param("id", newId).param("e", email).param("p", hash).param("m", meta(name)).update()
            newId
        }
        return session(StubUser(id, email, hash, false, name))
    }

    fun signin(req: DevSignin): DevSession {
        val user = find("email", normalizeEmail(req.email))
        if (user?.passwordHash == null || !encoder.matches(req.password!!, user.passwordHash)) {
            throw ApiException(ProblemCode.UNAUTHORIZED, "E-mail ou senha incorretos.")
        }
        return session(user)
    }

    /** Fake Google/Apple: links the current anonymous user or signs in the fake account (google-user@local.test). */
    fun oauth(current: CurrentUser?, provider: DevOauthProvider): DevSession {
        val email = "${provider.name}-user@local.test"
        val name = if (provider == DevOauthProvider.google) "Usuário Google" else "Usuário Apple"
        find("email", email)?.let { return session(it) }
        if (current != null && current.isAnonymous && find("id", current.id) != null) {
            jdbc.sql("update auth.users set email = :e, is_anonymous = false, raw_user_meta_data = cast(:m as jsonb) where id = :id")
                .param("e", email).param("m", meta(name)).param("id", current.id).update()
            return session(StubUser(current.id, email, null, false, name))
        }
        val id = UUID.randomUUID()
        jdbc.sql("insert into auth.users(id, email, is_anonymous, raw_user_meta_data) values (:id, :e, false, cast(:m as jsonb))")
            .param("id", id).param("e", email).param("m", meta(name)).update()
        return session(StubUser(id, email, null, false, name))
    }

    /** Writes the recovery e-mail to the local outbox (never reveals whether the account exists). */
    fun recover(req: DevRecover) {
        val email = normalizeEmail(req.email)
        if (find("email", email) != null) {
            mail.send(MailTemplates.passwordRecovery(email, "${props.appUrl.trimEnd('/')}/entrar?recuperar=1", props.appUrl))
        } else {
            log.info("Recovery requested for an unknown e-mail")
        }
    }
}

@RestController
@Tag(name = "dev-auth")
class DevAuthController(private val auth: DevAuthService) {
    @PostMapping("/dev/auth/anonymous")
    @Operation(operationId = "devAuthAnonymous", summary = "Only when AUTH_MODE=dev (local profile). Emulates Supabase signInAnonymously.")
    fun anonymous(): DevSession {
        auth.requireDevMode()
        return auth.anonymous()
    }

    @PostMapping("/dev/auth/signup")
    @Operation(operationId = "devAuthSignup", summary = "With a bearer token of an anonymous user, links email+password to the same user id.")
    fun signup(@Valid @RequestBody body: DevSignup): DevSession {
        auth.requireDevMode()
        return auth.signup(CurrentUser.current(), body)
    }

    @PostMapping("/dev/auth/signin")
    @Operation(operationId = "devAuthSignin", summary = "E-mail and password sign in")
    fun signin(@Valid @RequestBody body: DevSignin): DevSession {
        auth.requireDevMode()
        return auth.signin(body)
    }

    @PostMapping("/dev/auth/oauth")
    @Operation(operationId = "devAuthOauth", summary = "Fake Google/Apple login. Links the current anonymous user or signs in the fake account.")
    fun oauth(@Valid @RequestBody body: DevOauth): DevSession {
        auth.requireDevMode()
        return auth.oauth(CurrentUser.current(), body.provider!!)
    }

    @PostMapping("/dev/auth/recover")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "devAuthRecover", summary = "Recovery e-mail written to the local outbox")
    fun recover(@Valid @RequestBody body: DevRecover) {
        auth.requireDevMode()
        auth.recover(body)
    }
}
