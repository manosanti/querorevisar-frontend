package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * PAYMENTS_MODE=mock: no network. Pix returns a real QR image of a fake "copia e cola"; card and Premium return
 * `${APP_URL}/mock/checkout?kind=...&id=...`. Approvals are recorded here and then go through the same handlers the
 * webhook uses ([PaymentEvents]), which re-read the resource from this gateway.
 */
class MockPaymentGateway(private val props: AppProperties, private val clock: Clock) : PaymentGateway {
    override val mode: String = "mock"

    private val approved = ConcurrentHashMap<String, Instant>()
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    fun markApproved(id: String) {
        approved.putIfAbsent(id, clock.instant())
    }

    fun isApproved(id: String): Boolean = approved.containsKey(id)

    override fun createPix(req: ChargeRequest): PixCharge {
        val payload = QrPng.fakePixPayload(req.purchaseId.toString(), req.amountCents)
        return PixCharge(
            paymentId = pixPaymentId(req.purchaseId),
            qrCode = payload,
            qrCodeBase64 = QrPng.base64(payload),
            expiresAt = req.expiresAt ?: clock.instant().plusSeconds(props.payments.pixExpirationMinutes * 60),
        )
    }

    override fun createPreference(req: ChargeRequest): CheckoutPreference =
        CheckoutPreference("mock-pref-${req.purchaseId}", "${props.appUrl.trimEnd('/')}/mock/checkout?kind=credits&id=${req.purchaseId}")

    override fun getPayment(id: String): GatewayPayment {
        val ref = PREFIXES.firstOrNull { id.startsWith(it) }?.let { id.removePrefix(it) }
        val at = approved[id]
        return GatewayPayment(id, if (at != null) "approved" else "pending", ref, at)
    }

    override fun createSubscription(subscriptionId: UUID, userId: UUID, payerEmail: String?, priceCents: Int): GatewayPreapproval =
        GatewayPreapproval(
            id = preapprovalId(subscriptionId),
            status = "pending",
            externalReference = userId.toString(),
            nextPaymentDate = null,
            initPoint = "${props.appUrl.trimEnd('/')}/mock/checkout?kind=premium&id=$subscriptionId",
        )

    override fun getPreapproval(id: String): GatewayPreapproval {
        val status = when {
            cancelled.contains(id) -> "cancelled"
            approved.containsKey(id) -> "authorized"
            else -> "pending"
        }
        val next = approved[id]?.let { java.time.ZonedDateTime.ofInstant(it, java.time.ZoneOffset.UTC).plusMonths(1).toInstant() }
        return GatewayPreapproval(id, status, null, if (status == "authorized") next else null, null)
    }

    override fun cancelPreapproval(id: String) {
        cancelled += id
    }

    override fun getAuthorizedPayment(id: String): GatewayAuthorizedPayment {
        // mock-authpay-{subscriptionId}-{n}
        val subscription = id.removePrefix(AUTHORIZED_PREFIX).substringBeforeLast('-')
        val at = approved[id]
        return GatewayAuthorizedPayment(
            id = id,
            preapprovalId = "mock-preapproval-$subscription",
            status = if (at != null) "processed" else "scheduled",
            paymentId = id,
            paymentStatus = if (at != null) "approved" else null,
            debitDate = at,
        )
    }

    companion object {
        const val PIX_PREFIX = "mock-pix-"
        const val CARD_PREFIX = "mock-card-"
        const val AUTHORIZED_PREFIX = "mock-authpay-"
        private val PREFIXES = listOf(PIX_PREFIX, CARD_PREFIX)

        fun pixPaymentId(purchaseId: UUID) = "$PIX_PREFIX$purchaseId"

        fun cardPaymentId(purchaseId: UUID) = "$CARD_PREFIX$purchaseId"

        fun preapprovalId(subscriptionId: UUID) = "mock-preapproval-$subscriptionId"

        fun authorizedPaymentId(subscriptionId: UUID, n: Int) = "$AUTHORIZED_PREFIX$subscriptionId-$n"
    }
}
