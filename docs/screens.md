# Telas e comportamento

Referência navegável: `reference/QueroRevisar v7 responsivo.dc.html`. Textos devem ser copiados de lá. Abaixo, estrutura, layout e regras que o código precisa seguir.

## Breakpoints {#shell}

| Faixa               | Navegação                                                                                                                                                                  | Conteúdo                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| < 768px (mobile)    | abas fixas embaixo (74px): Painel, Itens, Histórico, Conta. Botão "Registrar troca" fixo acima das abas no Painel                                                          | coluna única, largura máx. 480px centralizada sobre fundo --page |
| 768–1099px (tablet) | trilho lateral de 88px: ícone do app, botão redondo "+" (Registrar troca), abas com ícone e rótulo de 11.5px, "Consultas"                                                  | coluna até 780px centralizada                                    |
| ≥ 1100px (desktop)  | barra lateral de 248px: logo horizontal, botão "Registrar troca", abas com ícone e rótulo, "Consultar placa", rodapé com avatar, nome (ou "Conta"), "Plano X · N créditos" | até 1200px centralizado                                          |

Item ativo da navegação lateral: fundo --primary-tint e texto --primary. A lateral é `position: sticky; top: 0; height: 100vh` com borda direita --border.

Detalhe do item, Consultas e todos os sheets: no mobile, tela cheia ou bottom sheet; a partir de 768px, **painel à direita de 480px de largura e altura total**, com fundo --scrim-panel sobre o conteúdo e sombra side-panel.

## Onboarding

Boas-vindas → formulário "Qual é o seu veículo?": tipo (carro/moto), marca, modelo, ano, km atual. Aviso do plano do fabricante quando existir. Conteúdo até 560px centralizado em telas grandes. Substituir veículo mostra o aviso "Este veículo vai substituir o {modelo}…".

## Painel {#painel}

Blocos e ordem no mobile e tablet: faixa + card do veículo → contadores → aviso "Salve seus registros" → Precisa de atenção → Consultar uma placa → Sem registro.

- **Faixa** (--band): logo e avatar (só mobile), seletor de veículos em pills e botão "+" redondo com borda branca. Mobile: sangra até as bordas, raio `0 0 0 40px`, padding `4px 22px 84px`. Tablet/desktop: raio `24px 24px 24px 40px`, padding `20px 22px 84px`.
- **Card do veículo** (branco, raio 20, sombra card-vehicle, sobe −84px sobre a faixa):
  - Mobile/tablet (padding 18px, empilhado): modelo (22/700) + "marca · ano" + ícone do veículo 88px à direita; "Km estimada" + km (30/700) + botão "…" (gerenciar) + "Atualizar km"; divisória e linha FIPE (rótulo "Tabela FIPE · atualizada há N dias", valor 18/700, selo de variação).
  - Desktop: **uma linha**, grid de 3 colunas `1.1fr 1.2fr 1fr`, gap 24, alinhado ao centro, padding `36px 32px`, altura mínima 200px. Colunas 2 e 3 com borda esquerda --divider e padding-left 24.
- **Contadores:** três tiles (vencido, em atenção, em dia) que levam para Itens já filtrado.
- **Precisa de atenção:** lista com nome, linha de status, selo e barra de progresso 4px. Vazio: "Nada vencendo. Registre as trocas que você já fez para o app acompanhar."
- **Consultar uma placa** (fundo --primary-tint, raio 20): título, texto, pill de saldo de créditos (abre compra), botões "Consultar placa" e "Conferir o meu {modelo}".
- **Sem registro:** chips "+ {item}".
- **Desktop:** linha 1 com faixa + card ocupando as duas colunas; linha 2 com duas colunas (`1fr 1.15fr`): esquerda contadores, aviso e consultar placa; direita Precisa de atenção e Sem registro.

## Itens

