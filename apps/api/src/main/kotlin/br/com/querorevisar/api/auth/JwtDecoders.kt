package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Secrets
import com.nimbusds.jwt.JWTParser
import org.slf4j.LoggerFactory
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.BadJwtException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtTimestampValidator
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.web.client.RestTemplate
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/** Checks shared by Supabase and dev tokens: not expired, audience "authenticated", a UUID subject, user role. */
object UserTokenValidator : OAuth2TokenValidator<Jwt> {
    private val timestamps = JwtTimestampValidator()

    private fun fail(msg: String) = OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", msg, null))

    override fun validate(token: Jwt): OAuth2TokenValidatorResult {
        val ts = timestamps.validate(token)
        if (ts.hasErrors()) return ts
        if (token.expiresAt == null) return fail("missing exp")
        if (!token.audience.orEmpty().contains("authenticated")) return fail("audience")
        val role = token.getClaimAsString("role")
        if (role != null && role != "authenticated") return fail("role")
        if (runCatching { UUID.fromString(token.subject) }.isFailure) return fail("subject")
        return OAuth2TokenValidatorResult.success()
    }
}

object HmacKeys {
    /** HS256 needs at least 256 bits: shorter secrets are stretched with SHA-256. */
    fun hs256(secret: String): SecretKey {
        val raw = secret.toByteArray(Charsets.UTF_8)
        val bytes = if (raw.size >= 32) raw else MessageDigest.getInstance("SHA-256").digest(raw)
        return SecretKeySpec(bytes, "HmacSHA256")
    }

    fun decoder(key: SecretKey): NimbusJwtDecoder =
        NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().also { it.setJwtValidator(UserTokenValidator) }
}

/**
 * AUTH_MODE=supabase: asymmetric tokens (ES256/RS256) are verified against the project's JWKS
 * (SUPABASE_JWKS_URL); HS256 tokens are accepted only when SUPABASE_JWT_SECRET is configured (legacy secret).
 */
class SupabaseJwtDecoder(private val props: AppProperties) : JwtDecoder {
    private val log = LoggerFactory.getLogger(javaClass)

    private val hs: JwtDecoder? = props.supabase.jwtSecret.takeIf { Secrets.isSet(it) }?.let { HmacKeys.decoder(HmacKeys.hs256(it)) }

    private val jwks: JwtDecoder by lazy {
        val factory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(props.http.connectTimeout)
            setReadTimeout(props.http.readTimeout)
        }
        NimbusJwtDecoder.withJwkSetUri(props.supabase.jwksUrl)
            .jwsAlgorithms { it.add(SignatureAlgorithm.ES256); it.add(SignatureAlgorithm.RS256) }
            .restOperations(RestTemplate(factory))
            .build()
            .also { it.setJwtValidator(DelegatingOAuth2TokenValidator(listOf(UserTokenValidator))) }
    }

    init {
        if (hs == null) log.info("SUPABASE_JWT_SECRET not set: only JWKS-signed (ES256/RS256) tokens are accepted")
    }

    override fun decode(token: String): Jwt {
        val alg = try {
            JWTParser.parse(token).header.algorithm?.name
        } catch (e: Exception) {
            throw BadJwtException("Malformed token", e)
        }
        return when (alg) {
            "HS256" -> (hs ?: throw BadJwtException("HS256 tokens are not accepted")).decode(token)
            "ES256", "RS256" -> jwks.decode(token)
            else -> throw BadJwtException("Unsupported algorithm")
        }
    }
}
