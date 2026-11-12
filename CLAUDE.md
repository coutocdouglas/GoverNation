# GoverNation: guia para o Claude Code

Jogo de simulação política (governar o Brasil) para Windows, do Douglas (arquiteto, dono do projeto). Mecânicas inspiradas no jogo de referência planalto.fun. **Só a mecânica entra: nomes, textos, imagens e políticos reais do jogo de referência ficam de fora. Tudo no GoverNation é fictício.**

Versão atual: **v0.41.0**. Documentação técnica: `docs/DESIGN.md` (seção 27; 27.15 Fase A, 27.16 a 27.18 lote A2, 27.19 a 27.21 Etapa 5A, 27.22 e 27.23 Etapa 5B, 27.24 a 27.26 Etapa 5C, 27.27 redesenho visual, 27.28 telas da inteligência, 27.29 bloco 6.0, 27.30 bloco 6B, 27.31 bloco 6A, 27.32 e 27.33 bloco 6C, 27.34 bloco 6D, 27.35 bloco 6E parte 1, 27.36 bloco 6E parte 2, 27.37 bloco 6E parte 3, 27.38 bloco 6E parte 4, 27.39 bloco 6F dilemas). Plano da Etapa 5: `docs/projeto/plano-etapa-5.pdf`; o plano completo por etapas (`plano-de-desenvolvimento.md`) ficou no Cowork. Este arquivo traz o essencial.

## Como trabalhar com o Douglas
- Responder em português do Brasil.
- **Sempre avisar o nível de complexidade da tarefa e sugerir qual modelo é melhor para ela** (Haiku/Sonnet para ajustes e telas; Opus para regras que se cruzam e balanceamento; Fable ou Opus para motor central).
- O Douglas decide o que entra. Ideia fora de hora vai para a Caixa de ideias da etapa certa, não para o código.
- Ele prefere ideias que dão decisão e história ao jogador. Realidade bruta sem graça de jogar (orçamento anual detalhado, sessão de vetos, modo de realismo ajustável) fica de fora. Tudo deve ser divertido de jogar.

## Regras de desenvolvimento
O Douglas não programa: explicar em português simples, sem jargão.

**Combinados de trabalho**
- **Sempre pedir permissão antes de fazer qualquer mudança** (código, dados, documentos). Primeiro dizer o que pretende mudar e esperar o "sim" do Douglas.
- **Sempre dizer qual modelo é o melhor para cada etapa** e o nível de complexidade (ver a regra de modelos acima).
- Trabalhar **uma etapa por vez** e fechá-la antes de abrir outra. Cada etapa termina com: testes passando, partida jogada no navegador (`npx vite build && npx vite preview`), CHANGELOG e `docs/DESIGN.md` atualizados e versão nova publicada.

**Antes de mexer**
1. Ler `docs/ESTADO.md` (onde o projeto está e o próximo passo). **Atualizá-lo a cada mudança** (estado atual, próximo passo e uma linha no histórico).
2. Ler `docs/DESIGN.md` e `CHANGELOG.md`.
3. Rodar `npm ci`, `npm test`, `npx tsc -b`, `npx oxlint`.

**Regras do jogo que não podem quebrar**
- **Motor sem interface:** `src/game/` não importa nada de `src/ui/`. Todo número de balanceamento mora em `src/game/data/`.
- **Saves:** toda mudança no `GameState` sobe `saveVersion` e ganha migração em `src/game/save.ts`, com teste. Ninguém perde mandato ao atualizar.
- **Retratos:** um retrato por pessoa, nunca repetido (`src/game/data/cast.ts`, há teste). Personagem novo entra no `CAST`.
- **Personagens e partidos são fictícios.** Nada de nomes, marcas, textos ou imagens do jogo de referência.
- **Efeitos visíveis:** toda escolha mostra o custo antes; toda mudança de indicador ou grupo explica a causa.
- **Memória do mundo:** leis, decretos e decisões geram sementes e entradas de biografia; nada importante acontece sem ficar registrado.

