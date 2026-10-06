package br.com.querorevisar.api.mail

import br.com.querorevisar.api.domain.PtBr
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** A rendered e-mail. `template` is a short id used in file names and logs (never the address). */
data class Mail(val to: String, val subject: String, val html: String, val template: String)

data class AlertLine(val name: String, val status: String, val line: String, val over: Boolean)

/** pt-BR e-mail templates (F08.3): alerta de vencimento, boas-vindas, compra aprovada, Premium ativado e cancelado. */
object MailTemplates {
    private val SP = ZoneId.of("America/Sao_Paulo")
    private val DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(SP)

    // E-mail clients need inline styles; the values are the design tokens of packages/tokens.
    private const val PRIMARY = "#0e5a66" // --primary
    private const val INK = "#222222" // --ink
    private const val MUTED = "#6a6a6a" // --muted
    private const val TINT = "#e7f0f1" // --primary-tint
    private const val OVER = "#c13515" // --over-fg
    private const val WARN = "#9a5b00" // --warn-fg

    fun esc(s: String?): String = (s ?: "")
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;")

    private fun layout(title: String, body: String, appUrl: String, cta: String? = null, ctaUrl: String? = null): String {
        val button = if (cta != null && ctaUrl != null) {
            """<p style="margin:24px 0 8px"><a href="${esc(ctaUrl)}" style="background:$PRIMARY;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">${esc(cta)}</a></p>"""
        } else {
            ""
        }
        return """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Figtree,Arial,sans-serif;color:$INK">
<div style="max-width:560px;margin:0 auto;padding:24px 20px">
<p style="font-weight:700;font-size:18px;color:$PRIMARY;margin:0 0 20px">QueroRevisar</p>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${esc(title)}</h1>
$body
$button
<p style="font-size:12px;color:$MUTED;margin-top:32px">Você recebeu este e-mail porque usa o QueroRevisar. <a href="${esc(appUrl)}/conta" style="color:$MUTED">Gerenciar conta</a></p>
</div></body></html>"""
    }

    private fun p(text: String) = """<p style="font-size:15px;line-height:1.5;margin:0 0 12px">$text</p>"""

    fun welcome(to: String, name: String?, appUrl: String): Mail {
        val hello = if (name.isNullOrBlank()) "Olá!" else "Olá, ${esc(name)}!"
        val body = p(hello) +
            p("Sua conta está criada e seus registros ficam salvos. O QueroRevisar estima a km do seu veículo e avisa quando cada item estiver perto de vencer.")
        return Mail(to, "Bem-vindo ao QueroRevisar", layout("Bem-vindo ao QueroRevisar", body, appUrl, "Abrir o QueroRevisar", appUrl), "boas-vindas")
    }

    fun dueAlert(to: String, vehicle: String, items: List<AlertLine>, appUrl: String): Mail {
        val overCount = items.count { it.over }
        val subject = when {
            items.size == 1 -> "${items[0].name}: ${items[0].status.lowercase()} no seu $vehicle"
            overCount > 0 -> "$overCount ${if (overCount == 1) "item vencido" else "itens vencidos"} no seu $vehicle"
            else -> "${items.size} itens precisam de atenção no seu $vehicle"
        }
        val rows = items.joinToString("") {
            val color = if (it.over) OVER else WARN
            """<tr><td style="padding:10px 12px;border-bottom:1px solid $TINT"><div style="font-weight:600">${esc(it.name)}</div><div style="font-size:13px;color:$MUTED">${esc(it.line)}</div></td><td style="padding:10px 12px;border-bottom:1px solid $TINT;text-align:right;color:$color;font-weight:600;white-space:nowrap">${esc(it.status)}</td></tr>"""
        }
        val body = p("Estes itens do seu ${esc(vehicle)} precisam de atenção:") +
            """<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;margin:8px 0 4px">$rows</table>"""
        return Mail(to, subject, layout("Precisa de atenção", body, appUrl, "Ver os itens", "$appUrl/itens"), "alerta-vencimento")
    }

    fun purchaseApproved(to: String, credits: Int, amountCents: Long, appUrl: String): Mail {
        val title = "${PtBr.credits(credits)} adicionados"
        val body = p("Recebemos o pagamento de ${esc(PtBr.money(amountCents))}. ${esc(PtBr.credits(credits))} já estão na sua conta para consultar placas.") +
            p("Abrir de novo uma consulta anterior não gasta crédito.")
        return Mail(to, "Compra aprovada · $title", layout(title, body, appUrl, "Consultar uma placa", "$appUrl/consultas"), "compra-aprovada")
    }

    fun premiumActivated(to: String, premiumUntil: Instant?, bonusCredits: Int, appUrl: String): Mail {
        val until = premiumUntil?.let { " até ${DATE.format(it)}" } ?: ""
        val body = p("Seu Premium está ativo$until. Agora você acompanha quantos veículos quiser, vê o histórico completo e usa sem anúncio.") +
            p("Você ganhou ${esc(PtBr.credits(bonusCredits))} de consulta. A cada mês pago, mais ${esc(PtBr.credits(bonusCredits))}.")
        return Mail(to, "Premium ativado", layout("Premium ativado", body, appUrl, "Abrir o QueroRevisar", appUrl), "premium-ativado")
    }

    fun premiumCancelled(to: String, premiumUntil: Instant?, appUrl: String): Mail {
        val until = premiumUntil?.let { "O Premium continua ativo até ${DATE.format(it)}. Depois disso a conta volta para o plano grátis." }
            ?: "A conta volta para o plano grátis."
        val body = p("Cancelamos a sua assinatura. Nenhuma nova cobrança será feita.") + p(until) +
            p("Seus registros continuam salvos.")
        return Mail(to, "Premium cancelado", layout("Premium cancelado", body, appUrl, "Ver planos", "$appUrl/conta"), "premium-cancelado")
    }

    /** Local development only (/dev/auth/recover): emulates the Supabase recovery e-mail. */
    fun passwordRecovery(to: String, link: String, appUrl: String): Mail {
        val body = p("Recebemos um pedido para trocar a senha da sua conta. Se não foi você, ignore este e-mail.")
        return Mail(to, "Recuperar senha", layout("Recuperar senha", body, appUrl, "Criar nova senha", link), "recuperar-senha")
    }
}
