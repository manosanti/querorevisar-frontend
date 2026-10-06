package br.com.querorevisar.api.lookups

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
@Tag(name = "lookups")
class LookupController(private val lookups: LookupService) {
    @GetMapping("/v1/lookups/products")
    @Operation(operationId = "listLookupProducts", summary = "Products, cost in credits and parts")
    fun products(): List<LookupProduct> = lookups.products()

    @GetMapping("/v1/lookups")
    @Operation(operationId = "listLookups", summary = "Previous lookups, newest first")
    fun list(user: CurrentUser): List<LookupSummary> = lookups.list(user.id)

    @PostMapping("/v1/lookups")
    @Operation(operationId = "createLookup", summary = "Runs a lookup (credits debited in the same transaction)")
    fun create(user: CurrentUser, @Valid @RequestBody body: LookupCreate): LookupResult = lookups.create(user.id, body)

    @GetMapping("/v1/lookups/{id}")
    @Operation(operationId = "getLookup", summary = "Saved result; reopening never charges")
    fun get(user: CurrentUser, @PathVariable id: UUID): LookupResult = lookups.get(user.id, id)
}