**Publicar:** subir `version` em `package.json`, registrar no `CHANGELOG.md`, commit na `main`. O GitHub Actions gera o instalador e o jogo instalado se atualiza sozinho (`docs/RELEASES.md`).

**Quando abrir uma conversa nova (para poupar créditos):** ao fechar cada etapa (já publicada), ao trocar de assunto, depois de muitos prints ou arquivos grandes, com mais de umas 30 trocas ou quando o Claude esquecer combinados, e antes de uma etapa grande. Para começar: "Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md. Quero fazer a etapa X."

## Princípios do jogo
1. **Realidade na lógica, jogo no tempo e na apresentação.**
2. **Regras decidem, IA narra.** O resultado sai de regras balanceáveis; a IA escreve texto, desdobramentos, concessões e resumos.
3. **Causa e consequência é o motor central.** Toda ação marca reputação e a Ficha de governo, inclusive a medida impopular que não passou.
4. **Fatos do mês têm duas saídas: Agir ou Deixar passar.**
5. **Uma medida nova por rodada**, votada na hora (Câmara e, se passar, Senado).

## Testes que toda ideia nova precisa passar
- **Régua realidade × jogo:** o jogador entende por que aconteceu e consegue agir na próxima rodada?
- **Teste do mix:** (1) a instituição se comporta como na vida real? (2) a parte de jogo está só na decisão e na apresentação, sem mudar quem pode o quê?
- **Teste do atalho:** dá para ganhar aprovação, reputação ou poder sem entregar nada, repetindo ação barata ou somando bônus fácil? Se sim, precisa de custo que volta no tempo, retorno decrescente, teto ou exclusão.
- **Teste do beco sem saída:** toda mecânica que cobra um custo deixa uma saída (mostrar antes o que vai se perder; permitir renegociar, reforçar ou desistir).
- **Teste da sobrecarga:** poucas decisões novas por tela (1 ou 2); o resto aparece como "o que mudou". A agenda do presidente é o limitador comum.
- **Teste da interface (proposta de 05/11/2026):** mecânica nova entra com versão resumida na tela principal e o detalhe atrás de um clique.

## Definição de pronto
Testes passando · partida simulada sem erro · balanceamento revisado · efeitos ligados à memória do mundo · placeholders cadastrados · sem regressão · versão publicada · Caixa de ideias revisada · **partida completa jogada pelo Douglas (portão de playtest) ao fim de cada fase** · **todo texto escrito pela IA tem texto de reserva** (a tela nunca mostra falha da IA; o erro real vai para o registro, com o modelo ativo).

**Texto conforme a situação da medida:** todo fato ligado a uma medida sabe se ela está em vigor, na pauta ou barrada (`EventDef.pauta`, `EventDef.barrada`, `billStage`, `resolveEvent` em `src/game/events.ts`). Com a lei na pauta, o texto ameaça ou antecipa, não conta como feito.

