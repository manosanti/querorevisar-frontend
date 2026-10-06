package br.com.querorevisar.api.billing

import br.com.querorevisar.api.account.AuthUsers
import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.credits.CreditService
import br.com.querorevisar.api.credits.PurchaseRepository
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.mail.MailTemplates
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Suppress("EnumEntryName")
enum class PremiumState { none, pending, authorized, paused, cancelled }

@ApiDto
data class PremiumStatus(val status: PremiumState, val nextBillingDate: Instant?, val premiumUntil: Instant?)

@ApiDto
data class CheckoutRedirect(val initPoint: String)

/** F09.2 Premium subscription (Mercado Pago preapproval). */
@Service
class PremiumService(
    private val gateway: PaymentGateway,
    private val subscriptions: SubscriptionRepository,
    private val profiles: ProfileService,
    private val events: PaymentEvents,
    private val purchases: PurchaseRepository,
    private val credits: CreditService,
    private val authUsers: AuthUsers,
    private val mail: MailService,
    private val props: AppProperties,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun status(userId: UUID): PremiumStatus {
        val sub = subscriptions.current(userId) ?: subscriptions.latest(userId)
        val profile = profiles.find(userId)
        val state = sub?.status?.let { s -> PremiumState.entries.firstOrNull { it.name == s } } ?: PremiumState.none
        return PremiumStatus(
            status = state,
            nextBillingDate = if (state == PremiumState.authorized) sub?.nextBillingAt else null,
            premiumUntil = profile?.premiumUntil,
        )
    }

    fun checkout(user: CurrentUser): CheckoutRedirect {
        val current = subscriptions.current(user.id)
        if (current?.status == "authorized" && profiles.isPremium(user.id)) throw ApiException.conflict("Você já é Premium.")
        val email = user.email ?: authUsers.email(user.id)
        if (gateway !is MockPaymentGateway && email == null) {
            throw ApiException.validation("Crie uma conta com e-mail para assinar o Premium.", "email")
        }
        val id = UUID.randomUUID()
        val pre = try {
            gateway.createSubscription(id, user.id, email, props.payments.premiumPriceCents)
        } catch (e: PaymentGatewayException) {
            Redact.error(log, "Could not create the Premium subscription", e)
            throw ApiException(ProblemCode.PAYMENT_ERROR)
        }
        val now = clock.instant()
        subscriptions.insert(SubscriptionRow(id, user.id, pre.id, "pending", null, now, now))
        return CheckoutRedirect(pre.initPoint ?: throw ApiException(ProblemCode.PAYMENT_ERROR))
    }

    /** PUT /preapproval/{id} status cancelled; the plan stays Premium until premium_until. */
    fun cancel(userId: UUID): PremiumStatus {
        val sub = subscriptions.current(userId) ?: throw ApiException.notFound("Você não tem uma assinatura ativa.")
        try {
            gateway.cancelPreapproval(sub.providerId)
        } catch (e: PaymentGatewayException) {
            Redact.error(log, "Could not cancel the subscription", e)
            throw ApiException(ProblemCode.PAYMENT_ERROR)
        }
        subscriptions.update(sub.id, "cancelled", null, clock.instant())
        if (sub.status == "authorized" || sub.status == "paused") {
            authUsers.email(userId)?.let { mail.send(MailTemplates.premiumCancelled(it, profiles.find(userId)?.premiumUntil, props.appUrl)) }
        }
        return status(userId)
    }

    /** Account deletion: cancels a live subscription at Mercado Pago (best effort). */
    fun cancelForDeletion(userId: UUID) {
        val sub = subscriptions.current(userId) ?: return
        runCatching { gateway.cancelPreapproval(sub.providerId) }
            .onFailure { log.warn("Could not cancel the subscription before deleting the account: {}", it.javaClass.simpleName) }
    }

    /**
     * POST /v1/mock/payments/{id}/approve (PAYMENTS_MODE=mock): `id` is a credit purchase or a Premium checkout of the
     * user. Runs the same handlers as the webhook.
     */
    fun approveMock(userId: UUID, id: UUID) {
        val mock = gateway as? MockPaymentGateway ?: throw ApiException.notFound()
        if (!props.payments.mockApprovals) throw ApiException.notFound()
        val purchase = purchases.find(userId, id)
        if (purchase != null) {
            val paymentId = purchase.providerPaymentId ?: MockPaymentGateway.cardPaymentId(purchase.id)
            credits.autoApprove(paymentId)
            return
        }
        val sub = subscriptions.find(userId, id) ?: throw ApiException.notFound("Pagamento não encontrado.")
        mock.markApproved(sub.providerId)
        events.handlePreapproval(sub.providerId)
        val month = java.time.YearMonth.now(clock).let { it.year * 100 + it.monthValue }
        val paymentId = MockPaymentGateway.authorizedPaymentId(sub.id, month)
        mock.markApproved(paymentId)
        events.handleAuthorizedPayment(paymentId)
    }
}
