# Contrato da API (v1)

Base: `${API_URL}`. JSON em camelCase. Autenticação `Authorization: Bearer <JWT do Supabase>` em tudo, exceto onde indicado. Erros em `application/problem+json`. Escritas exigem `Idempotency-Key` (UUID). Dinheiro em centavos (`amountCents`). Datas ISO 8601.

## Públicas

| Método | Rota                  | Descrição                                   |
| ------ | --------------------- | ------------------------------------------- |
| GET    | /actuator/health      | saúde                                       |
| GET    | /v1/catalog/version   | `{ version: 12, url: "/catalog.v12.json" }` |
| POST   | /webhooks/mercadopago | webhook do MP (sem JWT; valida x-signature) |

## Conta

| Método | Rota          | Corpo / resposta                              |
| ------ | ------------- | --------------------------------------------- |
| GET    | /v1/me        | `{ id, isAnonymous, name, email, plan: "free" | "premium", premiumUntil, credits, flags: {...} }` (ETag) |
| PATCH  | /v1/me        | `{ name }`                                    |
| GET    | /v1/me/export | todos os dados do usuário (LGPD)              |
| DELETE | /v1/me        | exclui dados e usuário no Supabase            |

## Sync

| Método | Rota                    | Descrição                                                                                                                                                                                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /v1/sync?since={cursor} | `{ cursor, catalogVersion, me, vehicles[], records[], lookups[], deleted: { vehicles[], records[] } }`. Sem `since` devolve tudo. ETag/304                                                                                          |
| POST   | /v1/sync                | `{ mutations: [{ id, type, payload, clientTime }] }` → `{ applied: [id], rejected: [{ id, problem }] , cursor }`. Tipos: vehicle.upsert, vehicle.archive, vehicle.restore, vehicle.delete, record.upsert, record.delete, vehicle.km |

## Veículos

| Método | Rota                      | Corpo                                                                                                                                                           |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /v1/vehicles              | lista (ativos e arquivados)                                                                                                                                     |
| POST   | /v1/vehicles              | `{ id, type, brand, model, year, km, plate?, fipeBrandCode?, fipeModelCode?, fipeYearCode?, replacesVehicleId? }` → 402 problem `vehicle-limit` no plano grátis |
| PATCH  | /v1/vehicles/{id}         | campos editáveis                                                                                                                                                |
| POST   | /v1/vehicles/{id}/km      | `{ km }` ou `{ confirmEstimate: true }` → veículo atualizado                                                                                                    |
| POST   | /v1/vehicles/{id}/archive | vendido/trocado                                                                                                                                                 |
| POST   | /v1/vehicles/{id}/restore | 402 no plano grátis                                                                                                                                             |
| DELETE | /v1/vehicles/{id}         | soft delete com registros                                                                                                                                       |
| GET    | /v1/vehicles/{id}/fipe    | `{ valueCents, referenceMonth, deltaPct30d, updatedAt }` (cache 7 dias)                                                                                         |

## Registros

| Método | Rota                      | Corpo                                                                            |
| ------ | ------------------------- | -------------------------------------------------------------------------------- |
| GET    | /v1/vehicles/{id}/records | lista; plano grátis limitado a 12 meses (`locked: true` quando há mais)          |
| POST   | /v1/records               | `{ id (uuid v7), vehicleId, itemId, km, date?, costCents?, brand?, where: "home" | "shop" }` |
| PATCH  | /v1/records/{id}          |                                                                                  |
| DELETE | /v1/records/{id}          | soft delete                                                                      |

## Catálogo e referência

| Método | Rota                                                            | Descrição                   |
| ------ | --------------------------------------------------------------- | --------------------------- |
| GET    | /v1/catalog/vehicles/{type}/brands                              | marcas FIPE (cache 30 dias) |
| GET    | /v1/catalog/vehicles/{type}/brands/{brand}/models               | modelos                     |
| GET    | /v1/catalog/vehicles/{type}/brands/{brand}/models/{model}/years | anos                        |
| GET    | /v1/catalog/manufacturer-plan?brand=&model=                     | plano do fabricante ou 404  |

## Push

| Método | Rota                   | Corpo                                             |
| ------ | ---------------------- | ------------------------------------------------- |
| POST   | /v1/push/subscriptions | `{ endpoint, keys: { p256dh, auth }, userAgent }` |
| DELETE | /v1/push/subscriptions | `{ endpoint }`                                    |

## Premium (Mercado Pago)

| Método | Rota                         | Descrição                                               |
| ------ | ---------------------------- | ------------------------------------------------------- |
| POST   | /v1/billing/premium/checkout | → `{ initPoint }` (redirecionar)                        |
| POST   | /v1/billing/premium/cancel   | cancela a assinatura; plano continua até `premiumUntil` |
| GET    | /v1/billing/premium          | `{ status, nextBillingDate, premiumUntil }`             |

## Créditos

| Método | Rota                       | Descrição                                                          |
| ------ | -------------------------- | ------------------------------------------------------------------ |
| GET    | /v1/credits/packs          | `[{ id, credits, priceCents, unitPriceCents, discountPct, tag? }]` |
| POST   | /v1/credits/purchases      | `{ packId, method: "pix"                                           | "card", payerCpf? }`→ pix:`{ purchaseId, status, qrCode, qrCodeBase64, expiresAt }`; card: `{ purchaseId, initPoint }` |
| GET    | /v1/credits/purchases/{id} | `{ status: pending                                                 | approved                                                                                                               | rejected | expired, credits }` |
| GET    | /v1/credits/ledger         | extrato                                                            |

## Consultas veiculares

| Método | Rota                 | Descrição                                                                                                                   |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| GET    | /v1/lookups/products | produtos, créditos e partes                                                                                                 |
| POST   | /v1/lookups          | `{ plate, product, mine: boolean, vehicleId? }` → 402 problem `insufficient-credits` com `{ missing }`; 200 com o resultado |
| GET    | /v1/lookups          | histórico do usuário                                                                                                        |
| GET    | /v1/lookups/{id}     | resultado salvo (não cobra)                                                                                                 |

Resultado: `{ id, plate, product, createdAt, vehicle: { model, year, color, fuel, city }, sections: [{ key, title, rows: [{ label, value, tone: null|"ok"|"warn"|"over" }] }], summary: { flags: n } }`

## Internas (Cloud Scheduler, OIDC)

`POST /internal/jobs/daily` · `POST /internal/jobs/send-alerts` · `POST /internal/jobs/premium-credits` · `POST /internal/jobs/fipe-refresh` · `POST /internal/jobs/cleanup` (idempotency_keys e webhook_events antigos)

## Problemas (type)

`validation`, `not-found`, `vehicle-limit`, `history-locked`, `insufficient-credits`, `invalid-plate`, `provider-unavailable` (créditos estornados), `rate-limited`, `conflict`.