## Mapa do código (o que já foi dito no plano)
- `src/game/congress.ts`, `deals.ts`, `rodada.ts`, `data/base.ts`: Câmara, acordos, fila da pauta, `ESFRIA`, `offerFor`, `dealBlockedReason`, `archiveStale`, `emendasMonths`.
- `src/game/causas.ts`: registro de causas (`registrarOrigemRisco`, `porque`); `bumpScandal` registra todo ponto de escândalo.
- `src/game/reserva.ts`: textos de reserva da IA (parecer do ministro, opinião sobre o fato, resumo da assessoria).
- `src/game/events.ts`: fatos do mês e desdobramentos.
- `assessoria.ts`, `data/assessoria.ts`, `data/rua.ts`: motor do post e da rua, sem tela até a Etapa 6.
- `SENADO.dealCarry` (35%): conversão do acordo da Câmara no Senado, valor ilustrativo a rebalancear.
- `src/game/risco.ts`, `data/risco.ts`: Etapa 5A (Elos, risco oculto, rastro do presidente, Controle do Estado, sementes de risco, contrato com escolha de empresa, proposta de setor). Telas da 5A: `src/ui/Elo.tsx`, `eloTexto.ts`, `IntegridadeCard.tsx` (Integridade e proposta de setor), `LicitacaoSheet.tsx` (licitação, aberta pela pendência quando a medida com obra passa a valer; prazo até o fim do mês seguinte) e o aviso `ContratoBox` em `MeasureSheet.tsx`; a resposta à proposta vai em `MonthPlan.proposta`. Só obra ou a marca `contrato` geram licitação.
- `src/game/caso.ts`, `data/caso.ts`: Etapa 5B (vazamento, caso com provas e solidez, saídas do presidente em `MonthPlan.casos`, delação, Supremo para o caso do presidente, advogado em `MonthPlan.advogado`, agenda `AGENDA.espacos`, interinos em `GameState.interinos`). Vazamento ligado desde a v0.28.1 (`VAZAMENTO.ativo`; testes podem usar `ligarVazamento`). Telas: `src/ui/CasoCard.tsx` (`CasosCard`, `AdvogadoCard`, `AgendaBadge`) e `casoTexto.ts`. Nomes das empresas pela IA: `askEmpresaNames` (src/lib/aiActions.ts) e `nomearEmpresas`.
- `src/game/cpi.ts`, `data/cpi.ts`: Etapa 5C (objetivo da oposição em `rival.ts`, requerimento, CPI, relatório; `MonthPlan.cpi`; ligada desde a v0.29.1: `CPI.ativo`, testes podem usar `ligarCpi`). Telas: `src/ui/CpiCard.tsx` (`CpiCard`, `CpisEncerradasCard`) e `cpiTexto.ts`; meta da oposição em `OppositionCards.tsx`.
- `src/game/inteligencia.ts`, `data/inteligencia.ts`: Etapa 5C, bloco 3 (serviço, avisos, abafar, dossiês; `MonthPlan.inteligencia`, `FloorOptions.dossie`). Ligado desde a v0.32.0 (`INTELIGENCIA.ativo`; testes usam `ligarInteligencia`). Telas: `src/ui/InteligenciaCard.tsx` (janela do serviço) e `DossieBox` na `VoteSheet.tsx`.
- Visual (v0.31.0 e v0.31.1, DESIGN.md 27.27): fontes ZT Nature e Corigo (`src/assets/fonts/`), tema claro/escuro (escuro em preto neutro), trilho lateral, painel em 3 colunas, janelas de detalhe (`src/ui/Janelas.tsx`; resumo no cartão Radar, detalhe na janela) e Elo em corrente na foto (`EloRing`, `Portrait elo=`). Tela nova entra como resumo + janela.
- `src/game/agenda.ts`, `data/agenda.ts`: bloco 6A (ação política no lugar da medida: post, rua, receber líder, cobrar ministro, falar à nação, imprensa; `MonthPlan.acao`, `RoundBuffer.acao`, cansaço, cobertura). Ligado desde a v0.34.1 (`AGENDA_ACOES.ativo`; testes podem usar `ligarAgenda`). Tela: `src/ui/AgendaJanela.tsx`.
- `src/game/credibilidade.ts`, `pesquisa.ts`, `absurdo.ts`, `data/credibilidade.ts`: bloco 6C (credibilidade, compromisso na fala, `MonthPlan.pesquisa`, nota de absurdo, medida explosiva, `retirarExplosiva`). Ligado desde a v0.35.1 (`CREDIBILIDADE.ativo`; testes podem usar `ligarCredibilidade`). Telas: `src/ui/CredibilidadeJanela.tsx`, pesquisa e compromisso em `AgendaJanela.tsx`.
- `src/game/pressao.ts`, `data/pressao.ts`: bloco 6D (pressão antes da votação: agência de risco, mercado, ato de rua; saídas enfrentar, negociar, adiar, retirar em `responderPressao`; `GameState.pressao`). Ligado desde a v0.36.1 (`PRESSAO.ativo`; testes e `sim6d` usam `ligarPressao`). Telas: `src/ui/PressaoJanela.tsx` (janela, linha da votação, resumo); pendência em `pendencias.ts`.
- `src/game/governo.ts`, `data/governo.ts`: bloco 6E parte 1 (vice por proposta na posse, 27 candidatos, base parcial, ações `agirNoVice`, líder do governo e `trocarLider` em rodada.ts; `GameState.governo`). Ligado desde a v0.37.1 (`GOVERNO.ativo`; testes e `sim6e` usam `ligarGoverno`). Telas: `src/ui/GovernoJanela.tsx` (janela do Radar), `PosseReveal.tsx` (dia da posse) e a etapa "Vice" em `App.tsx`.
- `src/game/pastas.ts`, `data/pastas.ts`: bloco 6E parte 2 (troca de ministro a cada 3 meses, interino efetivado, reforma ministerial como ação de agenda `{ tipo: 'reforma' }`, "a pasta está em jogo"; `GameState.pastas`; `efetivarInterino` e `responderPastaJogo` em rodada.ts). Ligado desde a v0.38.1 (`PASTAS.ativo`; testes e `sim6f` usam `ligarPastas`). Telas: `src/ui/PastasJanela.tsx` (pasta em jogo), aba Ministérios em `GovTabs.tsx` e a aba "Reforma ministerial" em `AgendaJanela.tsx`.
- `src/game/conselho.ts`, `data/conselho.ts`: bloco 6E parte 3, o ministro antenado (dossiê da pasta `dossiePasta`, situações e proposta `situacoes`/`escolherProposta`; `pedirProposta`, `retirarDaPauta` e `revogarDecreto` em rodada.ts; `RoundBuffer.proposta` e `revogou`). Ligado desde a v0.39.1 (`CONSELHO.ativo`; testes usam `ligarConselho`). Telas: `src/ui/PropostaJanela.tsx` (janela e Radar), botão na aba Ministérios (`GovTabs.tsx`), retirar e revogar em `CongressView.tsx`. IA: `ministerProposalPrompt`/`parseProposal` (ai.ts) e `askProposta` (aiActions.ts), reserva `textoProposta`. Círculo de confiança: `src/game/circulo.ts` (`membrosCirculo`, `parecerCirculo`; `consultarCirculo` e `narrarCirculo` em rodada.ts; `RoundBuffer.circulo`; números em `CIRCULO`), regras na v0.40.0; telas na v0.40.1 (`src/ui/CirculoJanela.tsx`: `CirculoBox` na leitura da medida em `MeasureSheet.tsx`, janela no Radar; IA `circleSpeechPrompt`/`askCirculo`).
- `src/game/dilema.ts`, `data/dilemas.ts`: bloco 6F (dilemas: fato com dois lados e saídas prontas, `EventDef.dilema`, `EventOption.lado`, `aliado` e `depois`; sorteio próprio `sortearDilema` no lugar do fato comum, `aliadoDe`, `aplicarDilema`; `GameState.dilemas`). Regras na v0.41.0, desligadas (`DILEMA.ativo`; testes usam `ligarDilemas`).
- Save na versão 40.

