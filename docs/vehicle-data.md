# FIPE e consulta veicular

## FIPE (preço de mercado)

- API: **FIPE API v2** mantida por Deivid Fortuna / Parallelum. Documentação: https://deividfortuna.github.io/fipe/v2/ e https://fipe.online/docs/api. Base `https://fipe.parallelum.com.br/api/v2`.
- Sem token há um limite diário de requisições; com o token gratuito (`X-Subscription-Token`, obtido em fipe.online) o limite sobe. Confira os limites atuais na documentação. O histórico de preços da API é recurso pago: por isso guardamos o nosso próprio histórico.
- Tipos: `cars`, `motorcycles` (mapa: car → cars, moto → motorcycles).
- Rotas usadas:
  - `GET /{type}/brands`
  - `GET /{type}/brands/{brandId}/models`
  - `GET /{type}/brands/{brandId}/models/{modelId}/years`
  - `GET /{type}/brands/{brandId}/models/{modelId}/years/{yearId}` → preço, código FIPE, mês de referência
  - `GET /{type}/{fipeCode}/years/{yearId}` (por código FIPE)
- **Onboarding:** os selects de marca, modelo e ano usam essas listas (cache em `fipe_reference` por 30 dias). O veículo guarda os códigos. Se a FIPE estiver fora, usar a lista local `BRANDS` do protótipo como fallback e deixar os códigos nulos.
- **Card do veículo:** `GET /v1/vehicles/{id}/fipe`. Se `fipe_prices.fetched_at` < 7 dias, responder do cache. Senão buscar, gravar e inserir em `fipe_price_history` (um registro por mês de referência).
- **Variação 30 dias:** `(valor atual − valor do mês de referência anterior) / anterior`. Sem anterior → 0 ("Estável em 30 dias").
- **Orçamento diário:** contador em memória/banco; ao passar de `FIPE_DAILY_BUDGET`, servir cache vencido e reagendar.
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
- `LiveVehicleDataProvider`: esqueleto com `TODO` e testes com WireMock a partir de exemplos de resposta do fornecedor escolhido.
- A parte `fipe` de qualquer consulta usa o `FipeClient`, não o fornecedor.
- Nunca persistir nem exibir nome, CPF ou endereço do proprietário, mesmo que o fornecedor devolva.

### Fluxo do POST /v1/lookups

1. Validar placa e produto. 2. Abrir transação: ler saldo com lock (`select ... for update` no agregado ou ledger), verificar créditos. 3. Lançar `credit_ledger` `lookup` −N. 4. Chamar o provedor fora da transação com timeout de 15 s. 5. Sucesso: gravar `vehicle_lookups`. Falha: lançar `refund` +N e responder `provider-unavailable`.
