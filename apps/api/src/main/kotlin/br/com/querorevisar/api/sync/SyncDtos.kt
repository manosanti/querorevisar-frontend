package br.com.querorevisar.api.sync

import br.com.querorevisar.api.account.Me
import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.Problem
import br.com.querorevisar.api.lookups.LookupSummary
import br.com.querorevisar.api.records.MaintenanceRecord
import br.com.querorevisar.api.vehicles.Vehicle
import io.swagger.v3.oas.annotations.media.Schema
import jakarta.validation.Valid
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

@ApiDto
data class SyncResponse(
    val cursor: String,
    /** true when `since` was absent or invalid: replace local state. */
    val full: Boolean,
    val catalogVersion: Int,
    val me: Me,
    val vehicles: List<Vehicle>,
    val records: List<MaintenanceRecord>,
    val lookups: List<LookupSummary>,
    val deleted: SyncDeleted,
)

@ApiDto
data class SyncDeleted(val vehicles: List<UUID>, val records: List<UUID>)

@ApiDto
data class SyncMutation(
    /** Idempotency key of the mutation. */
    @NotNull(message = "Mutação sem id")
    val id: UUID?,
    @NotNull(message = "Mutação sem tipo")
    @Schema(
        type = "string",
        allowableValues = ["vehicle.upsert", "vehicle.archive", "vehicle.restore", "vehicle.delete", "vehicle.km", "record.upsert", "record.delete"],
    )
    val type: String?,
    @NotNull(message = "Mutação sem payload")
    val payload: Map<String, Any?>?,
    @NotNull(message = "Mutação sem clientTime")
    val clientTime: Instant?,
)

@ApiDto
data class SyncPush(
    @NotNull(message = "Envie as mutações")
    @Size(max = 200, message = "Envie no máximo 200 mutações por vez")
    val mutations: List<@Valid SyncMutation>?,
)

@ApiDto
data class SyncRejection(val id: UUID, val problem: Problem)

@ApiDto
data class SyncPushResult(val applied: List<UUID>, val rejected: List<SyncRejection>, val cursor: String)
