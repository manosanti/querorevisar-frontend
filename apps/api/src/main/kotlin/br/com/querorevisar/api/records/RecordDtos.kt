package br.com.querorevisar.api.records

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.NonNullWhenPresent
import br.com.querorevisar.api.common.PatchRequest
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

const val ITEM_MESSAGE = "Escolha o item que você trocou"
const val RECORD_KM_MESSAGE = "Informe o km de quando trocou"
const val FUTURE_DATE_MESSAGE = "A data não pode ser no futuro"
const val COST_MESSAGE = "Informe um custo válido"
const val BRAND_MESSAGE = "Use até 80 caracteres na marca ou peça"
const val PLACE_MESSAGE = "Escolha onde a troca foi feita"

/** Where the change was made: em casa (home) ou no mecânico (shop). */
@Suppress("EnumEntryName")
enum class RecordPlace { home, shop }

@ApiDto
data class MaintenanceRecord(
    val id: UUID,
    val vehicleId: UUID,
    val itemId: String,
    val km: Int,
    val date: LocalDate?,
    val costCents: Int?,
    val brand: String?,
    val where: RecordPlace,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@ApiDto
data class RecordCreate(
    /** UUID v7 generated on the client. */
    @NotNull(message = "Informe o id do registro")
    val id: UUID?,
    @NotNull(message = "Escolha o veículo")
    val vehicleId: UUID?,
    @NotBlank(message = ITEM_MESSAGE)
    val itemId: String?,
    @NotNull(message = RECORD_KM_MESSAGE) @Min(1, message = RECORD_KM_MESSAGE)
    val km: Int?,
    val date: LocalDate? = null,
    @Min(0, message = COST_MESSAGE)
    val costCents: Int? = null,
    @Size(max = 80, message = BRAND_MESSAGE)
    val brand: String? = null,
    @NotNull(message = PLACE_MESSAGE)
    val where: RecordPlace?,
)

@ApiDto
data class RecordUpdate(
    @NonNullWhenPresent @Pattern(regexp = ".*\\S.*", message = ITEM_MESSAGE)
    val itemId: String? = null,
    @NonNullWhenPresent @Min(1, message = RECORD_KM_MESSAGE)
    val km: Int? = null,
    val date: LocalDate? = null,
    @Min(0, message = COST_MESSAGE)
    val costCents: Int? = null,
    @Size(max = 80, message = BRAND_MESSAGE)
    val brand: String? = null,
    @NonNullWhenPresent
    val where: RecordPlace? = null,
) : PatchRequest {
    @get:JsonIgnore
    override val presentKeys: MutableSet<String> = mutableSetOf()
}

@ApiDto
data class RecordList(
    val records: List<MaintenanceRecord>,
    /** true when the free plan hides records older than 12 months. */
    val locked: Boolean,
)
