package br.com.querorevisar.api.account

import br.com.querorevisar.api.auth.CurrentUser
import br.com.querorevisar.api.billing.PremiumService
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Secrets
import br.com.querorevisar.api.credits.CreditLedger
import br.com.querorevisar.api.lookups.LookupRepository
import br.com.querorevisar.api.records.RecordRepository
import br.com.querorevisar.api.vehicles.VehicleRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatusCode
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.util.UUID

/** GET/PATCH /v1/me, LGPD export and account deletion (F12.4). */
@Service
class MeService(
    private val profiles: ProfileService,
    private val ledger: CreditLedger,
    private val flags: FlagsService,
    private val vehicles: VehicleRepository,
    private val records: RecordRepository,
    private val lookups: LookupRepository,
    private val premium: PremiumService,
    private val jdbc: JdbcClient,
    private val tx: TransactionTemplate,
    private val props: AppProperties,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun me(user: CurrentUser): Me {
        val profile = profiles.get(user.id)
        val plan = profile.effectivePlan(clock.instant())
        return Me(
            id = user.id,
            isAnonymous = user.isAnonymous,
            name = profile.name ?: user.name,
            email = user.email,
            plan = plan,
            premiumUntil = profile.premiumUntil,
            credits = maxOf(0, ledger.balance(user.id)),
            flags = flags.flags(user.id, plan),
        )
    }

    fun updateName(user: CurrentUser, name: String): Me {
        profiles.updateName(user.id, name.trim())
        return me(user)
    }

    fun export(user: CurrentUser): MeExport = MeExport(
        me = me(user),
        vehicles = vehicles.list(user.id).map { it.toDto() },
        records = records.listByUser(user.id).map { it.toDto() },
        lookups = lookups.list(user.id),
        ledger = ledger.entries(user.id),
        exportedAt = clock.instant(),
    )

    /**
     * Deletes every row of the user and the auth user: Supabase Admin API with the service role when configured,
     * otherwise the auth.users row directly (local stub). A live Premium subscription is cancelled first.
     */
    fun delete(user: CurrentUser) {
        premium.cancelForDeletion(user.id)
        tx.executeWithoutResult {
            for (table in USER_TABLES) {
                jdbc.sql("delete from $table where user_id = :u").param("u", user.id).update()
            }
        }
        val removed = if (props.auth.mode != "dev" && Secrets.isSet(props.supabase.serviceRoleKey)) {
            deleteSupabaseUser(user.id)
        } else {
            runCatching { jdbc.sql("delete from auth.users where id = :id").param("id", user.id).update() }
                .onFailure { log.warn("Could not delete the auth user directly ({})", it.javaClass.simpleName) }
                .isSuccess
        }
        if (!removed) log.warn("Account data deleted but the auth user remains (configure SUPABASE_SERVICE_ROLE_KEY)")
        profiles.forget(user.id)
    }

    private fun deleteSupabaseUser(id: UUID): Boolean = try {
        val key = props.supabase.serviceRoleKey
        val client = br.com.querorevisar.api.common.HttpClients.restClient(props.supabase.url.trimEnd('/'), props).build()
        client.delete().uri("/auth/v1/admin/users/{id}", id)
            .header("apikey", key)
            .apply { if (key.startsWith("eyJ")) header("Authorization", "Bearer $key") }
            .retrieve()
            .onStatus(HttpStatusCode::isError) { _, response -> throw IllegalStateException("Supabase admin delete failed: ${response.statusCode}") }
            .toBodilessEntity()
        true
    } catch (e: Exception) {
        log.warn("Supabase admin delete failed ({})", e.javaClass.simpleName)
        false
    }

    companion object {
        /** Children first; every user table also cascades from auth.users. */
        val USER_TABLES = listOf(
            "vehicle_lookups", "credit_ledger", "credit_purchases", "subscriptions", "push_subscriptions", "alerts",
            "maintenance_records", "vehicles", "sync_mutations", "idempotency_keys", "profiles",
        )
    }
}
