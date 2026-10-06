package br.com.querorevisar.api.vehicles

import br.com.querorevisar.api.common.instant
import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.domain.KmState
import br.com.querorevisar.api.domain.VehicleType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

data class VehicleRow(
    val id: UUID,
    val userId: UUID,
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
    val deletedAt: Instant?,
) {
    fun kmState() = KmState(km, kmAt, kmPerMonth)

    fun displayName(): String = model

    fun toDto() = Vehicle(
        id, type, brand, model, year, plate, km, kmAt, kmPerMonth, fipeBrandCode, fipeModelCode, fipeYearCode, fipeCode,
        status, position, archivedAt, createdAt, updatedAt,
    )
}

@Repository
class VehicleRepository(private val jdbc: JdbcClient) {
    private val columns = "id, user_id, type, brand, model, year, plate, km, km_at, km_per_month, fipe_brand_code, " +
        "fipe_model_code, fipe_year_code, fipe_code, status, position, archived_at, created_at, updated_at, deleted_at"

    fun find(userId: UUID, id: UUID): VehicleRow? =
        jdbc.sql("select $columns from vehicles where id = :id and user_id = :u and deleted_at is null")
            .param("id", id).param("u", userId).query { rs, _ -> map(rs) }.optional().orElse(null)

    /** Any row with this id, from any user and also deleted ones (ids are global primary keys). */
    fun findAny(id: UUID): VehicleRow? =
        jdbc.sql("select $columns from vehicles where id = :id").param("id", id).query { rs, _ -> map(rs) }.optional().orElse(null)

    fun list(userId: UUID): List<VehicleRow> =
        jdbc.sql(
            """select $columns from vehicles where user_id = :u and deleted_at is null
               order by case status when 'active' then 0 else 1 end, position, created_at""",
        ).param("u", userId).query { rs, _ -> map(rs) }.list()

    /** Every vehicle (deleted included) changed after `since`; null means all. */
    fun changedSince(userId: UUID, since: Instant?): List<VehicleRow> =
        jdbc.sql(
            """select $columns from vehicles where user_id = :u and (cast(:s as timestamptz) is null or updated_at > :s)
               order by position, created_at""",
        ).param("u", userId).param("s", since?.odt()).query { rs, _ -> map(rs) }.list()

    fun countActive(userId: UUID, excluding: UUID?): Int =
        jdbc.sql(
            """select count(*) from vehicles where user_id = :u and status = 'active' and deleted_at is null
               and (cast(:x as uuid) is null or id <> :x)""",
        ).param("u", userId).param("x", excluding).query(Int::class.java).single()

    fun maxPosition(userId: UUID): Int =
        jdbc.sql("select coalesce(max(position), -1) from vehicles where user_id = :u").param("u", userId)
            .query(Int::class.java).single()

    fun insert(v: VehicleRow) {
        jdbc.sql(
            """insert into vehicles($columns) values (:id, :u, :type, :brand, :model, :year, :plate, :km, :kmAt, :kpm,
               :fb, :fm, :fy, :fc, :status, :pos, :archivedAt, :createdAt, :updatedAt, :deletedAt)""",
        ).paramSource(params(v)).update()
    }

    fun save(v: VehicleRow) {
        jdbc.sql(
            """update vehicles set type = :type, brand = :brand, model = :model, year = :year, plate = :plate, km = :km,
               km_at = :kmAt, km_per_month = :kpm, fipe_brand_code = :fb, fipe_model_code = :fm, fipe_year_code = :fy,
               fipe_code = :fc, status = :status, position = :pos, archived_at = :archivedAt, updated_at = :updatedAt,
               deleted_at = :deletedAt where id = :id and user_id = :u""",
        ).paramSource(params(v)).update()
    }

    /** Sets the FIPE code learned from the price lookup without touching updated_at (not a user change). */
    fun setFipeCode(id: UUID, fipeCode: String) {
        jdbc.sql("update vehicles set fipe_code = :c where id = :id").param("c", fipeCode).param("id", id).update()
    }

    /** Active vehicles of every user (daily job). */
    fun allActive(): List<VehicleRow> =
        jdbc.sql("select $columns from vehicles where status = 'active' and deleted_at is null order by user_id")
            .query { rs, _ -> map(rs) }.list()

    private fun params(v: VehicleRow) = mapOf(
        "id" to v.id, "u" to v.userId, "type" to v.type.name, "brand" to v.brand, "model" to v.model, "year" to v.year,
        "plate" to v.plate, "km" to v.km, "kmAt" to v.kmAt.odt(), "kpm" to v.kmPerMonth, "fb" to v.fipeBrandCode,
        "fm" to v.fipeModelCode, "fy" to v.fipeYearCode, "fc" to v.fipeCode, "status" to v.status.name, "pos" to v.position,
        "archivedAt" to v.archivedAt?.odt(), "createdAt" to v.createdAt.odt(), "updatedAt" to v.updatedAt.odt(),
        "deletedAt" to v.deletedAt?.odt(),
    ).let { org.springframework.jdbc.core.namedparam.MapSqlParameterSource(it) }

    companion object {
        fun map(rs: ResultSet) = VehicleRow(
            id = rs.getObject("id", UUID::class.java),
            userId = rs.getObject("user_id", UUID::class.java),
            type = VehicleType.valueOf(rs.getString("type")),
            brand = rs.getString("brand"),
            model = rs.getString("model"),
            year = rs.getInt("year"),
            plate = rs.getString("plate"),
            km = rs.getInt("km"),
            kmAt = rs.instantOrThrow("km_at"),
            kmPerMonth = rs.getInt("km_per_month"),
            fipeBrandCode = rs.getString("fipe_brand_code"),
            fipeModelCode = rs.getString("fipe_model_code"),
            fipeYearCode = rs.getString("fipe_year_code"),
            fipeCode = rs.getString("fipe_code"),
            status = VehicleStatus.valueOf(rs.getString("status")),
            position = rs.getInt("position"),
            archivedAt = rs.instant("archived_at"),
            createdAt = rs.instantOrThrow("created_at"),
            updatedAt = rs.instantOrThrow("updated_at"),
            deletedAt = rs.instant("deleted_at"),
        )
    }
}