## Situação
Etapas feitas: 0, 1A, 1B, 2, 2B, 2C, 3 (Senado, v0.21), 4A e 4B (Supremo profundo, v0.22 e v0.23), **Fase A** (v0.24 e v0.24.1, publicada em 03/11/2026; playtest dispensado pelo Douglas em 07/11/2026), **lote A2 itens 1 a 3** (v0.25.0 acordos que esfriam, v0.26.0 efeitos das medidas, v0.26.1 logos do Senado), **Etapa 5A** (v0.27.0 regras, v0.27.1 telas, v0.27.2 licitação depois do vigor), **Etapa 5B** (v0.28.0 regras, v0.28.1 telas; falta a partida completa do Douglas), **Etapa 5C, blocos 1 e 2** (v0.29.0 regras, v0.29.1 telas da CPI e da meta da oposição).

### Próximo: Etapa 6 (plano aprovado em 08/11/2026: `docs/projeto/plano-etapa-6.md`)
Ordem dos blocos: 6.0 arrumar a casa → 6B "Por quê?" → 6A agenda e ações → 6C credibilidade, discurso, pesquisa, medida explosiva → 6D pressão antes da votação → 6E governo com vida (líder, vice, ministérios, círculo) → 6F dilemas e fecho. Impeachment só depois do 6E.
Etapa 5C fechada na v0.32.0 (telas da inteligência, DESIGN.md 27.28). Portão de playtest da 5B e da 5C dispensado pelo Douglas em 08/11/2026 (fechado). 6.0, 6B e 6A feitos (v0.32.1, v0.33.0, v0.34.0 e v0.34.1); 6C feito (regras v0.35.0, telas v0.35.1); 6D feito (regras v0.36.0, telas v0.36.1); 6E parte 1 feita (v0.37.0 e v0.37.1); 6E parte 2 feita (regras v0.38.0, telas v0.38.1); 6E parte 3 feita (regras v0.39.0, telas e IA v0.39.1); 6E parte 4 feita (v0.40.0 e v0.40.1): **bloco 6E completo**; 6F regras feitas (v0.41.0, dilemas desligados); **próximo: v0.41.1, telas dos dilemas · Sonnet**, depois o fecho da Etapa 6 (v0.42.0, `sim6`). Em andamento: **Etapa 6** (agenda completa, ação política sem instrumento, credibilidade, pressão antes da votação, tela do "Por quê?", líder do governo, vice, ministérios com vida, discurso, pesquisa, círculo de confiança, dilemas). **Complexidade alta · Opus** nas regras, Sonnet nas telas.
### Lote A2 (feito)
1. ✅ **Feito na v0.25.0** (força cai 15 pontos por mês, renovação por 70%, aviso no arquivamento; DESIGN.md 27.16). Falta o aviso "acordo para vencer" na central de pendências e rebalancear o 35% do Senado no playtest. Texto original: **Acordos que esfriam e travam a bancada** (erro achado pelo Douglas jogando; confirmado no código). Hoje: o acordo fica guardado na medida; a fila esfria todos os partidos (0,04 por rodada, até 0,20), corroendo o reforço; o partido fica travado em "Acordo já fechado" mesmo com o efeito anulado; aos 6 meses a medida é arquivada e o acordo some, enquanto as emendas pagas continuam saindo por 3 meses. Correção: (a) validade visível com força que cai mês a mês e "vence em N meses"; (b) renegociar quando a força cai ou vence, considerando o que já foi pago; (c) o desconto da fila vir do próprio acordo, sem zerar sem aviso; (d) avisar no arquivamento quanto foi pago e perdido; (e) valer para Câmara e Senado (`dealsOf`, `senateDealsOf`, `senado.dealCarry`). Cuidados: renegociar não pode ser grátis (Teste do atalho); manter o limite de 3 conversas por rodada; rebalancear o 35% do Senado. **Complexidade média · Opus** na regra; Sonnet no cartão do partido.
2. ✅ **Feito na v0.26.0** (curva do ganho, "só de mandar já pesa", teto por grupo no mês; `src/game/efeitos.ts`, DESIGN.md 27.17; a "medida explosiva" ficou para a Etapa 6). Texto original: **Calibrar o tamanho dos efeitos das medidas nos grupos** (medida boa sobe pouco, absurda desce pouco; hoje a barrada vale −0,8 por grupo). Passos: medir no simulador antes de mexer; curvas não lineares e sensibilidade por grupo; a absurda desce forte em quem é atingido; ganho com retorno decrescente; guardas (teto mensal por grupo, perdas e ganhos na mesma escala, aprovação ancorada nos fundamentos). Pronto quando a medida boa e a absurda dão resposta visível no mesmo mês e a simulação não dispara nem desaba. **Complexidade média-alta · Opus.** Vem depois da correção dos acordos.
3. ✅ **Feito na v0.26.1** (DESIGN.md 27.18). Texto original: **Logos dos partidos nas bolinhas do mapa do Senado**, com bolinhas um pouco maiores. Manter o anel de relação e os filtros, logo no miolo, cair para a cor sólida se faltar o logo, carregar cada logo uma vez. **Complexidade baixa · Sonnet ou Haiku.** Sem dependência.

