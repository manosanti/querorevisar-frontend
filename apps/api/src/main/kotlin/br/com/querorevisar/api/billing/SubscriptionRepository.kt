package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.instant
import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

data class SubscriptionRow(
    val id: UUID,
    val userId: UUID,
    val providerId: String,
    /** pending | authorized | paused | cancelled */
    val status: String,
    val nextBillingAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@Repository
class SubscriptionRepository(private val jdbc: JdbcClient) {
    fun insert(s: SubscriptionRow) {
        jdbc.sql(
            """insert into subscriptions(id, user_id, provider, provider_id, status, next_billing_at, created_at, updated_at)
               values (:id, :u, 'mercadopago', :p, :s, :n, :t, :t)""",
        ).param("id", s.id).param("u", s.userId).param("p", s.providerId).param("s", s.status)
            .param("n", s.nextBillingAt?.odt()).param("t", s.createdAt.odt()).update()
    }

    fun find(userId: UUID, id: UUID): SubscriptionRow? =
        jdbc.sql("select * from subscriptions where id = :id and user_id = :u").param("id", id).param("u", userId)
            .query { rs, _ -> map(rs) }.optional().orElse(null)

    fun byProviderId(providerId: String): SubscriptionRow? =
        jdbc.sql("select * from subscriptions where provider_id = :p").param("p", providerId).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun latest(userId: UUID): SubscriptionRow? =
        jdbc.sql("select * from subscriptions where user_id = :u order by created_at desc limit 1").param("u", userId)
            .query { rs, _ -> map(rs) }.optional().orElse(null)

    /** The subscription that counts: authorized or paused first, then the newest pending one. */
    fun current(userId: UUID): SubscriptionRow? =
        jdbc.sql(
            """select * from subscriptions where user_id = :u and status in ('authorized','paused','pending')
               order by case status when 'authorized' then 0 when 'paused' then 1 else 2 end, created_at desc limit 1""",
        ).param("u", userId).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun update(id: UUID, status: String, nextBillingAt: Instant?, now: Instant) {
        jdbc.sql("update subscriptions set status = :s, next_billing_at = :n, updated_at = :t where id = :id")
            .param("s", status).param("n", nextBillingAt?.odt()).param("t", now.odt()).param("id", id).update()
    }

    private fun map(rs: ResultSet) = SubscriptionRow(
        id = rs.getObject("id", UUID::class.java),
        userId = rs.getObject("user_id", UUID::class.java),
        providerId = rs.getString("provider_id"),
        status = rs.getString("status"),
        nextBillingAt = rs.instant("next_billing_at"),
        createdAt = rs.instantOrThrow("created_at"),
        updatedAt = rs.instantOrThrow("updated_at"),
    )
}
