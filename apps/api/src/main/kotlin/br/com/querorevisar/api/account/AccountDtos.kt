package br.com.querorevisar.api.account

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.credits.LedgerEntry
import br.com.querorevisar.api.lookups.LookupResult
import br.com.querorevisar.api.records.MaintenanceRecord
import br.com.querorevisar.api.vehicles.Vehicle
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

@Suppress("EnumEntryName")
enum class Plan { free, premium }

@ApiDto
data class Flags(
    val appleLogin: Boolean,
    val partsMarketplace: Boolean,
    val ads: Boolean,
    val vehicleLookups: Boolean,
    val fipeCard: Boolean,
)

@ApiDto
data class Me(
    val id: UUID,
    @JsonProperty("isAnonymous") val isAnonymous: Boolean,
    val name: String?,
    val email: String?,
    val plan: Plan,
    val premiumUntil: Instant?,
    val credits: Int,
    val flags: Flags,
)

@ApiDto
data class MeUpdate(
    @NotBlank(message = "Informe seu nome")
    @Size(max = 80, message = "Use até 80 caracteres")
    val name: String?,
)

@ApiDto
data class MeExport(
    val me: Me,
    val vehicles: List<Vehicle>,
    val records: List<MaintenanceRecord>,
    val lookups: List<LookupResult>,
    val ledger: List<LedgerEntry>,
    val exportedAt: Instant,
)
