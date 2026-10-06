package br.com.querorevisar.api.alerts

import br.com.querorevisar.api.account.AuthUsers
import br.com.querorevisar.api.catalog.CatalogService
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.domain.DueCalculator
import br.com.querorevisar.api.domain.DueStatusKey
import br.com.querorevisar.api.mail.AlertLine
import br.com.querorevisar.api.mail.MailService
import br.com.querorevisar.api.mail.MailTemplates
import br.com.querorevisar.api.push.PushMessage
import br.com.querorevisar.api.push.PushService
import br.com.querorevisar.api.records.RecordRepository
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.LocalDate
import java.util.UUID

/** One item of an alert summary (alerts.items). */
data class AlertItem(val itemId: String, val name: String, val status: String, val pct: Double, val line: String)

/**
 * F08.2 alerts. `daily` computes the due status of every active vehicle (estimated km, catalog merged with the
 * manufacturer plan) and writes one alerts row per vehicle and day with the over/warn items. `send-alerts` delivers
 * them by push, or by e-mail to who has no push. Free users get every alert too (docs/domain.md).
 */
@Service
class AlertService(
    private val jdbc: JdbcClient,
    private val catalog: CatalogService,
    private val records: RecordRepository,
    private val vehicles: br.com.querorevisar.api.vehicles.VehicleRepository,
    private val push: PushService,
    private val mail: MailService,
    private val authUsers: AuthUsers,
    private val mapper: JsonMapper,
    private val props: AppProperties,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val itemsType = object : TypeReference<List<AlertItem>>() {}

    fun computeDaily(runDate: LocalDate): Map<String, Any> {
        val now = clock.instant()
        var alerts = 0
        val active = vehicles.allActive()
        for (v in active) {
            val est = DueCalculator.estimateKm(v.kmState(), now)
            val recs = records.listByVehicle(v.id).map { it.asRecordLike() }
            if (recs.isEmpty()) continue
            val items = catalog.itemsFor(v.type, v.brand, v.model).mapNotNull { item ->
                val s = DueCalculator.itemStatus(item.interval(), recs, est, now)
                if (s.key == DueStatusKey.over || s.key == DueStatusKey.warn) {
                    s to AlertItem(item.id, item.name, s.key.name, s.pct, DueCalculator.statusLine(item.interval(), s, v.kmPerMonth))
                } else {
                    null
                }
            }.sortedWith { a, b -> DueCalculator.attentionOrder.compare(a.first, b.first) }.map { it.second }
            if (items.isEmpty()) continue
            alerts += jdbc.sql(
                """insert into alerts(user_id, vehicle_id, run_date, items) values (:u, :v, :d, cast(:i as jsonb))
                   on conflict (vehicle_id, run_date) do nothing""",
            ).param("u", v.userId).param("v", v.id).param("d", runDate).param("i", mapper.writeValueAsString(items)).update()
        }
        return mapOf("vehicles" to active.size, "alerts" to alerts)
    }

    fun sendPending(runDate: LocalDate): Map<String, Any> {
        data class Pending(val id: UUID, val userId: UUID, val vehicleId: UUID, val items: List<AlertItem>)
        val pending = jdbc.sql(
            "select id, user_id, vehicle_id, items::text as items from alerts where sent_at is null and run_date between :from and :to",
        ).param("from", runDate.minusDays(1)).param("to", runDate)
            .query { rs, _ ->
                Pending(
                    rs.getObject("id", UUID::class.java), rs.getObject("user_id", UUID::class.java),
                    rs.getObject("vehicle_id", UUID::class.java), mapper.readValue(rs.getString("items"), itemsType),
                )
            }.list()
        var pushed = 0
        var emailed = 0
        var skipped = 0
        for (a in pending) {
            val vehicle = vehicles.findAny(a.vehicleId)
            val name = vehicle?.model ?: "veículo"
            val first = a.items.first()
            val statusLabel = DueStatusKey.valueOf(first.status).label
            val body = if (a.items.size == 1) "${first.name}: ${statusLabel.lowercase()} no seu $name" else "${a.items.size} itens precisam de atenção no seu $name"
            val channel = when {
                push.sendToUser(a.userId, PushMessage("QueroRevisar", body, "/itens", "alert-${a.vehicleId}")) > 0 -> {
                    pushed++
                    "push"
                }
                else -> authUsers.email(a.userId)?.let { email ->
                    val lines = a.items.map { AlertLine(it.name, DueStatusKey.valueOf(it.status).label, it.line, it.status == "over") }
                    mail.send(MailTemplates.dueAlert(email, name, lines, props.appUrl))
                    emailed++
                    "email"
                }
            }
            if (channel == null) skipped++
            jdbc.sql("update alerts set sent_at = :t, channel = :c where id = :id")
                .param("t", clock.instant().odt()).param("c", channel).param("id", a.id).update()
        }
        if (pending.isNotEmpty()) log.info("Alerts: {} push, {} e-mail, {} without channel", pushed, emailed, skipped)
        return mapOf("pending" to pending.size, "push" to pushed, "email" to emailed, "noChannel" to skipped)
    }
}