## Roadmap seguinte
| Etapa | Conteúdo | Modelo |
|---|---|---|
| 5A | Elos de reputação (Platina, Ouro, Prata, Bronze, "sob suspeita"), risco oculto, Controle do Estado 0 a 100, três fontes de escândalo, rastro do presidente; usa `registrarOrigemRisco` | Opus nas regras, Sonnet nas telas |
| 5B | Vazamento, investigação da PF (provas 0 a 100), advogado do presidente, delação, núcleo mínimo da agenda | Opus, Sonnet |
| 5C | Oposição como personagem, CPI (171 assinaturas, 6 meses), serviço de inteligência com dossiês | Opus, Sonnet |
| 6 | Agenda completa, ação política sem instrumento, credibilidade e crédito de expectativa, pressão antes da votação, tela do "Por quê?", líder do governo, vice, ministérios com vida, discurso, pesquisa, círculo de confiança, dilemas | Opus, Sonnet |
| 6B | Congresso vivo e partido do presidente, frentes parlamentares, visual dos cartões dos partidos | Opus, Sonnet |
| 7 / 7B | Mapa de aprovação por região e estado, governadores, desastres e crises com relógio, calendário; árvores de programas e diplomacia (depois de gravar essas abas) | Opus, Sonnet |
| 8 / 8B / 9 | Candidatura completa, sociedade, apelidos, vida pessoal, cenários, eleição e herança; governo autoritário (opcional, em discussão); arte final e tutorial gradual | Sonnet; Fable ou Opus na 8B |

