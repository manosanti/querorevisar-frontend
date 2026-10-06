package br.com.querorevisar.api.billing

import java.time.Instant
import java.util.UUID

/** What the gateway needs to charge a credit pack. */
data class ChargeRequest(
    val purchaseId: UUID,
    val packId: String,
    val credits: Int,
    val amountCents: Int,
    val description: String,
    val payerEmail: String?,
    val payerCpf: String?,
    val expiresAt: Instant?,
)

data class PixCharge(val paymentId: String, val qrCode: String, val qrCodeBase64: String, val expiresAt: Instant)

data class CheckoutPreference(val preferenceId: String, val initPoint: String)

/** GET /v1/payments/{id}: only what the webhook handler needs. */
data class GatewayPayment(val id: String, val status: String, val externalReference: String?, val approvedAt: Instant?)

data class GatewayPreapproval(
    val id: String,
    val status: String,
    val externalReference: String?,
    val nextPaymentDate: Instant?,
    val initPoint: String?,
)

data class GatewayAuthorizedPayment(
    val id: String,
    val preapprovalId: String?,
    /** scheduled | processed | recycling | canceled */
    val status: String,
    val paymentId: String?,
    /** approved | rejected | ... */
    val paymentStatus: String?,
    val debitDate: Instant?,
)

class PaymentGatewayException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Mercado Pago operations (docs/mercadopago.md). [MercadoPagoGateway] calls the REST API (sandbox or live);
 * [MockPaymentGateway] (PAYMENTS_MODE=mock) answers locally and approves on demand.
 */
interface PaymentGateway {
    val mode: String

    fun createPix(req: ChargeRequest): PixCharge

    fun createPreference(req: ChargeRequest): CheckoutPreference

    fun getPayment(id: String): GatewayPayment

    fun createSubscription(subscriptionId: UUID, userId: UUID, payerEmail: String?, priceCents: Int): GatewayPreapproval

    fun getPreapproval(id: String): GatewayPreapproval

    fun cancelPreapproval(id: String)

    fun getAuthorizedPayment(id: String): GatewayAuthorizedPayment
}

/** MP spells it "canceled" in the docs and "cancelled" in the SDKs: store one spelling. */
fun normalizeMpStatus(status: String?): String = when (val s = status?.lowercase() ?: "") {
    "canceled" -> "cancelled"
    else -> s
}
