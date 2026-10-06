package br.com.querorevisar.api.credits

import br.com.querorevisar.api.common.instant
import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

data class PurchaseRow(
    val id: UUID,
    val userId: UUID,
    val packId: String,
    val credits: Int,
    val amountCents: Int,
    val method: PaymentMethod,
    val status: PurchaseStatus,
    val providerPaymentId: String?,
    val providerPreferenceId: String?,
    val expiresAt: Instant?,
    val qrCode: String?,
    val qrCodeBase64: String?,
    val initPoint: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    fun toDto() = CreditPurchase(id, status, method, credits, amountCents, qrCode, qrCodeBase64, expiresAt, initPoint)
}

@Repository
class PurchaseRepository(private val jdbc: JdbcClient) {
    fun insert(p: PurchaseRow) {
        jdbc.sql(
            """insert into credit_purchases(id, user_id, pack_id, credits, amount_cents, method, status, expires_at, created_at, updated_at)
               values (:id, :u, :pack, :credits, :amount, :method, :status, :exp, :t, :t)""",
        ).param("id", p.id).param("u", p.userId).param("pack", p.packId).param("credits", p.credits)
            .param("amount", p.amountCents).param("method", p.method.name).param("status", p.status.name)
            .param("exp", p.expiresAt?.odt()).param("t", p.createdAt.odt()).update()
    }

    fun find(userId: UUID, id: UUID): PurchaseRow? =
        jdbc.sql("select * from credit_purchases where id = :id and user_id = :u").param("id", id).param("u", userId)
            .query { rs, _ -> map(rs) }.optional().orElse(null)

    fun findById(id: UUID): PurchaseRow? =
        jdbc.sql("select * from credit_purchases where id = :id").param("id", id).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun lock(id: UUID): PurchaseRow? =
        jdbc.sql("select * from credit_purchases where id = :id for update").param("id", id).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun setCheckout(id: UUID, paymentId: String?, preferenceId: String?, qrCode: String?, qrCodeBase64: String?, initPoint: String?, expiresAt: Instant?, now: Instant) {
        jdbc.sql(
            """update credit_purchases set provider_payment_id = coalesce(:pay, provider_payment_id),
               provider_preference_id = coalesce(:pref, provider_preference_id), qr_code = :qr, qr_code_base64 = :qr64,
               init_point = :init, expires_at = coalesce(:exp, expires_at), updated_at = :t where id = :id""",
        ).param("pay", paymentId).param("pref", preferenceId).param("qr", qrCode).param("qr64", qrCodeBase64)
            .param("init", initPoint).param("exp", expiresAt?.odt()).param("t", now.odt()).param("id", id).update()
    }

    fun setStatus(id: UUID, status: PurchaseStatus, paymentId: String?, now: Instant) {
        jdbc.sql(
            """update credit_purchases set status = :s, provider_payment_id = coalesce(provider_payment_id, :pay), updated_at = :t
               where id = :id""",
        ).param("s", status.name).param("pay", paymentId).param("t", now.odt()).param("id", id).update()
    }

    /** Pending Pix purchases past their expiration become `expired`. */
    fun expirePending(now: Instant): Int =
        jdbc.sql("update credit_purchases set status = 'expired', updated_at = :t where status = 'pending' and expires_at < :t")
            .param("t", now.odt()).update()

    private fun map(rs: ResultSet) = PurchaseRow(
        id = rs.getObject("id", UUID::class.java),
        userId = rs.getObject("user_id", UUID::class.java),
        packId = rs.getString("pack_id"),
        credits = rs.getInt("credits"),
        amountCents = rs.getInt("amount_cents"),
        method = PaymentMethod.valueOf(rs.getString("method")),
        status = PurchaseStatus.valueOf(rs.getString("status")),
        providerPaymentId = rs.getString("provider_payment_id"),
        providerPreferenceId = rs.getString("provider_preference_id"),
        expiresAt = rs.instant("expires_at"),
        qrCode = rs.getString("qr_code"),
        qrCodeBase64 = rs.getString("qr_code_base64"),
        initPoint = rs.getString("init_point"),
        createdAt = rs.instantOrThrow("created_at"),
        updatedAt = rs.instantOrThrow("updated_at"),
    )
}
