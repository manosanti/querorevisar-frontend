# FIPE e consulta veicular

## FIPE (preço de mercado)

- API: **FIPE API v2** mantida por Deivid Fortuna / Parallelum. Documentação: https://deividfortuna.github.io/fipe/v2/ e https://fipe.api.br/docs/api (fipe.online redireciona para lá). Base `https://fipe.parallelum.com.br/api/v2`.
- Sem token: 500 requisições por 24 h; com o token gratuito (`X-Subscription-Token`): 1.000 por 24 h (conferido em 06/10/2026). As respostas trazem `x-ratelimit-limit/remaining/reset`, mas respostas em cache da Cloudflare podem mostrar valores de outro cliente; por isso o orçamento é contado por nós (`FIPE_DAILY_BUDGET`, tabela `fipe_usage`). O histórico de preços da API é recurso pago: por isso guardamos o nosso próprio histórico.
- Tipos: `cars`, `motorcycles` (e `trucks`, não usado). Mapa: car → cars, moto → motorcycles. Listas vêm como `[{ "code": "59", "name": "VW - VolksWagen" }]`; anos com código `2019-5` e nome `2019 Flex`.
- Rotas usadas:
  - `GET /{type}/brands`
  - `GET /{type}/brands/{brandId}/models`
  - `GET /{type}/brands/{brandId}/models/{modelId}/years`
  - `GET /{type}/brands/{brandId}/models/{modelId}/years/{yearId}` → `{ vehicleType, price: "R$ 62.400,00", brand, model, modelYear, fuel, codeFipe, referenceMonth: "outubro de 2026", fuelAcronym }`
  - `GET /{type}/{fipeCode}/years/{yearId}` (por código FIPE)
- **Onboarding:** os selects de marca, modelo e ano usam essas listas (cache em `fipe_reference` por 30 dias). O veículo guarda os códigos. Se a FIPE estiver fora, usar a lista local `BRANDS` do protótipo como fallback e deixar os códigos nulos.
- **Card do veículo:** `GET /v1/vehicles/{id}/fipe`. Se `fipe_prices.fetched_at` < 7 dias, responder do cache. Senão buscar, gravar e inserir em `fipe_price_history` (um registro por mês de referência).
- **Variação 30 dias:** `(valor atual − valor do mês de referência anterior) / anterior`. Sem anterior → 0 ("Estável em 30 dias").
- **Orçamento diário:** contador no banco (`fipe_usage`, dia de São Paulo); ao passar de `FIPE_DAILY_BUDGET`, servir cache vencido e reagendar (job `fipe-refresh`). Sem cache e sem orçamento (ou com a FIPE fora), as listas respondem 503 `provider-unavailable` e a web usa a lista local.
- **Código FIPE:** o veículo guarda `fipeBrandCode/fipeModelCode/fipeYearCode` do onboarding; na primeira consulta de preço a API aprende o `codeFipe` (`vehicles.fipe_code`) e passa a usar `GET /{type}/{fipeCode}/years/{yearId}`.
- Converter o preço "R$ 62.400,00" para centavos com parser pt-BR.

## Consulta veicular por placa

O fornecedor ainda não foi escolhido (pendência do dono). Exemplos de empresas brasileiras que vendem consulta veicular, inclusive por API pay-per-use: AnyCar (anycar.com.br/para-empresas/api), Checktudo, Consulta Auto, ZapCar, CheckCred. Avaliar: cobertura (leilão, sinistro, restrições, débitos por UF), custo por chamada, SLA, formato de retorno, contrato e conformidade com a LGPD.

### Interface

```kotlin
interface VehicleDataProvider {
    val name: String
    fun basic(plate: String): BasicData            // marca, modelo, ano, cor, combustível, município
    fun restrictions(plate: String): Restrictions   // roubo/furto, financiamento (gravame), judicial
    fun auctionAndClaims(plate: String): Auction    // leilão, sinistro indenizado, indício de perda total
    fun debts(plate: String): Debts                 // IPVA, licenciamento, multas (qtd e valor)
}
```

- `MockVehicleDataProvider`: reproduz o protótipo. `h = soma dos códigos dos caracteres da placa`; para "outro veículo", `flag = h % 3` (0 → leilão "Consta em 2023" tom over; 1 → multas "2 em aberto · R$ 260,32" tom warn; 2 → nada consta). Modelo, ano, cor e FIPE vêm de uma lista fixa indexada por `h % 5`: Volkswagen Polo 2021 Prata, Hyundai HB20 2020 Branco, Fiat Argo 2022 Cinza, Chevrolet Onix Plus 2021 Preto, Toyota Corolla 2019 Branco. Para "meu veículo", usa os dados do veículo e tudo "Nada consta".
- `LiveVehicleDataProvider`: esqueleto com `TODO` e testes com WireMock a partir de exemplos de resposta do fornecedor escolhido. Enquanto `VEHICLE_DATA_API_KEY`/`VEHICLE_DATA_BASE_URL` forem `<SEM_TOKEN>`/`<PREENCHER>`, a API usa o mock mesmo com `VEHICLE_DATA_MODE=live`.
- A seção "Dados do veículo" alimenta o cabeçalho do resultado (`vehicle`), por isso `basic()` é chamado em todo produto. No modo "meu veículo" o mock usa marca, modelo e ano do veículo cadastrado; a cor não é cadastrada e aparece como "—".
- IPVA e Licenciamento usam o ano corrente (São Paulo); a referência da FIPE vem da FIPE (ou do mês corrente, no mock), por extenso: "outubro de 2026".
- A parte `fipe` de qualquer consulta usa o `FipeClient`, não o fornecedor.
- Nunca persistir nem exibir nome, CPF ou endereço do proprietário, mesmo que o fornecedor devolva.

### Fluxo do POST /v1/lookups

1. Validar placa e produto. 2. Abrir transação: ler saldo com lock (`select ... for update` no agregado ou ledger), verificar créditos. 3. Lançar `credit_ledger` `lookup` −N. 4. Chamar o provedor fora da transação com timeout de 15 s. 5. Sucesso: gravar `vehicle_lookups`. Falha: lançar `refund` +N e responder `provider-unavailable`.
