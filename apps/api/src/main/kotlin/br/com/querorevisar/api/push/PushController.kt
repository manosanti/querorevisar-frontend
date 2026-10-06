package br.com.querorevisar.api.push

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@Tag(name = "push")
class PushController(private val push: PushService) {
    @PostMapping("/v1/push/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "createPushSubscription", summary = "Stores a Web Push subscription")
    fun subscribe(user: CurrentUser, @Valid @RequestBody body: PushSubscriptionCreate) = push.subscribe(user.id, body)

    @DeleteMapping("/v1/push/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deletePushSubscription", summary = "Removes a Web Push subscription")
    fun unsubscribe(user: CurrentUser, @Valid @RequestBody body: PushSubscriptionDelete) = push.unsubscribe(user.id, body.endpoint!!)
}
