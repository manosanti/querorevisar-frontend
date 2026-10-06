# apps/api — API do QueroRevisar

Kotlin 2.3 + Spring Boot 4.1 (JVM 21, virtual threads), PostgreSQL (Supabase em dev/prod), Flyway, springdoc.
O contrato é `packages/api-client/openapi.yaml`; a API gera o mesmo documento em `/v3/api-docs` (profiles `local` e `dev`).

## Rodar localmente (sem Docker)

Da raiz do repositório, com JDK 21 (`JAVA_HOME`):

```bash
./gradlew :apps:api:localDb      # terminal 1: Postgres embutido em 127.0.0.1:54322 (dados em .local/pg), Ctrl+C para parar
./gradlew :apps:api:bootRun      # terminal 2: API em http://localhost:8080 com o profile local
```

Com todos os segredos em `<SEM_TOKEN>` tudo funciona em modo mock: login de desenvolvimento (`/dev/auth/*`),
pagamentos aprovados localmente, consulta de placa determinística, push e e-mail só em log
(e-mails renderizados em `apps/api/build/mail-outbox/`). A FIPE usa a API pública da Parallelum (sem token).

Outros comandos:

```bash
./gradlew :apps:api:check              # testes unitários + integração (Testcontainers com Docker, Postgres embutido sem)
./gradlew :apps:api:localDbStop        # para um Postgres embutido que ficou rodando (terminal fechado à força)
./gradlew :apps:api:createPremiumPlan  # cria o plano Premium no Mercado Pago (no modo mock só imprime as instruções)
node packages/api-client/scripts/compare-contract.ts apps/api/build/openapi.json   # contrato x API (o check gera o arquivo)
```

Swagger UI: http://localhost:8080/swagger-ui.html (local e dev). Jobs internos no local, sem `INTERNAL_TOKEN`:
`curl -X POST http://localhost:8080/internal/jobs/daily` (aceito só de 127.0.0.1).

Fluxo de login local (o mesmo que a web usa com `AUTH_MODE=dev`):

```bash
curl -s -X POST localhost:8080/dev/auth/anonymous            # { accessToken, expiresAt, user }
curl -s localhost:8080/v1/me -H "Authorization: Bearer <accessToken>"
```

## Profiles e modos

| Profile | Uso | Auth padrão | springdoc |
| --- | --- | --- | --- |
| `local` | `bootRun`, `pnpm dev:all` | `AUTH_MODE=dev` (tokens da própria API) e stub `auth.users` | sim |
| `dev` | Cloud Run `qr-api-dev` | Supabase (JWKS ES256/RS256; HS256 se `SUPABASE_JWT_SECRET`) | sim |
| `prod` | Cloud Run `qr-api` | Supabase | não |

O jar não tem profile padrão: sem `SPRING_PROFILES_ACTIVE` a aplicação não sobe. `AUTH_MODE=dev` fora do profile
`local` também derruba a inicialização.

| Variável | Valores | Mock quando |
| --- | --- | --- |
| `PAYMENTS_MODE` | mock, sandbox, live | `mock` ou `MP_ACCESS_TOKEN=<SEM_TOKEN>` (em `prod` o mock nunca aprova sozinho) |
| `FIPE_MODE` | live, mock | só testes usam `mock` |
| `VEHICLE_DATA_MODE` | mock, live | `mock` ou chave/URL do provedor ausentes |
| `PUSH_MODE` | log, live | `log` ou chaves VAPID ausentes |
| `EMAIL_MODE` | log, live | `log` ou `RESEND_API_KEY` ausente |
| `POSTHOG_KEY` | chave | ausente: flags padrão |

### Variáveis além de `env/api.env.example`

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `AUTH_MODE` | `supabase` (`dev` no profile local) | `dev` emite tokens locais em `/dev/auth/*` |
| `DEV_AUTH_SECRET` | vazio | segredo HS256 dos tokens dev; vazio gera um em `apps/api/build/dev-auth-secret` |
| `DB_AUTH_STUB` | `false` (`true` no local) | aplica `db/auth-stub` (tabela `auth.users`) em Postgres sem Supabase |
| `INTERNAL_JOBS_SERVICE_ACCOUNT` | vazio | opcional: e-mail da service account do Cloud Scheduler exigido no token OIDC |
| `LOG_FORMAT` | `ecs` (vazio no local) | formato dos logs estruturados (`ecs`, `logstash`, `gelf`; vazio = texto) |
| `MAIL_OUTBOX_DIR` | `build/mail-outbox` | pasta dos e-mails no `EMAIL_MODE=log` |

