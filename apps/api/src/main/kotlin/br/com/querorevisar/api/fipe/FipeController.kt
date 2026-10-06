package br.com.querorevisar.api.fipe

import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.common.AppProperties
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.util.UUID

@Configuration
class FipeConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    /** FIPE_MODE=live by default (the API works without a token); mock only for automated tests. */
    @Bean
    fun fipeClient(props: AppProperties, clock: Clock): FipeClient =
        if (props.fipe.mode == "mock") {
            log.warn("FIPE_MODE=mock: FIPE lists and prices are fake")
            MockFipeClient(clock)
        } else {
            ParallelumFipeClient(props)
        }
}

@RestController
@Tag(name = "vehicles")
class FipeController(private val fipe: FipeService) {
    @GetMapping("/v1/vehicles/{id}/fipe")
    @Operation(operationId = "getVehicleFipe", summary = "FIPE price for the vehicle (7-day cache)")
    fun vehicleFipe(user: CurrentUser, @PathVariable id: UUID): VehicleFipe = fipe.vehicleFipe(user.id, id)
}
