package br.com.querorevisar.api.billing

import br.com.querorevisar.api.common.AppProperties
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService

@Configuration
class BillingConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    /** PAYMENTS_MODE: mock (default, or whenever MP_ACCESS_TOKEN is a placeholder), sandbox or live. */
    @Bean
    fun paymentGateway(props: AppProperties, clock: Clock): PaymentGateway =
        if (props.payments.isMock) {
            log.warn("PAYMENTS_MODE=mock: payments are approved locally (Pix after {})", props.payments.mockAutoApproveDelay)
            MockPaymentGateway(props, clock)
        } else {
            log.info("PAYMENTS_MODE={}: Mercado Pago REST API", props.payments.effectiveMode)
            MercadoPagoGateway(props)
        }

    /** Delayed work (mock Pix auto-approval). */
    @Bean(destroyMethod = "shutdownNow")
    fun billingScheduler(): ScheduledExecutorService =
        Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().name("billing-scheduler").factory())
}
