# Design system

Tudo extraído de `reference/QueroRevisar v7 responsivo.dc.html`. Implementar em `packages/tokens` (CSS variables + TS) e `packages/ui`.

## Tipografia

- Família: **Figtree** (Google Fonts) 400, 500, 600, 700. Fallback `-apple-system, sans-serif`.
- Corpo: 15px / 1.43, peso 500, cor `--ink`.
- `-webkit-font-smoothing: antialiased`. Números com `font-variant-numeric: tabular-nums` em km, valores, contadores.

| Token      | Tamanho   | Peso    | Tracking          | Uso                                                       |
| ---------- | --------- | ------- | ----------------- | --------------------------------------------------------- |
| display    | 30px      | 700     | -0.03em           | km no card do veículo, título do onboarding               |
| title      | 28px      | 700     | -0.01em a -0.02em | título de tela (Itens, Histórico, Conta, Consultar placa) |
| title-sm   | 26px      | 700     | -0.02em           | modelo no resultado da consulta                           |
| section    | 22px      | 600     | -0.02em           | "Precisa de atenção", "Veículos", "Planos"                |
| vehicle    | 22px      | 700     | -0.02em           | modelo no card                                            |
| card-title | 17–18px   | 600–700 | -0.02em           | títulos de card e sheet                                   |
| body-lg    | 15.5–16px | 500–600 | 0                 | nome de item, botões                                      |
| body       | 14–14.5px | 500     | 0                 | descrições                                                |
| small      | 13–13.5px | 500     | 0                 | linhas de apoio                                           |
| caption    | 12–12.5px | 500–600 | 0                 | rótulos, badges                                           |
| overline   | 11.5px    | 600–700 | .04em, uppercase  | "Publicidade", "Patrocinado"                              |

## Cores

| Token            | Valor           | Uso                                                 |
| ---------------- | --------------- | --------------------------------------------------- |
| --primary        | #0e5a66         | botões, links, foco, abas ativas, barra "em dia"    |
| --primary-strong | #0a434c         | hover de link, texto sobre --primary-tint           |
| --band           | #125865         | faixa do topo do painel, theme_color do PWA         |
| --primary-tint   | #e7f0f1         | fundos teal claros, avatar, aba ativa da lateral    |
| --ink            | #222222         | texto principal                                     |
| --ink-2          | #555555         | texto secundário forte                              |
| --muted          | #6a6a6a         | texto de apoio                                      |
| --subtle         | #929292         | rótulos de tabela, abas inativas                    |
| --border         | #dddddd         | bordas e divisórias de lista                        |
| --divider        | #ececec         | divisória interna do card do veículo, skeleton      |
| --surface-1      | #f7f7f7         | inputs de login, cartão do usuário na lateral       |
| --surface-2      | #f4f4f4         | tiles "em dia", caixas informativas                 |
| --surface-3      | #f2f2f2         | botão voltar redondo, chip de ícone, segmented      |
| --track          | #f0f0f0         | trilho de barra de progresso                        |
| --page           | #ebeceb         | fundo fora do app no mobile e atrás de telas cheias |
| --white          | #ffffff         | superfícies                                         |
| --over-fg        | #c13515         | número/selo vencido, texto de erro, "Sair"          |
| --over-bg        | #fdf1f0         | fundo vencido                                       |
| --over-bar       | #c8372d         | barra vencido                                       |
| --over-label     | #8a1c16         | rótulo "vencido" no tile                            |
| --warn-fg        | #9a5b00         | selo atenção                                        |
| --warn-bg        | #fdf5e7         | fundo atenção                                       |
| --warn-bar       | #d9890a         | barra atenção                                       |
| --warn-label     | #7a4800         | rótulo "em atenção"                                 |
| --none-fg        | #929292         | sem registro                                        |
| --scrim          | rgba(0,0,0,.45) | fundo de sheet                                      |
| --scrim-panel    | rgba(0,0,0,.35) | fundo do painel lateral (≥768px)                    |
| --ad-border      | #c1c1c1         | borda tracejada do slot de anúncio                  |

