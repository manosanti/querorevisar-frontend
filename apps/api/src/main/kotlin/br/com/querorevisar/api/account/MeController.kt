package br.com.querorevisar.api.account

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@Tag(name = "me")
class MeController(private val me: MeService) {
    @GetMapping("/v1/me")
    @Operation(operationId = "getMe", summary = "Current user (ETag/304)")
    fun get(user: CurrentUser): Me = me.me(user)

    @PatchMapping("/v1/me")
    @Operation(operationId = "updateMe", summary = "Updates the name")
    fun update(user: CurrentUser, @Valid @RequestBody body: MeUpdate): Me = me.updateName(user, body.name!!)

    @DeleteMapping("/v1/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteMe", summary = "Deletes the account and every piece of data (LGPD)")
    fun delete(user: CurrentUser) = me.delete(user)

    @GetMapping("/v1/me/export")
    @Operation(operationId = "exportMe", summary = "Every piece of data the user owns (LGPD)")
    fun export(user: CurrentUser): MeExport = me.export(user)
}
