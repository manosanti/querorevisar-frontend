# Mercado Pago

Documentação oficial: https://www.mercadopago.com.br/developers/pt/docs e referência da API https://www.mercadopago.com.br/developers/pt/reference. **Antes de implementar, confira a referência oficial atual**; se algo divergir daqui, siga a oficial e atualize este arquivo.

## Credenciais

- Painel do desenvolvedor → Suas integrações → criar aplicação. Credenciais de teste (`TEST-...`) e de produção (`APP_USR-...`).
- `MP_ACCESS_TOKEN` só na API. Nunca no front.
- Webhook: configurar em Suas integrações → Webhooks, URL `https://<api>/webhooks/mercadopago`, eventos **Pagamentos** e **Planos e assinaturas**. Copiar a assinatura secreta para `MP_WEBHOOK_SECRET` (uma por modo: teste e produção).
- Sandbox: usar usuários de teste (comprador e vendedor) criados no painel.

## Cliente HTTP

- Spring `RestClient`, base `https://api.mercadopago.com`, header `Authorization: Bearer ${MP_ACCESS_TOKEN}`, `Content-Type: application/json`.
- `X-Idempotency-Key: <uuid>` em todo POST que cria cobrança (usar o id interno da compra).
- Timeout conexão 3 s, leitura 10 s. Retry só em 5xx e erros de rede, no máximo 2 vezes, com a mesma chave de idempotência.
- O SDK oficial Java (`com.mercadopago:sdk-java`) existe, mas não será usado para manter a compatibilidade com a imagem nativa.

## Premium (assinatura com plano)

1. **Criar o plano** uma vez por ambiente (script `./gradlew :apps:api:createPremiumPlan` ou endpoint admin):
   `POST /preapproval_plan`
   ```json
   {
     "reason": "QueroRevisar Premium",
     "auto_recurring": { "frequency": 1, "frequency_type": "months", "transaction_amount": 14.9, "currency_id": "BRL" },
     "back_url": "${MP_BACK_URL_SUCCESS}"
   }
   ```
   Gravar o `id` retornado em `MP_PREMIUM_PLAN_ID`.
2. **Checkout:** `POST /v1/billing/premium/checkout` na nossa API cria a assinatura e devolve o link de pagamento do Mercado Pago (`init_point`). O front redireciona para o `init_point`; o pagador informa o cartão no ambiente do Mercado Pago (nada de dados de cartão no nosso app).
   - **Fluxo escolhido (conferido na referência oficial em 06/10/2026):** assinatura com plano exige `card_token_id` e `status: "authorized"`, ou seja, um formulário de cartão nosso. Para o pagador pagar na página do Mercado Pago, a API cria a assinatura **sem plano** e com `status: "pending"`: `POST /preapproval` com `reason`, `external_reference` = `user_id`, `payer_email` (e-mail da conta), `auto_recurring { frequency: 1, frequency_type: "months", transaction_amount: 14.9, currency_id: "BRL" }`, `back_url`. A resposta traz `id` e `init_point` (`.../subscriptions/checkout?preapproval_id=...`).
   - Sem plano, o Mercado Pago confere se `payer_email` é o e-mail da conta MP que paga; por isso o checkout real exige conta com e-mail (usuário anônimo recebe `validation` "Crie uma conta com e-mail para assinar o Premium.").
   - O plano criado no passo 1 (`MP_PREMIUM_PLAN_ID`) continua útil como link genérico (`init_point` do plano), mas esse link não carrega `external_reference`; a API só associa assinaturas que tragam o `user_id`.
3. **Webhook `subscription_preapproval`:** reconsultar `GET /preapproval/{id}`. `authorized` → `profiles.plan = premium`, `premium_until` pelo menos 1 mês à frente, gravar `subscriptions`. `cancelled` (a documentação escreve `canceled`; os SDKs, `cancelled`: a API aceita os dois e grava `cancelled`) ou `paused` → manter Premium até `premium_until` e depois voltar para free (job diário).
4. **Webhook `subscription_authorized_payment`:** reconsultar `GET /authorized_payments/{id}` (`status` scheduled | processed | recycling | canceled, `payment { id, status }`, `debit_date`). `payment.status = approved` → estender `premium_until` até `debit_date` + 1 mês e lançar `credit_ledger` `premium_bonus` +2 com `ref_type = subscription_payment`, `ref_id` = id do pagamento (idempotente). Se o job `premium-credits` já lançou o bônus do mês (webhook atrasado), o bônus não é repetido.
5. **Cancelar:** `PUT /preapproval/{id}` com `{ "status": "cancelled" }`.

## Créditos por Pix

`POST /v1/payments`

```json
{
  "transaction_amount": 47.9,
  "description": "QueroRevisar · 12 créditos",
  "payment_method_id": "pix",
  "external_reference": "<credit_purchase.id>",
  "notification_url": "${MP_NOTIFICATION_URL}",
  "date_of_expiration": "<agora + 30 min, ISO com fuso -03:00>",
  "payer": { "email": "<e-mail do usuário>", "identification": { "type": "CPF", "number": "<se exigido>" } }
}
```