`DATABASE_URL`/`DATABASE_DIRECT_URL` usam o formato do `.env` (`postgresql://user:senha@host:porta/db`) e são
convertidos para JDBC; na porta 6543 (pooler do Supabase em transaction mode) a API adiciona `prepareThreshold=0`.
Flyway usa `DATABASE_DIRECT_URL` quando ele é diferente de `DATABASE_URL`.

## Estrutura

Pacotes por domínio em `src/main/kotlin/br/com/querorevisar/api/`:

- `domain/` regras puras portadas de `packages/core` (`DueCalculator`, `KmRules`, `CatalogMerge`, `CreditPricing`,
  `Lookups`, `Plates`, `PtBr`), testadas com as mesmas `fixtures/*.json` da versão TypeScript.
- `auth/` resource server (Supabase JWKS + HS256), tokens e endpoints dev, filtro de `/internal/**`, `CurrentUser`.
- `common/` problem details (RFC 9457), Idempotency-Key, rate limit (Bucket4j), request id, ETag, springdoc alinhado ao contrato.
- `account/` `/v1/me`, flags (PostHog), exportação e exclusão (LGPD). `vehicles/`, `records/`, `catalog/`, `sync/`.
- `billing/` Mercado Pago (RestClient, sem SDK), webhook com x-signature, mock. `credits/`, `lookups/`, `fipe/`.
- `push/` Web Push (VAPID), `mail/` templates pt-BR, `alerts/` cálculo e envio, `internal/` jobs do Cloud Scheduler.
- `src/localdb/` (source set separado, nunca vai para o jar): Postgres embutido do `localDb`.

Banco: `db/migration/V1__init.sql` é `docs/db.sql`; `V2__api_support.sql` acrescenta o que a API precisa
(`sync_mutations`, `fipe_usage`, colunas de QR/checkout, RLS em todas as tabelas públicas e `security_invoker` na view
`credit_balances`). O catálogo e os planos de fabricante (`data/*.json`, copiados para `seed/` no build) são gravados
por um `ApplicationRunner` idempotente.

## Decisões de implementação

- **Spring Boot 4** (Jackson 3, Spring Security 7, springdoc 3) no lugar do 3.x — ver `CLAUDE.md`.
- **Acesso a dados com `JdbcClient`** (SQL explícito). O starter `data-jpa` continua no build, mas não há entidades:
  locks (`select ... for update`), upserts idempotentes (`on conflict`), jsonb e arrays ficam explícitos e a imagem
  nativa não depende de reflexão do Hibernate.
- O documento do springdoc é ajustado (`OpenApiConfig`) para bater com o contrato: `required` vem dos parâmetros
  Kotlin sem valor padrão e a nulidade do tipo Kotlin (exceto `@NotNull`/`@NotBlank`/`@NonNullWhenPresent`).
- PATCH distingue campo ausente de `null` (`PatchRequest`).
- Sync: cursor opaco = mudança mais recente do usuário; o pull reenvia uma janela de 10 s antes do cursor (transações
  concorrentes) e o push aplica cada mutação na sua transação, idempotente por id (`sync_mutations`), com
  last-write-wins pelo `updated_at` do servidor (tolerância de 2 min de relógio; mudanças do mesmo lote nunca conflitam).
- Chamadas externas: conexão 3 s, leitura 10 s (15 s no provedor de consulta veicular), HTTP/1.1.
- Logs JSON (ECS) com `requestId` e `userId` (UUID, pseudônimo); e-mails, placas (ABC1***) e tokens nunca vão para o log.
- `processAot` roda antes do `bootRun` por causa do plugin GraalVM (imagem nativa não é gerada aqui).
