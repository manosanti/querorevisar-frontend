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

## Configuração do GitHub Actions (F13)

Os workflows em `.github/workflows/` leem **variables** (não sigilosas) e **secrets** do repositório e dos environments `dev`, `production` e `restore-drill`. Configure o environment `production` com aprovação manual (Required reviewers).

- [ ] ✏️ Variables: `GCP_PROJECT_ID`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `GCP_SCHEDULER_SERVICE_ACCOUNT`, `CLOUDFLARE_ACCOUNT_ID`, `DEV_API_URL`, `DEV_APP_URL`, `DEV_LANDING_URL`, `DEV_SUPABASE_URL`, `PROD_API_URL`, `PROD_APP_URL`, `PROD_LANDING_URL`, `PROD_SUPABASE_URL`, `VAPID_PUBLIC_KEY`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`, `ADS_MODE`, `ADSENSE_*`, `R2_ENDPOINT`, `R2_BUCKET`.
- [ ] 🔒 Secrets: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `CLOUDFLARE_API_TOKEN`, `DEV_SUPABASE_ANON_KEY`, `PROD_SUPABASE_ANON_KEY`, `DEV_DATABASE_JDBC_URL`/`_USER`/`_PASSWORD`, `PROD_DATABASE_JDBC_URL`/`_USER`/`_PASSWORD`, `PROD_DATABASE_DIRECT_URL`, `SENTRY_DSN_WEB`, `SENTRY_AUTH_TOKEN`, `POSTHOG_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_AGE_PUBLIC_KEY`.
- [ ] 🔒 Secret Manager (Cloud Run, referenciados no `gcloud run deploy`): `qr-{dev,prod}-database-url`, `qr-{dev,prod}-supabase-service-role`, `qr-{dev,prod}-mp-access-token`, `qr-{dev,prod}-mp-webhook-secret`, `qr-vapid-private`, `qr-resend`, `qr-sentry-api`.
- [ ] ✏️ Projetos da Cloudflare Pages: `querorevisar-app` (web) e `querorevisar-site` (landing). Repositório do Artifact Registry: `querorevisar` em `southamerica-east1`.
- [ ] ✏️⛔ Teste mensal de restauração (`restore-test.yml`): precisa da chave **privada** do age no environment `restore-drill` (`BACKUP_AGE_PRIVATE_KEY`). Isso contraria "guardar a chave privada fora da nuvem". Alternativas: usar uma chave só para o teste, ou rodar `infra/backup/restore.sh` localmente uma vez por mês. Decida e, se for local, desative o agendamento do workflow.

## Ambiente local desta máquina

- [ ] ✏️ A virtualização está desligada na BIOS, então o Docker Desktop não sobe. Sem Docker, o `pnpm dev:all` usa Postgres embutido e o login local da API; os testes da API usam Postgres embutido em vez de Testcontainers. Para usar o Supabase local (login real, e-mail OTP, Google), habilite a virtualização (VT-x/AMD-V) no firmware e a "Plataforma da Máquina Virtual" do Windows.

## Landing (apps/landing)

- [ ] ✏️⛔ Texto final de `/privacidade` e `/termos` (`apps/landing/src/pages/privacidade.md` e `termos.md`). Hoje só há a estrutura com `<PREENCHER>` e o aviso "Texto em revisão"; as duas páginas ficam fora do Google (`noindex`, fora do sitemap) até o texto final. Ao publicar: remover `review: true` do frontmatter e as rotas de `NOINDEX_PATHS` em `apps/landing/src/lib/seo.ts`.
- [ ] ✏️ E-mail de suporte no fim de `/ajuda` (`<PREENCHER: e-mail de suporte>`).
- [ ] ✏️ Plano anual: o protótipo da landing tem o seletor Mensal/Anual (R$ 149/ano = 10 × R$ 14,90, "−17%", "Equivale a R$ 12,42 por mês"), mas `docs/domain.md` e o plano do Mercado Pago só têm o mensal. Criar o plano anual ou desligar `FEATURES.annualBilling` em `apps/landing/src/config.ts`.
- [ ] ✏️ Botão "Apple" do protótipo da landing está escondido (`FEATURES.appleLogin`, decisão D07). Ligar junto com a flag `apple_login`.
- [ ] ✏️ "175 itens" (faixa de números e plano grátis) é o texto do protótipo; `data/catalog.json` tem 196 itens hoje. Confirmar o número.
- [ ] ✏️ Textos novos sem protótipo, para revisão: banner "Cookies de análise" ("Usamos cookies de análise para entender como o site é usado. Nenhum dado pessoal é enviado…", "Recusar", "Aceitar"), bloco "Rever escolha" em `/privacidade`, página 404 ("Página não encontrada"), título "Grátis e Premium" em `/precos`, "Fale com a gente" em `/ajuda`, link "Pular para o conteúdo" (acessibilidade).
- [ ] 🔒 `PUBLIC_POSTHOG_KEY` da landing (sem ela não há banner nem analytics). ✏️ `PUBLIC_POSTHOG_HOST` é opcional (padrão `https://us.i.posthog.com`) e ainda não está em `env/landing.env.example`. No projeto PostHog, ativar "Discard client IP data" (LGPD).
- [ ] ✏️ `PUBLIC_SITE_URL` e `PUBLIC_APP_URL` de produção no build da landing (canonical, Open Graph, sitemap e robots usam `PUBLIC_SITE_URL`).
- Integração com o app (F06): a landing abre `PUBLIC_APP_URL/entrar` com `?mode=signup`, `?provider=google|apple`, `&plan=premium` e o e-mail digitado no fragmento (`#email=…`, nunca na query). O app precisa ler o fragmento e limpá-lo com `history.replaceState` antes de iniciar o PostHog. O botão "Consultar placa" de `/precos` abre `PUBLIC_APP_URL/consultas`.

