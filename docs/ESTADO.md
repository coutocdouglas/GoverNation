# Estado atual do GoverNation

> **Leia este arquivo primeiro.** Ele diz onde o projeto está e qual é o próximo passo.
> Atualize-o a cada mudança: seção "Estado atual", "Próximo passo" e uma linha no "Histórico".

**Última atualização:** 29/10/2026 · **Versão publicada:** v0.5.0

---

## Próximo passo

**Etapa 3: resposta em texto ao fato do mês, leitura do ministro e catálogo grande de medidas.**

- O fato do mês ganha um campo "agir" em texto livre (o mesmo interpretador da medida do mês).
- Botão **"pedir leitura do ministro"**: o ministro da área sugere 2 ou 3 respostas em texto, que o jogador aceita, edita ou ignora.
- A resposta aceita vira decreto, projeto de lei, MP ou PEC e segue o trâmite normal. **Não gasta a medida do mês**: é a resolução do problema, num espaço à parte.
- O catálogo de medidas cresce de 17 para cerca de 80, organizado por área (saúde, educação, segurança, energia, agro, transportes, trabalho, ambiente...), cada uma com palavras-chave, efeitos e sementes de consequência.
- Cada fato do mês passa a ter uma área e um ministro responsável (ministros novos entram no elenco com retrato livre ou reservado).
- **Sem IA por enquanto.** O texto livre é lido por palavras-chave. A IA fica para depois, como modelo local ou chave própria.

Complexidade: alta. Use o Opus para desenhar e o Sonnet para escrever o catálogo.

Para começar numa conversa nova: *"Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md. Quero fazer a etapa 3."*

---

## Estado atual (o que o jogo já tem)

**Base técnica**
- App de Windows (Tauri 2 + React + TypeScript). O instalador é gerado pelo GitHub Actions e o jogo se atualiza sozinho, com atualização assinada.
- O motor do jogo (`src/game/`) fica separado das telas (`src/ui/`). Os números de balanceamento ficam em `src/game/data/`.
- 53 testes automáticos. Saves antigos são migrados (versão atual do save: 4).

**Jogabilidade**
- Mandato de 48 meses (jan/2027 a dez/2030), com o mês em 4 passos: notícias, fato do mês, decisões e encerrar.
- **Economia** com causa e efeito: PIB, inflação, Selic (Banco Central independente, 8 reuniões do Copom por ano), desemprego, dívida, contas públicas, confiança do mercado, dólar e choques externos.
- **7 grupos sociais** com memória: ganhos são esquecidos em cerca de 9 meses e perdas em cerca de 2 anos.
- **Medida do mês em texto livre**, lida por palavras-chave. Leva a 7 decretos ou a 10 projetos de lei e mostra o instrumento, o custo e o placar previsto.
- **Congresso:** 513 deputados de 9 partidos fictícios. O voto depende de ideologia, orientação do partido, relação com o governo, popularidade, aprovação e emendas.
  - Lei ordinária, lei complementar (257 votos), PEC (308 votos, em dois turnos) e MP, que vale na hora e cai se for rejeitada.
  - Recesso em janeiro e julho.
  - Articulação: conversar com partidos ou liberar emendas, até 2 por mês.
  - O jogador escolhe o partido (esquerda, centro ou direita).
- **Fato do mês** com importância de 1 a 5, crises, boas notícias (promover, dar crédito ou ignorar) e consequências de leis antigas.
- **Cobranças dos grupos** com prazo, recompensa e penalidade.
- **Memória do mundo:** leis, MPs e obras plantam consequências que brotam meses ou anos depois. Há herança do governo anterior e o tempo é absoluto, pronto para vários mandatos.
- **Fichas:** biografia acumulada de cada personagem e memória do país.
- **Retratos:** 110 fotos, cada uma usada por uma pessoa só. O presidente escolhe o rosto na posse e 16 retratos ficam reservados para Defesa, Supremo, povos indígenas, campo e tradições.

**Telas:** Painel (com cara de jogo, animações e plantão de notícias), Governo (plenário, pauta, partidos e articulação) e Fichas. Nação, Economia, Diplomacia, Programas e Vida pessoal aparecem bloqueadas.

**Onde está cada coisa**
- `CLAUDE.md`: regras do projeto e quando abrir uma conversa nova.
- `docs/DESIGN.md`: decisões de desenho, seções 1 a 16.
- `CHANGELOG.md`: novidades de cada versão.
- `docs/RELEASES.md`: como publicar.

---

## Roteiro

1. ✅ Retratos e elenco fixo (v0.4.1)
2. ✅ Memória do mundo, consequências, importância, fatos bons e herdados, biografias (v0.5.0)
3. ⏭️ Resposta em texto ao fato do mês, leitura do ministro, catálogo grande de medidas
4. Congresso 2.0: veto e derrubada, relator e emendas ao texto, comissões, presidente da Câmara, frentes temáticas, pautas-bomba, ministérios cedidos
5. Entre mandatos (campanha contínua): painel de eleição com escolha de candidato pela ficha, governo seguinte simulado se o jogador perder, herança
6. Depois: Senado com poderes próprios (sabatinas, impeachment), Supremo, imprensa e pesquisas, orçamento anual, ícones próprios, IA opcional

## Decisões já tomadas (resumo; detalhes no DESIGN.md)

- Mecânicas inspiradas no jogo de referência; nomes, textos, arte e números próprios. Personagens e partidos fictícios, com bancadas inspiradas na Câmara eleita em 2026.
- Campanha contínua entre mandatos, com painel de eleição.
- IA fora por enquanto: o jogo é pessoal e o catálogo com palavras-chave resolve. Se vier, será um modelo local ou uma chave própria.
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
