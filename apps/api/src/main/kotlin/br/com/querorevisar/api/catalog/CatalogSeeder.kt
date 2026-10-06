package br.com.querorevisar.api.catalog

import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.annotation.Order
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper

/**
 * F03.1 seed: upserts catalog_items (data/catalog.json) and manufacturer_plans (data/planos.json) on startup.
 * Idempotent; skipped when the database already holds the same catalog version and plans.
 */
@Component
@Order(0)
class CatalogSeeder(
    private val jdbc: JdbcClient,
    private val mapper: JsonMapper,
    private val tx: TransactionTemplate,
    private val catalog: CatalogService,
) : ApplicationRunner {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun run(args: ApplicationArguments) {
        seed()
    }

    fun seed() {
        val data = catalog.catalog
        val items = data.categories.flatMap { c -> c.items.map { c to it } }
        val plans = mapper.readTree(ClassPathResource(CatalogService.SEED_PLANS).inputStream).path("plans")
        val current = jdbc.sql("select count(*) from catalog_items where catalog_version = :v").param("v", data.version)
            .query(Int::class.java).single()
        val currentPlans = jdbc.sql("select count(*) from manufacturer_plans").query(Int::class.java).single()
        if (current == items.size && currentPlans == plans.size()) {
            log.info("Catalog v{} already seeded ({} items, {} plans)", data.version, items.size, currentPlans)
            return
        }
        tx.executeWithoutResult {
            for ((c, it) in items) {
                jdbc.sql(
                    """insert into catalog_items(id, category_id, category_name, icon, name, description, interval_km,
                       interval_months, vehicle_types, visual_inspection, catalog_version)
                       values (:id, :cid, :cname, :icon, :name, :desc, :km, :months, string_to_array(:types, ','), :insp, :v)
                       on conflict (id) do update set category_id = excluded.category_id, category_name = excluded.category_name,
                       icon = excluded.icon, name = excluded.name, description = excluded.description,
                       interval_km = excluded.interval_km, interval_months = excluded.interval_months,
                       vehicle_types = excluded.vehicle_types, visual_inspection = excluded.visual_inspection,
                       catalog_version = excluded.catalog_version""",
                ).param("id", it.id).param("cid", c.id).param("cname", c.name).param("icon", c.icon.joinToString(" "))
                    .param("name", it.name).param("desc", it.desc).param("km", it.km).param("months", it.months)
                    .param("types", it.types.joinToString(",") { t -> t.name }).param("insp", it.insp).param("v", data.version)
                    .update()
            }
            for (p in plans) {
                jdbc.sql(
                    """insert into manufacturer_plans(id, brand, model, data) values (:id, :brand, :model, cast(:data as jsonb))
                       on conflict (id) do update set brand = excluded.brand, model = excluded.model, data = excluded.data""",
                ).param("id", p.path("id").asString()).param("brand", p.path("brand").asString())
                    .param("model", p.path("model").asString()).param("data", mapper.writeValueAsString(p)).update()
            }
        }
        catalog.evict()
        log.info("Seeded catalog v{}: {} items, {} manufacturer plans", data.version, items.size, plans.size())
    }
}
