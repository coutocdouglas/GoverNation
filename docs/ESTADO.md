# Estado atual do GoverNation

> **Leia este arquivo primeiro.** Ele diz onde o projeto está e qual é o próximo passo.
> Atualize-o a cada mudança: seção "Estado atual", "Próximo passo" e uma linha no "Histórico".

**Última atualização:** 30/10/2026 · **Versão publicada:** v0.7.1

---

## Próximo passo

**Testar a IA com a chave real e fixar os modelos.** A etapa 3B ficou pronta na v0.7.0, mas foi testada com uma API simulada.

- Douglas: no botão 🤖 IA, escolher o provedor (Gemini, já que há conta paga; ou Claude, Groq, OpenRouter), colar a chave e jogar alguns meses. Ver se as falas soam bem e anotar o "Gasto medido".
- Com os números reais, decidir os modelos de cada tarefa. Se a chamada falhar no app instalado com "Sem conexão", pode ser bloqueio do navegador interno (CORS) daquele provedor: aí a correção é passar as chamadas pelo lado Windows do app (plugin http do Tauri). Ajustes de texto dos prompts ficam em `src/game/ai.ts`.
- Depois: **etapa 4, Congresso 2.0** (veto e derrubada, relator e emendas, comissões, presidente da Câmara, frentes, pautas-bomba, ministérios cedidos). Complexidade alta: use o **Opus**, numa conversa nova.

Para começar numa conversa nova: *"Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md. Quero fazer a etapa 4."*

---

## Estado atual (o que o jogo já tem)

**Base técnica**
- App de Windows (Tauri 2 + React + TypeScript). O instalador é gerado pelo GitHub Actions e o jogo se atualiza sozinho, com atualização assinada.
- O motor do jogo (`src/game/`) fica separado das telas (`src/ui/`). Os números de balanceamento ficam em `src/game/data/`.
- 78 testes automáticos. Saves antigos são migrados (versão atual do save: 5).

**Jogabilidade**
- Mandato de 48 meses (jan/2027 a dez/2030), com o mês em 4 passos: notícias, fato do mês, decisões e encerrar.
- **Economia** com causa e efeito: PIB, inflação, Selic (Banco Central independente, 8 reuniões do Copom por ano), desemprego, dívida, contas públicas, confiança do mercado, dólar e choques externos.
- **7 grupos sociais** com memória: ganhos são esquecidos em cerca de 9 meses e perdas em cerca de 2 anos.
- **Medida do mês em texto livre**, lida por palavras-chave. Leva aos 7 decretos rápidos ou a um catálogo de 91 medidas em 13 áreas (decreto, MP, lei, lei complementar ou PEC) e mostra o instrumento, o custo e o placar previsto.
- **Agir no fato do mês:** além das opções prontas, o jogador escreve a resposta; o ministro da área lê e mostra até 3 caminhos. A resposta segue o trâmite normal e não gasta a medida do mês. Decreto e MP resolvem na hora; lei e PEC, se aprovadas no mesmo mês.
- **Ministros:** 13 áreas, cada uma com um ministro responsável, partido e estilo próprio.
- **IA opcional (v0.7):** com chave própria de Claude, Gemini, Groq ou OpenRouter, o ministro dá conselhos no estilo dele e a IA lê o texto livre, sempre escolhendo do catálogo. Sem chave ou sem internet, palavras-chave.
- **Congresso:** 513 deputados de 9 partidos fictícios. O voto depende de ideologia, orientação do partido, relação com o governo, popularidade, aprovação e emendas.
  - Lei ordinária, lei complementar (257 votos), PEC (308 votos, em dois turnos) e MP, que vale na hora e cai se for rejeitada.
  - Recesso em janeiro e julho.
  - Articulação: conversar com partidos ou liberar emendas, até 2 por mês.
  - O jogador escolhe o partido (esquerda, centro ou direita).
- **Fato do mês** com importância de 1 a 5, crises, boas notícias (promover, dar crédito ou ignorar) e consequências de leis antigas.
- **Cobranças dos grupos** com prazo, recompensa e penalidade.
- **Memória do mundo:** leis, MPs e obras plantam consequências que brotam meses ou anos depois. Há herança do governo anterior e o tempo é absoluto, pronto para vários mandatos.
- **Fichas:** biografia acumulada de cada personagem e memória do país.
- **Retratos:** 110 fotos, cada uma usada por uma pessoa só. O presidente escolhe o rosto na posse (65 livres) e 16 retratos ficam reservados para Defesa, Supremo, povos indígenas, campo e tradições.

**Telas:** Painel (com cara de jogo, animações e plantão de notícias), Governo (plenário, pauta, partidos e articulação) e Fichas. Nação, Economia, Diplomacia, Programas e Vida pessoal aparecem bloqueadas.

**Onde está cada coisa**
- `CLAUDE.md`: regras do projeto e quando abrir uma conversa nova.
- `docs/DESIGN.md`: decisões de desenho, seções 1 a 19.
- `CHANGELOG.md`: novidades de cada versão.
- `docs/RELEASES.md`: como publicar.

---

## Roteiro

1. ✅ Retratos e elenco fixo (v0.4.1)
2. ✅ Memória do mundo, consequências, importância, fatos bons e herdados, biografias (v0.5.0)
3. ✅ **3A** resposta em texto ao fato do mês, ministro responsável, catálogo grande de medidas (v0.6.0) · ✅ **3B** camada de IA: conselho do ministro, interpretação do texto livre, chave própria, plano B (v0.7.0)
4. Congresso 2.0: veto e derrubada, relator e emendas ao texto, comissões, presidente da Câmara, frentes temáticas, pautas-bomba, ministérios cedidos
5. Entre mandatos (campanha contínua): painel de eleição com escolha de candidato pela ficha, governo seguinte simulado se o jogador perder, herança
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
