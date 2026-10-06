package br.com.querorevisar.api.domain

// Catalog (data/catalog.json) merged with the manufacturer plan (data/planos.json) for one vehicle.
// Ported from packages/core/src/catalog.ts (fixtures/catalog-merge.json).

data class CatalogItemRaw(
    val id: String,
    val name: String,
    val km: Int? = null,
    val months: Int? = null,
    val desc: String = "",
    val insp: Boolean = false,
    val types: List<VehicleType> = emptyList(),
)

data class CatalogCategoryRaw(
    val id: String,
    val group: String = "",
    val name: String,
    val icon: List<String> = emptyList(),
    val types: List<VehicleType> = emptyList(),
    val items: List<CatalogItemRaw> = emptyList(),
)

data class CatalogData(
    val version: Int,
    val total: Int = 0,
    val categories: List<CatalogCategoryRaw> = emptyList(),
)

data class PlanRule(
    val acoes: List<String>? = null,
    val intervaloKm: Int? = null,
    val intervaloMeses: Int? = null,
)

data class PlanItem(val name: String? = null, val nome: String? = null, val rules: List<PlanRule>? = null)

data class PlanCategory(val items: List<PlanItem> = emptyList())

data class ManufacturerPlanData(
    val id: String,
    val brand: String,
    val model: String,
    val type: VehicleType? = null,
    val categories: List<PlanCategory> = emptyList(),
)

data class CatalogItem(
    val id: String,
    val name: String,
    val km: Int?,
    val months: Int?,
    val desc: String,
    val insp: Boolean,
    val types: List<VehicleType>,
    val categoryId: String,
    val categoryName: String,
    val icon: List<String>,
    /** "Plano {marca}" when the manufacturer plan sets the interval, otherwise "Média QueroRevisar". */
    val source: String,
) {
    fun interval(): IntervalItem = IntervalItem(id, km, months)
}

object CatalogMerge {
    const val DEFAULT_SOURCE = "Média QueroRevisar"

    /**
     * Tolerant to FIPE names (docs/domain.md): brands are equal after normalizeText; the model matches when the
     * normalized names are equal or the vehicle model starts with the plan model followed by a space
     * ("PULSAR N150 160" → plan "Pulsar N150", but not "Pulsar N1500").
     */
    fun planMatches(plan: ManufacturerPlanData, brand: String, model: String): Boolean {
        if (PtBr.normalizeText(plan.brand) != PtBr.normalizeText(brand)) return false
        val m = PtBr.normalizeText(model)
        val p = PtBr.normalizeText(plan.model)
        return m == p || m.startsWith("$p ")
    }

    fun findPlan(plans: List<ManufacturerPlanData>, brand: String, model: String): ManufacturerPlanData? =
        plans.firstOrNull { planMatches(it, brand, model) }

    fun catalogForVehicle(
        catalog: CatalogData,
        plans: List<ManufacturerPlanData>,
        type: VehicleType,
        brand: String,
        model: String,
    ): List<CatalogItem> {
        val plan = findPlan(plans, brand, model)
        val fromPlan = HashMap<String, Pair<Int?, Int?>>()
        plan?.categories?.forEach { c ->
            c.items.forEach { pi ->
                val rule = (pi.rules ?: emptyList()).firstOrNull { (it.acoes ?: emptyList()).contains("trocar") }
                if (rule != null) fromPlan[PtBr.normalizeText(pi.name ?: pi.nome)] = rule.intervaloKm to rule.intervaloMeses
            }
        }
        val out = ArrayList<CatalogItem>()
        for (c in catalog.categories) {
            for (it in c.items) {
                if (!it.types.contains(type)) continue
                val f = fromPlan[PtBr.normalizeText(it.name)]
                out += CatalogItem(
                    id = it.id,
                    name = it.name,
                    km = if (f != null) f.first else it.km,
                    months = if (f != null) f.second else it.months,
                    desc = it.desc,
                    insp = it.insp,
                    types = it.types,
                    categoryId = c.id,
                    categoryName = c.name,
                    icon = c.icon,
                    source = if (f != null && plan != null) "Plano ${plan.brand}" else DEFAULT_SOURCE,
                )
            }
        }
        return out
    }
}
