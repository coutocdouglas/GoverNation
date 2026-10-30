# Estado atual do GoverNation

> **Leia este arquivo primeiro.** Ele diz onde o projeto está e qual é o próximo passo.
> Atualize-o a cada mudança: seção "Estado atual", "Próximo passo" e uma linha no "Histórico".

**Última atualização:** 30/10/2026 · **Versão publicada:** v0.10.0

---

## Próximo passo

**Etapa 5: entre mandatos** (campanha contínua). Painel de eleição com escolha de candidato pela ficha, governo seguinte simulado se o jogador perder, herança.

Complexidade: alta. Use o **Opus**, numa conversa nova.

Para começar numa conversa nova: *"Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md. Quero fazer a etapa 5."*

---

## Estado atual (o que o jogo já tem)

**Base técnica**
- App de Windows (Tauri 2 + React + TypeScript). O instalador é gerado pelo GitHub Actions e o jogo se atualiza sozinho, com atualização assinada.
- O motor do jogo (`src/game/`) fica separado das telas (`src/ui/`). Os números de balanceamento ficam em `src/game/data/`.
- 119 testes automáticos. Saves antigos são migrados (versão atual do save: 8).

**Jogabilidade**
- Mandato de 48 meses (jan/2027 a dez/2030), com o mês em 4 passos: notícias, fato do mês, decisões e encerrar.
- **Economia** com causa e efeito: PIB, inflação, Selic (Banco Central independente, 8 reuniões do Copom por ano), desemprego, dívida, contas públicas, confiança do mercado, dólar e choques externos.
- **7 grupos sociais** com memória: ganhos são esquecidos em cerca de 9 meses e perdas em cerca de 2 anos.
- **Medida do mês em texto livre**, lida por palavras-chave. Leva aos 7 decretos rápidos ou a um catálogo de 91 medidas em 13 áreas (decreto, MP, lei, lei complementar ou PEC) e mostra o instrumento, o custo e o placar previsto.
- **Agir no fato do mês:** além das opções prontas, o jogador escreve a resposta; o ministro da área lê e mostra até 3 caminhos. A resposta segue o trâmite normal e não gasta a medida do mês. Decreto e MP resolvem na hora; lei e PEC, se aprovadas no mesmo mês.
- **Medidas livres (v0.9):** com IA, se nada do catálogo faz o que o jogador pediu, o gabinete redige uma medida nova. O jogo confere a ficha (instrumento mínimo pela matéria, números nas faixas do catálogo, "não existe almoço grátis", risco jurídico) e a medida entra no catálogo do mandato com a marca "criada pelo governo".
- **Ministros:** 13 áreas, cada uma com um ministro responsável, partido e estilo próprio.
- **IA opcional (v0.7):** com chave própria de Claude, Gemini, Groq ou OpenRouter, o ministro dá um parecer com ordens prontas, o gabinete mostra a leitura antes de assinar e o ministro opina sobre a ordem e a IA lê o texto livre, sempre escolhendo do catálogo. Sem chave ou sem internet, palavras-chave.
- **Congresso:** 513 deputados de 9 partidos fictícios. O voto depende de ideologia, orientação do partido, relação com o governo, popularidade, aprovação e emendas.
  - Lei ordinária, lei complementar (257 votos), PEC (308 votos, em dois turnos) e MP, que vale na hora e cai se for rejeitada.
  - Recesso em janeiro e julho.
  - Articulação: conversar com partidos ou liberar emendas, até 2 por mês.
  - **Votação com negociação (v0.8):** janela com placar previsto e plenário; ouvir até 3 lideranças por mês, que cobram emendas, pauta do projeto-bandeira ou cargos (ou não vendem); confiabilidade, promessas e risco de escândalo.
  - O jogador escolhe o partido (esquerda, centro ou direita).
  - **Congresso 2.0 (v0.10):** comissões que engavetam, relator que mantém, desidrata ou enfia "jabuti", presidente da Câmara dono da pauta (segura projetos, escolhe relatores), urgência, deixar na pauta, 7 frentes parlamentares, pautas-bomba, sanção e veto com sessão de derrubada (257 votos) e ministérios cedidos a partidos (o indicado assume).
  - **Votação no painel (v0.10):** cada votação aparece com os votos acendendo um a um; maioria esmagadora em lei ou MP permite votação simbólica, sem painel.
  - **Reação da sociedade (v0.10):** depois de cada lei, página com nota de popularidade (0 a 10), % a favor, reação de cada grupo, mercado, frentes, partidos, custo e prós e contras.
- **Fato do mês** com importância de 1 a 5, crises, boas notícias (promover, dar crédito ou ignorar) e consequências de leis antigas.
- **Cobranças dos grupos** com prazo, recompensa e penalidade.
- **Memória do mundo:** leis, MPs e obras plantam consequências que brotam meses ou anos depois. Há herança do governo anterior e o tempo é absoluto, pronto para vários mandatos.
- **Fichas:** biografia acumulada de cada personagem e memória do país.
- **Retratos:** 110 fotos, cada uma usada por uma pessoa só. O presidente escolhe o rosto na posse (65 livres) e 16 retratos ficam reservados para Defesa, Supremo, povos indígenas, campo e tradições.

**Telas:** Painel (com cara de jogo, animações e plantão de notícias), Governo (mesa de sanção, presidente da Câmara, pauta, partidos e articulação, ministérios, frentes, leis com reação) e Fichas. Nação, Economia, Diplomacia, Programas e Vida pessoal aparecem bloqueadas.

