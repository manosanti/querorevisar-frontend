# QueroRevisar

Controle de manutenção de carro e moto: a pessoa registra as trocas, o app estima a km e avisa quando cada item está perto de vencer. Web app responsivo instalável (PWA), API em Kotlin, Postgres no Supabase, pagamentos pelo Mercado Pago.

O plano completo está em [`docs/PLAN.json`](docs/PLAN.json) e as regras para quem desenvolve em [`CLAUDE.md`](CLAUDE.md). O que depende do dono do projeto (segredos, domínio, preços) está em [`PENDENCIAS.md`](PENDENCIAS.md).

## Rodar tudo em 3 comandos

```bash
corepack enable          # usa o pnpm fixado no package.json
pnpm install
pnpm dev:all             # banco + API (:8080) + web (:5173)
```

Pré-requisitos: Node 22+ e JDK 21 (`JAVA_HOME`, ou um JDK em `~/.jdks`). O `dev:all` escolhe o banco sozinho:

| Docker disponível | Banco e login                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Sim               | Supabase CLI (`infra/supabase`): Postgres + Auth reais, login anônimo e por e-mail                                            |
| Não               | Postgres embutido na porta 54322 e login de desenvolvimento emitido pela própria API (`AUTH_MODE=dev`, só no profile `local`) |

Com todos os segredos em `<SEM_TOKEN>` o app funciona de ponta a ponta em modo mock: pagamentos aprovam sozinhos (Pix em 3 s, Premium e cartão na página `/mock/checkout`), a consulta por placa usa dados determinísticos, push e e-mail vão para o log. A FIPE usa a API pública da Parallelum (sem token, com limite diário).

## Comandos

| Comando                        | O que faz                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `pnpm dev:all`                 | Banco local + API + web (`--landing` sobe a landing também; `--embedded` força o Postgres embutido) |
| `pnpm dev`                     | Só os apps TypeScript (turbo)                                                                       |
| `pnpm test`                    | Vitest em todos os pacotes                                                                          |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript em todos os pacotes                                                             |
| `pnpm check:colors`            | Falha se houver cor fora de `packages/tokens`                                                       |
| `./gradlew :apps:api:check`    | Testes da API (Testcontainers com Docker, Postgres embutido sem)                                    |
| `pnpm e2e`                     | Playwright (precisa do `dev:all` rodando)                                                           |
| `pnpm api:gen`                 | Lê o OpenAPI da API local, confere com o contrato e regenera `packages/api-client`                  |
| `pnpm fixtures:gen`            | Regenera `fixtures/*.json` a partir da lógica de referência do protótipo                            |
| `pnpm data:convert`            | Converte `docs/reference/catalog.js` e `planos.js` em `data/*.json`                                 |
| `pnpm brand:gen`               | Gera WebP otimizados e os ícones do PWA a partir de `docs/reference/brand`                          |

## Estrutura

```
apps/web/            React + Vite + TanStack Router/Query, PWA (app logado e onboarding)
apps/landing/        Astro, site público
apps/api/            Kotlin + Spring Boot (Gradle)
packages/api-client/ contrato OpenAPI (openapi.yaml) + cliente gerado pelo orval (hooks + Zod)
packages/core/       regras puras: vencimento, km estimada, catálogo, preços, placa
packages/tokens/     tokens do design system (TS → CSS variables + tema Tailwind v4)
packages/ui/         componentes React do design system
packages/config/     tsconfig, ESLint e Prettier compartilhados
fixtures/            casos de teste lidos pelo TypeScript e pelo Kotlin
data/                catalog.json e planos.json (seed)
infra/               Supabase local, docker-compose, scripts de desenvolvimento
docs/                plano, regras de negócio, design system, telas, API, banco e protótipos
```

## Como o app fala com a API

- O front só conversa com a API Kotlin; o `supabase-js` serve apenas para login.
- O estado do usuário vem de `GET /v1/sync` e fica em cache no IndexedDB. Toda escrita (veículo, troca, km) é aplicada na hora na tela e entra numa fila offline, enviada em lote para `POST /v1/sync` assim que houver rede.
- Toda resposta da API passa pela validação Zod gerada a partir do contrato.
- A regra de vencimento existe em TypeScript (`packages/core`) e em Kotlin (`apps/api`), e as duas passam pelas mesmas `fixtures/due-status.json`.
