package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.FieldError
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.common.Redact
import br.com.querorevisar.api.common.Zones
import br.com.querorevisar.api.credits.CreditLedger
import br.com.querorevisar.api.credits.LedgerReason
import br.com.querorevisar.api.domain.FipeQuote
import br.com.querorevisar.api.domain.LookupAssembler
import br.com.querorevisar.api.domain.LookupCatalog
import br.com.querorevisar.api.domain.LookupData
import br.com.querorevisar.api.domain.LookupPart
import br.com.querorevisar.api.domain.LookupProductDef
import br.com.querorevisar.api.domain.Plates
import br.com.querorevisar.api.domain.PtBr
import br.com.querorevisar.api.fipe.FipeService
import br.com.querorevisar.api.vehicles.VehicleRepository
import br.com.querorevisar.api.vehicles.VehicleRow
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.LocalDate
import java.util.UUID

@Configuration
class LookupConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    /** VEHICLE_DATA_MODE=mock (default, or whenever the provider key/URL are placeholders) or live. */
    @Bean
    fun vehicleDataProvider(props: AppProperties): VehicleDataProvider =
        if (props.vehicleData.isMock) {
            log.warn("VEHICLE_DATA_MODE=mock: plate lookups return the prototype's deterministic data")
            MockVehicleDataProvider()
        } else {
            LiveVehicleDataProvider(props)
        }
}

/**
 * F10.2 plate lookups: validate the plate, debit the credits in a transaction (balance checked under the user's
 * lock, 402 `insufficient-credits` with `missing`), call the provider outside the transaction, refund on failure
 * (503 `provider-unavailable`). Reopening a saved lookup never charges.
 */
@Service
class LookupService(
    private val provider: VehicleDataProvider,
    private val lookups: LookupRepository,
    private val ledger: CreditLedger,
    private val profiles: ProfileService,
    private val vehicles: VehicleRepository,
    private val fipe: FipeService,
    private val props: AppProperties,
    private val clock: Clock,
    private val tx: TransactionTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun products() = LookupCatalog.PRODUCTS.map {
        LookupProduct(it.id, it.name, it.desc, it.credits, it.credits * props.credits.unitPriceCents, it.tag, it.parts)
    }

    fun list(userId: UUID): List<LookupSummary> = lookups.list(userId).map { it.toSummary() }

    fun get(userId: UUID, id: UUID): LookupResult = lookups.find(userId, id) ?: throw ApiException.notFound("Consulta não encontrada.")

    fun create(userId: UUID, req: LookupCreate): LookupResult {
        val plate = Plates.normalize(req.plate!!)
        if (!Plates.isValid(plate)) throw ApiException(ProblemCode.INVALID_PLATE, errors = listOf(FieldError("plate", Plates.ERROR)))
        val product = LookupCatalog.product(req.product!!)
        val mine = req.mine!!
        val own: VehicleRow? = when {
            req.vehicleId != null -> vehicles.find(userId, req.vehicleId) ?: throw ApiException.notFound("Veículo não encontrado.")
            mine -> vehicles.list(userId).firstOrNull { it.plate == plate } ?: throw ApiException.notFound("Veículo não encontrado.")
            else -> null
        }
        val cost = product.credits
        val id = UUID.randomUUID()

        if (cost > 0) {
            tx.executeWithoutResult {
                profiles.lock(userId)
                val balance = ledger.balance(userId)
                if (balance < cost) {
                    val missing = cost - balance
                    throw ApiException(ProblemCode.INSUFFICIENT_CREDITS, "Faltam ${PtBr.credits(missing)} para esta consulta.", missing = missing)
                }
                ledger.add(userId, -cost, LedgerReason.lookup, "lookup", id.toString())
            }
        }
        log.info("Lookup {} for plate {} ({} credits)", product.id, Plates.mask(plate), cost)

        val result = try {
            val now = clock.instant()
            val query = PlateQuery(plate, mine, own?.let { ownVehicle(it) }, now)
            val data = fetch(product, query, if (mine) own else null)
            val sections = LookupAssembler.sections(product, data, LocalDate.now(clock.withZone(Zones.SAO_PAULO)).year)
            val b = data.basic
            LookupResult(
                id = id, plate = plate, product = product.id, mine = mine, createdAt = now, creditsSpent = cost,
                vehicle = LookupVehicle(b.model, b.year, b.color, b.fuel, b.city),
                sections = sections, summary = LookupCatalog.summary(sections),
            ).also { lookups.insert(it, userId, own?.id, provider.name) }
        } catch (e: Exception) {
            Redact.error(log, "Lookup failed; refunding ${cost} credits", e)
            if (cost > 0) ledger.add(userId, cost, LedgerReason.refund, "lookup", id.toString())
            throw ApiException(
                ProblemCode.PROVIDER_UNAVAILABLE,
                "Não conseguimos consultar agora. Seus créditos foram devolvidos.",
            )
        }
        return result
    }

    private fun ownVehicle(v: VehicleRow): OwnVehicle {
        val cached = if (fipe.hasFipeData(v)) runCatching { fipe.quote(v, allowFetch = false) }.getOrNull() else null
        return OwnVehicle("${v.brand} ${v.model}", v.year.toString(), null, cached?.valueCents)
    }

    /** Calls only the provider methods the product needs; the FIPE part prefers FipeService for the user's car. */
    private fun fetch(product: LookupProductDef, q: PlateQuery, own: VehicleRow?): LookupData {
        val parts = product.parts.toSet()
        val basic = provider.basic(q)
        val fipeQuote: FipeQuote? = if (LookupPart.fipe in parts) {
            val fromFipe = own?.takeIf { fipe.hasFipeData(it) }?.let { v ->
                runCatching { fipe.quote(v, allowFetch = true) }.getOrNull()?.let { FipeQuote(it.valueCents, it.referenceMonth) }
            }
            fromFipe ?: provider.fipeHint(q)
        } else {
            null
        }
        return LookupData(
            basic = basic,
            restrictions = if (LookupPart.restricoes in parts) provider.restrictions(q) else null,
            auction = if (LookupPart.leilao in parts) provider.auctionAndClaims(q) else null,
            debts = if (LookupPart.debitos in parts) provider.debts(q) else null,
            fipe = fipeQuote,
        )
    }
}
