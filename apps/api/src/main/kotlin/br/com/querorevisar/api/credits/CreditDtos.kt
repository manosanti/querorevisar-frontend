package br.com.querorevisar.api.credits

import br.com.querorevisar.api.common.ApiDto
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.Instant
import java.util.UUID

@Suppress("EnumEntryName")
enum class PaymentMethod { pix, card }

@Suppress("EnumEntryName")
enum class PurchaseStatus { pending, approved, rejected, expired, refunded }

@Suppress("EnumEntryName")
enum class LedgerReason { purchase, premium_bonus, lookup, refund, admin }

@ApiDto
data class CreditPack(
    val id: String,
    val credits: Int,
    val priceCents: Int,
    val unitPriceCents: Int,
    val discountPct: Int,
    val tag: String?,
)

@ApiDto
data class CreditPurchaseCreate(
    @NotBlank(message = "Escolha um pacote")
    val packId: String?,
    @NotNull(message = "Escolha Pix ou cartão")
    val method: PaymentMethod?,
    val payerCpf: String? = null,
)

@ApiDto
data class CreditPurchase(
    val purchaseId: UUID,
    val status: PurchaseStatus,
    val method: PaymentMethod,
    val credits: Int,
    val amountCents: Int,
    /** Pix copia e cola. */
    val qrCode: String?,
    /** PNG image, base64. */
    val qrCodeBase64: String?,
    val expiresAt: Instant?,
    /** Checkout Pro link (card). */
    val initPoint: String?,
)

@ApiDto
data class LedgerEntry(val id: UUID, val delta: Int, val reason: LedgerReason, val createdAt: Instant)