**Onde está cada coisa**
- `CLAUDE.md`: regras do projeto e quando abrir uma conversa nova.
- `docs/DESIGN.md`: decisões de desenho, seções 1 a 21.
- `CHANGELOG.md`: novidades de cada versão.
- `docs/RELEASES.md`: como publicar.

---

## Roteiro

1. ✅ Retratos e elenco fixo (v0.4.1)
2. ✅ Memória do mundo, consequências, importância, fatos bons e herdados, biografias (v0.5.0)
3. ✅ **3A** resposta em texto ao fato do mês, ministro responsável, catálogo grande de medidas (v0.6.0) · ✅ **3B** camada de IA: conselho do ministro, interpretação do texto livre, chave própria, plano B (v0.7.0) · ✅ **3C** medidas livres montadas pela IA (v0.9.0)
4. ✅ **4A** votação com negociação por lideranças (v0.8.0) · ✅ **4B** Congresso 2.0, votação animada, voto simbólico e reação da sociedade (v0.10.0)
5. ⏭️ Entre mandatos (campanha contínua): painel de eleição com escolha de candidato pela ficha, governo seguinte simulado se o jogador perder, herança
6. Depois: Senado com poderes próprios (sabatinas, impeachment), Supremo, imprensa e pesquisas, orçamento anual, ícones próprios

## Decisões já tomadas (resumo; detalhes no DESIGN.md)

- Mecânicas inspiradas no jogo de referência; nomes, textos, arte e números próprios. Personagens e partidos fictícios, com bancadas inspiradas na Câmara eleita em 2026.
- Campanha contínua entre mandatos, com painel de eleição.
- IA entra na etapa 3B, com chave de API própria e plano B por palavras-chave. Modelo local descartado por ora (DESIGN.md, seção 17).
- O Senado não vota leis por enquanto. A profundidade vem da Câmara; o Senado ganha poderes próprios depois.
- Retratos: um por pessoa, sem repetir. Chegaram 110 (o plano era 200).
- Uma etapa por vez, fechada antes da próxima, integrando ao jogo a cada etapa.

---

## Histórico

| Data | Versão | O que mudou |
| --- | --- | --- |
| 29/10/2026 | — | Levantamento do jogo de referência (prints e robô de prints), dossiê dos partidos conferido com o resultado da eleição de 2026, roadmap e protótipo visual do Painel |
| 29/10/2026 | v0.2.1 | Painel com cara de jogo, mês em passos, medida do mês em texto livre |
| 29/10/2026 | v0.3.0 | Congresso: 513 deputados, 9 partidos, 10 projetos de lei, articulação, escolha de partido |
| 29/10/2026 | v0.4.0 | Fato do mês em painel próprio, cobranças dos grupos, caricaturas provisórias |
| 29/10/2026 | v0.4.1 | 110 retratos e elenco fixo, escolha do rosto na posse |
| 29/10/2026 | v0.5.0 | Memória do mundo, consequências, importância 1–5, boas notícias, herança, biografias e Fichas; CLAUDE.md |
| 29/10/2026 | — | Criado este arquivo de estado (docs/ESTADO.md) |
| 30/10/2026 | — | Decisão: IA entra na etapa 3B; etapa 3 dividida em 3A (catálogo) e 3B (IA). Documentos atualizados |
| 30/10/2026 | v0.6.0 | Etapa 3A: agir em texto no fato do mês, 13 áreas com ministro responsável (7 ministros novos), catálogo de 91 medidas por palavras-chave, boas notícias por área |
| 30/10/2026 | v0.7.0 | Etapa 3B: IA opcional com chave própria, conselho do ministro no estilo dele, leitura do texto livre por IA, plano B por palavras-chave, medidor de gasto |
| 30/10/2026 | v0.7.1 | Provedores de IA: Gemini, Groq e OpenRouter além do Claude, com chave e modelos por provedor |
| 30/10/2026 | v0.7.2 | Opinião do ministro em parágrafo com ordens "Usar", folha de leitura antes de assinar (vira, custo, quem sente) e parecer do ministro com sugestões |
| 30/10/2026 | v0.7.3 | Gemini: modelo padrão corrigido (gemini-3.5-flash-lite nas duas tarefas, testado pelo Douglas); motivo da última falha visível no gasto medido |
| 30/10/2026 | v0.8.0 | Etapa 4A: janela de votação com plenário e negociação com lideranças (3 por mês: emendas, pauta, cargos); risco de escândalo; sem opções prontas com IA fora do modo fácil |
| 30/10/2026 | — | Decisão: etapa 3C (medidas livres montadas pela IA, entrando no catálogo do mandato) antes da 4B |
| 30/10/2026 | v0.9.0 | Etapa 3C: medidas livres redigidas pela IA quando nada do catálogo serve, conferidas pelo motor (instrumento mínimo, faixas, almoço grátis, risco jurídico) e guardadas no catálogo do mandato; fim da "medida mais parecida" quando a IA diz que nada serve |
| 30/10/2026 | v0.10.0 | Etapa 4B: comissões, relator e jabutis, presidente da Câmara, urgência, deixar na pauta, frentes, pautas-bomba, sanção/veto e derrubada, ministérios cedidos; votação animada no painel, voto simbólico e página de reação da sociedade; save 8 |