Toast: fundo `--ink` (sucesso) ou `--over-fg` (erro), texto branco.

## Raios

4 (barra de progresso), 6 (placa pequena), 8 (botão primário, inputs), 9–10 (segmented, nav), 12 (botões secundários, ícone de ação), 14 (tiles, cards de lista, radio cards), 16 (avisos), 18 (cards de plano), 20 (cards principais, sheets no topo, pills), 24 (faixa do painel no desktop), 50% (avatar, botões redondos). Faixa do painel no mobile: `0 0 0 40px`.

## Sombras

- card-vehicle: `rgba(0,0,0,.04) 0 0 0 1px, rgba(14,90,102,.10) 0 6px 14px 0, rgba(0,0,0,.08) 0 12px 28px -8px`
- dropdown / card destacado: `rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px 0, rgba(0,0,0,.1) 0 4px 8px 0`
- segmented-selected: `rgba(0,0,0,.08) 0 1px 4px`
- shell-mobile: `0 0 40px rgba(0,0,0,.06)`
- side-panel: `0 0 40px rgba(0,0,0,.14)`

## Alturas

Botão primário 48px (50px no CTA de consulta e compra); botões médios 44px; pequenos 40–42px; input de busca 52px; inputs do onboarding 50px; input de placa 64px (28px/700, letter-spacing .14em, borda 2px --ink, raio 10); chips 36–38px; abas embaixo 74px; alvo mínimo 44px.

## Espaçamento

Padding lateral de tela 22px (mobile). Gaps usados: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32. Painel desktop: padding 28px 36px 40px, gap 18px vertical e 32px entre colunas.

## Interações

- **Active:** `transform: scale(0.96)` (0.98 em linhas grandes).
- **Foco:** `outline: 2px solid --primary; outline-offset: 2px` em botões; inputs com borda --primary + `box-shadow: 0 0 0 1px --primary`.
- **Hover "água"** (botões outline e chips, só em dispositivos com hover): um círculo `--primary` sobe de baixo (`top: 115% → -70%`, 0.7s `cubic-bezier(.3,.7,.25,1)`) e o texto vira branco em .4s. Variante clara (`[data-water="light"]`) sobe branco e o texto vira `--band`. CSS de referência no `<helmet>` do protótipo.
- **Barra de rota:** 3px no topo, trilho --primary-tint, segmento --primary com animação `qrbar` 1.1s.
- **Skeleton:** blocos #ececec com `qrsk` 1.3s (opacidade 1 → .45 → 1).
- **Pull to refresh** no painel (mobile): spinner circular branco sobre a faixa.
- **Contagem da km** ao abrir o painel: 0 → valor em 1.3s, ease-out quártico.
- **Spinner** de botão: 18px, borda 2.5px branca 35%, topo branco, `qrspin` .8s.

## Componentes {#componentes}

Button (primary, outline, ghost, text, danger-text, icon-round 40/42/52), Input, Select (ver `reference/QR Select.dc.html`), DatePicker (ver `reference/QR DatePicker.dc.html`), FilterPill (borda 2px --primary quando ativo, peso 600), StatusBadge (none/ok/warn/over), ProgressBar (4px lista, 6px tabela/detalhe), StatTile (vencido/atenção/em dia), Card, VehicleCard, GarageSwitcher (pills 48px com ícone do carro/moto), Sheet, SidePanel, Toast (topo, centralizado, até 448px), Skeleton, Segmented, RadioCard (dot: borda 2px #c1c1c1; selecionado 6px --primary), PlateInput, PlateTag (borda 1.5–2px --ink, letter-spacing .08–.12em), EmptyState, AdSlot, SideNav (completa 248px e trilho 88px), BottomTabs.

## Assets

`reference/brand/`: `icone.png` (ícone do app), `logo-horizontal.png` (lateral desktop), `logo-header-petroleo.png` (faixa do painel), `logo-branca-fundo-petroleo.png`, `logo-preta.png`, `icone-carro.png`, `icone-moto.png`. Ícones de interface: paths SVG 24×24, traço 1.8–2.4, `stroke-linecap/linejoin: round` (ver TAB_ICONS e catálogo).
