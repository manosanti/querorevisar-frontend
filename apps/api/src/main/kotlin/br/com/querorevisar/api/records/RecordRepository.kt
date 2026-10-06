package br.com.querorevisar.api.records

import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.instant
import br.com.querorevisar.api.common.intOrNull
import br.com.querorevisar.api.common.localDate
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.domain.RecordLike
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class RecordRow(
    val id: UUID,
    val userId: UUID,
    val vehicleId: UUID,
    val itemId: String,
    val km: Int,
    val date: LocalDate?,
    val costCents: Int?,
    val brand: String?,
    val place: RecordPlace,
    val createdAt: Instant,
    val updatedAt: Instant,
    val deletedAt: Instant?,
) {
    fun toDto() = MaintenanceRecord(id, vehicleId, itemId, km, date, costCents, brand, place, createdAt, updatedAt)

    fun asRecordLike() = RecordLike(itemId, km, date)
}

@Repository
class RecordRepository(private val jdbc: JdbcClient) {
    private val columns = "id, user_id, vehicle_id, item_id, km, done_on, cost_cents, brand, place, created_at, updated_at, deleted_at"

    fun find(userId: UUID, id: UUID): RecordRow? =
        jdbc.sql("select $columns from maintenance_records where id = :id and user_id = :u and deleted_at is null")
            .param("id", id).param("u", userId).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun exists(id: UUID): Boolean =
        jdbc.sql("select count(*) from maintenance_records where id = :id").param("id", id).query(Int::class.java).single() > 0

    fun findAny(id: UUID): RecordRow? =
        jdbc.sql("select $columns from maintenance_records where id = :id").param("id", id).query { rs, _ -> map(rs) }.optional().orElse(null)

    /** Live records of one vehicle, newest first (date desc, undated last, then km desc). */
    fun listByVehicle(vehicleId: UUID): List<RecordRow> =
        jdbc.sql(
            """select $columns from maintenance_records where vehicle_id = :v and deleted_at is null
               order by done_on desc nulls last, km desc, created_at desc""",
        ).param("v", vehicleId).query { rs, _ -> map(rs) }.list()

    fun listByUser(userId: UUID): List<RecordRow> =
        jdbc.sql(
            """select $columns from maintenance_records where user_id = :u and deleted_at is null
               order by done_on desc nulls last, km desc""",
        ).param("u", userId).query { rs, _ -> map(rs) }.list()

    fun changedSince(userId: UUID, since: Instant?): List<RecordRow> =
        jdbc.sql(
            """select $columns from maintenance_records where user_id = :u
               and (cast(:s as timestamptz) is null or updated_at > :s) order by done_on desc nulls last, km desc""",
        ).param("u", userId).param("s", since?.odt()).query { rs, _ -> map(rs) }.list()

    fun maxKm(vehicleId: UUID): Int =
        jdbc.sql("select coalesce(max(km), 0) from maintenance_records where vehicle_id = :v and deleted_at is null")
            .param("v", vehicleId).query(Int::class.java).single()

    fun insert(r: RecordRow) {
        jdbc.sql(
            """insert into maintenance_records($columns) values (:id, :u, :v, :item, :km, :date, :cost, :brand, :place,
               :createdAt, :updatedAt, :deletedAt)""",
        ).paramSource(params(r)).update()
    }

    fun save(r: RecordRow) {
        jdbc.sql(
            """update maintenance_records set item_id = :item, km = :km, done_on = :date, cost_cents = :cost, brand = :brand,
               place = :place, updated_at = :updatedAt, deleted_at = :deletedAt where id = :id and user_id = :u""",
        ).paramSource(params(r)).update()
    }

    fun softDeleteByVehicle(vehicleId: UUID, now: Instant) {
        jdbc.sql("update maintenance_records set deleted_at = :t, updated_at = :t where vehicle_id = :v and deleted_at is null")
            .param("t", now.odt()).param("v", vehicleId).update()
    }

    private fun params(r: RecordRow) = MapSqlParameterSource(
        mapOf(
            "id" to r.id, "u" to r.userId, "v" to r.vehicleId, "item" to r.itemId, "km" to r.km, "date" to r.date,
            "cost" to r.costCents, "brand" to r.brand, "place" to r.place.name, "createdAt" to r.createdAt.odt(),
            "updatedAt" to r.updatedAt.odt(), "deletedAt" to r.deletedAt?.odt(),
        ),
    )

    companion object {
        fun map(rs: ResultSet) = RecordRow(
            id = rs.getObject("id", UUID::class.java),
            userId = rs.getObject("user_id", UUID::class.java),
            vehicleId = rs.getObject("vehicle_id", UUID::class.java),
            itemId = rs.getString("item_id"),
            km = rs.getInt("km"),
            date = rs.localDate("done_on"),
            costCents = rs.intOrNull("cost_cents"),
            brand = rs.getString("brand"),
            place = RecordPlace.valueOf(rs.getString("place")),
            createdAt = rs.instantOrThrow("created_at"),
            updatedAt = rs.instantOrThrow("updated_at"),
            deletedAt = rs.instant("deleted_at"),
        )
    }
}
