package br.com.querorevisar.api.billing

import br.com.querorevisar.api.account.AuthUsers
import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Zones
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.credits.CreditLedger
import br.com.querorevisar.api.credits.LedgerReason
import br.com.querorevisar.api.credits.PurchaseRepository
import br.com.querorevisar.api.credits.PurchaseRow
import br.com.querorevisar.api.credits.PurchaseStatus
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.mail.MailTemplates
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * The single place where payments change state. The webhook, the mock approval endpoint and the mock auto-approval
 * all call these handlers, which always re-read the resource from the gateway (never trust a webhook body).
 * Credits are idempotent through credit_ledger's unique (reason, ref_type, ref_id).
 */
@Service
class PaymentEvents(
    private val gateway: PaymentGateway,
    private val purchases: PurchaseRepository,
    private val subscriptions: SubscriptionRepository,
    private val ledger: CreditLedger,
    private val profiles: ProfileService,
    private val authUsers: AuthUsers,
    private val mail: MailService,
    private val jdbc: JdbcClient,
    private val props: AppProperties,
    private val clock: Clock,
    private val tx: TransactionTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handle(type: String?, dataId: String) {
        when (type) {
            "payment" -> handlePayment(dataId)
            "subscription_preapproval" -> handlePreapproval(dataId)
            "subscription_authorized_payment" -> handleAuthorizedPayment(dataId)
            else -> log.info("Ignoring Mercado Pago event type {}", type)
        }
    }

    // ---- credit purchases ---------------------------------------------------------------------------------------

    /** `payment`: approved → credits once; rejected/cancelled → purchase rejected. Returns true when credits were added. */
    fun handlePayment(paymentId: String): Boolean {
        val p = gateway.getPayment(paymentId)
        val purchaseId = p.externalReference?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return false
        return when (normalizeMpStatus(p.status)) {
            "approved" -> approvePurchase(purchaseId, p.id)
            "rejected", "cancelled" -> {
                tx.executeWithoutResult {
                    val purchase = purchases.lock(purchaseId)
                    if (purchase != null && purchase.status == PurchaseStatus.pending) {
                        purchases.setStatus(purchaseId, PurchaseStatus.rejected, p.id, clock.instant())
                    }
                }
                false
            }
            "refunded", "charged_back" -> {
                purchases.setStatus(purchaseId, PurchaseStatus.refunded, p.id, clock.instant())
                log.warn("Purchase refunded at Mercado Pago; credits kept in the ledger for manual review")
                false
            }
            else -> false
        }
    }

    fun approvePurchase(purchaseId: UUID, paymentId: String?): Boolean {
        val credited: PurchaseRow? = tx.execute {
            val purchase = purchases.lock(purchaseId) ?: return@execute null
            if (purchase.status != PurchaseStatus.approved) {
                purchases.setStatus(purchaseId, PurchaseStatus.approved, paymentId, clock.instant())
            }
            val added = ledger.add(purchase.userId, purchase.credits, LedgerReason.purchase, "credit_purchase", purchaseId.toString())
            if (added) purchase else null
        }
        if (credited != null) {
            log.info("Purchase approved: +{} credits", credited.credits)
            authUsers.email(credited.userId)?.let {
                mail.send(MailTemplates.purchaseApproved(it, credited.credits, credited.amountCents.toLong(), props.appUrl))
            }
        }
        return credited != null
    }

    // ---- Premium ------------------------------------------------------------------------------------------------

    /** `subscription_preapproval`: authorized activates Premium; cancelled/paused keep it until premium_until. */
    fun handlePreapproval(preapprovalId: String) {
        val pre = gateway.getPreapproval(preapprovalId)
        val now = clock.instant()
        var sub = subscriptions.byProviderId(preapprovalId)
        if (sub == null) {
            val userId = pre.externalReference?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            if (userId == null || profiles.find(userId) == null) {
                log.warn("Preapproval without a known user; ignored")
                return
            }
            sub = SubscriptionRow(UUID.randomUUID(), userId, preapprovalId, pre.status, pre.nextPaymentDate, now, now)
            subscriptions.insert(sub)
        }
        val previous = sub.status
        val status = pre.status.ifBlank { previous }
        subscriptions.update(sub.id, status, if (status == "cancelled") null else pre.nextPaymentDate ?: sub.nextBillingAt, now)
        when {
            status == "authorized" && previous != "authorized" -> activate(sub.userId, now)
            status == "cancelled" && previous != "cancelled" -> {
                val until = profiles.find(sub.userId)?.premiumUntil
                authUsers.email(sub.userId)?.let { mail.send(MailTemplates.premiumCancelled(it, until, props.appUrl)) }
            }
        }
    }

    /** Plan premium, premium_until at least one month ahead. */
    fun activate(userId: UUID, now: Instant) {
        var until: Instant? = null
        val wasPremium = tx.execute {
            val profile = profiles.lock(userId)
            val was = profile.isPremium(now)
            val candidate = plusMonths(now, 1)
            until = listOfNotNull(profile.premiumUntil, candidate).max()
            jdbc.sql("update profiles set plan = 'premium', premium_until = :p, updated_at = :t where user_id = :u")
                .param("p", until!!.odt()).param("t", now.odt()).param("u", userId).update()
            was
        } ?: false
        if (!wasPremium) {
            log.info("Premium activated")
            authUsers.email(userId)?.let {
                mail.send(MailTemplates.premiumActivated(it, until, props.credits.premiumMonthly, props.appUrl))
            }
        }
    }

    /** `subscription_authorized_payment`: an approved monthly charge extends premium_until and adds the bonus. */
    fun handleAuthorizedPayment(id: String) {
        val ap = gateway.getAuthorizedPayment(id)
        if (ap.paymentStatus != "approved") {
            log.info("Authorized payment not approved yet ({}/{})", ap.status, ap.paymentStatus)
            return
        }
        val sub = ap.preapprovalId?.let { subscriptions.byProviderId(it) }
        if (sub == null) {
            log.warn("Authorized payment of an unknown subscription; ignored")
            return
        }
        val now = clock.instant()
        val activatedNow = tx.execute {
            val profile = profiles.lock(sub.userId)
            val was = profile.isPremium(now)
            val until = listOfNotNull(profile.premiumUntil, plusMonths(ap.debitDate ?: now, 1)).max()
            jdbc.sql("update profiles set plan = 'premium', premium_until = :p, updated_at = :t where user_id = :u")
                .param("p", until.odt()).param("t", now.odt()).param("u", sub.userId).update()
            // The fallback job may already have paid this month's bonus when the webhook was late.
            val fallback = ledger.lastPremiumBonus(sub.userId, FALLBACK_REF)
            if (fallback == null || fallback.isBefore(now.minus(Duration.ofDays(25)))) {
                ledger.add(sub.userId, props.credits.premiumMonthly, LedgerReason.premium_bonus, "subscription_payment", ap.paymentId ?: ap.id)
            }
            !was
        } ?: false
        if (sub.status != "authorized") subscriptions.update(sub.id, "authorized", sub.nextBillingAt, now)
        if (activatedNow) {
            authUsers.email(sub.userId)?.let {
                mail.send(MailTemplates.premiumActivated(it, profiles.find(sub.userId)?.premiumUntil, props.credits.premiumMonthly, props.appUrl))
            }
        }
    }

    /** Job premium-credits: monthly bonus for Premium users that got none in 31 days (webhook failed). Idempotent per month. */
    fun premiumCreditsFallback(): Map<String, Any> {
        val now = clock.instant()
        val users = jdbc.sql("select user_id from profiles where plan = 'premium' and premium_until > :t")
            .param("t", now.odt()).query(UUID::class.java).list().filterNotNull()
        var credited = 0
        val month = java.time.YearMonth.now(clock.withZone(Zones.SAO_PAULO))
        for (u in users) {
            val last = ledger.lastPremiumBonus(u)
            if (last != null && last.isAfter(now.minus(Duration.ofDays(31)))) continue
            if (ledger.add(u, props.credits.premiumMonthly, LedgerReason.premium_bonus, FALLBACK_REF, "$u:$month")) credited++
        }
        return mapOf("premiumUsers" to users.size, "credited" to credited)
    }

    /** Daily: plans whose premium_until passed go back to free. */
    fun downgradeExpired(): Int =
        jdbc.sql("update profiles set plan = 'free', updated_at = :t where plan = 'premium' and premium_until < :t")
            .param("t", clock.instant().odt()).update()

    private fun plusMonths(i: Instant, n: Long): Instant = i.atZone(Zones.SAO_PAULO).plusMonths(n).toInstant()

    companion object {
        const val FALLBACK_REF = "premium_fallback"
    }
}