Resposta: `id`, `status: "pending"` (`status_detail: "pending_waiting_transfer"`), `point_of_interaction.transaction_data.qr_code` (copia e cola), `qr_code_base64` (imagem) e `ticket_url`. Guardar `provider_payment_id`. Front mostra o QR e faz polling em `GET /v1/credits/purchases/{id}`.

Notas da referência oficial (06/10/2026): `X-Idempotency-Key` é obrigatório; `external_reference` aceita até 64 caracteres `[A-Za-z0-9_-]` (o UUID da compra serve); `notification_url` até 248 caracteres e só é enviado quando for https; `date_of_expiration` aceita de 30 minutos a 30 dias, no formato `2026-10-06T12:30:00.000-03:00`. O Mercado Pago passou a chamar `/v1/payments` de "Checkout Transparente (legacy)" e recomenda a API de Orders (`/v1/orders`); o endpoint legado continua suportado e é o usado aqui.

## Créditos por cartão (Checkout Pro)

`POST /checkout/preferences`

```json
{
  "items": [
    { "id": "pack-12", "title": "QueroRevisar · 12 créditos", "quantity": 1, "currency_id": "BRL", "unit_price": 47.9 }
  ],
  "external_reference": "<credit_purchase.id>",
  "notification_url": "${MP_NOTIFICATION_URL}",
  "back_urls": {
    "success": "${MP_BACK_URL_SUCCESS}",
    "pending": "${MP_BACK_URL_PENDING}",
    "failure": "${MP_BACK_URL_FAILURE}"
  },
  "auto_return": "approved",
  "payment_methods": { "excluded_payment_types": [{ "id": "ticket" }] }
}
```

Redirecionar para `init_point`. A referência atual pede para não usar `sandbox_init_point`: com credenciais de teste o `init_point` já abre o ambiente de teste. `back_urls` e `auto_return` só são enviados quando `MP_BACK_URL_SUCCESS` é https (exigência do Mercado Pago).

## Webhook: validação da assinatura {#assinatura}

Headers recebidos: `x-signature: ts=<ts>,v1=<hash>` e `x-request-id`. O `data.id` vem na query string (`?data.id=...&type=...`).

1. Separar `ts` e `v1` do `x-signature`.
2. Montar o manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (omitir `id:` e `request-id:` quando ausentes; `ts:` sempre). A documentação manda usar `data.id` em minúsculas quando alfanumérico, mas os SDKs oficiais (Java e Node, 2026) assinam com o valor como recebido: a API aceita as duas formas.
3. HMAC-SHA256 do manifesto com `MP_WEBHOOK_SECRET`, em hexadecimal.
4. Comparar com `v1` em tempo constante (`MessageDigest.isEqual`). Diferente → 401.
5. Rejeitar `ts` com mais de 10 minutos de diferença (replay). `ts` é Unix time em segundos (correção dos SDKs de 03/08/2026); valores em milissegundos também são aceitos.
6. Gravar em `webhook_events` (id único) e **reconsultar o recurso na API** (`GET /v1/payments/{id}`, `GET /preapproval/{id}`). Nunca confiar no corpo do webhook.
7. Responder 200 rapidamente (o Mercado Pago espera resposta em até 22 s e reenvia a cada 15 min). Erros de processamento ficam em `webhook_events.error` e são reprocessados pelo job `cleanup`.

O id do evento em `webhook_events` é `mercadopago:<type>:<data.id>:<x-request-id>`; o mesmo evento reenviado não é reprocessado, e o crédito é idempotente pelo `credit_ledger` (`purchase`/`credit_purchase`/id da compra). Tipos tratados: `payment`, `subscription_preapproval`, `subscription_authorized_payment` (`subscription_preapproval_plan` é ignorado).

Testes obrigatórios: assinatura válida, `v1` alterado, segredo errado, `ts` alterado, header ausente, mesmo evento duas vezes (crédito lançado uma vez).

## Modo mock (`PAYMENTS_MODE=mock`)

Ativo quando `PAYMENTS_MODE=mock` ou quando `MP_ACCESS_TOKEN` é `<SEM_TOKEN>`.

- Premium: `checkout` devolve `initPoint = ${APP_URL}/mock/checkout?kind=premium&id=<id>`; a página chama `POST /v1/mock/payments/{id}/approve`, que roda os mesmos handlers do webhook (`subscription_preapproval` autorizado + primeira cobrança aprovada): plano premium, `premium_until` +1 mês, +2 créditos.
- Pix: devolve um QR real (PNG em base64) de um "copia e cola" fictício no formato BR Code e aprova sozinho em 3 s (também aprova ao consultar a compra depois desse prazo, para sobreviver a reinícios).
- Cartão: `initPoint = ${APP_URL}/mock/checkout?kind=credits&id=<purchaseId>`; aprova pelo mesmo `POST /v1/mock/payments/{id}/approve`.
- No profile `prod` o modo mock nunca aprova nada sozinho (`app.payments.mock-approvals=false`): sem credenciais, compras ficam pendentes.
