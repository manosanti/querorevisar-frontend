package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.common.instantOrThrow
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.domain.LookupProductId
import br.com.querorevisar.api.domain.LookupResultSummary
import br.com.querorevisar.api.domain.LookupSection
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import tools.jackson.databind.json.JsonMapper
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/** What vehicle_lookups.result holds: vehicle, sections and summary (never owner personal data). */
data class StoredLookup(val vehicle: LookupVehicle, val sections: List<LookupSection>, val summary: LookupResultSummary)

@Repository
class LookupRepository(private val jdbc: JdbcClient, private val mapper: JsonMapper) {
    fun insert(r: LookupResult, userId: UUID, vehicleId: UUID?, provider: String) {
        jdbc.sql(
            """insert into vehicle_lookups(id, user_id, plate, product, mine, vehicle_id, credits_spent, provider, result, created_at)
               values (:id, :u, :plate, :product, :mine, :v, :credits, :provider, cast(:result as jsonb), :t)""",
        ).param("id", r.id).param("u", userId).param("plate", r.plate).param("product", r.product.name).param("mine", r.mine)
            .param("v", vehicleId).param("credits", r.creditsSpent).param("provider", provider)
            .param("result", mapper.writeValueAsString(StoredLookup(r.vehicle, r.sections, r.summary)))
            .param("t", r.createdAt.odt()).update()
    }

    fun find(userId: UUID, id: UUID): LookupResult? =
        jdbc.sql("select * from vehicle_lookups where id = :id and user_id = :u").param("id", id).param("u", userId)
            .query { rs, _ -> map(rs) }.optional().orElse(null)

    fun list(userId: UUID): List<LookupResult> =
        jdbc.sql("select * from vehicle_lookups where user_id = :u order by created_at desc").param("u", userId)
            .query { rs, _ -> map(rs) }.list()

    fun createdSince(userId: UUID, since: Instant?): List<LookupResult> =
        jdbc.sql(
            """select * from vehicle_lookups where user_id = :u and (cast(:s as timestamptz) is null or created_at > :s)
               order by created_at desc""",
        ).param("u", userId).param("s", since?.odt()).query { rs, _ -> map(rs) }.list()

    private fun map(rs: ResultSet): LookupResult {
        val stored = mapper.readValue(rs.getString("result"), StoredLookup::class.java)
        return LookupResult(
            id = rs.getObject("id", UUID::class.java),
            plate = rs.getString("plate"),
            product = LookupProductId.valueOf(rs.getString("product")),
            mine = rs.getBoolean("mine"),
            createdAt = rs.instantOrThrow("created_at"),
            creditsSpent = rs.getInt("credits_spent"),
            vehicle = stored.vehicle,
            sections = stored.sections,
            summary = stored.summary,
        )
    }
}
