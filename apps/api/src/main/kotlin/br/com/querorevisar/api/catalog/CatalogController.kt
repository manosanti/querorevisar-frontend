package br.com.querorevisar.api.catalog

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.domain.VehicleType
import br.com.querorevisar.api.fipe.FipeOption
import br.com.querorevisar.api.fipe.FipeService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper

@ApiDto
data class CatalogVersion(
    val version: Int,
    /** e.g. /catalog.v1.json (published by the web build). */
    val url: String,
)

@RestController
@Tag(name = "catalog")
class CatalogController(
    private val catalog: CatalogService,
    private val fipe: FipeService,
    private val mapper: JsonMapper,
) {
    @GetMapping("/v1/catalog/version")
    @Operation(operationId = "getCatalogVersion", summary = "Current catalog version and the static file that holds it")
    fun version(): CatalogVersion = CatalogVersion(catalog.version, "/catalog.v${catalog.version}.json")

    @GetMapping("/v1/catalog/vehicles/{type}/brands")
    @Operation(operationId = "listFipeBrands", summary = "FIPE brands (30-day cache)")
    fun brands(@PathVariable type: VehicleType): List<FipeOption> = fipe.brands(type)

    @GetMapping("/v1/catalog/vehicles/{type}/brands/{brand}/models")
    @Operation(operationId = "listFipeModels", summary = "FIPE models of the brand")
    fun models(@PathVariable type: VehicleType, @PathVariable brand: String): List<FipeOption> = fipe.models(type, brand)

    @GetMapping("/v1/catalog/vehicles/{type}/brands/{brand}/models/{model}/years")
    @Operation(operationId = "listFipeYears", summary = "FIPE years of the model (code like \"2019-1\", name like \"2019 Gasolina\")")
    fun years(@PathVariable type: VehicleType, @PathVariable brand: String, @PathVariable model: String): List<FipeOption> =
        fipe.years(type, brand, model)

    @GetMapping("/v1/catalog/manufacturer-plan")
    @Operation(operationId = "getManufacturerPlan", summary = "Manufacturer plan (structure of data/planos.json)")
    @Suppress("UNCHECKED_CAST")
    fun manufacturerPlan(@RequestParam brand: String, @RequestParam model: String): Map<String, Any?> {
        val plan = catalog.findPlan(brand, model) ?: throw ApiException.notFound("Não temos o plano do fabricante para este modelo.")
        return mapper.convertValue(plan.raw, Map::class.java) as Map<String, Any?>
    }
}
