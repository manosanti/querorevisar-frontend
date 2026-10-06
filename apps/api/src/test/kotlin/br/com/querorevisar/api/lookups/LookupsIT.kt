package br.com.querorevisar.api.lookups

import br.com.querorevisar.api.account.ProfileService
import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.ProblemCode
import br.com.querorevisar.api.credits.CreditLedger
import br.com.querorevisar.api.domain.AuctionClaims
import br.com.querorevisar.api.domain.BasicData
import br.com.querorevisar.api.domain.Debts
import br.com.querorevisar.api.domain.LookupProductId
import br.com.querorevisar.api.domain.Restrictions
import br.com.querorevisar.api.fipe.FipeService
import br.com.querorevisar.api.support.IntegrationTest
import br.com.querorevisar.api.vehicles.VehicleRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

/** F10.2 plate lookups: credits debited under lock, 402 with `missing`, refund on provider failure, reopen free. */
class LookupsIT : IntegrationTest() {
    @Autowired lateinit var lookups: LookupRepository
    @Autowired lateinit var ledger: CreditLedger
    @Autowired lateinit var profiles: ProfileService
    @Autowired lateinit var vehicles: VehicleRepository
    @Autowired lateinit var fipe: FipeService
    @Autowired lateinit var props: AppProperties
    @Autowired lateinit var clock: Clock
    @Autowired lateinit var tx: TransactionTemplate

    @Test
    fun `products with credits and price`() {
        val user = newUser()
        val products = get("/v1/lookups/products", user).expect(200).json.values().toList()
        assertEquals(listOf("laudo", "restricoes", "leilao", "debitos", "basica", "fipe"), products.map { it["id"].asString() })
        assertEquals(2940, products[0]["priceCents"].asInt())
        assertEquals("Antes de comprar", products[0]["tag"].asString())
        assertEquals(listOf("basica", "restricoes", "leilao", "debitos", "fipe"), products[0]["parts"].values().map { it.asString() })
    }

    @Test
    fun `insufficient credits is a 402 with missing`() {
        val user = newUser()
        giveCredits(user, 2)
        val r = post("/v1/lookups", mapOf("plate" to "ABC1D23", "product" to "laudo", "mine" to false), user)
        assertEquals(402, r.status)
        assertEquals("insufficient-credits", r.text("/code"))
        assertEquals(4, r.at("/missing").asInt())
        assertEquals("Faltam 4 créditos para esta consulta.", r.text("/title"))
        assertEquals(2, get("/v1/me", user).at("/credits").asInt())
    }

    @Test
    fun `laudo debits, stores and reopens for free`() {
        val user = newUser()
        giveCredits(user, 10)
        val r = post("/v1/lookups", mapOf("plate" to "bra-2e19", "product" to "laudo", "mine" to false), user).expect(200)
        assertEquals("BRA2E19", r.text("/plate"))
        assertEquals(6, r.at("/creditsSpent").asInt())
        assertEquals("Chevrolet Onix Plus", r.text("/vehicle/model"))
        assertEquals(5, r.at("/sections").size())
        assertEquals("1 ponto de atenção: leilão", r.text("/summary/text"))
        assertEquals("over", r.text("/summary/tone"))
        val year = LocalDate.now(ZoneId.of("America/Sao_Paulo")).year
        assertEquals("IPVA $year", r.at("/sections/3/rows/0/label").asString())
        assertEquals(4, get("/v1/me", user).at("/credits").asInt())
        val again = get("/v1/lookups/${r.text("/id")}", user).expect(200)
        assertEquals(r.json, again.json)
        assertEquals(4, get("/v1/me", user).at("/credits").asInt())
        val list = get("/v1/lookups", user).expect(200)
        assertEquals("Chevrolet Onix Plus", list.at("/0/model").asString())
        // never any owner data
        assertFalse(r.body.contains("cpf", ignoreCase = true) || r.body.contains("proprietário", ignoreCase = true))
    }

    @Test
    fun `fipe lookup is free and mine uses the user's vehicle`() {
        val user = newUser()
        val v = createVehicle(user, extra = mapOf("plate" to "QRV2E19")).expect(200).text("/id")
        val free = post("/v1/lookups", mapOf("plate" to "DEF5G67", "product" to "fipe", "mine" to false), user).expect(200)
        assertEquals(0, free.at("/creditsSpent").asInt())
        giveCredits(user, 2)
        val mine = post("/v1/lookups", mapOf("plate" to "QRV2E19", "product" to "debitos", "mine" to true, "vehicleId" to v), user).expect(200)
        assertEquals("Chevrolet Onix", mine.text("/vehicle/model"))
        assertEquals("Nada consta nas bases consultadas", mine.text("/summary/text"))
        assertTrue(mine.at("/mine").asBoolean())
        assertEquals(404, post("/v1/lookups", mapOf("plate" to "ZZZ9Z99", "product" to "fipe", "mine" to true), user).status)
    }

    @Test
    fun `provider failure refunds the credits`() {
        val user = newUser()
        giveCredits(user, 6)
        val failing = object : VehicleDataProvider {
            override val name = "failing"
            override fun basic(q: PlateQuery): BasicData = throw ProviderUnavailableException("down")
            override fun restrictions(q: PlateQuery): Restrictions = throw ProviderUnavailableException("down")
            override fun auctionAndClaims(q: PlateQuery): AuctionClaims = throw ProviderUnavailableException("down")
            override fun debts(q: PlateQuery): Debts = throw ProviderUnavailableException("down")
        }
        val service = LookupService(failing, lookups, ledger, profiles, vehicles, fipe, props, clock, tx)
        val ex = assertThrows(ApiException::class.java) {
            service.create(user.id, LookupCreate("ABC1D23", LookupProductId.laudo, false))
        }
        assertEquals(ProblemCode.PROVIDER_UNAVAILABLE, ex.code)
        assertEquals(6, ledger.balance(user.id))
        val reasons = get("/v1/credits/ledger", user).json.values().map { it["reason"].asString() }
        assertTrue(reasons.containsAll(listOf("lookup", "refund")))
        assertEquals(0, get("/v1/lookups", user).json.size())
    }
}
