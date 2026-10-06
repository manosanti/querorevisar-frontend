package br.com.querorevisar.api.account

import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.instant
import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.mail.MailTemplates
import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import java.sql.ResultSet
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

data class ProfileRow(
    val userId: UUID,
    val name: String?,
    val plan: String,
    val premiumUntil: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Premium counts only while premium_until is in the future (the daily job also downgrades expired plans). */
    fun isPremium(now: Instant): Boolean = plan == "premium" && (premiumUntil == null || premiumUntil.isAfter(now))

    fun effectivePlan(now: Instant): Plan = if (isPremium(now)) Plan.premium else Plan.free
}

/** profiles rows: created on the first authenticated request (F04.2), plan and Premium validity. */
@Service
class ProfileService(
    private val jdbc: JdbcClient,
    private val clock: Clock,
    private val mail: MailService,
    private val props: AppProperties,
) {
    private val known = Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(30)).maximumSize(100_000).build<String, Boolean>()

    fun ensure(user: CurrentUser) {
        val cacheKey = "${user.id}:${user.isAnonymous}"
        if (known.getIfPresent(cacheKey) == true) return
        try {
            jdbc.sql("insert into profiles(user_id, name) values (:u, :n) on conflict (user_id) do nothing")
                .param("u", user.id).param("n", user.name?.take(80)).update()
        } catch (e: DataIntegrityViolationException) {
            // The token is valid but the auth user no longer exists (deleted account).
            throw ApiException(ProblemCode.UNAUTHORIZED)
        }
        if (!user.isAnonymous && user.email != null) sendWelcomeOnce(user)
        known.put(cacheKey, true)
    }

    private fun sendWelcomeOnce(user: CurrentUser) {
        val first = jdbc.sql(
            "update profiles set welcome_sent_at = :t where user_id = :u and welcome_sent_at is null",
        ).param("t", clock.instant().odt()).param("u", user.id).update() == 1
        if (first) mail.send(MailTemplates.welcome(user.email!!, user.name ?: find(user.id)?.name, props.appUrl))
    }

    /** Forgets the cached "profile exists" flag (account deleted). */
    fun forget(userId: UUID) {
        known.invalidate("$userId:true")
        known.invalidate("$userId:false")
    }

    fun find(userId: UUID): ProfileRow? =
        jdbc.sql("select * from profiles where user_id = :u").param("u", userId).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun get(userId: UUID): ProfileRow = find(userId) ?: throw ApiException(ProblemCode.UNAUTHORIZED)

    /** Serializes writes of one user (plan limits, credit balance) inside the caller's transaction. */
    fun lock(userId: UUID): ProfileRow =
        jdbc.sql("select * from profiles where user_id = :u for update").param("u", userId).query { rs, _ -> map(rs) }
            .optional().orElseThrow { ApiException(ProblemCode.UNAUTHORIZED) }

    fun isPremium(userId: UUID): Boolean = find(userId)?.isPremium(clock.instant()) ?: false

    fun updateName(userId: UUID, name: String) {
        jdbc.sql("update profiles set name = :n, updated_at = :t where user_id = :u")
            .param("n", name).param("t", clock.instant().odt()).param("u", userId).update()
    }

    private fun map(rs: ResultSet) = ProfileRow(
        userId = rs.getObject("user_id", UUID::class.java),
        name = rs.getString("name"),
        plan = rs.getString("plan"),
        premiumUntil = rs.instant("premium_until"),
        createdAt = rs.instantOrThrow("created_at"),
        updatedAt = rs.instantOrThrow("updated_at"),
    )
}
