package br.com.querorevisar.api.catalog

import br.com.querorevisar.api.domain.CatalogData
import br.com.querorevisar.api.domain.CatalogItem
import br.com.querorevisar.api.domain.CatalogMerge
import br.com.querorevisar.api.domain.ManufacturerPlanData
import br.com.querorevisar.api.domain.VehicleType
import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.time.Duration

/** A manufacturer plan as stored in manufacturer_plans.data (structure of data/planos.json). */
data class StoredPlan(val plan: ManufacturerPlanData, val raw: JsonNode)

/**
 * The maintenance catalog (data/catalog.json, copied into the jar as seed/catalog.json) and the manufacturer plans
 * (manufacturer_plans), cached for 10 minutes (F04.3).
 */
@Service
class CatalogService(private val jdbc: JdbcClient, private val mapper: JsonMapper) {
    private val cache = Caffeine.newBuilder().expireAfterWrite(Duration.ofMinutes(10)).build<String, Any>()

    /** The seed catalog; it never changes while the process runs. */
    val catalog: CatalogData by lazy { mapper.readValue(ClassPathResource(SEED_CATALOG).inputStream, CatalogData::class.java) }

    val version: Int get() = catalog.version

    private val itemIds: Set<String> by lazy { catalog.categories.flatMap { c -> c.items.map { it.id } }.toSet() }

    fun itemExists(itemId: String): Boolean = itemId in itemIds

    fun itemName(itemId: String): String? = catalog.categories.asSequence().flatMap { it.items.asSequence() }.firstOrNull { it.id == itemId }?.name

    @Suppress("UNCHECKED_CAST")
    fun plans(): List<StoredPlan> = cache.get("plans") {
        jdbc.sql("select data::text from manufacturer_plans order by id").query(String::class.java).list().map { json ->
            val node = mapper.readTree(json)
            StoredPlan(mapper.treeToValue(node, ManufacturerPlanData::class.java), node)
        }
    } as List<StoredPlan>

    /** Same tolerant lookup as packages/core findPlan (FIPE names such as "PULSAR N150 160"). */
    fun findPlan(brand: String, model: String): StoredPlan? {
        val all = plans()
        val match = CatalogMerge.findPlan(all.map { it.plan }, brand, model) ?: return null
        return all.first { it.plan.id == match.id }
    }

    /** Catalog for one vehicle, merged with its manufacturer plan (intervals and "Plano {marca}" source). */
    fun itemsFor(type: VehicleType, brand: String, model: String): List<CatalogItem> =
        CatalogMerge.catalogForVehicle(catalog, plans().map { it.plan }, type, brand, model)

    fun evict() = cache.invalidateAll()

    companion object {
        const val SEED_CATALOG = "seed/catalog.json"
        const val SEED_PLANS = "seed/planos.json"
    }
}
