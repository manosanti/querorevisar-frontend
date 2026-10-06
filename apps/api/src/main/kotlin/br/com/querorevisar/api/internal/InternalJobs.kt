package br.com.querorevisar.api.internal

import br.com.querorevisar.api.alerts.AlertService
import br.com.querorevisar.api.billing.PaymentEvents
import br.com.querorevisar.api.billing.WebhookService
import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.IdempotencyFilter
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.common.Zones
import br.com.querorevisar.api.common.odt
import br.com.querorevisar.api.credits.PurchaseRepository
import br.com.querorevisar.api.fipe.FipeService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.tags.Tag
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Duration
import java.time.LocalDate

@Suppress("EnumEntryName")
enum class JobStatus { ran, skipped }

@ApiDto
data class JobRun(val job: String, val runDate: LocalDate, val status: JobStatus, val stats: Map<String, Any?>)

/**
 * F08.2 internal jobs (Cloud Scheduler). Each job runs at most once per São Paulo date (job_runs); a second call the
 * same day answers `skipped` with the stored stats. A failed run is forgotten so the scheduler can retry.
 */
@Service
class JobRunner(
    private val jdbc: JdbcClient,
    private val mapper: JsonMapper,
    private val clock: Clock,
    private val alerts: AlertService,
    private val payments: PaymentEvents,
    private val purchases: PurchaseRepository,
    private val fipe: FipeService,
    private val webhooks: WebhookService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val statsType = object : TypeReference<Map<String, Any?>>() {}

    fun today(): LocalDate = LocalDate.now(clock.withZone(Zones.SAO_PAULO))

    fun run(job: String, runDate: LocalDate = today()): JobRun {
        val work: () -> Map<String, Any?> = when (job) {
            "daily" -> { { alerts.computeDaily(runDate) + mapOf("downgraded" to payments.downgradeExpired(), "expiredPurchases" to purchases.expirePending(clock.instant())) } }
            "send-alerts" -> { { alerts.sendPending(runDate) } }
            "premium-credits" -> { { payments.premiumCreditsFallback() } }
            "fipe-refresh" -> { { fipe.refreshStale() } }
            "cleanup" -> { { cleanup() } }
            else -> throw ApiException.notFound("Job desconhecido.")
        }
        val started = jdbc.sql("insert into job_runs(job, run_date, started_at) values (:j, :d, :t) on conflict do nothing")
            .param("j", job).param("d", runDate).param("t", clock.instant().odt()).update() == 1
        if (!started) {
            val stats = jdbc.sql("select stats::text from job_runs where job = :j and run_date = :d").param("j", job).param("d", runDate)
                .query { rs, _ -> rs.getString(1) }.list().firstOrNull()?.let { mapper.readValue(it, statsType) } ?: emptyMap()
            return JobRun(job, runDate, JobStatus.skipped, stats)
        }
        return try {
            val stats = work()
            jdbc.sql("update job_runs set finished_at = :t, stats = cast(:s as jsonb) where job = :j and run_date = :d")
                .param("t", clock.instant().odt()).param("s", mapper.writeValueAsString(stats)).param("j", job).param("d", runDate).update()
            log.info("Job {} ({}) finished: {}", job, runDate, stats)
            JobRun(job, runDate, JobStatus.ran, stats)
        } catch (e: Exception) {
            Redact.error(log, "Job $job failed", e)
            jdbc.sql("delete from job_runs where job = :j and run_date = :d").param("j", job).param("d", runDate).update()
            throw e
        }
    }

    private fun cleanup(): Map<String, Any?> {
        val keys = jdbc.sql("delete from idempotency_keys where created_at < :t")
            .param("t", clock.instant().minus(IdempotencyFilter.TTL).odt()).update()
        val retried = webhooks.retryFailed()
        val events = webhooks.deleteOld()
        val mutations = jdbc.sql("delete from sync_mutations where applied_at < :t")
            .param("t", clock.instant().minus(Duration.ofDays(60)).odt()).update()
        return mapOf("idempotencyKeys" to keys, "webhookEvents" to events, "webhookRetries" to retried, "syncMutations" to mutations)
    }
}

@RestController
@Tag(name = "internal")
class InternalJobsController(private val jobs: JobRunner) {
    @PostMapping("/internal/jobs/{job}")
    @Operation(operationId = "runInternalJob", summary = "Cloud Scheduler (OIDC) or X-Internal-Token")
    fun run(
        @PathVariable
        @Parameter(schema = Schema(type = "string", allowableValues = ["daily", "send-alerts", "premium-credits", "fipe-refresh", "cleanup"]))
        job: String,
        @RequestHeader(name = "X-Internal-Token", required = false) @Suppress("UNUSED_PARAMETER") token: String?,
    ): JobRun = jobs.run(job)
}
