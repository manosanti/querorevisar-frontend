package br.com.querorevisar.api.common

import br.com.querorevisar.api.billing.QrPng
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.mock.env.MockEnvironment
import java.util.Base64

class UnitsTest {
    @Test
    fun `DATABASE_URL becomes JDBC settings`() {
        val local = ApiEnvironmentPostProcessor.toJdbc("postgresql://postgres:postgres@127.0.0.1:54322/postgres")!!
        assertEquals("jdbc:postgresql://127.0.0.1:54322/postgres", local.url)
        assertEquals("postgres", local.user)
        assertEquals("postgres", local.password)
        val pooler = ApiEnvironmentPostProcessor.toJdbc("postgres://postgres.abc:p%40ss@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require")!!
        assertEquals("jdbc:postgresql://aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0", pooler.url)
        assertEquals("p@ss", pooler.password)
        assertEquals("jdbc:postgresql://x/y", ApiEnvironmentPostProcessor.toJdbc("jdbc:postgresql://x/y")!!.url)
        assertNull(ApiEnvironmentPostProcessor.toJdbc("<SEM_TOKEN>"))
    }

    @Test
    fun `placeholders are not secrets`() {
        assertFalse(Secrets.isSet("<SEM_TOKEN>"))
        assertFalse(Secrets.isSet("mailto:<PREENCHER>"))
        assertFalse(Secrets.isSet(""))
        assertTrue(Secrets.isSet("TEST-123"))
    }

    @Test
    fun `AUTH_MODE=dev only with the local profile`() {
        val env = MockEnvironment().withProperty("app.auth.mode", "dev")
        env.setActiveProfiles("dev")
        assertThrows(IllegalStateException::class.java) { StartupGuard.check(env) }
        env.setActiveProfiles("local")
        StartupGuard.check(env)
        val none = MockEnvironment()
        assertThrows(IllegalStateException::class.java) { StartupGuard.check(none) }
    }

    @Test
    fun `logs never carry e-mails, plates or tokens`() {
        val text = Redact.text("user joao@exemplo.com.br plate ABC1D23 token Bearer abc.def eyJhbGciOi.eyJzdWIi.c2ln")!!
        assertFalse(text.contains("joao@"))
        assertFalse(text.contains("ABC1D23"))
        assertTrue(text.contains("ABC1***"))
        assertFalse(text.contains("eyJhbGciOi"))
        assertFalse(text.contains("abc.def"))
    }

    @Test
    fun `mock Pix QR is a PNG of a BR Code with CRC`() {
        val payload = QrPng.fakePixPayload("0b4b5c8a-1111-2222-3333-444455556666", 4790)
        assertTrue(payload.startsWith("000201"))
        assertTrue(payload.contains("br.gov.bcb.pix"))
        assertTrue(payload.contains("540547.90"))
        assertTrue(Regex("6304[0-9A-F]{4}$").containsMatchIn(payload))
        val png = Base64.getDecoder().decode(QrPng.base64(payload))
        assertEquals(listOf(0x89, 0x50, 0x4E, 0x47), png.take(4).map { it.toInt() and 0xFF })
    }
}