Etapa 5: parcimônia (3 a 6 casos por mandato, no máximo 2 ativos); todo escândalo tem origem rastreável na Ficha; o presidente só é atingido pelo que fez (rastro oculto, com pista em palavras); a PF não investiga o presidente direto (sobe ao Supremo); a CPI não condena, produz relatório, e a base define presidente e relator.

## Decisões já tomadas
- O Senado vota as leis depois da Câmara e **não** devolve o texto emendado.
- "Outros caminhos" e catálogo saíram do fato do mês (Teste do atalho); post e rua voltam na Etapa 6 como ações de agenda, que gastam espaço e substituem a medida em vez de somar.
- O custo de uso da IA não é critério do plano por enquanto.
- Logos dos partidos são desenhados pelo Douglas (placeholders até lá).
- Fora do escopo: 22 partidos como na referência (usamos 9 com 3 alas cada), orçamento anual detalhado, sessão de vetos, modo de realismo.

## Playtest da Fase A (o que o Douglas vai anotar)
Parecer do ministro e o limite de um por mês · botão "Atender" nas pendências · fato do mês sem catálogo · plenário do Senado com anel e filtros · dificuldade do Senado com o acordo a 35% · medida absurda ("Amputa Brasil") derrubando a aprovação · falhas da IA no gasto medido · desdobramento da agência de risco ameaçando com a lei na pauta · grupos "parados" depois de medida boa e absurda · mês em que o acordo sumiu com a medida parada.

## Documentos de apoio (no Project GoverNation do claude.ai)
`levantamento-video-1.md` (comparação com o jogo de referência, vídeo 1), `levantamento-congresso.md` (Congresso, medida do dia e Supremo), `ideias-interface-e-ritmo.md` (Teste da interface, tutorial gradual, janelas e pausas, identidade visual própria). Peça ao Douglas para colocá-los em `docs/projeto/` se precisar.
