# Regras de negócio

Fonte: protótipo `reference/QueroRevisar v7 responsivo.dc.html` e `reference/Estrategia QueroRevisar v2.dc.html`. Constantes marcadas com ✏️ são valores de exemplo que o dono pode mudar (estão em `PENDENCIAS.md`).

## Veículo

- Campos: `type` (car | moto), `brand`, `model`, `year` (4 dígitos), `km` (último km informado), `kmAt` (data do último km informado), `kmPerMonth`, `plate` (opcional, formato Mercosul ou antigo), `fipeBrandCode`, `fipeModelCode`, `fipeYearCode` (preenchidos no onboarding a partir da FIPE).
- `kmPerMonth` inicial: **1100** para carro, **900** para moto.
- Validação no onboarding: marca, modelo e ano obrigatórios; ano com 4 dígitos ("Ano inválido. Use 4 dígitos, ex.: 2019"); km obrigatório ("Informe o km atual do painel").
- Plano grátis: 1 veículo ativo. Adicionar o segundo abre o paywall "Mais de um veículo". Premium: ilimitado.
- Veículo vendido ou trocado vai para "Veículos anteriores" com o histórico preservado. Restaurar exige Premium no plano grátis.

## Km estimada {#km}

```
estimatedKm = round(km + kmPerMonth × max(0, (agora − kmAt) / MÊS))
MÊS = 30,44 dias
```

Ao salvar um novo km `n`:

- Rejeitar se `n` < maior km de registro de troca ("Km menor que a última troca registrada (X km)").
- `meses = (agora − kmAt) / MÊS`
- Se `meses > 0,5` e `n > km`: `kmPerMonth = round((n − km) / meses)`; senão mantém.
- `km = n`, `kmAt = agora`.
- "Está certo" confirma a estimativa: `km = estimatedKm`, `kmAt = agora`, sem mudar `kmPerMonth`.

## Catálogo e plano do fabricante

- Itens do catálogo (`data/catalog.json`): nome, intervalo em km, intervalo em meses, descrição, tipos de veículo, categoria e ícone.
- Se existir plano do fabricante para marca+modelo (`data/planos.json`), para cada item cujo nome normalizado (minúsculas, sem acento) coincide, usar o `intervaloKm` e `intervaloMeses` da regra que contém a ação "trocar". A fonte exibida passa a ser "Plano <marca>"; senão "Média QueroRevisar".
- Onboarding mostra "Temos o plano do fabricante para este modelo. Os intervalos seguem o manual." quando houver plano.

## Status de cada item {#vencimento}

Usar o registro de troca com **maior km** do item.

```
sem registro → status "none" ("Sem registro")
used   = estimatedKm − registro.km
pKm    = item.km ? used / item.km : 0
mesesUsados = registro.date ? (agora − registro.date) / MÊS : null
pT     = (registro.date && item.months) ? mesesUsados / item.months : 0
pct    = max(pKm, pT)
status = pct ≥ 1 → "over" (Vencido) · pct ≥ 0,8 → "warn" (Atenção, badge mostra round(pct×100)%) · senão "ok" (Em dia)
kmLeft = item.km ? item.km − used : null
monthsLeft = (registro.date && item.months) ? item.months − mesesUsados : null
byTime = pT > pKm
dueKm  = item.km ? registro.km + item.km : null
```

Texto da linha:

- none: "A cada {intervalo}" onde intervalo = "{km} km ou {meses} meses" (omite o que não existir)
- over por tempo: "Trocado há {round(mesesUsados)} meses · limite {item.months}"
- over por km: "Passou {−kmLeft} km do limite"
- byTime com monthsLeft: "Vence em ~{max(1, round(monthsLeft))} meses pelo tempo"
- demais: "Faltam ~{kmLeft} km · {tempo}" onde semanas = kmLeft / (kmPerMonth / 4,345); < 1,5 → "esta semana"; < 8 → "cerca de N semanas"; senão "cerca de N meses" (N = round(semanas / 4,345))

Painel: "Precisa de atenção" lista over e warn, over primeiro, depois maior pct. "Sem registro" mostra até 6 itens principais sem registro: Óleo do motor, Filtro de óleo, Filtro de ar, Velas de ignição, Fluido de freio, Pastilhas de freio dianteiras, Correia dentada, Fluido de arrefecimento, Kit relação (corrente, coroa e pinhão).

## Registro de troca {#registro}

- Campos: item (obrigatório: "Escolha o item que você trocou"), km (obrigatório e > 0: "Informe o km de quando trocou"), data (opcional, não pode ser futura: "A data não pode ser no futuro"), custo (opcional, centavos), marca/peça (opcional), onde: casa | mecânico.
- Se o km do registro for maior que a km estimada, atualizar `km` e `kmAt` do veículo.
- Toast "Troca registrada".

