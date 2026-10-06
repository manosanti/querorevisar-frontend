package br.com.querorevisar.api.vehicles

import br.com.querorevisar.api.auth.CurrentUser
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@Tag(name = "vehicles")
class VehicleController(private val service: VehicleService) {
    @GetMapping("/v1/vehicles")
    @Operation(operationId = "listVehicles", summary = "Active and archived vehicles")
    fun list(user: CurrentUser): List<Vehicle> = service.list(user.id)

    @PostMapping("/v1/vehicles")
    @Operation(operationId = "createVehicle", summary = "Creates a vehicle (402 vehicle-limit on the free plan)")
    fun create(user: CurrentUser, @Valid @RequestBody body: VehicleCreate): Vehicle = service.create(user.id, body)

    @PatchMapping("/v1/vehicles/{id}")
    @Operation(operationId = "updateVehicle", summary = "Updates editable fields")
    fun update(user: CurrentUser, @PathVariable id: UUID, @Valid @RequestBody body: VehicleUpdate): Vehicle =
        service.update(user.id, id, body)

    @DeleteMapping("/v1/vehicles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteVehicle", summary = "Soft deleted together with its records")
    fun delete(user: CurrentUser, @PathVariable id: UUID) = service.delete(user.id, id)

    @PostMapping("/v1/vehicles/{id}/km")
    @Operation(operationId = "updateVehicleKm", summary = "New panel km or confirmation of the estimate")
    fun km(user: CurrentUser, @PathVariable id: UUID, @Valid @RequestBody body: KmUpdate): Vehicle = service.updateKm(user.id, id, body)

    @PostMapping("/v1/vehicles/{id}/archive")
    @Operation(operationId = "archiveVehicle", summary = "Archived (sold or replaced)")
    fun archive(user: CurrentUser, @PathVariable id: UUID): Vehicle = service.archive(user.id, id)

    @PostMapping("/v1/vehicles/{id}/restore")
    @Operation(operationId = "restoreVehicle", summary = "Active again (402 on the free plan)")
    fun restore(user: CurrentUser, @PathVariable id: UUID): Vehicle = service.restore(user.id, id)
}
