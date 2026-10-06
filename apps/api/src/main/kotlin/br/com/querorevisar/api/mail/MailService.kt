package br.com.querorevisar.api.mail

import br.com.querorevisar.api.common.AppProperties
import br.com.querorevisar.api.common.HttpClients
import br.com.querorevisar.api.common.Redact
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * EMAIL_MODE=log (default) writes the rendered HTML to apps/api/build/mail-outbox/; EMAIL_MODE=live sends through
 * the Resend HTTP API (needs RESEND_API_KEY and EMAIL_FROM). Addresses never reach the logs.
 */
@Service
class MailService(private val props: AppProperties, private val clock: Clock) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val executor: ExecutorService = Executors.newVirtualThreadPerTaskExecutor()
    private val fileTime = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS").withZone(ZoneOffset.UTC)

    private val resend by lazy {
        HttpClients.restClient(props.email.resendBaseUrl, props)
            .defaultHeader("Authorization", "Bearer ${props.email.resendApiKey}")
            .build()
    }

    init {
        if (!props.email.isLive) log.warn("EMAIL_MODE=log: e-mails are written to {}", Path.of(props.email.outboxDir).toAbsolutePath())
    }

    /** Sends (live, in the background) or writes to the outbox (log, synchronously). Never throws. */
    fun send(mail: Mail) {
        if (props.email.isLive) {
            executor.execute { deliver(mail) }
        } else {
            writeOutbox(mail)
        }
    }

    fun outboxDir(): Path = Path.of(props.email.outboxDir)

    private fun writeOutbox(mail: Mail) {
        try {
            val dir = outboxDir()
            Files.createDirectories(dir)
            val name = "${fileTime.format(clock.instant())}-${mail.template}-${UUID.randomUUID().toString().take(8)}.html"
            val header = "<!-- To: ${MailTemplates.esc(mail.to)} | Subject: ${MailTemplates.esc(mail.subject)} -->\n"
            Files.writeString(dir.resolve(name), header + mail.html)
            log.info("E-mail '{}' written to the local outbox ({})", mail.template, name)
        } catch (e: Exception) {
            Redact.error(log, "Could not write e-mail '${mail.template}' to the outbox", e)
        }
    }

    private fun deliver(mail: Mail) {
        try {
            resend.post().uri("/emails").contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("from" to props.email.from, "to" to listOf(mail.to), "subject" to mail.subject, "html" to mail.html))
                .retrieve().toBodilessEntity()
            log.info("E-mail '{}' sent through Resend", mail.template)
        } catch (e: Exception) {
            Redact.error(log, "Resend failed for e-mail '${mail.template}'", e)
        }
    }
}
