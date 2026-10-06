package br.com.querorevisar.api.records

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
@Tag(name = "records")
class RecordController(private val service: RecordService) {
    @GetMapping("/v1/vehicles/{id}/records")
    @Operation(operationId = "listVehicleRecords", summary = "Records of the vehicle; the free plan only gets the last 12 months")
    fun list(user: CurrentUser, @PathVariable id: UUID): RecordList = service.list(user.id, id)

    @PostMapping("/v1/records")
    @Operation(operationId = "createRecord", summary = "Registers a maintenance record")
    fun create(user: CurrentUser, @Valid @RequestBody body: RecordCreate): MaintenanceRecord = service.create(user.id, body)

    @PatchMapping("/v1/records/{id}")
    @Operation(operationId = "updateRecord", summary = "Updates a record")
    fun update(user: CurrentUser, @PathVariable id: UUID, @Valid @RequestBody body: RecordUpdate): MaintenanceRecord =
        service.update(user.id, id, body)

    @DeleteMapping("/v1/records/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteRecord", summary = "Soft deleted")
    fun delete(user: CurrentUser, @PathVariable id: UUID) = service.delete(user.id, id)
}
