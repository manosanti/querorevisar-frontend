package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.AppProperties
import com.nimbusds.jose.jwk.source.ImmutableSecret
import com.nimbusds.jose.proc.SecurityContext
import org.slf4j.LoggerFactory
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID
import javax.crypto.SecretKey

/**
 * AUTH_MODE=dev (local profile only): HS256 tokens shaped like Supabase access tokens, signed with
 * DEV_AUTH_SECRET or with a random secret persisted to build/dev-auth-secret on first use.
 */
@Component
class DevTokens(private val props: AppProperties, private val clock: Clock) {
    private val log = LoggerFactory.getLogger(javaClass)

    val key: SecretKey by lazy { HmacKeys.hs256(loadSecret()) }

    private val encoder by lazy { NimbusJwtEncoder(ImmutableSecret<SecurityContext>(key)) }

    fun decoder(): JwtDecoder = HmacKeys.decoder(key)

    data class Issued(val token: String, val expiresAt: Instant)

    fun issue(userId: UUID, isAnonymous: Boolean, email: String?, name: String?): Issued {
        val now = clock.instant()
        val exp = now.plus(props.auth.devTokenTtl)
        val claims = JwtClaimsSet.builder()
            .issuer("${props.apiUrl}/dev/auth")
            .subject(userId.toString())
            .audience(listOf("authenticated"))
            .issuedAt(now)
            .expiresAt(exp)
            .claim("role", "authenticated")
            .claim("is_anonymous", isAnonymous)
            .claim("user_metadata", if (name != null) mapOf("name" to name) else emptyMap<String, Any>())
            .apply { if (email != null) claim("email", email) }
            .build()
        val header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build()
        val token = encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
        return Issued(token, exp)
    }

    private fun loadSecret(): String {
        if (props.auth.devSecret.isNotBlank()) return props.auth.devSecret
        val file = Path.of(props.auth.devSecretFile)
        if (Files.exists(file)) return Files.readString(file).trim()
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val secret = Base64.getEncoder().encodeToString(bytes)
        file.toAbsolutePath().parent?.let { Files.createDirectories(it) }
        Files.writeString(file, secret)
        log.info("Generated a dev auth secret at {}", file.toAbsolutePath())
        return secret
    }
}
