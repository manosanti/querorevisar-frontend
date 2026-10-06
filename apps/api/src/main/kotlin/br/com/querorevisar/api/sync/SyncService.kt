package br.com.querorevisar.api.sync

import br.com.querorevisar.api.account.MeService
import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.catalog.CatalogService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.FieldError
import br.com.querorevisar.api.common.Problem
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.lookups.LookupRepository
import br.com.querorevisar.api.records.RecordCreate
import br.com.querorevisar.api.records.RecordRepository
import br.com.querorevisar.api.records.RecordService
import br.com.querorevisar.api.records.RecordUpdate
import br.com.querorevisar.api.vehicles.KmUpdate
import br.com.querorevisar.api.vehicles.VehicleCreate
import br.com.querorevisar.api.vehicles.VehicleRepository
import br.com.querorevisar.api.vehicles.VehicleService
import br.com.querorevisar.api.vehicles.VehicleStatus
import br.com.querorevisar.api.vehicles.VehicleUpdate
import jakarta.validation.Validator
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.util.Base64
import java.util.UUID

/** Opaque sync cursor: the newest change the client has seen (base64url of "v1:<epoch micros>"). */
object SyncCursor {
    fun encode(t: Instant): String {
        val micros = t.epochSecond * 1_000_000 + t.nano / 1_000
        return Base64.getUrlEncoder().withoutPadding().encodeToString("v1:$micros".toByteArray())
    }

    fun decode(s: String?): Instant? {
        if (s.isNullOrBlank()) return null
        return runCatching {
            val text = String(Base64.getUrlDecoder().decode(s))
            require(text.startsWith("v1:"))
            val micros = text.removePrefix("v1:").toLong()
            Instant.ofEpochSecond(Math.floorDiv(micros, 1_000_000L), Math.floorMod(micros, 1_000_000L) * 1_000)
        }.getOrNull()
    }
}

/**
 * F05.4: GET /v1/sync returns what changed since the cursor (everything, with `full: true`, without one) and
 * POST /v1/sync applies the offline queue in order, idempotent by mutation id (sync_mutations) and last-write-wins
 * by the server's updated_at against the mutation's clientTime.
 */
