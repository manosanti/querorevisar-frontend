# Pendências do dono do projeto

Tudo aqui depende de você. Enquanto estiver `<SEM_TOKEN>` ou `<PREENCHER>`, a integração roda em modo mock e o app continua funcionando.

Legenda: 🔒 segredo (nunca no repositório) · ✏️ decisão ou dado não sigiloso · ⛔ bloqueia o lançamento

## Domínio e marca

- [ ] ✏️⛔ Domínio final (ex.: querorevisar.com.br). Usado em `WEB_ORIGINS`, `APP_URL`, `LANDING_URL`, e-mails e back_url do Mercado Pago.
- [ ] ✏️ E-mail remetente (ex.: alertas@<domínio>) e e-mail de suporte.
- [ ] ✏️⛔ Texto da Política de privacidade e dos Termos de uso (LGPD).
- [ ] ✏️ CNPJ ou CPF do vendedor (necessário para a conta do Mercado Pago e para os termos).

## Supabase (dev e prod)

- [ ] ✏️ `SUPABASE_URL` de cada projeto.
- [ ] 🔒 `SUPABASE_ANON_KEY` (pública, mas fica em variável de ambiente da web).
- [ ] 🔒 `SUPABASE_SERVICE_ROLE_KEY` (só na API; usado para excluir conta).
- [ ] 🔒 `SUPABASE_JWT_SECRET` (só se o projeto usar chave JWT legada; com JWKS não precisa).
- [ ] 🔒 `DATABASE_URL` (pooler, transaction mode) e `DATABASE_DIRECT_URL` (migrações e backup).
- [ ] ✏️ No painel: ativar Anonymous sign-ins, Email OTP, Google; desativar Phone. Configurar SMTP da Resend. Redirect URLs com o domínio.

## Google

- [ ] 🔒 OAuth Client ID e Secret do Google (Google Cloud Console → Credentials) para o login com Google no Supabase.
- [ ] ✏️ ID do projeto Google Cloud (`GCP_PROJECT_ID`), região `southamerica-east1`.
- [ ] 🔒 Service account para o deploy pelo GitHub Actions (recomendado: Workload Identity Federation, sem chave JSON).
- [ ] ✏️ Alerta de orçamento de US$ 1 ativado.

## Mercado Pago

- [ ] 🔒 `MP_ACCESS_TOKEN` de teste (sandbox) e de produção.
- [ ] 🔒 `MP_PUBLIC_KEY` de teste e de produção (só se usar Bricks no futuro).
- [ ] 🔒 `MP_WEBHOOK_SECRET` (Suas integrações → Webhooks → assinatura secreta), um por modo.
- [ ] ✏️ Configurar a URL de webhook: `https://<api>/webhooks/mercadopago` com os eventos Pagamentos e Planos e assinaturas.
- [ ] ✏️ Criar usuários de teste (comprador e vendedor) para o sandbox.
- [ ] ✏️ `MP_PREMIUM_PLAN_ID`: gerado ao rodar o script de criação do plano (F09.2), uma vez por ambiente.
- [ ] ✏️ Confirmar se o Pix exige CPF do pagador na sua conta. Se exigir, o sheet de compra ganha o campo CPF.

## FIPE

- [ ] 🔒 `FIPE_API_TOKEN` (token gratuito em fipe.online). Opcional: sem ele o limite diário é menor.

## Consulta veicular (placa)

- [ ] ✏️⛔ Escolher o fornecedor de dados (ver `docs/vehicle-data.md`).
- [ ] 🔒 `VEHICLE_DATA_API_KEY` e `VEHICLE_DATA_BASE_URL`.
- [ ] ✏️ Custo por consulta de cada produto do fornecedor, para validar a margem dos preços em créditos.

## E-mail, push, observabilidade

- [ ] 🔒 `RESEND_API_KEY` e domínio verificado na Resend.
- [ ] 🔒 `VAPID_PRIVATE_KEY` e ✏️ `VAPID_PUBLIC_KEY` (o Claude gera o par com um script; você só guarda a privada como segredo).
- [ ] 🔒 `SENTRY_DSN_WEB`, `SENTRY_DSN_API`, `SENTRY_AUTH_TOKEN` (source maps no CI).
- [ ] 🔒 `POSTHOG_KEY` (pública, mas em variável) e ✏️ `POSTHOG_HOST`.

## Cloudflare

- [ ] 🔒 `CLOUDFLARE_API_TOKEN` (Pages:Edit, R2:Edit) e ✏️ `CLOUDFLARE_ACCOUNT_ID`.
- [ ] 🔒 `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, ✏️ `R2_BUCKET` para backups.
- [ ] 🔒 `BACKUP_AGE_PUBLIC_KEY` (criptografia dos dumps; guarde a chave privada fora da nuvem).

## Anúncios

- [ ] ✏️ Conta AdSense aprovada e IDs dos blocos (`ADSENSE_CLIENT`, slots itens-lista, historico-rodape, conta-rodape). Até lá, `ADS_MODE=placeholder`.

## Decisões de produto ainda abertas

- [ ] ✏️ Preços finais: Premium R$ 14,90/mês; crédito avulso R$ 4,90; pacotes 5 = R$ 21,90, 12 = R$ 47,90, 30 = R$ 104,90 (valores de exemplo do protótipo).
- [ ] ✏️ Custo em créditos de cada consulta (protótipo: laudo 6, leilão 3, restrições 2, débitos 2, dados da placa 1, FIPE grátis).
- [ ] ✏️ Validade dos créditos (o protótipo não define; implementação padrão: não expiram).
- [ ] ✏️ Login com Apple: exige Apple Developer (US$ 99/ano). Fica atrás da flag `apple_login`.

## API (notas da implementação)

- [ ] ✏️ Compra de créditos e assinatura Premium em sandbox/live exigem conta com e-mail (o Mercado Pago pede `payer.email`, e a assinatura sem plano confere o e-mail do pagador). Hoje o usuário anônimo recebe "Crie uma conta com e-mail para comprar créditos." / "...assinar o Premium.". Decidir se fica assim (no modo mock funciona sem conta).
- [ ] ✏️ Premium: o checkout usa assinatura **sem plano** com `status: pending` (o Mercado Pago só aceita assinatura com plano junto com `card_token_id`, ou seja, formulário de cartão próprio). `MP_PREMIUM_PLAN_ID` fica opcional. Ver `docs/mercadopago.md`.
- [ ] ✏️ Estorno/chargeback de compra de créditos: a compra é marcada `refunded`, mas os créditos não são retirados automaticamente (revisão manual). Definir a regra.
- [ ] ✏️ Consulta "Meu veículo": o cadastro não tem cor, então a linha "Cor" mostra "—" (o protótipo mostrava a cor do carro de exemplo).
- [ ] 🔒 `SUPABASE_SERVICE_ROLE_KEY` é necessário para `DELETE /v1/me` apagar o usuário no Supabase Auth; sem ele os dados são apagados e o usuário do Auth fica (aviso no log).
- [ ] ✏️ `INTERNAL_JOBS_AUDIENCE` (URL do serviço no Cloud Run) e, opcional, `INTERNAL_JOBS_SERVICE_ACCOUNT` (e-mail da service account do Cloud Scheduler) para os jobs `/internal/jobs/*`.
- [ ] 🔒 `SENTRY_DSN` já está ligado na API (`sentry-spring-boot-4-starter`); com `<SEM_TOKEN>` o Sentry fica desligado.
