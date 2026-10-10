package br.com.querorevisar.api.account

import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Clock
import java.util.UUID

/** DB_MIRROR_AUTH_USERS (pnpm dev:all with a real Supabase project and the embedded database). */
class AuthUserMirrorIT : IntegrationTest() {
    @Autowired
    lateinit var clock: Clock

    @Autowired
    lateinit var mail: MailService

    @Autowired
    lateinit var props: AppProperties

    private fun service(mirror: Boolean) =
        ProfileService(jdbc, clock, mail, props.copy(db = AppProperties.Db(authStub = true, mirrorAuthUsers = mirror)))

    private fun stubRow(id: UUID): Map<String, Any?>? =
        jdbc.sql("select email, is_anonymous, raw_user_meta_data->>'name' as name from auth.users where id = :id")
            .param("id", id).query().listOfRows().firstOrNull()

    @Test
    fun `an unknown Supabase user is copied into the stub before the profile`() {
        val id = UUID.randomUUID()
        service(mirror = true).ensure(CurrentUser(id, isAnonymous = true, email = null, name = null))
        assertEquals(true, stubRow(id)?.get("is_anonymous"))
        assertEquals(1, jdbc.sql("select count(*) from profiles where user_id = :u").param("u", id).query(Int::class.java).single())

        // Converting the anonymous user (new cache key) updates the copy.
        service(mirror = true).ensure(CurrentUser(id, isAnonymous = false, email = "mirror-$id@test.local", name = "Ana"))
        val row = stubRow(id)!!
        assertEquals(false, row["is_anonymous"])
        assertEquals("mirror-$id@test.local", row["email"])
        assertEquals("Ana", row["name"])
    }

    @Test
    fun `an e-mail held by an older stub row moves to the new user`() {
        val old = newUser(email = "reuse-${UUID.randomUUID()}@test.local")
        val id = UUID.randomUUID()
        service(mirror = true).ensure(CurrentUser(id, isAnonymous = false, email = old.email, name = null))
        assertEquals(old.email, stubRow(id)?.get("email"))
        assertNull(stubRow(old.id)?.get("email"))
    }

    @Test
    fun `without the mirror an unknown user is refused`() {
        val id = UUID.randomUUID()
        val error = runCatching { service(mirror = false).ensure(CurrentUser(id, isAnonymous = true, email = null, name = null)) }
        assertEquals("ApiException", error.exceptionOrNull()?.javaClass?.simpleName)
        assertNull(stubRow(id))
    }
}
