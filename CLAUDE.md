# Instruções para o Claude Code — QueroRevisar

Você vai construir o QueroRevisar do zero seguindo `docs/PLAN.json`. Leia este arquivo inteiro antes de começar.

## Ordem de leitura

1. `docs/PLAN.json`: fases, tarefas, critérios de aceite. Execute na ordem.
2. `docs/domain.md`: regras de negócio. Não invente regra que não esteja lá.
3. `docs/design-system.md` e `docs/screens.md`: visual e comportamento.
4. `docs/api.md` e `docs/db.sql`: contrato e banco.
5. `docs/mercadopago.md` e `docs/vehicle-data.md`: integrações externas.
6. `docs/reference/QueroRevisar v7 responsivo.dc.html`: protótipo navegável. Abra no navegador (precisa de `support.js`, `catalog.js`, `planos.js` e `brand/` na mesma pasta). **É a fonte da verdade visual e de textos.** Em caso de conflito entre um documento e o protótipo, o protótipo vence no visual e nos textos; os documentos vencem em arquitetura e segurança.

## Regras inegociáveis

- **Segredos:** nunca escreva um token, chave ou senha real no código ou em arquivo versionado. Use `<SEM_TOKEN>` nos `.env.example`. Se precisar de um segredo que não existe, crie a integração em modo mock (ver `modos_execucao` no PLAN.json) e anote em `PENDENCIAS.md`.
- **Nada quebra sem token:** com todas as variáveis em `<SEM_TOKEN>`, `pnpm dev:all` precisa subir e o app precisa funcionar ponta a ponta em modo mock.
- **O cliente só fala com a API Kotlin.** O `supabase-js` no front serve apenas para autenticação. Nenhuma tabela é lida ou escrita pelo front direto no Supabase.
- **Regra de vencimento em duas linguagens:** `packages/core` (TS) e `apps/api` (Kotlin) passam pelas mesmas `fixtures/due-status.json`. Mudou a regra, mude as fixtures (`node scripts/gen-fixtures.ts`) e as duas implementações no mesmo commit.
- **Textos:** use exatamente os textos do protótipo (pt-BR). Não reescreva copy.
- **Cores e medidas:** só pelos tokens de `packages/tokens`. Nenhum hex solto em componente (`pnpm check:colors` falha se houver).
- **Visual:** nunca usar o design system "Classical" (serifadas, dourado, estilo editorial). Não aplicar mudanças visuais amplas sem confirmar a direção com o dono.
- **Dinheiro em centavos** no banco e na API. Formatação só na borda (UI).
- **Idempotência:** toda escrita do usuário e todo webhook são idempotentes.
- **LGPD:** não logar e-mail, placa completa nem tokens. Não mandar PII para PostHog ou Sentry.

## Como trabalhar

- Uma tarefa do PLAN.json por vez. Ao terminar: rodar lint, typecheck e testes; conferir os critérios de aceite; commit `feat(F06.2): ...`.
- Se uma tarefa depender de decisão do dono, implemente a opção marcada em `decisoes` do PLAN.json. Se não houver, implemente o mínimo atrás de feature flag e registre em `PENDENCIAS.md`.
- Ao instalar dependências, use a versão estável mais recente e deixe o lockfile registrar. Não fixe versões de memória.
- Antes de usar uma API externa, confira a documentação oficial atual (os links estão nos docs). Se algo mudou em relação ao que está escrito aqui, siga a documentação oficial e atualize o doc correspondente.
- Ao escrever arquivos, escapes Unicode (`\u0300`, `\u00a0`) precisam chegar ao arquivo como texto; confira com `grep` depois de gravar.

## Desvios do plano (decididos na implementação)

- **Spring Boot 4.x** no lugar do 3.x da decisão D05: o suporte gratuito da linha 3.x terminou em junho de 2026 e o Spring Initializr só gera 4.x.
- **Ambiente local sem Docker:** quando o Docker não está disponível, `pnpm dev:all` sobe um Postgres embutido na porta 54322 (mesma do Supabase local) e a API emite tokens de desenvolvimento (`AUTH_MODE=dev`, só no profile `local`). Com Docker, o caminho do plano (Supabase CLI) continua valendo.
- Testes da API usam Testcontainers quando há Docker e Postgres embutido (zonky) quando não há.

## Comandos esperados (depois da F01)

```
pnpm install
pnpm dev:all          # banco local (Supabase CLI ou Postgres embutido) + api + web
pnpm test             # vitest em todos os pacotes
./gradlew :apps:api:check
pnpm e2e              # playwright
pnpm api:gen          # regenera packages/api-client a partir da API local
```
