package br.com.querorevisar.api.push

import com.fasterxml.jackson.databind.ObjectMapper
import nl.martijndwars.webpush.Encoding
import nl.martijndwars.webpush.Notification
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import java.io.File
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Security
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import org.bouncycastle.jce.interfaces.ECPublicKey as BcEcPublicKey

/** scripts/gen-vapid.ts (C11) produces a pair that the library behind WebPushSender accepts. */
class VapidKeysTest {
    private fun repoRoot(): File {
        var dir: File? = File("").absoluteFile
        while (dir != null && !File(dir, "scripts/gen-vapid.ts").exists()) dir = dir.parentFile
        return requireNotNull(dir) { "scripts/gen-vapid.ts not found" }
    }

    private fun generate(): Pair<String, String> {
        val root = repoRoot()
        val process = try {
            ProcessBuilder("node", "scripts/gen-vapid.ts", "--json").directory(root).redirectErrorStream(false).start()
        } catch (e: java.io.IOException) {
            assumeTrue(false, "node is not available")
            throw e
        }
        val out = process.inputStream.readBytes().toString(Charsets.UTF_8)
        assertEquals(0, process.waitFor(), "gen-vapid.ts failed")
        val json = ObjectMapper().readTree(out.trim().lines().last())
        return json["publicKey"].asText() to json["privateKey"].asText()
    }

    @Test
    fun `generated keys have the sizes and encoding Web Push expects`() {
        val (pub, priv) = generate()
        val url = Regex("^[A-Za-z0-9_-]+$")
        assertTrue(url.matches(pub) && url.matches(priv), "base64url without padding")
        val pubBytes = Base64.getUrlDecoder().decode(pub)
        assertEquals(65, pubBytes.size)
        assertEquals(0x04, pubBytes[0].toInt(), "uncompressed point")
        assertEquals(32, Base64.getUrlDecoder().decode(priv).size)
    }

    @Test
    fun `the web-push library signs a request with the generated pair`() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) Security.addProvider(BouncyCastleProvider())
        val (pub, priv) = generate()
        val service = nl.martijndwars.webpush.PushService(pub, priv, "mailto:suporte@querorevisar.com.br")

        // A browser subscription: its own P-256 key and a 16-byte auth secret.
        val kpg = KeyPairGenerator.getInstance("ECDH", BouncyCastleProvider.PROVIDER_NAME)
        kpg.initialize(ECGenParameterSpec("prime256v1"), SecureRandom())
        val browserKey = kpg.generateKeyPair().public as BcEcPublicKey
        val p256dh = Base64.getUrlEncoder().withoutPadding().encodeToString(browserKey.q.getEncoded(false))
        val auth = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(16).also { SecureRandom().nextBytes(it) })

        val request = service.preparePost(
            Notification("https://push.example.test/send/abc", p256dh, auth, "{}".toByteArray()),
            Encoding.AES128GCM,
        )
        val authorization = request.getFirstHeader("Authorization").value
        assertTrue(authorization.startsWith("vapid t="), authorization)
        assertTrue(authorization.contains("k=$pub"), "the public key travels in the Authorization header")
    }
}