Título, busca "Buscar item", filtros (Todos, Precisa de atenção, Em dia, Sem registro), grupos por categoria que abrem e fecham (abertos automaticamente quando há busca ou filtro). Slot de anúncio in-feed no plano grátis.

- Mobile: linha com nome, linha de status embaixo, selo à direita.
- ≥768px: **tabela** dentro de cada grupo, colunas `1.1fr 1.5fr 120px 104px`: Item | Situação | Progresso (barra 6px) | Status (selo alinhado à direita), com cabeçalho em caixa alta 12px --subtle.

## Detalhe do item

Selo de status, nome (28/700), descrição, card com km grande, barra 6px e "Trocado em X km / Vence em Y km", ou caixa "Ainda sem registro…". Lista Intervalo, Fonte, Última troca. Botões "Registrar troca" e "Ver peças compatíveis" (flag `parts_marketplace`).

## Histórico

Título + botão "Registrar troca", seletor de veículo (dropdown com "Todos os veículos" quando houver mais de um e "Adicionar veículo"), busca "Buscar troca, peça ou marca", filtros (Todas, Em casa, No mecânico, Com custo), tiles "Trocas registradas" e "Gasto informado". Plano grátis: aviso "O plano grátis mostra os últimos 12 meses. O histórico completo está no Premium."

- Mobile: lista (ícone do veículo quando "Todos"), nome, "data · onde · marca", km e custo à direita.
- ≥768px: **tabela** `minmax(96px,.8fr) 1.6fr minmax(84px,.7fr) 1fr minmax(84px,.7fr) minmax(84px,.7fr)`: Data | Item (+ veículo quando "Todos") | Onde | Marca | Km | Custo. Valores ausentes como "—".

## Conta

Estado sem login (card "Você está usando sem conta" + "Criar conta") ou perfil (avatar, nome, e-mail · Plano, "Sair"). Veículos (ativo, "Ver", gerenciar, "Adicionar veículo"), Veículos anteriores (Restaurar), **Consultas veiculares** (saldo, "Comprar", "Consultar"), Planos (Grátis e Premium com benefícios e botão), slot 300×250 no plano grátis.

## Login

Tela cheia: ícone, "QueroRevisar", subtítulo, Nome (cadastro), E-mail, Senha com "Mostrar", botão principal, "Esqueceu a senha?", divisor "OU", "Continuar com Google", "Continuar com Apple" (flag), alternar entre entrar/criar conta, "Continuar sem conta", aceite de Termos e Política no cadastro.

## Consultas

- Formulário: voltar, pill de saldo "+", "Consultar placa", subtítulo "Digite a placa de qualquer veículo, o seu ou de outra pessoa.", segmented "Outro veículo | Meu {modelo}", PlateInput, "O que consultar" com RadioCards (nome, tag, descrição, preço em R$ e em créditos), aviso Premium no plano grátis, "Consultas anteriores" ("Abrir de novo não gasta crédito."). CTA fixo embaixo com spinner durante a consulta e linha de saldo.
- Resultado: placa grande, modelo + ano, "{produto} · {data}", resumo colorido, seções com linhas chave/valor ou selo, aviso legal, "Baixar laudo em PDF" (laudo) e "Nova consulta".

## Sheets

Registrar troca, Atualizar km ("Está certo" para confirmar a estimativa), Gerenciar veículo (vendido/trocado, substituir, excluir), Vendido, Excluir, Paywall (títulos "Mais de um veículo" ou "Use sem anúncios"), Sair, Peças compatíveis, **Comprar créditos** (pacotes em RadioCard, Pix | Cartão, "Pagar R$ X com Pix" / "no cartão"; ao escolher Pix, mostrar QR code, copia e cola e tempo de expiração; aprovado → toast "N créditos adicionados").

## Estados globais

- Carregamento: barra de rota no topo + skeleton da tela.
- Offline: indicador discreto; escritas vão para a fila.
- Erros de validação: toast vermelho com o texto exato.
- Nova versão do PWA: aviso com "Atualizar".
