package br.com.querorevisar.api.fipe

import br.com.querorevisar.api.domain.PtBr
import br.com.querorevisar.api.support.IntegrationTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

/** F10.1 FIPE (FIPE_MODE=mock in tests): lists with cache, vehicle price with our monthly history and budget. */
class FipeIT : IntegrationTest() {
    @Test
    fun `brands, models and years are cached`() {
        val user = newUser()
        val brands = get("/v1/catalog/vehicles/car/brands", user).expect(200)
        assertEquals("Chevrolet", brands.at("/0/name").asString())
        val models = get("/v1/catalog/vehicles/car/brands/1/models", user).expect(200)
        assertEquals("Onix", models.at("/0/name").asString())
        val years = get("/v1/catalog/vehicles/moto/brands/1/models/101/years", user).expect(200)
        assertEquals("2025-1", years.at("/0/code").asString())
        val cached = jdbc.sql("select count(*) from fipe_reference where key in ('cars/brands', 'cars/brands/1/models')").query(Int::class.java).single()
        assertEquals(2, cached)
        assertEquals(400, get("/v1/catalog/vehicles/truck/brands", user).status)
    }

    @Test
    fun `vehicle FIPE price, learned code and 30-day variation`() {
        val user = newUser()
        val noCodes = createVehicle(user).expect(200).text("/id")
        assertEquals(404, get("/v1/vehicles/$noCodes/fipe", user).status)
        delete("/v1/vehicles/$noCodes", user).expect(204)

        val v = createVehicle(user, extra = mapOf("fipeBrandCode" to "1", "fipeModelCode" to "101", "fipeYearCode" to "2019-1")).expect(200).text("/id")
        val first = get("/v1/vehicles/$v/fipe", user).expect(200)
        val month = YearMonth.now(ZoneId.of("America/Sao_Paulo"))
        assertEquals(PtBr.monthYear(month), first.text("/referenceMonth"))
        assertEquals(0.0, first.at("/deltaPct30d").asDouble())
        val value = first.at("/valueCents").asLong()
        assertTrue(value > 0)
        val code = get("/v1/vehicles", user).json.values().first()["fipeCode"].asString()
        assertTrue(code.isNotBlank())

        jdbc.sql("insert into fipe_price_history(fipe_code, year_code, reference_month, value_cents) values (:c, '2019-1', :m, :v)")
            .param("c", code).param("m", PtBr.monthYear(month.minusMonths(1))).param("v", value - value / 100).update()
        val second = get("/v1/vehicles/$v/fipe", user).expect(200)
        assertEquals(value, second.at("/valueCents").asLong())
        assertTrue(second.at("/deltaPct30d").asDouble() > 0.9 && second.at("/deltaPct30d").asDouble() < 1.1, second.body)
    }

    @Test
    fun `exhausted budget serves nothing new (503) but keeps cached lists`() {
        val user = newUser()
        get("/v1/catalog/vehicles/moto/brands", user).expect(200)
        val day = LocalDate.now(ZoneId.of("America/Sao_Paulo"))
        jdbc.sql("insert into fipe_usage(day, calls) values (:d, 100000) on conflict (day) do update set calls = 100000").param("d", day).update()
        try {
            get("/v1/catalog/vehicles/moto/brands", user).expect(200)
            val r = get("/v1/catalog/vehicles/moto/brands/3/models", user)
            assertEquals(503, r.status)
            assertEquals("provider-unavailable", r.text("/code"))
        } finally {
            jdbc.sql("update fipe_usage set calls = 0 where day = :d").param("d", day).update()
        }
    }

    @Test
    fun `manufacturer plan with the tolerant lookup`() {
        val user = newUser()
        val plan = get("/v1/catalog/manufacturer-plan?brand=BAJAJ&model=PULSAR N150 160", user).expect(200)
        assertEquals("bajaj-pulsar-n150", plan.text("/id"))
        assertEquals(404, get("/v1/catalog/manufacturer-plan?brand=Bajaj&model=Pulsar N1500", user).status)
    }
}
