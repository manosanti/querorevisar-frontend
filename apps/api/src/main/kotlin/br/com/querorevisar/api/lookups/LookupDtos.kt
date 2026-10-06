package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.domain.LookupPart
import br.com.querorevisar.api.domain.LookupProductId
import br.com.querorevisar.api.domain.LookupResultSummary
import br.com.querorevisar.api.domain.LookupSection
import br.com.querorevisar.api.domain.Plates
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.Instant
import java.util.UUID

@ApiDto
data class LookupProduct(
    val id: LookupProductId,
    val name: String,
    val desc: String,
    val credits: Int,
    val priceCents: Int,
    val tag: String?,
    val parts: List<LookupPart>,
)

@ApiDto
data class LookupCreate(
    /** ABC1D23; normalized server-side. */
    @NotBlank(message = Plates.ERROR)
    val plate: String?,
    @NotNull(message = "Escolha o que consultar")
    val product: LookupProductId?,
    @NotNull(message = "Escolha outro veículo ou o seu")
    val mine: Boolean?,
    val vehicleId: UUID? = null,
)

@ApiDto
data class LookupVehicle(val model: String, val year: String, val color: String?, val fuel: String?, val city: String?)

@ApiDto
data class LookupResult(
    val id: UUID,
    val plate: String,
    val product: LookupProductId,
    val mine: Boolean,
    val createdAt: Instant,
    val creditsSpent: Int,
    val vehicle: LookupVehicle,
    val sections: List<LookupSection>,
    val summary: LookupResultSummary,
) {
    fun toSummary() = LookupSummary(id, plate, product, mine, createdAt, vehicle.model, vehicle.year)
}

@ApiDto
data class LookupSummary(
    val id: UUID,
    val plate: String,
    val product: LookupProductId,
    val mine: Boolean,
    val createdAt: Instant,
    val model: String,
    val year: String,
)