## Planos

|                      | Grátis                                     | Premium         |
| -------------------- | ------------------------------------------ | --------------- |
| Preço                | R$ 0                                       | ✏️ R$ 14,90/mês |
| Veículos             | 1                                          | ilimitados      |
| Alertas              | todos (nunca esconder um alerta)           | todos           |
| Histórico            | últimos 12 meses                           | completo + PDF  |
| Anúncio              | sim (nativo, fora do painel e dos alertas) | não             |
| Cadastro por placa   | não                                        | sim             |
| Créditos de consulta | —                                          | ✏️ 2 por mês    |

Ao ativar o Premium: +2 créditos e toast "Premium ativado · +2 créditos de consulta". A cada cobrança mensal aprovada: +2 créditos.

## Créditos ✏️

- Preço avulso: R$ 4,90 por crédito.
- Pacotes: 1 = R$ 4,90 · 5 = R$ 21,90 · 12 = R$ 47,90 (destaque "Mais escolhido", pré-selecionado) · 30 = R$ 104,90.
- Exibir "R$ X por crédito" e "Economia de N%" com `N = round((1 − preço / (n × 4,90)) × 100)`.
- Saldo nunca negativo. Débito e consulta na mesma transação; se o provedor falhar, estornar.
- Ledger imutável (`credit_ledger`): compra, bônus Premium, consumo, estorno.

## Consultas veiculares ✏️

| id         | Nome                                             | Créditos          | Partes                                    |
| ---------- | ------------------------------------------------ | ----------------- | ----------------------------------------- |
| laudo      | Laudo cautelar completo (tag "Antes de comprar") | 6 ("economiza 2") | basica, restricoes, leilao, debitos, fipe |
| restricoes | Restrições                                       | 2                 | restricoes                                |
| leilao     | Leilão e sinistro                                | 3                 | leilao                                    |
| debitos    | Débitos, IPVA e multas                           | 2                 | debitos                                   |
| basica     | Dados da placa                                   | 1                 | basica                                    |
| fipe       | Tabela FIPE                                      | 0 (Grátis)        | fipe                                      |

- Placa: maiúsculas, só letras e números, 7 caracteres, regex `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`. Erro: "Placa inválida. Use o formato ABC1D23".
- Modo "Outro veículo" (padrão laudo) ou "Meu {modelo}" (padrão débitos, placa do veículo).
- Saldo insuficiente: abrir compra de créditos com o menor pacote que cobre a diferença.
- Resultado: resumo "Nada consta nas bases consultadas" ou "N pontos de atenção: ...". Linhas com selo ok (Nada consta, Pago), warn ou over.
- Reabrir consulta anterior não cobra.
- Nunca exibir dados pessoais do proprietário.

## FIPE no card do veículo

- Valor FIPE do veículo, "atualizada há N dias" e variação em 30 dias ("▲ 1,2% em 30 dias", "▼ 0,8% em 30 dias" ou "Estável em 30 dias"). Subida em teal (#0e5a66 sobre #e7f0f1), queda em cinza (#555 sobre #f4f4f4).
- Cache de 7 dias por veículo antes de chamar a API de novo.
- Variação: comparar com o snapshot do mês de referência anterior em `fipe_price_history`. Sem histórico ainda: "Estável em 30 dias".

## Anúncios

- Slots: itens-lista (in-feed 100 px), historico-rodape (in-feed 100 px), conta-rodape (300 × 250). Item patrocinado no histórico depois do 2º registro.
- Botão "Remover anúncios" abre paywall "Use sem anúncios".
- Nunca no painel nem nos alertas.

## Conta anônima

- O app começa com usuário anônimo do Supabase. Aviso no painel "Salve seus registros" quando houver registros e não houver login.
- Criar conta vincula a identidade ao mesmo usuário (linkIdentity / updateUser), sem perder dados.
- Sair: confirmação, limpa dados locais e volta para boas-vindas.

## Esclarecimentos da implementação

Dois casos de borda do protótipo foram corrigidos (as fixtures em `fixtures/due-status.json` já refletem isso):

- No limite exato (`kmLeft = 0`, vencido por km) o protótipo escrevia "Passou -0 km do limite". A implementação escreve "Passou 0 km do limite".
- Item sem intervalo em km (só meses) com registro sem data ficava "Em dia" com a linha "Faltam ~0 km · esta semana". A implementação mostra o intervalo: "A cada {meses} meses".
- Datas de registro (`done_on`, `YYYY-MM-DD`) são interpretadas como meia-noite UTC daquele dia, como faz o `new Date('YYYY-MM-DD')` do protótipo, nas duas linguagens.
- Ao recalcular `kmPerMonth`, o valor mínimo é 1 km/mês, para a conta de tempo nunca dividir por zero.
