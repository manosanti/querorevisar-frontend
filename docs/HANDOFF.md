# Handoff: QueroRevisar (plano completo de desenvolvimento)

## Visão geral

Controle de manutenção de carro e moto para quem cuida do próprio veículo. A pessoa registra as trocas, o app estima a km e avisa quando cada item está perto de vencer. A receita vem do Premium (assinatura), de créditos para consultas veiculares por placa e de anúncio nativo no plano grátis.

Este pacote contém tudo para o Claude Code construir o produto: plano em fases (`PLAN.json`), regras para o agente (`CLAUDE.md`), regras de negócio, design system, telas, contrato da API, schema do banco, integrações (Mercado Pago, FIPE, consulta veicular), variáveis de ambiente e a lista do que só o dono pode fornecer.

## Sobre os arquivos de design

Os arquivos em `reference/` são **protótipos em HTML** que mostram o visual e o comportamento esperados. Não são código de produção para copiar. A tarefa é **recriar essas telas** na stack definida em `PLAN.json` (React + Vite + TypeScript no front, Kotlin + Spring Boot na API).

Para abrir o protótipo: abra `reference/QueroRevisar v7 responsivo.dc.html` num navegador a partir da própria pasta `reference/`. Redimensione a janela para ver mobile (<768px), tablet (768–1099px) e desktop (≥1100px).

## Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamentos, textos e interações são finais. Recriar com precisão de pixel usando os tokens de `docs/design-system.md`.

## Como usar com o Claude Code

1. Crie um repositório vazio e copie este pacote inteiro para dentro de `docs/handoff/` (ou para a raiz).
2. Copie `CLAUDE.md` para a raiz do repositório.
3. Peça ao Claude Code: "Leia CLAUDE.md e PLAN.json e execute a fase F01." Siga fase por fase.
4. Preencha os segredos de `PENDENCIAS.md` quando puder. Até lá tudo roda em modo mock.

## Conteúdo

- `PLAN.json`: plano completo, 15 fases (F00 a F14), com passos e critérios de aceite
- `CLAUDE.md`: regras para o agente
- `PENDENCIAS.md`: segredos e decisões que dependem do dono
- `env/`: `.env.example` da API, da web e da landing
- `docs/domain.md`: regras de negócio (vencimento, km, planos, créditos, consultas, FIPE)
- `docs/design-system.md`: tokens e componentes
- `docs/screens.md`: telas, layout responsivo, estados e textos
- `docs/api.md`: endpoints
- `docs/db.sql`: schema Postgres
- `docs/mercadopago.md`: assinatura, Pix, cartão e webhook
- `docs/vehicle-data.md`: FIPE e provedor de consulta veicular
- `reference/`: protótipos HTML, catálogo, planos de fabricante, marca e documentos de estratégia e arquitetura

## Decisões que mudaram desde os documentos de estratégia

- Pagamentos: **Mercado Pago** no lugar do Asaas citado na Arquitetura v2.
- Plataforma: **só web + PWA** (sem app de loja), como na Arquitetura v2.
