# Fila de lançamento

Roteiro único do código até o produto no ar em `querorevisar.com.br`. Montado em 26/11/2026 a partir do código, dos workflows de `.github/workflows/` e de [PENDENCIAS.md](../PENDENCIAS.md).

## Como esta fila garante o deploy

1. **Ordem.** Uma etapa só começa quando as etapas de que ela depende fecharam (diagrama abaixo).
2. **Prova.** Um item só vira `[x]` depois que o **Pronto quando** foi conferido de verdade: comando, tela ou resultado. Marcar sem conferir anula a garantia.
3. **Cobertura.** O [Anexo B](#anexo-b-variáveis-e-segredos) lista todo nome que os workflows leem, e `node scripts/check-launch-queue.ts` falha se faltar algum. Rode depois de qualquer mudança em `.github/workflows/`.
4. **Prova final.** A [etapa 8](#8-prova-final-em-produção) usa o produto em produção como um cliente: cadastro, pagamento real com estorno, alerta, exclusão de conta e restauração de backup. Se ela passa, o deploy está pronto.

O que a fila não consegue garantir sozinha está no [Anexo C](#anexo-c-o-que-esta-fila-não-garante-sozinha).

Legenda: 👤 você · 🤖 Claude · 👥 juntos.

```
0 Decisões ─┬─ 1 Código (🤖) ─────────────────────────────┐
            └─ 2 Domínio ─ 3 Contas e serviços ─ 4 GitHub ─┴─ 5 Dev de verdade ─┐
               6 Jurídico e conteúdo (em paralelo, desde a etapa 0) ────────────┴─ 7 Produção ─ 8 Prova final
```

## Já está pronto

- Código das fases F01 a F14: app, API, landing, CI e deploy escritos e testados em modo mock (12/12 fluxos ponta a ponta em 06/10/2026).
- Supabase dev (`ldfmadfpdhwpxvhrggin`), aplicação do Mercado Pago (`672594239844399`) e repositório no GitHub.
- Banco: as 20 tabelas têm RLS ligado e nenhuma policy, então a API pública do Supabase não lê nem grava nada.
- Pagamentos: sem credencial, a produção recusa a compra em vez de aprová-la sozinha.

## 0. Decisões (👤)

Pronto quando: a decisão está escrita no próprio item, no lugar do `?`.

- [x] **D1 · Domínio.** Decisão: `querorevisar.com.br` (26/11/2026). A compra é o item R1.
- [ ] **D2 · Quem vende.** CNPJ ou CPF, nome ou razão social e endereço. Usados no Registro.br, no Mercado Pago, nos termos e no rodapé. Decisão: ?
- [ ] **D3 · Consulta por placa no lançamento.** (a) Lançar sem consultas pagas. A FIPE continua grátis. A oferta do Premium perde "cadastro por placa" e "2 créditos de consulta por mês", que dependem do mesmo fornecedor. (b) Contratar um fornecedor de `docs/vehicle-data.md`. Decisão: ?
- [ ] **D4 · Plano anual (R$ 149/ano, anunciado na landing).** Criar no app e no Mercado Pago ou tirar da landing. Decisão: ?
- [ ] **D5 · Login com Google no lançamento.** Sim (item 3I) ou não (o botão sai, item C8). Decisão: ?
- [ ] **D6 · Preços e créditos.** Premium R$ 14,90/mês. Crédito avulso R$ 4,90. Pacotes: 5 = R$ 21,90, 12 = R$ 47,90 e 30 = R$ 104,90. Créditos por consulta: laudo 6, leilão 3, restrições 2, débitos 2, dados da placa 1. Os créditos não expiram. Confirmar ou mudar. Decisão: ?
- [ ] **D7 · E-mails.** Remetente (sugestão: `alertas@querorevisar.com.br`) e suporte (sugestão: `suporte@querorevisar.com.br`, recebido pelo item R4). Decisão: ?
- [ ] **D8 · Repositório.** Continua público ou vira privado. No plano grátis, um repositório privado limita o GitHub Actions a 2.000 min/mês. Decisão: ?
- [ ] **D9 · Teste mensal de restauração.** Chave age só para o teste, guardada no GitHub, ou restauração local uma vez por mês (nesse caso o agendamento do `restore-test.yml` é desligado). Decisão: ?
- [ ] **D10 · Regras em aberto.** Compra só com conta de e-mail (hoje é assim). Estorno de créditos (hoje é revisão manual). Contraste do token `--subtle`. "175 itens" (o catálogo tem 196). Decisão: ?

## 1. Código (🤖, em paralelo às etapas 2 a 4)

Pronto quando, para todos os itens: commit no GitHub e CI verde. Se o item tiver um teste próprio, ele aparece no item.

- [ ] **C1 · CI da API.** O Gradle não encontra o plugin GraalVM 1.1.8. Mesclar o PR #19, que sobe para 1.1.19, refazer o #20 e revisar os PRs #1 a #5 e #8. Pronto quando: `./gradlew :apps:api:check` passa e os PRs mesclados estão verdes.
- [x] **C2 · Trabalho parado.** Commit do diagnóstico de assinatura do webhook e da correção do `Redact.error`, e push dos 3 commits locais. Pronto quando: `git status -sb` mostra a branch igual à `origin` e sem alterações.
- [ ] **C3 · Domínio no repositório.** Atualizar `docs/PLAN.json`, `env/*.example` e `PENDENCIAS.md` com os endereços do [Anexo A](#anexo-a-endereços). Pronto quando: `grep -rn "querorevisar.<PREENCHER>" docs env` não acha nada.
- [ ] **C4 · Deploy passa tudo de que a API precisa.** `--set-env-vars` apaga toda variável fora da lista. Hoje faltam `PUSH_MODE=live`, `EMAIL_MODE=live`, `EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `INTERNAL_JOBS_SERVICE_ACCOUNT` e `DATABASE_DIRECT_URL`, e sem isso push e e-mail ficam só no log. Também entram: `--service-account` com a conta de execução própria (3C), `INTERNAL_TOKEN` só no dev (para disparar os jobs na etapa 5), `VEHICLE_DATA_MODE` conforme D3 e `ADS_MODE` com padrão `off` no build. Pronto quando: `node scripts/check-launch-queue.ts` passa com os nomes novos.
- [ ] **C5 · Produção não sobe incompleta.** No profile `prod`, a API se recusa a iniciar nestes casos:
  - push ou e-mail fora do modo real;
  - Mercado Pago sem credencial ou sem o segredo do webhook;
  - `DATABASE_DIRECT_URL` vazio;
  - `INTERNAL_JOBS_AUDIENCE` ou `INTERNAL_JOBS_SERVICE_ACCOUNT` vazios (sem a conta, qualquer token do Google com o mesmo audience dispara `/internal/jobs/*`);
  - `INTERNAL_TOKEN` definido;
  - `APP_URL`, `API_URL` ou `WEB_ORIGINS` sem `https`.

  Além disso, a consulta por placa nunca usa os dados fictícios em produção. Pronto quando: os testes novos do `StartupGuard` passam.

- [ ] **C6 · Consulta por placa conforme D3.**
  - (a) Em produção, a API recusa a consulta e a venda de pacotes, e o app e a landing tiram a oferta de consultas, o "cadastro por placa" e os créditos mensais do Premium.
  - (b) Integração do fornecedor em `LiveVehicleDataProvider`, com testes WireMock sobre as respostas de exemplo dele.

  Pronto quando: o teste do caminho escolhido passa.

- [ ] **C7 · Backup sem alarme falso.** `backup.yml` e `restore-test.yml` terminam verdes, com aviso, enquanto não houver banco de produção. O backup sai do environment `production` e vai para um environment `backup`, porque com aprovação manual ele ficaria esperando alguém aprovar todo dia. Pronto quando: uma execução manual sem segredos termina verde com o aviso.
- [ ] **C8 · Google conforme D5.** Se a decisão for "não", o botão sai do app e da landing. Pronto quando: o e2e do login passa sem o botão.
- [ ] **C9 · Plano anual conforme D4.** Desligar `FEATURES.annualBilling` ou criar o plano anual (API, Mercado Pago e app).
- [ ] **C10 · Identificação de quem vende** (depois de D2). Nome, CNPJ ou CPF, endereço e e-mail no rodapé da landing (Decreto 7.962/2013). Pronto quando: aparece em todas as páginas do build da landing.
- [ ] **C11 · Chaves VAPID.** Um script gera o par sem dependência externa. A chave pública vai para `VAPID_PUBLIC_KEY` e a privada para `qr-vapid-private`.
- [ ] **C12 · E-mails do Supabase em português.** Modelos de confirmação, código ou link de acesso, troca de e-mail e redefinição de senha em `infra/supabase/templates/`, para colar no painel (3A). Os textos são novos, então passam pela sua revisão (J4).
- [ ] **C13 · Preços conforme D6** (só se algum valor mudar). `packages/core`, `CREDIT_UNIT_PRICE_CENTS`, `MP_PREMIUM_PRICE_CENTS` e a landing com os mesmos valores. Pronto quando: os testes de preço passam e a landing mostra o que o app cobra.
- [ ] **C14 · Documentos.** `PENDENCIAS.md` e `docs/checklist-lancamento.md` apontando para esta fila.

## 2. Domínio e DNS (👤)

- [ ] **R1 · Comprar `querorevisar.com.br`** no Registro.br, em nome de D2. Pronto quando: o domínio aparece ativo na sua conta do Registro.br.
- [ ] **R2 · Cloudflare.** Criar a conta, usar "Add a domain" com `querorevisar.com.br` no plano Free e anotar os 2 nameservers.
- [ ] **R3 · Apontar o DNS.** No Registro.br, trocar os servidores DNS pelos 2 da Cloudflare. Pronto quando: a Cloudflare mostra o domínio como **Active** e `nslookup -type=NS querorevisar.com.br` responde com `*.ns.cloudflare.com`.
- [ ] **R4 · Caixa de suporte** (recomendado). Em Cloudflare → Email → Email Routing, encaminhar `suporte@querorevisar.com.br` para o seu e-mail. A Resend só envia: sem esse encaminhamento, ninguém recebe a resposta de um cliente. Pronto quando: um e-mail de teste chega.

## 3. Contas e serviços (👤)

Os comandos citados estão no [Anexo D](#anexo-d-comandos). Cada valor vai para o lugar indicado no [Anexo B](#anexo-b-variáveis-e-segredos).

### 3A. Supabase produção

- [ ] Criar o projeto `qr-prod` na região South America (São Paulo). Guardar a senha do banco no seu gerenciador de senhas.
- [ ] Em Project Settings → API Keys: a chave publishable vai para `PROD_SUPABASE_ANON_KEY` e a secret para `qr-prod-supabase-service-role`.
- [ ] Chave de assinatura dos tokens: `curl -s https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` precisa trazer uma chave com `"kty":"EC"` ou `"kty":"RSA"`. Se a lista vier vazia, o projeto ainda usa o segredo legado (HS256). Nesse caso, migre para as chaves novas em Project Settings → JWT Keys, porque a API de produção não recebe o segredo legado.
- [ ] No botão **Connect**:
  - A URL do _Transaction pooler_ (porta 6543) vai para `qr-prod-database-url`.
  - A URL do _Session pooler_ (porta 5432) vai para `PROD_DATABASE_DIRECT_URL` e `qr-prod-database-direct-url`.
  - A mesma URL do _Session pooler_, em formato JDBC (`jdbc:postgresql://<host>:5432/postgres`, usuário `postgres.<ref>`), vai para `PROD_DATABASE_JDBC_URL`, `PROD_DATABASE_USER` e `PROD_DATABASE_PASSWORD`.
  - Não use a conexão direta (`db.<ref>.supabase.co`): no plano grátis ela só tem IPv6, e o GitHub Actions não a alcança.
- [ ] Em Authentication → Sign In / Providers:
  - Anonymous **ligado**.
  - Email **ligado**, com **Confirm email**.
  - Phone **desligado**.
  - Google conforme D5 (item 3I).
  - Não ligue CAPTCHA: o app não envia o token e o login quebraria.
- [ ] Em Authentication → URL Configuration: Site URL `https://app.querorevisar.com.br` e Redirect URLs `https://app.querorevisar.com.br/**`.
- [ ] Em Authentication → Emails → SMTP: host `smtp.resend.com`, porta `465`, usuário `resend`, senha igual à chave da Resend (3E), remetente de D7 e nome `QueroRevisar`. Sem SMTP próprio, o Supabase só manda e-mail para membros da organização.
- [ ] Em Authentication → Emails → Templates: colar os modelos em português (C12).
- [ ] Em Project Settings → Infrastructure: a versão do Postgres precisa ser igual ou menor que 17, a do `postgresql-client-17` de `backup.yml` e `restore-test.yml`. Se for maior, avise: 🤖 ajusto os workflows.
- [ ] Recomendado: desligar o Data API em Project Settings → Data API. O app não usa (o login continua funcionando), e desligar tira uma porta de entrada.

### 3B. Supabase dev (já existe)

- [ ] Em Redirect URLs, incluir `https://main.querorevisar-app.pages.dev/**`, além de `http://localhost:5173/**`.
- [ ] Conferir o JWKS com o mesmo `curl` do 3A (o `PENDENCIAS.md` registra ES256).
- [ ] No botão **Connect**: _Transaction pooler_ → `qr-dev-database-url`; _Session pooler_ → `qr-dev-database-direct-url`. Em JDBC, o _Session pooler_ vai para `DEV_DATABASE_JDBC_URL`, `DEV_DATABASE_USER` e `DEV_DATABASE_PASSWORD`.
- [ ] Em API Keys: a publishable vai para `DEV_SUPABASE_ANON_KEY` e a secret para `qr-dev-supabase-service-role`.
- [ ] Configurar SMTP e modelos iguais aos de produção, para que o V5 teste o mesmo e-mail que o cliente vai receber.

### 3C. Google Cloud

- [ ] Criar o projeto (ID sugerido: `querorevisar`) e ligar o faturamento. Anote o **ID** e o **número** do projeto.
- [ ] Em Billing → Budgets & alerts: orçamento de US$ 1 com alertas em 50%, 90% e 100% para o seu e-mail. Pronto quando: o orçamento aparece na lista.
- [ ] Rodar o bloco [D1](#d1-google-cloud) do Anexo D. Ele ativa as APIs, cria o Artifact Registry `querorevisar` e as contas de serviço `qr-deploy`, `qr-api-runtime` e `qr-scheduler`, dá os papéis e configura o Workload Identity Federation preso a `manosanti/querorevisar-frontend`. Pronto quando: a conferência no fim do bloco mostra as 7 APIs, o repositório, as 3 contas e o provedor `ACTIVE`.
- [ ] Criar no Secret Manager todos os segredos do [Anexo B3](#b3-secret-manager-google-cloud) (bloco [D5](#d5-segredos-no-secret-manager)). **Todos precisam existir**, mesmo os que ainda não têm valor (nesse caso, use `<SEM_TOKEN>`): o deploy falha se um nome citado em `--set-secrets` não existir. Pronto quando: `gcloud secrets list` mostra os nomes do B3.

### 3D. Cloudflare Pages e R2

- [ ] Criar os projetos `querorevisar-app` e `querorevisar-site` com a branch de produção **`production`** (bloco [D2](#d2-cloudflare)). Se forem criados pelo painel com a branch `main`, o deploy de dev vai para o endereço de produção.
- [ ] Domínios: `querorevisar.com.br` e `www.querorevisar.com.br` no `querorevisar-site`; `app.querorevisar.com.br` no `querorevisar-app`. Criar a regra Rules → Redirect Rules → "Redirect from WWW to root".
- [ ] Token da API: em My Profile → API Tokens, criar um Custom Token com _Account · Cloudflare Pages · Edit_. O token vai para `CLOUDFLARE_API_TOKEN` e o Account ID para `CLOUDFLARE_ACCOUNT_ID`.
- [ ] R2 (o painel pode pedir um cartão para ativar; o volume do backup cabe na faixa gratuita):
  - bucket `querorevisar-backups` → `R2_BUCKET`;
  - endpoint `https://<account-id>.r2.cloudflarestorage.com` → `R2_ENDPOINT`;
  - token do R2 com _Object Read & Write_ só nesse bucket → `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`.
- [ ] Chave do backup (bloco [D3](#d3-chave-do-backup)). A linha `Public key: age1…` vai para `BACKUP_AGE_PUBLIC_KEY`. O arquivo com a chave privada fica fora da nuvem (pendrive ou gerenciador de senhas), conforme D9.

### 3E. Resend

- [ ] Em Domains → Add, cadastrar `querorevisar.com.br`. Criar na Cloudflare os registros que a Resend mostrar (MX e TXT do subdomínio de envio e o DKIM), todos como **DNS only**. Acrescentar o DMARC: TXT `_dmarc` com `v=DMARC1; p=none;`. Pronto quando: a Resend mostra o domínio como **Verified**.
- [ ] Em API Keys, criar uma chave com _Sending access_ restrita ao domínio. Ela vai para `qr-resend` e é a senha do SMTP do Supabase (3A e 3B).

### 3F. Mercado Pago

- [ ] Ter uma conta de vendedor em nome de D2, com **chave Pix cadastrada**. Sem chave, o Pix não gera QR.
- [ ] Na aplicação `672594239844399` → Contas de teste, criar um vendedor e um comprador de teste. A credencial de teste vai para `qr-dev-mp-access-token` (passo a passo em `docs/mercadopago.md`).
- [ ] Em Produção, ativar as credenciais de produção (setor, site `https://querorevisar.com.br`, aceite dos termos). O Access Token vai para `qr-prod-mp-access-token`.
- [ ] Webhooks, modo de teste: URL `<DEV_API_URL>/webhooks/mercadopago` com os eventos **Pagamentos** e **Planos e assinaturas**. A assinatura secreta vai para `qr-dev-mp-webhook-secret`.
- [ ] Webhooks, modo produção: URL `<PROD_API_URL>/webhooks/mercadopago` com os mesmos eventos. A assinatura vai para `qr-prod-mp-webhook-secret`.

### 3G. Sentry (recomendado)

- [ ] Criar a organização e os projetos `querorevisar-web` (React) e `querorevisar-api` (Spring Boot).
  - DSN da web → `SENTRY_DSN_WEB`.
  - DSN da API → `qr-sentry-api`.
  - Token da organização → `SENTRY_AUTH_TOKEN`.
  - `SENTRY_ORG` e `SENTRY_PROJECT_WEB` recebem os slugs.

  Sem Sentry: `qr-sentry-api` fica com `<SEM_TOKEN>` e os outros não são criados.

### 3H. PostHog (opcional)

- [ ] Projeto na nuvem **US** (o build usa o host US), com "Discard client IP data" ligado. A chave vai para `POSTHOG_KEY`. Sem PostHog, não crie a chave: o banner de cookies some.

### 3I. Login com Google (se D5 = sim)

- [ ] Em Google Cloud → APIs & Services → OAuth consent screen: tipo externo, nome QueroRevisar, e-mail de suporte, domínios autorizados `querorevisar.com.br` e `supabase.co`, status publicado (_In production_).
- [ ] Em Credentials, criar um OAuth client ID do tipo Web:
  - origem `https://app.querorevisar.com.br`;
  - redirect `https://<ref-prod>.supabase.co/auth/v1/callback`, e o equivalente do dev;
  - Client ID e Secret vão para Supabase → Providers → Google (3A e 3B).

  A tela do Google vai mostrar o endereço `…supabase.co`, porque domínio próprio no Supabase é pago.

### 3J. Push (VAPID)

- [ ] Rodar o script do C11. A chave pública vai para `VAPID_PUBLIC_KEY` e a privada para `qr-vapid-private`. `VAPID_SUBJECT` recebe `mailto:` seguido do e-mail de suporte (D7).

## 4. GitHub (👤, com 🤖 no fim)

- [ ] **G1 · Environments** (Settings → Environments): `dev`; `production` com **Required reviewers** = você; `backup` (C7); `restore-drill`.
- [ ] **G2 · Variables:** as do [Anexo B1](#b1-github-variables), no nível do repositório (Settings → Secrets and variables → Actions → Variables). As que ficam vazias não são criadas.
- [ ] **G3 · Secrets:** as do [Anexo B2](#b2-github-secrets), no nível do repositório. A exceção é `BACKUP_AGE_PRIVATE_KEY`: fica só no environment `restore-drill`, e só se a decisão de D9 for a chave do teste.
- [ ] **G4 · Cobertura.** `node scripts/check-launch-queue.ts` termina sem nomes faltando.
- [ ] **G5 · 🤖 Criar a `main`** a partir da branch atual. O push dispara o primeiro `deploy-dev`, por isso só depois da etapa 3 e de G1 a G4.
- [ ] **G6 · Proteger a `main`.** Branch padrão = `main`, com regra exigindo PR e os checks `typescript` e `api`.

## 5. Dev de verdade (👥, portão antes da produção)

Endereços: app em `DEV_APP_URL` e API em `DEV_API_URL` ([Anexo A](#anexo-a-endereços)).

- [ ] **V1 ·** `deploy-dev` verde: imagem nativa compilada, smoke, Flyway no dev, Cloud Run e Pages. Se a imagem nativa não compilar, 🤖 troco para a JVM com CPU boost (decisão D05 do plano) e rodamos de novo.
- [ ] **V2 ·** `curl -s <DEV_API_URL>/actuator/health` responde `{"status":"UP"}`.
- [ ] **V3 ·** No Pages, o deploy da `main` aparece como **Preview** (não como Production), e `https://main.querorevisar-app.pages.dev` abre o app.
- [ ] **V4 ·** Sem login: cadastrar um veículo, registrar uma troca e atualizar a km. Recarregar a página mantém tudo.
- [ ] **V5 ·** Criar conta com e-mail a partir do anônimo. O e-mail de confirmação chega em português e, depois de confirmar, o veículo continua lá.
- [ ] **V6 ·** Google (se D5 = sim): entrar com Google funciona.
- [ ] **V7 ·** Mercado Pago, modo teste → Webhooks → **Simular notificação**: o log do `qr-api-dev` não tem "Rejected Mercado Pago webhook".
- [ ] **V8 ·** Compra de créditos por cartão com o comprador de teste: o pagamento é aprovado e os créditos entram no saldo.
- [ ] **V9 ·** Premium com o comprador de teste: a conta vira Premium. Se o sandbox não completar a assinatura, anote o erro: o F4 prova isso em produção.
- [ ] **V10 ·** Pix: o QR aparece. A aprovação de verdade é provada no F3.
- [ ] **V11 ·** Alertas:
  1. Registre uma troca de "Óleo do motor" com data de 2 anos atrás. O item fica Vencido.
  2. Ative as notificações no app, no Android (Chrome) e no iPhone. No iPhone, o app precisa estar instalado na tela de início (iOS 16.4 ou mais novo).
  3. Dispare os jobs (bloco [D4](#d4-disparar-os-jobs-no-dev)).

  Pronto quando: o push chega nos dois aparelhos e o e-mail chega.

- [ ] **V12 ·** Consultas conforme D3. (a) A oferta paga não aparece e a FIPE funciona. (b) A consulta de uma placa real devolve dados reais.
- [ ] **V13 ·** Excluir a conta (Conta → Excluir): o usuário some de Authentication → Users no Supabase dev.
- [ ] **V14 ·** LGPD nos logs: no Logs Explorer do Cloud Run, a busca pelo seu e-mail e pela placa usada nos testes não acha nada.
- [ ] **V15 ·** Sentry (se 3G): um erro de teste aparece no projeto certo.

## 6. Jurídico e conteúdo (👤, com apoio 🤖)

- [ ] **J1 · Política de privacidade.** Preencher os 13 `<PREENCHER>` de `apps/landing/src/pages/privacidade.md`, de preferência com revisão de advogado. Pronto quando: `grep -c PREENCHER apps/landing/src/pages/privacidade.md` dá `0`.
- [ ] **J2 · Termos de uso.** Preencher os 16 de `apps/landing/src/pages/termos.md`, incluindo renovação e cancelamento do Premium, arrependimento em 7 dias (CDC art. 49) e reembolso. Pronto quando: o mesmo `grep` no `termos.md` dá `0`.
- [ ] **J3 · 🤖 Publicar as duas páginas.** Tirar `review: true` e as duas rotas de `NOINDEX_PATHS` em `apps/landing/src/lib/seo.ts`. Pronto quando: as duas páginas estão no sitemap do build.
- [ ] **J4 · Revisar os textos novos.** E-mail de suporte em `/ajuda`, banner de cookies, página 404, "Grátis e Premium", "Fale com a gente" e os modelos de e-mail do C12.
- [ ] **J5 · Nota fiscal.** Combinar com um contador como emitir nota das vendas. Fica fora do código, mas sem isso não dá para vender.

## 7. Produção (👥)

- [ ] **P1 ·** Etapas 0 a 6 fechadas, e `node scripts/check-launch-queue.ts` sem faltas.
- [ ] **P2 · 🤖 Tag `v1.0.0`** num commit da `main` cujo `deploy-dev` passou. O `deploy-prod` promove a imagem construída para aquele commit; em outro commit, ele não encontra a imagem.
- [ ] **P3 · 👤 Aprovar** o deploy no environment `production`.
- [ ] **P4 ·** `deploy-prod` verde: Flyway em produção, `qr-api`, jobs do Cloud Scheduler e Pages do app e da landing.
- [ ] **P5 ·** `curl -s <PROD_API_URL>/actuator/health` responde `{"status":"UP"}`, e `gcloud scheduler jobs list --location=southamerica-east1` mostra `qr-daily`, `qr-send-alerts`, `qr-premium-credits`, `qr-fipe-refresh` e `qr-cleanup`.
- [ ] **P6 ·** `https://querorevisar.com.br` abre a landing, `https://www.querorevisar.com.br` redireciona para ela e `https://app.querorevisar.com.br` abre o login, os três com cadeado válido.
- [ ] **P7 ·** Mercado Pago, modo produção → **Simular notificação**: o log do `qr-api` não tem "Rejected Mercado Pago webhook".

## 8. Prova final em produção (👥)

Feita com uma conta sua, do jeito que um cliente faria. Se todos os itens passarem, o produto está no ar.

- [ ] **F1 ·** Na landing, "Criar conta" leva ao app com o e-mail preenchido. O e-mail de confirmação chega em português e o login funciona.
- [ ] **F2 ·** Primeiro veículo, troca e km. Com o celular em modo avião, registrar algo e depois voltar à rede: os dados sincronizam.
- [ ] **F3 ·** Comprar 1 crédito por Pix (R$ 4,90) e pagar pelo seu banco: o pagamento é aprovado em segundos e o crédito entra. Depois, devolver o pagamento pelo painel do Mercado Pago. No Supabase (Table Editor → `credit_purchases`), a compra fica `refunded` (regra de D10).
- [ ] **F4 ·** Assinar o Premium com o seu cartão: a conta vira Premium. Cancelar na tela Conta: a conta continua Premium até a data paga.
- [ ] **F5 ·** Alertas: rodar `gcloud scheduler jobs run qr-daily --location=southamerica-east1` e depois `gcloud scheduler jobs run qr-send-alerts --location=southamerica-east1`, com um veículo que tenha item vencido. O push e o e-mail chegam.
- [ ] **F6 ·** Consultas conforme D3, como no V12.
- [ ] **F7 ·** Excluir a conta de teste: ela some do Supabase de produção.
- [ ] **F8 ·** Backup: rodar o `backup` manualmente (Actions → backup → Run workflow) e conferir que o arquivo aparece no R2. Restaurar uma vez, conforme D9: `restore-test` verde, ou `infra/backup/restore.sh` local mostrando a contagem de veículos e registros.
- [ ] **F9 ·** O alerta de orçamento de US$ 1 está ativo (3C).
- [ ] **F10 ·** `node scripts/check-launch-queue.ts --final` não acusa nenhum item aberto.

### Primeira semana (não bloqueia o lançamento)

- O projeto Supabase de produção continua _Active_ (o plano grátis pausa projetos parados) e o `backup` rodou todos os dias.
- Lighthouse mobile ≥ 90 na landing e no app (a medição de 06/10/2026 deu 85 a 90 em performance).
- Google Search Console: verificar o domínio e enviar `https://querorevisar.com.br/sitemap-index.xml`.
- AdSense: pedir a aprovação. Com os IDs em mãos, `ADS_MODE` passa a `adsense`.

## Anexo A: endereços

| O quê                   | Produção                                                        | Dev                                                                 |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Landing                 | `https://querorevisar.com.br` (o `www` redireciona)             | `https://main.querorevisar-site.pages.dev`                          |
| App                     | `https://app.querorevisar.com.br`                               | `https://main.querorevisar-app.pages.dev`                           |
| API                     | `https://qr-api-<número do projeto>.southamerica-east1.run.app` | `https://qr-api-dev-<número do projeto>.southamerica-east1.run.app` |
| Webhook do Mercado Pago | API de produção + `/webhooks/mercadopago`                       | API de dev + `/webhooks/mercadopago`                                |
| Supabase                | `https://<ref de produção>.supabase.co`                         | `https://ldfmadfpdhwpxvhrggin.supabase.co`                          |
| E-mails                 | remetente e suporte de D7                                       | os mesmos                                                           |

O endereço do Cloud Run usa o **número** do projeto, não o ID. Se o `curl` do V2 ou do P5 falhar com ele, use o endereço que o console do Cloud Run mostra e atualize `DEV_API_URL` ou `PROD_API_URL`.

## Anexo B: variáveis e segredos

Tirados de `.github/workflows/*.yml` e de `apps/api/src/main/resources/application.yml` em 26/11/2026. A marca (C4) indica um nome que entra junto com aquela mudança.

### B1. GitHub Variables

| Nome                                 | Valor                                             |
| ------------------------------------ | ------------------------------------------------- |
| `GCP_PROJECT_ID`                     | ID do projeto (3C)                                |
| `GCP_DEPLOY_SERVICE_ACCOUNT`         | `qr-deploy@<ID>.iam.gserviceaccount.com`          |
| `GCP_SCHEDULER_SERVICE_ACCOUNT`      | `qr-scheduler@<ID>.iam.gserviceaccount.com`       |
| `GCP_RUNTIME_SERVICE_ACCOUNT` (C4)   | `qr-api-runtime@<ID>.iam.gserviceaccount.com`     |
| `CLOUDFLARE_ACCOUNT_ID`              | 3D                                                |
| `DEV_API_URL`                        | Anexo A                                           |
| `DEV_APP_URL`                        | `https://main.querorevisar-app.pages.dev`         |
| `DEV_LANDING_URL`                    | `https://main.querorevisar-site.pages.dev`        |
| `DEV_SUPABASE_URL`                   | `https://ldfmadfpdhwpxvhrggin.supabase.co`        |
| `PROD_API_URL`                       | Anexo A                                           |
| `PROD_APP_URL`                       | `https://app.querorevisar.com.br`                 |
| `PROD_LANDING_URL`                   | `https://querorevisar.com.br`                     |
| `PROD_SUPABASE_URL`                  | `https://<ref de produção>.supabase.co`           |
| `VAPID_PUBLIC_KEY`                   | 3J                                                |
| `VAPID_SUBJECT` (C4)                 | `mailto:` + e-mail de suporte (D7)                |
| `EMAIL_FROM` (C4)                    | `QueroRevisar <alertas@querorevisar.com.br>` (D7) |
| `VEHICLE_DATA_PROVIDER` (C4, D3 = b) | nome do fornecedor                                |
| `VEHICLE_DATA_BASE_URL` (C4, D3 = b) | URL da API do fornecedor                          |
| `SENTRY_ORG`                         | 3G (não criar sem Sentry)                         |
| `SENTRY_PROJECT_WEB`                 | 3G (não criar sem Sentry)                         |
| `ADS_MODE`                           | `off` até o AdSense                               |
| `ADSENSE_CLIENT`                     | não criar até o AdSense                           |
| `ADSENSE_SLOT_ITENS`                 | não criar até o AdSense                           |
| `ADSENSE_SLOT_HISTORICO`             | não criar até o AdSense                           |
| `ADSENSE_SLOT_CONTA`                 | não criar até o AdSense                           |
| `R2_ENDPOINT`                        | `https://<account-id>.r2.cloudflarestorage.com`   |
| `R2_BUCKET`                          | `querorevisar-backups`                            |

### B2. GitHub Secrets

| Nome                             | Valor                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | saída do bloco D1                                                     |
| `CLOUDFLARE_API_TOKEN`           | 3D                                                                    |
| `DEV_SUPABASE_ANON_KEY`          | publishable do dev (3B)                                               |
| `PROD_SUPABASE_ANON_KEY`         | publishable de produção (3A)                                          |
| `DEV_DATABASE_JDBC_URL`          | _Session pooler_ do dev em JDBC (3B)                                  |
| `DEV_DATABASE_USER`              | `postgres.ldfmadfpdhwpxvhrggin`                                       |
| `DEV_DATABASE_PASSWORD`          | senha do banco dev                                                    |
| `PROD_DATABASE_JDBC_URL`         | _Session pooler_ de produção em JDBC (3A)                             |
| `PROD_DATABASE_USER`             | `postgres.<ref de produção>`                                          |
| `PROD_DATABASE_PASSWORD`         | senha do banco de produção                                            |
| `PROD_DATABASE_DIRECT_URL`       | _Session pooler_ de produção, `postgresql://…:5432/postgres` (backup) |
| `SENTRY_DSN_WEB`                 | 3G (não criar sem Sentry)                                             |
| `SENTRY_AUTH_TOKEN`              | 3G (não criar sem Sentry)                                             |
| `POSTHOG_KEY`                    | 3H (não criar sem PostHog)                                            |
| `R2_ACCESS_KEY_ID`               | 3D                                                                    |
| `R2_SECRET_ACCESS_KEY`           | 3D                                                                    |
| `BACKUP_AGE_PUBLIC_KEY`          | 3D (`age1…`)                                                          |
| `BACKUP_AGE_PRIVATE_KEY`         | só no environment `restore-drill`, se D9 = chave do teste             |

### B3. Secret Manager (Google Cloud)

Todos precisam existir antes do primeiro deploy, com `<SEM_TOKEN>` enquanto não houver valor.

| Nome                                   | Vira na API                       | Valor                                        |
| -------------------------------------- | --------------------------------- | -------------------------------------------- |
| `qr-dev-database-url`                  | `DATABASE_URL` (dev)              | _Transaction pooler_ do dev, porta 6543      |
| `qr-prod-database-url`                 | `DATABASE_URL`                    | _Transaction pooler_ de produção, porta 6543 |
| `qr-dev-database-direct-url` (C4)      | `DATABASE_DIRECT_URL` (dev)       | _Session pooler_ do dev, porta 5432          |
| `qr-prod-database-direct-url` (C4)     | `DATABASE_DIRECT_URL`             | _Session pooler_ de produção, porta 5432     |
| `qr-dev-supabase-service-role`         | `SUPABASE_SERVICE_ROLE_KEY` (dev) | secret key do dev                            |
| `qr-prod-supabase-service-role`        | `SUPABASE_SERVICE_ROLE_KEY`       | secret key de produção                       |
| `qr-dev-mp-access-token`               | `MP_ACCESS_TOKEN` (dev)           | credencial de teste                          |
| `qr-prod-mp-access-token`              | `MP_ACCESS_TOKEN`                 | credencial de produção                       |
| `qr-dev-mp-webhook-secret`             | `MP_WEBHOOK_SECRET` (dev)         | assinatura do webhook, modo teste            |
| `qr-prod-mp-webhook-secret`            | `MP_WEBHOOK_SECRET`               | assinatura do webhook, modo produção         |
| `qr-vapid-private`                     | `VAPID_PRIVATE_KEY`               | 3J                                           |
| `qr-resend`                            | `RESEND_API_KEY`                  | 3E                                           |
| `qr-sentry-api`                        | `SENTRY_DSN`                      | 3G ou `<SEM_TOKEN>`                          |
| `qr-dev-internal-token` (C4)           | `INTERNAL_TOKEN` (só dev)         | 32 caracteres aleatórios ou mais (bloco D4)  |
| `qr-vehicle-data-api-key` (C4, D3 = b) | `VEHICLE_DATA_API_KEY`            | chave do fornecedor                          |
| `qr-fipe-token` (C4, opcional)         | `FIPE_API_TOKEN`                  | token grátis do fipe.online                  |

### B4. Variáveis da API no Cloud Run

Quem define é o workflow. Não edite pelo console do Cloud Run: o próximo deploy apaga a alteração (`--set-env-vars` substitui tudo).

| Nome                                 | Produção                        | Dev                     |
| ------------------------------------ | ------------------------------- | ----------------------- |
| `SPRING_PROFILES_ACTIVE`             | `prod`                          | `dev`                   |
| `PAYMENTS_MODE`                      | `live`                          | `sandbox`               |
| `TZ`                                 | `America/Sao_Paulo`             | igual                   |
| `APP_URL`                            | `PROD_APP_URL`                  | `DEV_APP_URL`           |
| `API_URL`                            | `PROD_API_URL`                  | `DEV_API_URL`           |
| `WEB_ORIGINS`                        | `PROD_APP_URL`                  | `DEV_APP_URL`           |
| `SUPABASE_URL`                       | `PROD_SUPABASE_URL`             | `DEV_SUPABASE_URL`      |
| `INTERNAL_JOBS_AUDIENCE`             | `PROD_API_URL`                  | `DEV_API_URL`           |
| `INTERNAL_JOBS_SERVICE_ACCOUNT` (C4) | `GCP_SCHEDULER_SERVICE_ACCOUNT` | igual                   |
| `PUSH_MODE` (C4)                     | `live`                          | `live`                  |
| `EMAIL_MODE` (C4)                    | `live`                          | `live`                  |
| `EMAIL_FROM` (C4)                    | B1                              | igual                   |
| `VAPID_PUBLIC_KEY` (C4)              | B1                              | igual                   |
| `VAPID_SUBJECT` (C4)                 | B1                              | igual                   |
| `VEHICLE_DATA_MODE` (C4)             | conforme D3                     | conforme D3             |
| `INTERNAL_TOKEN` (C4)                | nunca                           | `qr-dev-internal-token` |

Segredos montados pelo `--set-secrets` (valores no B3): `DATABASE_URL`, `DATABASE_DIRECT_URL` (C4), `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY` e `SENTRY_DSN`.

## Anexo C: o que esta fila não garante sozinha

- **Imagem nativa.** Ela nunca foi compilada. O V1 é o primeiro teste, e o plano B (JVM) já está previsto.
- **O que não deu para ler daqui.** As variáveis e os segredos já cadastrados no GitHub (sem permissão), a configuração do Supabase dev (conector sem permissão) e a aplicação do Mercado Pago (conector não autorizado). Por isso tudo isso aparece como "a fazer", e os portões V e F conferem de verdade.
- **Telas de terceiros mudam** (Supabase, Google, Cloudflare, Mercado Pago, Resend). Se um passo não bater com a tela, siga a documentação oficial e corrija esta fila no mesmo commit.
- **Sandbox do Mercado Pago.** Se ele não aprovar Pix ou assinatura de teste, a prova vem do F3 e do F4, com dinheiro real e estorno.
- **Backup do schema `auth`.** A restauração do F8 é a única prova de que o dump do Supabase volta inteiro.

## Anexo D: comandos

### D1. Google Cloud

Rode no Cloud Shell (console do Google Cloud, ícone `>_`). Ajuste `PROJECT_ID` e `BILLING_ACCOUNT` antes.

```bash
PROJECT_ID=querorevisar                  # se o ID já existir, escolha outro
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX      # Billing → Account management
REGION=southamerica-east1
REPO=manosanti/querorevisar-frontend

gcloud projects create "$PROJECT_ID" --name="QueroRevisar"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  cloudscheduler.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
gcloud artifacts repositories create querorevisar --repository-format=docker --location="$REGION"

for sa in qr-deploy qr-api-runtime qr-scheduler; do gcloud iam service-accounts create "$sa"; done
DEPLOY="qr-deploy@$PROJECT_ID.iam.gserviceaccount.com"
RUNTIME="qr-api-runtime@$PROJECT_ID.iam.gserviceaccount.com"
SCHEDULER="qr-scheduler@$PROJECT_ID.iam.gserviceaccount.com"

# O GitHub Actions publica a imagem, faz o deploy e cria os jobs do Scheduler.
for role in roles/run.admin roles/artifactregistry.writer roles/cloudscheduler.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY" --role="$role" --condition=None
done
for sa in "$RUNTIME" "$SCHEDULER"; do
  gcloud iam service-accounts add-iam-policy-binding "$sa" --member="serviceAccount:$DEPLOY" --role=roles/iam.serviceAccountUser
done
# A API lê os segredos.
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME" \
  --role=roles/secretmanager.secretAccessor --condition=None

# Workload Identity Federation: só este repositório assume a conta de deploy (sem chave JSON).
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# Valores para o Anexo B
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"
echo "PROD_API_URL=https://qr-api-$PROJECT_NUMBER.$REGION.run.app"
echo "DEV_API_URL=https://qr-api-dev-$PROJECT_NUMBER.$REGION.run.app"

# Conferência: 7 APIs, o repositório, as 3 contas e o provedor ACTIVE
gcloud services list --enabled --format='value(config.name)' \
  | grep -E '^(run|artifactregistry|secretmanager|cloudscheduler|iam|iamcredentials|sts)\.googleapis\.com$'
gcloud artifacts repositories list --location="$REGION"
gcloud iam service-accounts list --format='value(email)' | grep qr-
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github --format='value(state)'
```

### D2. Cloudflare

```bash
npx wrangler login
npx wrangler pages project create querorevisar-app --production-branch=production
npx wrangler pages project create querorevisar-site --production-branch=production
npx wrangler r2 bucket create querorevisar-backups
```

### D3. Chave do backup

```bash
age-keygen -o querorevisar-backup.key    # no Windows: winget install FiloSottile.age
```

### D4. Disparar os jobs no dev

Gere o valor de `qr-dev-internal-token` com `openssl rand -base64 32` (Git Bash). Depois do C4:

```bash
TOKEN='<valor de qr-dev-internal-token>'
API='<DEV_API_URL>'
curl -fsS -X POST -H "X-Internal-Token: $TOKEN" "$API/internal/jobs/daily"
curl -fsS -X POST -H "X-Internal-Token: $TOKEN" "$API/internal/jobs/send-alerts"
```

### D5. Segredos no Secret Manager

Prefira o console (Security → Secret Manager → Create secret), que não deixa o valor no histórico do terminal. Pelo Cloud Shell:

```bash
printf '%s' '<valor>' | gcloud secrets create qr-prod-database-url --data-file=-
printf '%s' '<novo valor>' | gcloud secrets versions add qr-prod-database-url --data-file=-   # trocar depois
gcloud secrets list --format='value(name)'
```