@Service
class SyncService(
    private val vehicles: VehicleRepository,
    private val records: RecordRepository,
    private val lookups: LookupRepository,
    private val vehicleService: VehicleService,
    private val recordService: RecordService,
    private val me: MeService,
    private val catalog: CatalogService,
    private val jdbc: JdbcClient,
    private val mapper: JsonMapper,
    private val validator: Validator,
    private val tx: TransactionTemplate,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun pull(user: CurrentUser, since: String?): SyncResponse {
        val sinceAt = SyncCursor.decode(since)
        val full = sinceAt == null
        // Re-send a small window before the cursor: a transaction that started earlier may have committed later.
        val from = sinceAt?.minus(OVERLAP)
        val cursor = cursor(user.id)
        val vs = vehicles.changedSince(user.id, from)
        val rs = records.changedSince(user.id, from)
        return SyncResponse(
            cursor = cursor,
            full = full,
            catalogVersion = catalog.version,
            me = me.me(user),
            vehicles = vs.filter { it.deletedAt == null }.map { it.toDto() },
            records = rs.filter { it.deletedAt == null }.map { it.toDto() },
            lookups = lookups.createdSince(user.id, from).map { it.toSummary() },
            deleted = if (full) {
                SyncDeleted(emptyList(), emptyList())
            } else {
                SyncDeleted(vs.filter { it.deletedAt != null }.map { it.id }, rs.filter { it.deletedAt != null }.map { it.id })
            },
        )
    }

    /** Newest change of the user (vehicles, records, lookups, profile, credits); stable while nothing changes. */
    fun cursor(userId: UUID): String {
        val newest = jdbc.sql(
            """select greatest(
                 (select max(updated_at) from vehicles where user_id = :u),
                 (select max(updated_at) from maintenance_records where user_id = :u),
                 (select max(created_at) from vehicle_lookups where user_id = :u),
                 (select max(updated_at) from profiles where user_id = :u),
                 (select max(created_at) from credit_ledger where user_id = :u))""",
        ).param("u", userId).query { rs, _ -> rs.getObject(1, OffsetDateTime::class.java)?.toInstant() }.list().firstOrNull()
        return SyncCursor.encode(newest ?: Instant.EPOCH)
    }

    fun push(user: CurrentUser, req: SyncPush): SyncPushResult {
        val applied = ArrayList<UUID>()
        val rejected = ArrayList<SyncRejection>()
        val touched = HashSet<UUID>()
        for (m in req.mutations.orEmpty()) {
            val problem = applyOne(user, m, touched)
            if (problem == null) applied += m.id!! else rejected += SyncRejection(m.id!!, problem)
        }
        return SyncPushResult(applied, rejected, cursor(user.id))
    }

    private class AlreadyApplied : RuntimeException(null, null, false, false)

    /** Applies one mutation in its own transaction; returns the problem when rejected. */
    private fun applyOne(user: CurrentUser, m: SyncMutation, touched: MutableSet<UUID>): Problem? {
        val id = m.id!!
        val previous = jdbc.sql("select status, problem::text as problem from sync_mutations where user_id = :u and id = :id")
            .param("u", user.id).param("id", id)
            .query { rs, _ -> rs.getString("status") to rs.getString("problem") }.optional().orElse(null)
        if (previous != null) {
            return if (previous.first == "applied") null else previous.second?.let { mapper.readValue(it, Problem::class.java) }
        }
        return try {
            tx.executeWithoutResult {
                apply(user, m, touched)
                val inserted = jdbc.sql(
                    "insert into sync_mutations(user_id, id, type, status) values (:u, :id, :t, 'applied') on conflict do nothing",
                ).param("u", user.id).param("id", id).param("t", m.type).update() == 1
                if (!inserted) throw AlreadyApplied()
            }
            null
        } catch (e: AlreadyApplied) {
            null
        } catch (e: ApiException) {
            val problem = e.toProblem("/v1/sync")
            jdbc.sql(
                """insert into sync_mutations(user_id, id, type, status, problem) values (:u, :id, :t, 'rejected', cast(:p as jsonb))
                   on conflict do nothing""",
            ).param("u", user.id).param("id", id).param("t", m.type ?: "unknown").param("p", mapper.writeValueAsString(problem)).update()
            problem
        } catch (e: Exception) {
            // Not stored: the client may retry this mutation later.
            Redact.error(log, "Sync mutation ${m.type} failed", e)
            ApiException(ProblemCode.INTERNAL).toProblem("/v1/sync")
        }
    }

    private fun <T : Any> payload(m: SyncMutation, type: Class<T>): T {
        val value = try {
            mapper.convertValue(m.payload, type)
        } catch (e: Exception) {
            throw ApiException.validation("Payload inválido para ${m.type}.", "payload")
        }
        val violations = validator.validate(value)
        if (violations.isNotEmpty()) {
            val order = type.declaredFields.mapIndexed { i, f -> f.name to i }.toMap()
            val errors = violations.sortedBy { order[it.propertyPath.toString().substringBefore('.')] ?: Int.MAX_VALUE }
                .map { FieldError(it.propertyPath.toString(), it.message) }
            throw ApiException(ProblemCode.VALIDATION, errors.first().message, errors = errors)
        }
        return value
    }

    private fun idOf(m: SyncMutation): UUID =
        (m.payload?.get("id") as? String)?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?: throw ApiException.validation("Payload sem id.", "payload.id")

    private fun apply(user: CurrentUser, m: SyncMutation, touched: MutableSet<UUID>) {
        val clientTime = m.clientTime!!
        val now = clock.instant()

        /**
         * Last-write-wins: a server change newer than the mutation wins. Changes made earlier in this same batch (an
         * offline create followed by an edit) never conflict, and client clocks get SKEW of tolerance.
         */
        fun lww(entityId: UUID, serverUpdatedAt: Instant) {
            if (entityId in touched) return
            if (serverUpdatedAt.isAfter(clientTime.plus(SKEW))) throw ApiException.conflict("Este item foi alterado em outro aparelho.")
        }

        when (m.type) {
            "vehicle.upsert" -> {
                val dto = payload(m, VehicleCreate::class.java)
                val existing = vehicles.findAny(dto.id!!)
                if (existing == null) {
                    vehicleService.create(user.id, dto, now)
                    touched += dto.id
                    dto.replacesVehicleId?.let { touched += it }
                    return
                }
                if (existing.userId != user.id) throw ApiException.conflict("Este veículo já está cadastrado.")
                if (existing.deletedAt != null) throw ApiException.notFound("Veículo não encontrado.")
                lww(existing.id, existing.updatedAt)
                val update = VehicleUpdate(
                    brand = dto.brand, model = dto.model, year = dto.year, plate = dto.plate,
                    fipeBrandCode = dto.fipeBrandCode, fipeModelCode = dto.fipeModelCode, fipeYearCode = dto.fipeYearCode,
                ).also { it.presentKeys += setOf("brand", "model", "year", "plate", "fipeBrandCode", "fipeModelCode", "fipeYearCode") }
                vehicleService.update(user.id, existing.id, update, now)
                touched += existing.id
                dto.replacesVehicleId?.let { r ->
                    vehicles.find(user.id, r)?.takeIf { it.status == VehicleStatus.active }?.let { vehicleService.archive(user.id, it.id, now) }
                    touched += r
                }
            }
            "vehicle.archive", "vehicle.restore", "vehicle.delete" -> {
                val id = idOf(m)
                val v = vehicles.findAny(id)?.takeIf { it.userId == user.id }
                if (v == null || v.deletedAt != null) {
                    if (m.type == "vehicle.delete") return // already gone: idempotent
                    throw ApiException.notFound("Veículo não encontrado.")
                }
                lww(v.id, v.updatedAt)
                when (m.type) {
                    "vehicle.archive" -> vehicleService.archive(user.id, id, now)
                    "vehicle.restore" -> vehicleService.restore(user.id, id, now)
                    else -> vehicleService.delete(user.id, id, now)
                }
                touched += id
            }
            "vehicle.km" -> {
                val id = idOf(m)
                val dto = payload(m, KmUpdate::class.java)
                val v = vehicles.find(user.id, id) ?: throw ApiException.notFound("Veículo não encontrado.")
                lww(v.id, v.kmAt)
                // The km was read on the panel at clientTime (never in the future, never before the last km).
                val at = listOf(clientTime, v.kmAt).max().let { if (it.isAfter(now)) now else it }
                vehicleService.updateKm(user.id, id, dto, at)
                touched += id
            }
            "record.upsert" -> {
                val dto = payload(m, RecordCreate::class.java)
                val existing = records.findAny(dto.id!!)
                if (existing == null) {
                    recordService.create(user.id, dto, now)
                    touched += dto.id
                    touched += dto.vehicleId!!
                    return
                }
                if (existing.userId != user.id) throw ApiException.conflict("Este registro já existe.")
                if (existing.deletedAt != null) throw ApiException.notFound("Registro não encontrado.")
                lww(existing.id, existing.updatedAt)
                val update = RecordUpdate(
                    itemId = dto.itemId, km = dto.km, date = dto.date, costCents = dto.costCents, brand = dto.brand, where = dto.where,
                ).also { it.presentKeys += setOf("itemId", "km", "date", "costCents", "brand", "where") }
                recordService.update(user.id, existing.id, update, now)
                touched += existing.id
                touched += existing.vehicleId
            }
            "record.delete" -> {
                val id = idOf(m)
                val r = records.findAny(id)?.takeIf { it.userId == user.id && it.deletedAt == null } ?: return
                lww(r.id, r.updatedAt)
                recordService.delete(user.id, id, now)
                touched += id
            }
            else -> throw ApiException.validation("Tipo de mutação desconhecido: ${m.type}", "type")
        }
    }

    companion object {
        val OVERLAP: Duration = Duration.ofSeconds(10)
        val SKEW: Duration = Duration.ofMinutes(2)
    }
}
