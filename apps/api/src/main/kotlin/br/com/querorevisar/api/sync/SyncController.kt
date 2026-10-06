package br.com.querorevisar.api.sync

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@Tag(name = "sync")
class SyncController(private val sync: SyncService) {
    @GetMapping("/v1/sync")
    @Operation(operationId = "getSync", summary = "Everything that changed since the cursor (ETag/304)")
    fun pull(
        user: CurrentUser,
        @Parameter(description = "Cursor from the previous sync. Without it the whole state is returned.")
        @RequestParam(required = false) since: String?,
    ): SyncResponse = sync.pull(user, since)

    @PostMapping("/v1/sync")
    @Operation(operationId = "postSync", summary = "Applies the offline queue in order (result per mutation)")
    fun push(user: CurrentUser, @Valid @RequestBody body: SyncPush): SyncPushResult = sync.push(user, body)
}
