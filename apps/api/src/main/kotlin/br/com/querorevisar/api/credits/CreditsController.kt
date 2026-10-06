package br.com.querorevisar.api.credits

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@Tag(name = "credits")
class CreditsController(private val credits: CreditService) {
    @GetMapping("/v1/credits/packs")
    @Operation(operationId = "listCreditPacks", summary = "Credit packs")
    fun packs(): List<CreditPack> = credits.packs()

    @PostMapping("/v1/credits/purchases")
    @Operation(operationId = "createCreditPurchase", summary = "Pix data (QR code) or the card checkout link")
    fun create(user: CurrentUser, @Valid @RequestBody body: CreditPurchaseCreate): CreditPurchase = credits.create(user, body)

    @GetMapping("/v1/credits/purchases/{id}")
    @Operation(operationId = "getCreditPurchase", summary = "Purchase status (polled every 3 s by the web)")
    fun get(user: CurrentUser, @PathVariable id: UUID): CreditPurchase = credits.get(user.id, id)

    @GetMapping("/v1/credits/ledger")
    @Operation(operationId = "listCreditLedger", summary = "Credit statement, newest first")
    fun ledger(user: CurrentUser): List<LedgerEntry> = credits.ledger(user.id)
}
