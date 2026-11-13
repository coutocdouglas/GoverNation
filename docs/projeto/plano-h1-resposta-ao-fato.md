# Plano H1: resposta ao fato que nem sempre é lei (proposta de 13/11/2026)

> **Feito na v0.44.0 (13/11/2026), com 12 tipos.** Ajustes do Douglas na aprovação: o jogo reconhece o que o jogador escreve (sem menu de sugestões e sem "ver todas"); as sugestões entram no parecer do ministro, que já existia; regras e telas saíram juntas numa versão só. Detalhe final em DESIGN.md 27.42. Amplia o bloco H1 do `plano-etapa-6g.md` com o que o Douglas pediu em 13/11/2026: ceder ministério, campanha publicitária, ordem executiva, atender pedido, conversar com ministro ou líder. Decisões já tomadas: a resposta ao fato tem **espaço próprio** (uma por fato) e a campanha precisa de **aprovação da verba e do ministro, não do Congresso**.

## 1. O problema (achado jogando)
Hoje o texto que o jogador escreve na resposta ao fato só vira **lei, decreto ou MP** (`ResponseBox.tsx`, `readText`, `interpretPrompt`). Fato como "o Centrão pressiona por ministérios" ou "uma ação sua deu resultado" não tem resposta natural: o jogador quer ceder uma pasta, conversar, fazer campanha, e o jogo só entende "medida".

## 2. A ideia em uma frase
O que o jogador escreve é **interpretado e vira a ação certa**. O jogo mostra "entendi isto" com custo e efeito **antes de executar**; a IA só classifica e narra, as regras decidem.

## 3. Tipos de resposta

| Tipo | Exemplo escrito | O que acontece | Reaproveita |
|---|---|---|---|
| `medida` | "Proponho uma lei de…" | Como hoje (lei, decreto, MP; vai a voto se for o caso) | `eventResponse` |
| `pasta` | "Cedo o ministério X ao Centrão" | Abre a aba Ministérios com a troca pronta; vale a regra do intervalo de 3 meses | `reforma` (6E), `ministryBlockedReason` |
| `lider` | "Chamo o líder do partido" | Recebe o líder: relação sobe, custo de agenda | ação `lider` (6A) |
| `ministro` | "Cobro o ministro da Saúde" | Conversa particular ou pública | ação `ministro` (6A) |
| `pedido` | "Atendo o pedido dos caminhoneiros" | Resolve a cobrança do grupo com custo à vista (verba, relação com outro grupo) | `demands` |
| `campanha` | "Lanço campanha elogiando o programa" | **Nova**: gasta verba, sobe aprovação do grupo-alvo, retorno decrescente, risco de "propaganda" | `credibilidade` (6C), `assessoria` |
| `ordem` | "Mando a PF investigar" | **Nova**: ordem executiva sem votação e sem Supremo; efeito menor que a lei, maior que deixar passar | `efeitos.ts`, teto por grupo |
| `nenhuma` | (deixar passar) | Sempre possível | `eventChoice` padrão |

## 4. Regras que não podem quebrar
- **Regras decidem, IA narra.** Efeitos, custos e limites moram em `src/game/data/` (novo `data/resposta.ts`).
- **Texto de reserva obrigatório.** Sem IA ou com falha, a tela lista os tipos de resposta para escolher no clique, sem mostrar erro. A leitura por palavras-chave cobre `pasta`, `lider`, `ministro`, `campanha`, `pedido`, `ordem` (palavras como "ministério", "cedo", "campanha", "propaganda", "ordem", "conversar").
- **Teste do atalho:** campanha e ordem têm retorno decrescente por mês e por tema, intervalo mínimo e teto por grupo; a campanha repetida cansa o público (usa o cansaço da agenda).
- **Teste do beco:** toda resposta mostra o custo antes e pode ser desfeita até fechar o mês; deixar passar continua existindo.
- **Teste da sobrecarga:** a resposta ao fato continua sendo **uma por fato** e fica no mesmo lugar da tela; a leitura "entendi isto" é um cartão só.
- **Teste da interface:** resumo na tela principal e detalhe atrás de um clique. A aba Ministérios é aberta já com a troca marcada, sem o jogador refazer nada.
- **Memória do mundo:** toda resposta executiva gera entrada de biografia, semente e causa (`registrarCausa`).
- **Campanha:** aprovação da **verba e do ministro responsável** (a Secom ou a pasta da área). Sem voto do Congresso. Custo em R$ bi pequeno e visível; se a economia estiver ruim e a campanha for grande, a credibilidade (6C) cobra.

## 5. Desenho técnico (resumo)
- `MonthPlan.resposta?: RespostaFato` (nova), `RespostaFato = { tipo: 'pasta' | 'lider' | 'ministro' | 'pedido' | 'campanha' | 'ordem'; ... }`. `eventResponse` (lei) continua como está.
- Novo `src/game/resposta.ts`: `interpretarResposta(s, texto)` por regras (reserva), `respostaBlockedReason`, `previaResposta` (custo e efeito à vista) e `aplicarResposta`. As respostas `lider`, `ministro` e `pasta` chamam o motor que já existe (`aplicarAcao` e `applyMinistryChange`), sem duplicar regra.
- A IA: `interpretPrompt` ganha o campo `tipo` e os parâmetros (partido, pasta, tema). `parseInterpretation` valida; o que não bater cai nas palavras-chave.
- Exclusividade: uma resposta por fato (lei **ou** executiva). A ação política da agenda (6A) segue como hoje: no lugar da medida do mês.
- Save: `GameState` guarda o registro das respostas executivas (retorno decrescente), então sobe o `saveVersion` (de 41 para 42) com migração e teste.

## 6. Versões
| Versão | Conteúdo | Modelo | Complexidade |
|---|---|---|---|
| v0.44.0 | Regras: `data/resposta.ts`, `resposta.ts`, interpretação por regras, tipos novos (`campanha`, `ordem`), registro no save 42, `MonthPlan.resposta`, desligado (`RESPOSTA.ativo`), simulador `sim8` | Opus | média-alta |
| v0.44.1 | Telas: cartão "Entendi isto" no `ResponseBox`, atalho para Ministérios e Agenda, IA no `interpretPrompt`, texto de reserva, liga o bloco | Sonnet | média |

## 7. Testes previstos
- Cada tipo é reconhecido pelas palavras-chave e vira a ação certa (ceder pasta abre a troca válida; intervalo de 3 meses respeitado).
- Atalho: campanha todo mês rende cada vez menos e cansa; ordem executiva repetida não vira aprovação grátis.
- Beco: desfazer a resposta até fechar o mês; deixar passar sempre possível.
- Texto de reserva: sem IA, a lista de tipos aparece; com resposta inválida da IA, cai nas palavras-chave sem mostrar erro.
- Save 41 → 42 sem perder mandato.
- Simulador `sim8`: respostas executivas não disparam nem derrubam a aprovação ao longo de 60 mandatos.

## 8. Fora deste plano
Árvores de diplomacia e discursos por IA em plenário (Caixa de ideias das Etapas 7 e 8), e fatos vivos com memória (H5).
