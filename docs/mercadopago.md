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
2. **Checkout:** `POST /v1/billing/premium/checkout` na nossa API cria a assinatura vinculada ao plano e devolve o link de pagamento do Mercado Pago (`init_point`). Campos principais: `preapproval_plan_id`, `payer_email` (e-mail da conta), `external_reference` = `user_id`, `back_url`. O front redireciona para o `init_point`; o pagador informa o cartão no ambiente do Mercado Pago (nada de dados de cartão no nosso app).
   - Se a API exigir `card_token_id` para criar com plano no modo escolhido, usar o fluxo de link do plano (`init_point` do `preapproval_plan`) com `external_reference` e associar pela notificação. Validar na referência oficial qual dos dois fluxos está vigente e documentar a escolha aqui.
3. **Webhook `subscription_preapproval`:** reconsultar `GET /preapproval/{id}`. `authorized` → `profiles.plan = premium`, gravar `subscriptions`. `cancelled` ou `paused` → manter Premium até `premium_until` e depois voltar para free (job diário).
4. **Webhook `subscription_authorized_payment`:** reconsultar o pagamento autorizado. Aprovado → estender `premium_until` em 1 mês e lançar `credit_ledger` `premium_bonus` +2 com `ref_id` = id do pagamento (idempotente).
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

Resposta: `id`, `status: "pending"`, `point_of_interaction.transaction_data.qr_code` (copia e cola) e `qr_code_base64` (imagem). Guardar `provider_payment_id`. Front mostra o QR e faz polling em `GET /v1/credits/purchases/{id}`.

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

Redirecionar para `init_point` (produção) ou `sandbox_init_point` (teste).

## Webhook: validação da assinatura {#assinatura}

Headers recebidos: `x-signature: ts=<ts>,v1=<hash>` e `x-request-id`. O `data.id` vem na query string (`?data.id=...&type=...`).

1. Separar `ts` e `v1` do `x-signature`.
2. Montar o manifesto: `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;` (omitir partes ausentes, conforme a documentação).
3. HMAC-SHA256 do manifesto com `MP_WEBHOOK_SECRET`, em hexadecimal.
4. Comparar com `v1` em tempo constante (`MessageDigest.isEqual`). Diferente → 401.
5. Rejeitar `ts` com mais de 10 minutos de diferença (replay).
6. Gravar em `webhook_events` (id único) e **reconsultar o recurso na API** (`GET /v1/payments/{id}`, `GET /preapproval/{id}`). Nunca confiar no corpo do webhook.
7. Responder 200 rapidamente. Erros de processamento ficam em `webhook_events.error` e são reprocessados pelo job `cleanup`.

Testes obrigatórios: assinatura válida, `v1` alterado, segredo errado, `ts` alterado, header ausente, mesmo evento duas vezes (crédito lançado uma vez).

## Modo mock (`PAYMENTS_MODE=mock`)

- Premium: `checkout` devolve `initPoint` para `/mock/checkout?purchase=...` no próprio app; ao confirmar, a API chama internamente o mesmo handler do webhook.
- Pix: devolve um QR fictício (imagem de placeholder) e aprova sozinho em 3 s.
- Cartão: igual ao Premium.
