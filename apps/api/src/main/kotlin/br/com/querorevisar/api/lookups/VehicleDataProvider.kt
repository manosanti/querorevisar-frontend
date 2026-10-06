package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.domain.AuctionClaims
import br.com.querorevisar.api.domain.BasicData
import br.com.querorevisar.api.domain.Debts
import br.com.querorevisar.api.domain.Finding
import br.com.querorevisar.api.domain.FipeQuote
import br.com.querorevisar.api.domain.PtBr
import br.com.querorevisar.api.domain.Restrictions
import br.com.querorevisar.api.domain.Tone
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId

/** The user's own vehicle ("Meu {modelo}" mode). */
data class OwnVehicle(val model: String, val year: String, val color: String?, val fipeCents: Long?)

data class PlateQuery(val plate: String, val mine: Boolean, val own: OwnVehicle?, val now: Instant)

class ProviderUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Vehicle data by plate (docs/vehicle-data.md, D11). Implementations must never return owner personal data
 * (name, CPF, address). The FIPE part of a lookup comes from the FipeClient; [fipeHint] is only a fallback.
 */
interface VehicleDataProvider {
    val name: String

    fun basic(q: PlateQuery): BasicData

    fun restrictions(q: PlateQuery): Restrictions

    fun auctionAndClaims(q: PlateQuery): AuctionClaims

    fun debts(q: PlateQuery): Debts

    fun fipeHint(q: PlateQuery): FipeQuote? = null
}

/**
 * VEHICLE_DATA_MODE=mock: the prototype logic (fixtures/lookup-mock.json). h = sum of the plate char codes; the
 * vehicle comes from 5 fixed cars by h % 5; for another person's vehicle flag = h % 3 (0 → auction "Consta em 2023",
 * 1 → fines "2 em aberto · R$ 260,32", 2 → nothing); "mine" uses the user's vehicle and everything is "Nada consta".
 */
class MockVehicleDataProvider : VehicleDataProvider {
    override val name = "mock"

    data class MockCar(val model: String, val year: String, val color: String, val fipeReais: Long)

    companion object {
        val CARS = listOf(
            MockCar("Volkswagen Polo", "2021", "Prata", 78512),
            MockCar("Hyundai HB20", "2020", "Branco", 64230),
            MockCar("Fiat Argo", "2022", "Cinza", 71890),
            MockCar("Chevrolet Onix Plus", "2021", "Preto", 76340),
            MockCar("Toyota Corolla", "2019", "Branco", 104760),
        )

        fun plateHash(plate: String): Int = plate.sumOf { it.code }

        fun referenceMonth(now: Instant): String = PtBr.monthYear(YearMonth.from(now.atZone(ZoneId.of("America/Sao_Paulo"))))
    }

    private fun car(q: PlateQuery) = CARS[plateHash(q.plate) % CARS.size]

    private fun flag(q: PlateQuery): Int = if (q.mine) -1 else plateHash(q.plate) % 3

    override fun basic(q: PlateQuery): BasicData {
        val own = q.own
        return if (q.mine && own != null) {
            BasicData(own.model, own.year, own.color, "Flex", "São Paulo/SP")
        } else {
            val c = car(q)
            BasicData(c.model, c.year, c.color, "Flex", "São Paulo/SP")
        }
    }

    override fun restrictions(q: PlateQuery) = Restrictions(Finding.NOTHING, Finding.NOTHING, Finding.NOTHING)

    override fun auctionAndClaims(q: PlateQuery) = AuctionClaims(
        auction = if (flag(q) == 0) Finding("Consta em 2023", Tone.over) else Finding.NOTHING,
        claim = Finding.NOTHING,
        totalLoss = Finding.NOTHING,
    )

    override fun debts(q: PlateQuery) = Debts(
        ipva = Finding.PAID,
        licensing = Finding.PAID,
        fines = if (flag(q) == 1) Finding("2 em aberto · R$ 260,32", Tone.warn) else Finding.NOTHING,
    )

    override fun fipeHint(q: PlateQuery): FipeQuote? {
        val cents = if (q.mine) q.own?.fipeCents else car(q).fipeReais * 100
        return cents?.let { FipeQuote(it, referenceMonth(q.now)) }
    }
}

/**
 * VEHICLE_DATA_MODE=live: skeleton until the owner picks the provider (PENDENCIAS.md, docs/vehicle-data.md).
 * TODO: map the chosen provider's API (VEHICLE_DATA_BASE_URL, VEHICLE_DATA_API_KEY, 15 s read timeout) to these
 * methods, drop owner personal data, and add WireMock tests from the provider's sample responses.
 */
class LiveVehicleDataProvider(private val props: AppProperties) : VehicleDataProvider {
    override val name: String = props.vehicleData.provider

    private fun notImplemented(): Nothing =
        throw ProviderUnavailableException("Vehicle data provider '${props.vehicleData.provider}' is not implemented yet")

    override fun basic(q: PlateQuery): BasicData = notImplemented()

    override fun restrictions(q: PlateQuery): Restrictions = notImplemented()

    override fun auctionAndClaims(q: PlateQuery): AuctionClaims = notImplemented()

    override fun debts(q: PlateQuery): Debts = notImplemented()
}
