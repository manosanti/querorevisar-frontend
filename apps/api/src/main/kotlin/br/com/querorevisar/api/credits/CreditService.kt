package br.com.querorevisar.api.credits

import br.com.querorevisar.api.account.AuthUsers
import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.billing.ChargeRequest
import br.com.querorevisar.api.billing.MockPaymentGateway
import br.com.querorevisar.api.billing.PaymentEvents
import br.com.querorevisar.api.billing.PaymentGateway
import br.com.querorevisar.api.billing.PaymentGatewayException
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.domain.CreditPricing
import br.com.querorevisar.api.domain.PtBr
import com.github.benmanes.caffeine.cache.Caffeine
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/** F09.3 credit packs and purchases (Pix via /v1/payments, card via Checkout Pro). */
@Service
class CreditService(
    private val purchases: PurchaseRepository,
    private val ledger: CreditLedger,
    private val gateway: PaymentGateway,
    private val events: PaymentEvents,
    private val authUsers: AuthUsers,
    private val props: AppProperties,
    private val clock: Clock,
    private val scheduler: ScheduledExecutorService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val lastCheck = Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(5)).build<UUID, Instant>()

    fun packs(): List<CreditPack> = CreditPricing.PACKS.map {
        CreditPack(it.id, it.credits, it.priceCents, CreditPricing.unitPriceCents(it), CreditPricing.discountPct(it, props.credits.unitPriceCents), it.tag)
    }

    fun balance(userId: UUID): Int = ledger.balance(userId)

    fun ledger(userId: UUID): List<LedgerEntry> = ledger.entries(userId)

    fun create(user: CurrentUser, req: CreditPurchaseCreate): CreditPurchase {
        val pack = CreditPricing.find(req.packId!!) ?: throw ApiException.validation("Escolha um pacote", "packId")
        val method = req.method!!
        val email = user.email ?: authUsers.email(user.id)
        if (gateway !is MockPaymentGateway && email == null) {
            throw ApiException.validation("Crie uma conta com e-mail para comprar créditos.", "email")
        }
        val now = clock.instant()
        val id = UUID.randomUUID()
        val expiresAt = if (method == PaymentMethod.pix) now.plus(Duration.ofMinutes(props.payments.pixExpirationMinutes)) else null
        purchases.insert(
            PurchaseRow(
                id, user.id, pack.id, pack.credits, pack.priceCents, method, PurchaseStatus.pending,
                null, null, expiresAt, null, null, null, now, now,
            ),
        )
        val charge = ChargeRequest(id, pack.id, pack.credits, pack.priceCents, "QueroRevisar · ${PtBr.credits(pack.credits)}", email, req.payerCpf, expiresAt)
        try {
            if (method == PaymentMethod.pix) {
                val pix = gateway.createPix(charge)
                purchases.setCheckout(id, pix.paymentId, null, pix.qrCode, pix.qrCodeBase64, null, pix.expiresAt, now)
                if (gateway is MockPaymentGateway) {
                    scheduler.schedule({ autoApprove(pix.paymentId) }, props.payments.mockAutoApproveDelay.toMillis(), TimeUnit.MILLISECONDS)
                }
            } else {
                val pref = gateway.createPreference(charge)
                purchases.setCheckout(id, null, pref.preferenceId, null, null, pref.initPoint, null, now)
            }
        } catch (e: PaymentGatewayException) {
            Redact.error(log, "Could not create the ${method.name} charge", e)
            purchases.setStatus(id, PurchaseStatus.rejected, null, now)
            throw ApiException(ProblemCode.PAYMENT_ERROR)
        }
        return purchases.find(user.id, id)!!.toDto()
    }

    /** Polled every 3 s by the web until approved/expired. */
    fun get(userId: UUID, id: UUID): CreditPurchase {
        val p = purchases.find(userId, id) ?: throw ApiException.notFound("Compra não encontrada.")
        if (p.status != PurchaseStatus.pending) return p.toDto()
        val now = clock.instant()
        val paymentId = p.providerPaymentId
        if (gateway is MockPaymentGateway) {
            // Survives restarts: a mock Pix older than the auto-approval delay is approved on read.
            if (p.method == PaymentMethod.pix && paymentId != null && !p.createdAt.plus(props.payments.mockAutoApproveDelay).isAfter(now)) {
                autoApprove(paymentId)
            }
        } else if (paymentId != null) {
            // Late webhook: re-check at Mercado Pago at most every 15 s per purchase.
            val last = lastCheck.getIfPresent(id)
            if (last == null || last.isBefore(now.minusSeconds(15))) {
                lastCheck.put(id, now)
                runCatching { events.handlePayment(paymentId) }
                    .onFailure { log.warn("Payment re-check failed: {}", it.javaClass.simpleName) }
            }
        }
        val fresh = purchases.find(userId, id)!!
        if (fresh.status == PurchaseStatus.pending && fresh.expiresAt != null && fresh.expiresAt.isBefore(now)) {
            purchases.setStatus(id, PurchaseStatus.expired, null, now)
            return purchases.find(userId, id)!!.toDto()
        }
        return fresh.toDto()
    }

    /** Mock approval: the same handler the webhook runs, after the mock gateway marks the payment approved. */
    fun autoApprove(paymentId: String) {
        val mock = gateway as? MockPaymentGateway ?: return
        if (!props.payments.mockApprovals) return
        try {
            mock.markApproved(paymentId)
            events.handlePayment(paymentId)
        } catch (e: Exception) {
            Redact.error(log, "Mock auto-approval failed", e)
        }
    }
}
