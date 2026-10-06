package br.com.querorevisar.api.vehicles

import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.FieldError
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.domain.DomainConstants
import br.com.querorevisar.api.domain.KmRules
import br.com.querorevisar.api.domain.KmUpdateResult
import br.com.querorevisar.api.domain.Plates
import br.com.querorevisar.api.records.RecordRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

/**
 * F05.3 vehicles: plan limit (free: 1 active vehicle → 402 `vehicle-limit`), archive/restore, soft delete with the
 * records, km updates (docs/domain.md#km). Every write bumps updated_at (sync cursor).
 */
@Service
class VehicleService(
    private val vehicles: VehicleRepository,
    private val records: RecordRepository,
    private val profiles: ProfileService,
    private val clock: Clock,
) {
    fun list(userId: UUID): List<Vehicle> = vehicles.list(userId).map { it.toDto() }

    fun get(userId: UUID, id: UUID): VehicleRow = vehicles.find(userId, id) ?: throw notFound()

    private fun notFound() = ApiException.notFound("Veículo não encontrado.")

    private fun limit() = ApiException(ProblemCode.VEHICLE_LIMIT)

    /** Normalized plate or null; invalid plates are a 422 `invalid-plate`. */
    fun normalizePlate(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val plate = Plates.normalize(raw)
        if (!Plates.isValid(plate)) throw ApiException(ProblemCode.INVALID_PLATE, errors = listOf(FieldError("plate", Plates.ERROR)))
        return plate
    }

    @Transactional
    fun create(userId: UUID, req: VehicleCreate, nowArg: Instant? = null): Vehicle {
        val now = nowArg ?: clock.instant()
        val profile = profiles.lock(userId)
        val id = req.id!!
        if (vehicles.findAny(id) != null) throw ApiException.conflict("Este veículo já está cadastrado.")
        val replaced = req.replacesVehicleId?.let { vehicles.find(userId, it) ?: throw notFound() }
        if (!profile.isPremium(now) && vehicles.countActive(userId, excluding = replaced?.id) >= 1) throw limit()
        if (replaced != null && replaced.status == VehicleStatus.active) {
            vehicles.save(replaced.copy(status = VehicleStatus.archived, archivedAt = now, updatedAt = now))
        }
        val type = req.type!!
        val row = VehicleRow(
            id = id,
            userId = userId,
            type = type,
            brand = req.brand!!.trim(),
            model = req.model!!.trim(),
            year = req.year!!,
            plate = normalizePlate(req.plate),
            km = req.km!!,
            kmAt = now,
            kmPerMonth = DomainConstants.initialKmPerMonth(type),
            fipeBrandCode = req.fipeBrandCode?.takeIf { it.isNotBlank() },
            fipeModelCode = req.fipeModelCode?.takeIf { it.isNotBlank() },
            fipeYearCode = req.fipeYearCode?.takeIf { it.isNotBlank() },
            fipeCode = null,
            status = VehicleStatus.active,
            position = vehicles.maxPosition(userId) + 1,
            archivedAt = null,
            createdAt = now,
            updatedAt = now,
            deletedAt = null,
        )
        vehicles.insert(row)
        return row.toDto()
    }

    @Transactional
    fun update(userId: UUID, id: UUID, req: VehicleUpdate, nowArg: Instant? = null): Vehicle {
        val now = nowArg ?: clock.instant()
        val v = get(userId, id)
        var next = v
        if (req.has("brand") && req.brand != null) next = next.copy(brand = req.brand.trim())
        if (req.has("model") && req.model != null) next = next.copy(model = req.model.trim())
        if (req.has("year") && req.year != null) next = next.copy(year = req.year)
        if (req.has("plate")) next = next.copy(plate = normalizePlate(req.plate))
        if (req.has("position") && req.position != null) next = next.copy(position = req.position)
        if (req.has("fipeBrandCode")) next = next.copy(fipeBrandCode = req.fipeBrandCode?.takeIf { it.isNotBlank() })
        if (req.has("fipeModelCode")) next = next.copy(fipeModelCode = req.fipeModelCode?.takeIf { it.isNotBlank() })
        if (req.has("fipeYearCode")) next = next.copy(fipeYearCode = req.fipeYearCode?.takeIf { it.isNotBlank() })
        val fipeChanged = next.fipeBrandCode != v.fipeBrandCode || next.fipeModelCode != v.fipeModelCode || next.fipeYearCode != v.fipeYearCode
        if (fipeChanged) next = next.copy(fipeCode = null)
        if (next == v) return v.toDto()
        next = next.copy(updatedAt = now)
        vehicles.save(next)
        return next.toDto()
    }

    /** POST /v1/vehicles/{id}/km: `{ km }` or `{ confirmEstimate: true }` ("Está certo"). */
    @Transactional
    fun updateKm(userId: UUID, id: UUID, req: KmUpdate, atArg: Instant? = null): Vehicle {
        val at = atArg ?: clock.instant()
        val v = get(userId, id)
        val result = when {
            req.confirmEstimate == true -> KmRules.confirmEstimate(v.kmState(), at)
            req.km != null -> KmRules.applyKmUpdate(v.kmState(), req.km, records.maxKm(v.id), at)
            else -> throw ApiException.validation("Digite o km do painel ou toque em \"Está certo\"", "km")
        }
        return when (result) {
            is KmUpdateResult.Rejected -> throw ApiException.validation(result.error, "km")
            is KmUpdateResult.Ok -> {
                val next = v.copy(km = result.km, kmAt = result.kmAt, kmPerMonth = result.kmPerMonth, updatedAt = clock.instant())
                vehicles.save(next)
                next.toDto()
            }
        }
    }

    @Transactional
    fun archive(userId: UUID, id: UUID, nowArg: Instant? = null): Vehicle {
        val now = nowArg ?: clock.instant()
        val v = get(userId, id)
        if (v.status == VehicleStatus.archived) return v.toDto()
        val next = v.copy(status = VehicleStatus.archived, archivedAt = now, updatedAt = now)
        vehicles.save(next)
        return next.toDto()
    }

    /** Restoring needs Premium on the free plan (docs/domain.md). */
    @Transactional
    fun restore(userId: UUID, id: UUID, nowArg: Instant? = null): Vehicle {
        val now = nowArg ?: clock.instant()
        val profile = profiles.lock(userId)
        val v = get(userId, id)
        if (v.status == VehicleStatus.active) return v.toDto()
        if (!profile.isPremium(now)) throw limit()
        val next = v.copy(status = VehicleStatus.active, archivedAt = null, updatedAt = now)
        vehicles.save(next)
        return next.toDto()
    }

    /** Soft delete together with the records. */
    @Transactional
    fun delete(userId: UUID, id: UUID, nowArg: Instant? = null) {
        val now = nowArg ?: clock.instant()
        val v = get(userId, id)
        vehicles.save(v.copy(deletedAt = now, updatedAt = now))
        records.softDeleteByVehicle(v.id, now)
    }

    /** A record above the estimated km moves the vehicle km forward (docs/domain.md#registro). */
    fun bumpKmForRecord(v: VehicleRow, recordKm: Int, now: Instant) {
        val bumped = KmRules.kmAfterRecord(v.kmState(), recordKm, now) ?: return
        vehicles.save(v.copy(km = bumped.first, kmAt = bumped.second, updatedAt = now))
    }
}
