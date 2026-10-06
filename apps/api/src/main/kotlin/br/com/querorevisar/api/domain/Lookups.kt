package br.com.querorevisar.api.domain

import br.com.querorevisar.api.common.ApiDto

// Vehicle lookups by plate (docs/domain.md#consultas-veiculares), ported from packages/core/src/lookups.ts.
// ✏️ Credit costs are owner decisions (PENDENCIAS.md).

@Suppress("EnumEntryName")
enum class LookupProductId { laudo, restricoes, leilao, debitos, basica, fipe }

@Suppress("EnumEntryName")
enum class LookupPart { basica, restricoes, leilao, debitos, fipe }

@Suppress("EnumEntryName")
enum class Tone { ok, warn, over }

data class LookupProductDef(
    val id: LookupProductId,
    val name: String,
    val desc: String,
    val credits: Int,
    val tag: String?,
    val parts: List<LookupPart>,
)

/** One line of a lookup section. `tone` is null for plain key/value rows. */
@ApiDto
data class LookupRow(val label: String, val value: String, val tone: Tone?)

@ApiDto
data class LookupSection(val key: String, val title: String, val rows: List<LookupRow>)

@ApiDto
data class LookupResultSummary(val flags: Int, val text: String, val tone: Tone)

object LookupCatalog {
    val PRODUCTS = listOf(
        LookupProductDef(
            LookupProductId.laudo, "Laudo cautelar completo",
            "Tudo abaixo num relatório só, com PDF para levar na negociação.", 6, "Antes de comprar",
            listOf(LookupPart.basica, LookupPart.restricoes, LookupPart.leilao, LookupPart.debitos, LookupPart.fipe),
        ),
        LookupProductDef(
            LookupProductId.restricoes, "Restrições", "Roubo e furto, financiamento, bloqueio judicial.", 2, null,
            listOf(LookupPart.restricoes),
        ),
        LookupProductDef(
            LookupProductId.leilao, "Leilão e sinistro",
            "Passagem por leilão, indenização de seguradora, perda total.", 3, null, listOf(LookupPart.leilao),
        ),
        LookupProductDef(
            LookupProductId.debitos, "Débitos, IPVA e multas", "Valores em aberto no Detran e na Sefaz.", 2, null,
            listOf(LookupPart.debitos),
        ),
        LookupProductDef(
            LookupProductId.basica, "Dados da placa", "Marca, modelo, ano, cor, combustível e município.", 1, null,
            listOf(LookupPart.basica),
        ),
        LookupProductDef(
            LookupProductId.fipe, "Tabela FIPE", "Preço médio de mercado do modelo e ano.", 0, null,
            listOf(LookupPart.fipe),
        ),
    )

    fun product(id: LookupProductId): LookupProductDef = PRODUCTS.first { it.id == id }

    /** "Nada consta nas bases consultadas" or "N pontos de atenção: a, b". */
    fun summary(sections: List<LookupSection>): LookupResultSummary {
        val flags = sections.flatMap { s -> s.rows.filter { it.tone == Tone.warn || it.tone == Tone.over } }
        if (flags.isEmpty()) return LookupResultSummary(0, "Nada consta nas bases consultadas", Tone.ok)
        val head = if (flags.size == 1) "1 ponto de atenção" else "${flags.size} pontos de atenção"
        return LookupResultSummary(
            flags = flags.size,
            text = "$head: ${flags.joinToString(", ") { it.label.lowercase() }}",
            tone = if (flags.any { it.tone == Tone.over }) Tone.over else Tone.warn,
        )
    }
}

// ---- data returned by a vehicle data provider (never owner personal data) ---------------------------

/** A single finding, e.g. ("Nada consta", ok) or ("Consta em 2023", over). */
data class Finding(val value: String, val tone: Tone) {
    companion object {
        val NOTHING = Finding("Nada consta", Tone.ok)
        val PAID = Finding("Pago", Tone.ok)
    }
}

data class BasicData(val model: String, val year: String, val color: String?, val fuel: String?, val city: String?)

data class Restrictions(val theft: Finding, val financing: Finding, val judicial: Finding)

data class AuctionClaims(val auction: Finding, val claim: Finding, val totalLoss: Finding)

data class Debts(val ipva: Finding, val licensing: Finding, val fines: Finding)

data class FipeQuote(val valueCents: Long, val referenceMonth: String)

/** Whatever the provider answered for the parts of one product. */
data class LookupData(
    val basic: BasicData,
    val restrictions: Restrictions? = null,
    val auction: AuctionClaims? = null,
    val debts: Debts? = null,
    val fipe: FipeQuote? = null,
)

/** Builds the sections shown in the result screen, in the order of the product parts (prototype cqSections). */
object LookupAssembler {
    private fun row(label: String, value: String?, tone: Tone? = null) = LookupRow(label, value ?: "—", tone)

    private fun row(label: String, f: Finding) = LookupRow(label, f.value, f.tone)

    fun sections(product: LookupProductDef, data: LookupData, currentYear: Int): List<LookupSection> =
        product.parts.mapNotNull { part ->
            when (part) {
                LookupPart.basica -> LookupSection(
                    "basica", "Dados do veículo",
                    listOf(
                        row("Marca e modelo", data.basic.model),
                        row("Ano", data.basic.year),
                        row("Cor", data.basic.color),
                        row("Combustível", data.basic.fuel),
                        row("Município", data.basic.city),
                    ),
                )
                LookupPart.restricoes -> data.restrictions?.let {
                    LookupSection(
                        "restricoes", "Restrições",
                        listOf(row("Roubo e furto", it.theft), row("Financiamento", it.financing), row("Bloqueio judicial", it.judicial)),
                    )
                }
                LookupPart.leilao -> data.auction?.let {
                    LookupSection(
                        "leilao", "Leilão e sinistro",
                        listOf(row("Leilão", it.auction), row("Sinistro indenizado", it.claim), row("Indício de perda total", it.totalLoss)),
                    )
                }
                LookupPart.debitos -> data.debts?.let {
                    LookupSection(
                        "debitos", "Débitos",
                        listOf(row("IPVA $currentYear", it.ipva), row("Licenciamento $currentYear", it.licensing), row("Multas", it.fines)),
                    )
                }
                LookupPart.fipe -> LookupSection(
                    "fipe", "Preço de mercado",
                    if (data.fipe != null) {
                        listOf(row("Tabela FIPE", PtBr.money(data.fipe.valueCents)), row("Referência", data.fipe.referenceMonth))
                    } else {
                        listOf(row("Tabela FIPE", "Indisponível"))
                    },
                )
            }
        }
}
