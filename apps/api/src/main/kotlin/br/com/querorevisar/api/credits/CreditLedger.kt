package br.com.querorevisar.api.credits

import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

/**
 * Immutable credit ledger (credit_ledger): purchases, Premium bonus, lookups and refunds. Idempotent by the unique
 * (reason, ref_type, ref_id); the balance is the sum of deltas (view credit_balances) and never goes negative.
 */
@Repository
class CreditLedger(private val jdbc: JdbcClient) {
    fun balance(userId: UUID): Int =
        jdbc.sql("select coalesce(sum(delta), 0)::int from credit_ledger where user_id = :u").param("u", userId)
            .query(Int::class.java).single()

    /** Inserts an entry; false when the same (reason, refType, refId) already exists. */
    fun add(userId: UUID, delta: Int, reason: LedgerReason, refType: String, refId: String, at: Instant? = null): Boolean =
        jdbc.sql(
            """insert into credit_ledger(user_id, delta, reason, ref_type, ref_id, created_at)
               values (:u, :d, :r, :t, :i, coalesce(cast(:at as timestamptz), now()))
               on conflict (reason, ref_type, ref_id) do nothing""",
        ).param("u", userId).param("d", delta).param("r", reason.name).param("t", refType).param("i", refId)
            .param("at", at?.odt()).update() == 1

    fun exists(reason: LedgerReason, refType: String, refId: String): Boolean =
        jdbc.sql("select count(*) from credit_ledger where reason = :r and ref_type = :t and ref_id = :i")
            .param("r", reason.name).param("t", refType).param("i", refId).query(Int::class.java).single() > 0

    /** Last Premium bonus of the user, any source. */
    fun lastPremiumBonus(userId: UUID, refType: String? = null): Instant? =
        jdbc.sql(
            """select max(created_at) from credit_ledger where user_id = :u and reason = 'premium_bonus'
               and (cast(:t as text) is null or ref_type = :t)""",
        ).param("u", userId).param("t", refType)
            .query { rs, _ -> rs.getObject(1, java.time.OffsetDateTime::class.java)?.toInstant() }.list().firstOrNull()

    fun entries(userId: UUID): List<LedgerEntry> =
        jdbc.sql("select id, delta, reason, created_at from credit_ledger where user_id = :u order by created_at desc, id")
            .param("u", userId).query { rs, _ ->
                LedgerEntry(
                    rs.getObject("id", UUID::class.java), rs.getInt("delta"), LedgerReason.valueOf(rs.getString("reason")),
                    rs.instantOrThrow("created_at"),
                )
            }.list()
}
