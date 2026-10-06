package br.com.querorevisar.api.fipe

import br.com.querorevisar.api.common.AppProperties
import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.client.WireMock.absent
import com.github.tomakehurst.wiremock.client.WireMock.equalTo
import com.github.tomakehurst.wiremock.client.WireMock.get
import com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor
import com.github.tomakehurst.wiremock.client.WireMock.okJson
import com.github.tomakehurst.wiremock.client.WireMock.serverError
import com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo
import com.github.tomakehurst.wiremock.core.WireMockConfiguration
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/** FIPE API v2 client against WireMock (response shapes checked against fipe.parallelum.com.br on 2026-10-06). */
class ParallelumFipeClientTest {
    private val server = WireMockServer(WireMockConfiguration.options().dynamicPort())

    @BeforeEach
    fun start() = server.start()

    @AfterEach
    fun stop() = server.stop()

    private fun client(token: String = "<SEM_TOKEN>") =
        ParallelumFipeClient(AppProperties(fipe = AppProperties.Fipe(baseUrl = server.baseUrl(), token = token)))

    @Test
    fun `lists and price`() {
        server.stubFor(get("/cars/brands").willReturn(okJson("""[{"code":"59","name":"VW - VolksWagen"},{"code":"23","name":"GM - Chevrolet"}]""")))
        server.stubFor(get("/cars/brands/23/models").willReturn(okJson("""[{"code":"8291","name":"ONIX HATCH 1.0 12V Flex 5p Mec."}]""")))
        server.stubFor(get("/cars/brands/23/models/8291/years").willReturn(okJson("""[{"code":"2019-5","name":"2019 Flex"}]""")))
        server.stubFor(
            get("/cars/brands/23/models/8291/years/2019-5").willReturn(
                okJson(
                    """{"vehicleType":1,"price":"R$ 62.400,00","brand":"GM - Chevrolet","model":"ONIX HATCH 1.0 12V Flex 5p Mec.",
                       "modelYear":2019,"fuel":"Flex","codeFipe":"004463-3","referenceMonth":"outubro de 2026","fuelAcronym":"F"}""",
                ),
            ),
        )
        server.stubFor(
            get("/cars/004463-3/years/2019-5").willReturn(
                okJson("""{"price":"R$ 61.900,00","codeFipe":"004463-3","referenceMonth":"outubro de 2026","modelYear":2019}"""),
            ),
        )
        val c = client("fipe-token")
        assertEquals(FipeOption("59", "VW - VolksWagen"), c.brands("cars")[0])
        assertEquals("8291", c.models("cars", "23")[0].code)
        assertEquals("2019 Flex", c.years("cars", "23", "8291")[0].name)
        val price = c.price("cars", "23", "8291", "2019-5")
        assertEquals(6240000L, price.valueCents)
        assertEquals("004463-3", price.fipeCode)
        assertEquals("outubro de 2026", price.referenceMonth)
        assertEquals(6190000L, c.priceByCode("cars", "004463-3", "2019-5").valueCents)
        server.verify(getRequestedFor(urlEqualTo("/cars/brands")).withHeader("X-Subscription-Token", equalTo("fipe-token")))
    }

    @Test
    fun `no token header without FIPE_API_TOKEN and failures become FipeUnavailableException`() {
        server.stubFor(get("/motorcycles/brands").willReturn(okJson("[]")))
        server.stubFor(get("/cars/brands").willReturn(serverError()))
        client().brands("motorcycles")
        server.verify(getRequestedFor(urlEqualTo("/motorcycles/brands")).withHeader("X-Subscription-Token", absent()))
        assertThrows(FipeUnavailableException::class.java) { client().brands("cars") }
    }
}
