package br.com.querorevisar.api.fipe

import br.com.querorevisar.api.common.ApiDto
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.HttpClients
import br.com.querorevisar.api.common.Secrets
import br.com.querorevisar.api.domain.PtBr
import br.com.querorevisar.api.domain.VehicleType
import org.springframework.core.ParameterizedTypeReference
import org.springframework.web.client.RestClient
import java.time.Clock
import java.time.YearMonth
import java.time.ZoneId

@ApiDto
data class FipeOption(val code: String, val name: String)

/** Price of one model/year: "R$ 62.400,00" already converted to cents. */
data class FipePrice(
    val valueCents: Long,
    val referenceMonth: String,
    val fipeCode: String,
    val brand: String?,
    val model: String?,
    val modelYear: Int?,
    val fuel: String?,
)

class FipeUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/** FIPE API v2 (Parallelum). `type` is the API vehicle type: cars, motorcycles or trucks. */
interface FipeClient {
    fun brands(type: String): List<FipeOption>

    fun models(type: String, brand: String): List<FipeOption>

    fun years(type: String, brand: String, model: String): List<FipeOption>

    fun price(type: String, brand: String, model: String, year: String): FipePrice

    fun priceByCode(type: String, fipeCode: String, year: String): FipePrice

    companion object {
        fun apiType(type: VehicleType): String = if (type == VehicleType.car) "cars" else "motorcycles"
    }
}

/**
 * https://fipe.parallelum.com.br/api/v2 — X-Subscription-Token only when FIPE_API_TOKEN is set (the free tier works
 * without it, with a lower daily limit). Timeouts: connect 3 s, read 10 s.
 */
class ParallelumFipeClient(props: AppProperties) : FipeClient {
    private val client: RestClient = HttpClients.restClient(props.fipe.baseUrl.trimEnd('/'), props).let { b ->
        if (Secrets.isSet(props.fipe.token)) b.defaultHeader("X-Subscription-Token", props.fipe.token) else b
    }.build()

    private val listType = object : ParameterizedTypeReference<List<FipeOption>>() {}

    private data class PriceBody(
        val price: String? = null,
        val brand: String? = null,
        val model: String? = null,
        val modelYear: Int? = null,
        val fuel: String? = null,
        val codeFipe: String? = null,
        val referenceMonth: String? = null,
    )

    private fun <T : Any> call(what: String, block: () -> T?): T = try {
        block() ?: throw FipeUnavailableException("Empty FIPE response for $what")
    } catch (e: FipeUnavailableException) {
        throw e
    } catch (e: Exception) {
        throw FipeUnavailableException("FIPE request failed for $what: ${e.javaClass.simpleName}", e)
    }

    override fun brands(type: String): List<FipeOption> =
        call("brands") { client.get().uri("/{t}/brands", type).retrieve().body(listType) }

    override fun models(type: String, brand: String): List<FipeOption> =
        call("models") { client.get().uri("/{t}/brands/{b}/models", type, brand).retrieve().body(listType) }

    override fun years(type: String, brand: String, model: String): List<FipeOption> =
        call("years") { client.get().uri("/{t}/brands/{b}/models/{m}/years", type, brand, model).retrieve().body(listType) }

    override fun price(type: String, brand: String, model: String, year: String): FipePrice = toPrice(
        call("price") {
            client.get().uri("/{t}/brands/{b}/models/{m}/years/{y}", type, brand, model, year).retrieve().body(PriceBody::class.java)
        },
    )

    override fun priceByCode(type: String, fipeCode: String, year: String): FipePrice = toPrice(
        call("price") { client.get().uri("/{t}/{c}/years/{y}", type, fipeCode, year).retrieve().body(PriceBody::class.java) },
    )

    private fun toPrice(b: PriceBody): FipePrice {
        val cents = PtBr.parseMoneyToCents(b.price) ?: throw FipeUnavailableException("FIPE price without value")
        return FipePrice(
            valueCents = cents,
            referenceMonth = b.referenceMonth?.trim() ?: throw FipeUnavailableException("FIPE price without reference month"),
            fipeCode = b.codeFipe ?: throw FipeUnavailableException("FIPE price without code"),
            brand = b.brand, model = b.model, modelYear = b.modelYear, fuel = b.fuel,
        )
    }
}

/** FIPE_MODE=mock (automated tests): deterministic lists and prices, no network. */
class MockFipeClient(private val clock: Clock) : FipeClient {
    private val brandsByType = mapOf(
        "cars" to linkedMapOf(
            "Chevrolet" to listOf("Onix", "Onix Plus", "Tracker", "S10", "Spin", "Montana"),
            "Volkswagen" to listOf("Gol", "Polo", "Virtus", "T-Cross", "Nivus", "Saveiro"),
            "Fiat" to listOf("Argo", "Mobi", "Cronos", "Strada", "Toro", "Pulse"),
            "Hyundai" to listOf("HB20", "HB20S", "Creta"),
            "Toyota" to listOf("Corolla", "Corolla Cross", "Hilux", "Yaris"),
        ),
        "motorcycles" to linkedMapOf(
            "Honda" to listOf("CG 160", "Biz 125", "Pop 110i", "CB 300F", "XRE 300", "PCX 160"),
            "Yamaha" to listOf("Fazer 250", "Factor 150", "Lander 250", "NMax 160"),
            "Bajaj" to listOf("Pulsar N150", "Dominar 200"),
        ),
    )

    private fun brandMap(type: String) = brandsByType[type] ?: brandsByType.getValue("cars")

    override fun brands(type: String): List<FipeOption> =
        brandMap(type).keys.mapIndexed { i, name -> FipeOption("${i + 1}", name) }

    override fun models(type: String, brand: String): List<FipeOption> {
        val names = brandMap(type).values.toList().getOrNull((brand.toIntOrNull() ?: 0) - 1) ?: return emptyList()
        return names.mapIndexed { i, name -> FipeOption("${brand}${(i + 1).toString().padStart(2, '0')}", name) }
    }

    override fun years(type: String, brand: String, model: String): List<FipeOption> =
        (2025 downTo 2015).map { FipeOption("$it-1", "$it Gasolina") }

    override fun price(type: String, brand: String, model: String, year: String): FipePrice =
        priceByCode(type, "${model.padStart(6, '0').take(6)}-${(model.hashCode() and 7)}", year)

    override fun priceByCode(type: String, fipeCode: String, year: String): FipePrice {
        val y = year.substringBefore('-').toIntOrNull() ?: 2020
        val base = if (type == "motorcycles") 1_500_000L else 6_000_000L
        val value = base + (Math.floorMod(fipeCode.hashCode(), 40)) * 50_000L + (y - 2015) * 120_000L
        val month = YearMonth.now(clock.withZone(ZoneId.of("America/Sao_Paulo")))
        return FipePrice(value, PtBr.monthYear(month), fipeCode, null, null, y, "Gasolina")
    }
}