## Acessibilidade (contraste)

- [ ] ✏️ O token `--subtle` (#929292) do protótipo tem contraste 3,1:1 sobre branco, abaixo do AA (4,5:1) para texto pequeno. Ele aparece em rótulos de tabela, "Publicidade", "Patrocinado" e textos de apoio. No login, o "OU" passou a usar `--muted` (#6a6a6a) para o Lighthouse/axe aprovar. Decidir se o token escurece no design system todo (uma mudança só em `packages/tokens`). Proposta: #767676 (4,54:1, o cinza mais claro que passa AA). A auditoria axe das telas logadas só acusa esse ponto: abas inativas, cabeçalhos de tabela, "Publicidade" e "Patrocinado". O teste `apps/web/e2e/a11y.spec.ts` ignora contraste até essa decisão.

## API (notas da implementação)

- [ ] ✏️ Compra de créditos e assinatura Premium em sandbox/live exigem conta com e-mail (o Mercado Pago pede `payer.email`, e a assinatura sem plano confere o e-mail do pagador). Hoje o usuário anônimo recebe "Crie uma conta com e-mail para comprar créditos." / "...assinar o Premium.". Decidir se fica assim (no modo mock funciona sem conta).
- [ ] ✏️ Premium: o checkout usa assinatura **sem plano** com `status: pending` (o Mercado Pago só aceita assinatura com plano junto com `card_token_id`, ou seja, formulário de cartão próprio). `MP_PREMIUM_PLAN_ID` fica opcional. Ver `docs/mercadopago.md`.
- [ ] ✏️ Estorno/chargeback de compra de créditos: a compra é marcada `refunded`, mas os créditos não são retirados automaticamente (revisão manual). Definir a regra.
- [ ] ✏️ Consulta "Meu veículo": o cadastro não tem cor, então a linha "Cor" mostra "—" (o protótipo mostrava a cor do carro de exemplo).
- [ ] 🔒 `SUPABASE_SERVICE_ROLE_KEY` é necessário para `DELETE /v1/me` apagar o usuário no Supabase Auth; sem ele os dados são apagados e o usuário do Auth fica (aviso no log).
- [ ] ✏️ `INTERNAL_JOBS_AUDIENCE` (URL do serviço no Cloud Run) e, opcional, `INTERNAL_JOBS_SERVICE_ACCOUNT` (e-mail da service account do Cloud Scheduler) para os jobs `/internal/jobs/*`.
- [ ] 🔒 `SENTRY_DSN` já está ligado na API (`sentry-spring-boot-4-starter`); com `<SEM_TOKEN>` o Sentry fica desligado.
