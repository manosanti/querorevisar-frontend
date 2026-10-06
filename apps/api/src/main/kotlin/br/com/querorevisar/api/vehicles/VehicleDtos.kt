package br.com.querorevisar.api.vehicles

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.NonNullWhenPresent
import br.com.querorevisar.api.common.PatchRequest
import br.com.querorevisar.api.domain.VehicleType
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import java.time.Instant
import java.util.UUID

const val YEAR_MESSAGE = "Ano inválido. Use 4 dígitos, ex.: 2019"
const val BRAND_MODEL_MESSAGE = "Escolha a marca e o modelo"
const val VEHICLE_KM_MESSAGE = "Informe o km atual do painel"

@Suppress("EnumEntryName")
enum class VehicleStatus { active, archived }

@ApiDto
data class Vehicle(
    val id: UUID,
    val type: VehicleType,
    val brand: String,
    val model: String,
    val year: Int,
    val plate: String?,
    val km: Int,
    val kmAt: Instant,
    val kmPerMonth: Int,
    val fipeBrandCode: String?,
    val fipeModelCode: String?,
    val fipeYearCode: String?,
    val fipeCode: String?,
    val status: VehicleStatus,
    val position: Int,
    val archivedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@ApiDto
data class VehicleCreate(
    /** UUID v7 generated on the client. */
    @NotNull(message = "Informe o id do veículo")
    val id: UUID?,
    @NotNull(message = "Escolha carro ou moto")
    val type: VehicleType?,
    @NotBlank(message = BRAND_MODEL_MESSAGE)
    val brand: String?,
    @NotBlank(message = BRAND_MODEL_MESSAGE)
    val model: String?,
    @NotNull(message = YEAR_MESSAGE) @Min(1950, message = YEAR_MESSAGE) @Max(2100, message = YEAR_MESSAGE)
    val year: Int?,
    @NotNull(message = VEHICLE_KM_MESSAGE) @Min(0, message = VEHICLE_KM_MESSAGE)
    val km: Int?,
    val plate: String? = null,
    val fipeBrandCode: String? = null,
    val fipeModelCode: String? = null,
    val fipeYearCode: String? = null,
    /** When set, that vehicle is archived in the same transaction ("Cadastrar o novo veículo"). */
    val replacesVehicleId: UUID? = null,
)

@ApiDto
data class VehicleUpdate(
    @NonNullWhenPresent @Pattern(regexp = ".*\\S.*", message = BRAND_MODEL_MESSAGE)
    val brand: String? = null,
    @NonNullWhenPresent @Pattern(regexp = ".*\\S.*", message = BRAND_MODEL_MESSAGE)
    val model: String? = null,
    @NonNullWhenPresent @Min(1950, message = YEAR_MESSAGE) @Max(2100, message = YEAR_MESSAGE)
    val year: Int? = null,
    val plate: String? = null,
    @NonNullWhenPresent
    val position: Int? = null,
    val fipeBrandCode: String? = null,
    val fipeModelCode: String? = null,
    val fipeYearCode: String? = null,
) : PatchRequest {
    @get:JsonIgnore
    override val presentKeys: MutableSet<String> = mutableSetOf()
}

@ApiDto
data class KmUpdate(
    @Min(0, message = VEHICLE_KM_MESSAGE)
    val km: Int? = null,
    val confirmEstimate: Boolean? = null,
)
