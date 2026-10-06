package br.com.querorevisar.api.records

import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.catalog.CatalogService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.Zones
import br.com.querorevisar.api.domain.DomainConstants
import br.com.querorevisar.api.vehicles.VehicleRepository
import br.com.querorevisar.api.vehicles.VehicleService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/** F05.3 maintenance records: client UUID v7 ids, soft delete and the validations of docs/domain.md#registro. */
@Service
class RecordService(
    private val records: RecordRepository,
    private val vehicles: VehicleRepository,
    private val vehicleService: VehicleService,
    private val catalog: CatalogService,
    private val profiles: ProfileService,
    private val clock: Clock,
) {
    private fun notFound() = ApiException.notFound("Registro não encontrado.")

    private fun today(): LocalDate = LocalDate.now(clock.withZone(Zones.SAO_PAULO))

    private fun validate(itemId: String?, km: Int?, date: LocalDate?, costCents: Int?, brand: String?) {
        if (itemId.isNullOrBlank() || !catalog.itemExists(itemId)) throw ApiException.validation(ITEM_MESSAGE, "itemId")
        if (km == null || km <= 0) throw ApiException.validation(RECORD_KM_MESSAGE, "km")
        if (date != null && date.isAfter(today())) throw ApiException.validation(FUTURE_DATE_MESSAGE, "date")
        if (costCents != null && costCents < 0) throw ApiException.validation(COST_MESSAGE, "costCents")
        if (brand != null && brand.length > 80) throw ApiException.validation(BRAND_MESSAGE, "brand")
    }

    /**
     * GET /v1/vehicles/{id}/records. The free plan only sees the last 12 months (records without a date are always
     * included); `locked` tells the web that something was hidden.
     */
    fun list(userId: UUID, vehicleId: UUID): RecordList {
        vehicles.find(userId, vehicleId) ?: throw ApiException.notFound("Veículo não encontrado.")
        val all = records.listByVehicle(vehicleId)
        if (profiles.isPremium(userId)) return RecordList(all.map { it.toDto() }, false)
        val cutoff = today().minusDays(DomainConstants.FREE_HISTORY_DAYS)
        val visible = all.filter { it.date == null || !it.date.isBefore(cutoff) }
        return RecordList(visible.map { it.toDto() }, visible.size < all.size)
    }

    @Transactional
    fun create(userId: UUID, req: RecordCreate, nowArg: Instant? = null): MaintenanceRecord {
        val now = nowArg ?: clock.instant()
        val vehicle = vehicles.find(userId, req.vehicleId!!) ?: throw ApiException.notFound("Veículo não encontrado.")
        validate(req.itemId, req.km, req.date, req.costCents, req.brand)
        if (records.exists(req.id!!)) throw ApiException.conflict("Este registro já existe.")
        val row = RecordRow(
            id = req.id,
            userId = userId,
            vehicleId = vehicle.id,
            itemId = req.itemId!!,
            km = req.km!!,
            date = req.date,
            costCents = req.costCents,
            brand = req.brand?.trim()?.takeIf { it.isNotEmpty() },
            place = req.where!!,
            createdAt = now,
            updatedAt = now,
            deletedAt = null,
        )
        records.insert(row)
        vehicleService.bumpKmForRecord(vehicle, row.km, now)
        return row.toDto()
    }

    @Transactional
    fun update(userId: UUID, id: UUID, req: RecordUpdate, nowArg: Instant? = null): MaintenanceRecord {
        val now = nowArg ?: clock.instant()
        val r = records.find(userId, id) ?: throw notFound()
        var next = r
        if (req.has("itemId") && req.itemId != null) next = next.copy(itemId = req.itemId)
        if (req.has("km") && req.km != null) next = next.copy(km = req.km)
        if (req.has("date")) next = next.copy(date = req.date)
        if (req.has("costCents")) next = next.copy(costCents = req.costCents)
        if (req.has("brand")) next = next.copy(brand = req.brand?.trim()?.takeIf { it.isNotEmpty() })
        if (req.has("where") && req.where != null) next = next.copy(place = req.where)
        validate(next.itemId, next.km, next.date, next.costCents, next.brand)
        if (next == r) return r.toDto()
        next = next.copy(updatedAt = now)
        records.save(next)
        if (next.km != r.km) vehicles.find(userId, r.vehicleId)?.let { vehicleService.bumpKmForRecord(it, next.km, now) }
        return next.toDto()
    }

    @Transactional
    fun delete(userId: UUID, id: UUID, nowArg: Instant? = null) {
        val now = nowArg ?: clock.instant()
        val r = records.find(userId, id) ?: throw notFound()
        records.save(r.copy(deletedAt = now, updatedAt = now))
    }
}
