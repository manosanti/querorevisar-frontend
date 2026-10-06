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
