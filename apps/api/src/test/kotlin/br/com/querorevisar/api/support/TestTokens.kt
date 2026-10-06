package br.com.querorevisar.api.support

import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.client.WireMock
import com.github.tomakehurst.wiremock.core.WireMockConfiguration
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.time.Instant
import java.util.Date
import java.util.UUID

/** Supabase-shaped access tokens for tests: legacy HS256 (SUPABASE_JWT_SECRET) and ES256 served by a JWKS stub. */
object TestTokens {
    const val HS_SECRET = "test-only-legacy-hs256-secret-0123456789abcdef"

    val ecKey: ECKey by lazy { ECKeyGenerator(Curve.P_256).keyID("test-es256").generate() }

    private val jwksServer: WireMockServer by lazy {
        WireMockServer(WireMockConfiguration.options().dynamicPort()).also { server ->
            server.start()
            server.stubFor(
                WireMock.get("/auth/v1/.well-known/jwks.json").willReturn(
                    WireMock.okJson(JWKSet(ecKey.toPublicJWK()).toString()),
                ),
            )
            Runtime.getRuntime().addShutdownHook(Thread { server.stop() })
        }
    }

    val jwksUrl: String get() = "http://localhost:${jwksServer.port()}/auth/v1/.well-known/jwks.json"

    fun claims(
        userId: UUID,
        anonymous: Boolean = false,
        email: String? = null,
        name: String? = null,
        role: String = "authenticated",
        audience: String = "authenticated",
        expiresAt: Instant = Instant.now().plusSeconds(3600),
    ): JWTClaimsSet = JWTClaimsSet.Builder()
        .subject(userId.toString())
        .audience(audience)
        .issuer("http://127.0.0.1:54321/auth/v1")
        .issueTime(Date())
        .expirationTime(Date.from(expiresAt))
        .claim("role", role)
        .claim("is_anonymous", anonymous)
        .claim("user_metadata", if (name != null) mapOf("name" to name) else emptyMap<String, Any>())
        .apply { if (email != null) claim("email", email) }
        .build()

    fun hs256(claims: JWTClaimsSet, secret: String = HS_SECRET): String =
        SignedJWT(JWSHeader(JWSAlgorithm.HS256), claims).apply { sign(MACSigner(secret.toByteArray())) }.serialize()

    fun es256(claims: JWTClaimsSet, key: ECKey = ecKey): String =
        SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(key.keyID).build(), claims).apply { sign(ECDSASigner(key)) }.serialize()
}
