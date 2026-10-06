package br.com.querorevisar.api.billing

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@Tag(name = "billing")
class PremiumController(private val premium: PremiumService) {
    @GetMapping("/v1/billing/premium")
    @Operation(operationId = "getPremium", summary = "Premium subscription state")
    fun status(user: CurrentUser): PremiumStatus = premium.status(user.id)

    @PostMapping("/v1/billing/premium/checkout")
    @Operation(operationId = "startPremiumCheckout", summary = "Mercado Pago link to redirect to")
    fun checkout(user: CurrentUser): CheckoutRedirect = premium.checkout(user)

    @PostMapping("/v1/billing/premium/cancel")
    @Operation(operationId = "cancelPremium", summary = "Cancelled; Premium stays until premiumUntil")
    fun cancel(user: CurrentUser): PremiumStatus = premium.cancel(user.id)
}

@RestController
@Tag(name = "billing")
class WebhookController(private val webhooks: WebhookService) {
    @PostMapping("/webhooks/mercadopago")
    @Operation(operationId = "mercadoPagoWebhook", summary = "Mercado Pago notifications (x-signature validated)")
    fun receive(
        @RequestParam(name = "data.id", required = false) dataId: String?,
        @RequestParam(name = "type", required = false) type: String?,
        @RequestHeader(name = "x-signature", required = false) signature: String?,
        @RequestHeader(name = "x-request-id", required = false) requestId: String?,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Void> =
        when (webhooks.receive(dataId, type, signature, requestId, body)) {
            WebhookService.Outcome.INVALID_SIGNATURE -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
            else -> ResponseEntity.ok().build()
        }
}

@RestController
@Tag(name = "mock-payments")
class MockPaymentsController(private val premium: PremiumService) {
    @PostMapping("/v1/mock/payments/{id}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
        operationId = "approveMockPayment",
        summary = "PAYMENTS_MODE=mock only: approves a credit purchase or a Premium checkout (same handler as the webhook)",
    )
    fun approve(user: CurrentUser, @PathVariable id: UUID) = premium.approveMock(user.id, id)
}
