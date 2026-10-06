package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.Secrets
import kotlin.system.exitProcess

/**
 * `./gradlew :apps:api:createPremiumPlan` (F09.2): creates the preapproval_plan "QueroRevisar Premium" once per
 * environment and prints the id for MP_PREMIUM_PLAN_ID. In mock mode it only prints the instructions.
 * Reads PAYMENTS_MODE, MP_ACCESS_TOKEN, MP_PREMIUM_PRICE_CENTS and MP_BACK_URL_SUCCESS (or APP_URL).
 */
fun main() {
    val env = System.getenv()
    val mode = env["PAYMENTS_MODE"] ?: "mock"
    val token = env["MP_ACCESS_TOKEN"] ?: "<SEM_TOKEN>"
    val price = env["MP_PREMIUM_PRICE_CENTS"]?.toIntOrNull() ?: 1490
    val appUrl = env["APP_URL"] ?: "http://localhost:5173"
    val backUrl = env["MP_BACK_URL_SUCCESS"]?.replace("\${APP_URL}", appUrl) ?: "$appUrl/conta?pagamento=ok"

    if (mode == "mock" || !Secrets.isSet(token)) {
        println(
            """
            |PAYMENTS_MODE=mock (ou MP_ACCESS_TOKEN=<SEM_TOKEN>): nada foi criado no Mercado Pago.
            |No modo mock o checkout do Premium não usa plano (o app aprova localmente em /mock/checkout).
            |
            |Para criar o plano "QueroRevisar Premium" (R$ ${price / 100},${(price % 100).toString().padStart(2, '0')}/mês) num ambiente real:
            |  PAYMENTS_MODE=sandbox MP_ACCESS_TOKEN=<token de teste> MP_BACK_URL_SUCCESS=https://<app>/conta?pagamento=ok \
            |  ./gradlew :apps:api:createPremiumPlan
            |Depois grave o id impresso em MP_PREMIUM_PLAN_ID (um por ambiente: sandbox e produção).
            """.trimMargin(),
        )
        return
    }
    if (!backUrl.startsWith("https://")) {
        System.err.println("MP_BACK_URL_SUCCESS precisa ser https (o Mercado Pago recusa back_url sem https): $backUrl")
        exitProcess(1)
    }
    val props = AppProperties(payments = AppProperties.Payments(mode = mode, accessToken = token, premiumPriceCents = price, backUrlSuccess = backUrl))
    try {
        val (id, initPoint) = MercadoPagoGateway(props).createPlan(price, backUrl)
        println("Plano criado no Mercado Pago ($mode).")
        println("MP_PREMIUM_PLAN_ID=$id")
        if (initPoint != null) println("Link do plano: $initPoint")
    } catch (e: Exception) {
        System.err.println("Falha ao criar o plano: ${e.message}")
        exitProcess(1)
    }
}
