# Estado atual do GoverNation

> **Leia este arquivo primeiro.** Ele diz onde o projeto está e qual é o próximo passo.
> Atualize-o a cada mudança: seção "Estado atual", "Próximo passo" e uma linha no "Histórico".

**Última atualização:** 31/10/2026 · **Versão publicada:** v0.18.0

---

## Próximo passo

**Etapa 3: Senado** (v0.19). Plano em `docs/DESIGN.md`, seção 27 (tabela): página própria, líderes de bancada, indecisos com preço, comissões do Senado, 27 estados com bancadas estaduais (3 senadores e os deputados de cada estado, fictícios e proporcionais), emendas por estado e por bancada. Antes de programar, escrever o plano da etapa no DESIGN.md (seção 27.6) e mostrar ao Douglas. Boa base pronta da Etapa 2: alas, conversa por tipos, contraoferta e concessões podem ser reaproveitadas no Senado.

Complexidade: **alta**. Opus para as regras (bancadas estaduais, indecisos com preço) e o balanceamento; Sonnet nas telas e nos dados dos 27 estados.

Para começar numa conversa nova: *"Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md (seção 27). Quero fazer a etapa 3."*

**Sugestão (opcional, 1B):** pedir a um Opus uma revisão final dos números da assessoria (`data/assessoria.ts`: `postScale`, `omissoShare`, `fatigueFactor`, `softenMax`; e `data/rua.ts`). O simulador mostra que ficou equilibrado (DESIGN.md 27.4), mas é a primeira etapa balanceada fora do Opus.

**Pendência do Douglas:** mandar as ilustrações dos slots (`public/art/LEIAME.md`) quando quiser. Retratos: 198 no total, 106 livres; para gerar provisórios de quem ainda não tem rosto, `scripts/retratos-provisorios.py` (sai em `scripts/retratos-provisorios/`, a partir do 199).

---

## Estado atual (o que o jogo já tem)

**Base técnica**
- App de Windows (Tauri 2 + React + TypeScript). O instalador é gerado pelo GitHub Actions e o jogo se atualiza sozinho, com atualização assinada.
- O motor do jogo (`src/game/`) fica separado das telas (`src/ui/`). Os números de balanceamento ficam em `src/game/data/`.
- 232 testes automáticos. Saves antigos são migrados (versão atual do save: 16).

**Jogabilidade**
- Mandato de 48 meses (jan/2027 a dez/2030), com o mês em 4 passos: notícias, fato do mês, decisões e encerrar.
- **A rodada (v0.15):** uma medida nova por rodada; ela vota na hora (Câmara e Senado), decreto e MP valem na hora, um projeto da fila por casa pode ser pautado, articulação vale na hora, gaveta avisada antes, MP caduca em 4 rodadas sem votação, Supremo julga no fechamento da mesma rodada. Faixa da rodada no Painel e ilustrações provisórias (slots em `src/ui/artSlots.ts`, arte em `public/art`).
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
- **Senado (v0.12):** 81 senadores dos 9 partidos, mais de centro. Tudo o que a Câmara aprova passa pelo Senado: lei, LC e MP no mesmo fechamento de mês; PEC no mês seguinte, em dois turnos (41 votos para LC, 49 para PEC). Rejeitado no Senado volta em 6 meses, custa aprovação e fortalece o rival. Presidente do Senado (Hermínia Valença, PSN) segura projetos se estiver de mal; conversar com ela é articulação. Janela de votação com abas Câmara e Senado, 2 lideranças por mês no Senado, painel animado de 81 cadeiras.
- **Supremo (v0.13):** 11 ministros fictícios com doutrina e relação com o governo. Toda medida tem risco jurídico (baixo, médio, alto), mostrado antes de assinar com a chance de cair. Partidos de oposição levam ao Supremo medidas com risco nos 24 meses depois de entrarem em vigor; julgamento voto a voto (6 derrubam), com animação. Medida derrubada deixa de valer e vira fato do mês: acatar, mandar nova proposta (instrumento mais forte) ou criticar o Supremo. Vaga quando um ministro faz 75 anos (a primeira em ago/2028): 3 indicáveis e sabatina no Senado (41 votos).
- **Supremo no caminho das medidas (v0.14):** risco jurídico também pela regra do instrumento (decreto não cria imposto, despesa grande precisa de lei, MP não trata de pena, vício de forma): 31 medidas do catálogo com risco. Risco alto vai ao Supremo quase sempre (cerca de 30% ao mês) e é julgado em 1 a 2 meses. **Liminar** do relator suspende a medida na hora (dinheiro parado até o plenário) e vira fato do mês: esperar, recuar, recorrer ou criticar. A oposição pode **travar um projeto** ainda no Congresso (risco alto, PEC em direito fundamental, jabuti); derrubado, é arquivado por 6 meses. **CCJ** filtra projetos de risco alto (aprova, adequa ou barra), com a previsão antes de enviar. **Consulta ao Supremo**: 2 meses de espera; chancelada fica imune por 24 meses.
- **Ministérios (v0.14):** 13 ministros com desgaste de 0 a 100 e meta por pasta (no rumo, em risco, longe); desgastado (70+) custa aprovação no grupo da pasta; reforma ministerial (trocar o ministro zera o desgaste; troca direta de um partido para outro).
- **Posse em 3 passos (v0.11):** candidato, perfil (até 2 traços e 2 hábitos que agradam uns grupos e desagradam outros) e 5 promessas de posse com meta medida, com painel ao lado mostrando o efeito em cada grupo.
- **Rival (v0.11):** líder da oposição fictício (Leopoldo Rezende, POL, ou Clarice Siqueira, FPT) desde o mês 1, com força de 0 a 100 e causas, postura (observa, desgaste com ataques mensais, obstrução na Câmara) e pesquisa de intenção de voto todo mês.
- **Promessas (v0.11):** acompanhadas no Painel (no rumo, em risco, longe) e cobradas no fim (cumprida, quase, quebrada); valem 300 dos 1000 pontos da **nota final**.
- **Fato do mês** com importância de 1 a 5, crises, boas notícias (promover, dar crédito ou ignorar) e consequências de leis antigas.
- **Cobranças dos grupos** com prazo, recompensa e penalidade.
- **Memória do mundo:** leis, MPs e obras plantam consequências que brotam meses ou anos depois. Há herança do governo anterior e o tempo é absoluto, pronto para vários mandatos.
- **Fichas:** biografia acumulada de cada personagem e memória do país.
- **Causa e consequência (v0.16):** Ficha de governo, 10 marcas de reputação (medida impopular marca no envio), marcas pesando todo mês, 10 desdobramentos ligados ao que você fez, capítulos da presidência a cada 6 meses (narração opcional pela IA), reputação e exposição a escândalo no Painel.
- **O mês mais vivo (v0.17):** três caminhos para a crise (medida, post da assessoria grátis 1 por mês, rua), com peso do discurso, cansaço e penalidade de deixar passar amenizada; cartão "Sua agenda está limpa" com posts de agenda em mês sem crise; fato bom com resposta escrita e, no Normal e no Difícil, perda de oportunidade (a oposição leva o crédito); "Enquanto você decidia" (oposição, empresariado e Câmara, com o porquê) no passo 1 do mês seguinte.
- **Câmara e partidos (v0.18):** cada partido tem 3 alas com chefe e lealdade (ala pouco leal trai a orientação); placar com orientação das bancadas, traidores, abstenções, ausentes e piso; líder do seu partido indicável (articulador, disciplinador ou popular); eleições internas todo fevereiro; eleição da Mesa em fev/2027 e fev/2029 (apoiar com moeda ou lançar candidato próprio); conversa por tipos com chance (pedir apoio, apelar à base, oferecer espaço, endurecer); contraoferta; emendas individuais ou de bancada com destino; concessões no texto (escritas pela IA, se ligada); janela da medida em 3 etapas com nota de freios e contrapesos; nome da medida; ministério e urgência valendo na hora.
- **Retratos:** 110 fotos, cada uma usada por uma pessoa só, e 88 retratos ilustrados (111 a 198) feitos pelo Douglas. 106 rostos livres para personagens novos e para o presidente (18 foram para os chefes de ala na v0.18). O presidente escolhe o rosto na posse (41 livres) e 15 retratos ficam reservados para Defesa, povos indígenas, campo e tradições.

**Telas:** Posse em 3 passos, Painel (com cara de jogo, animações, plantão de notícias, cartões de Oposição, Promessas e Supremo), Governo com quatro abas: **Câmara** (mesa de sanção, presidente da Câmara, pauta com a chance nas duas casas, partidos e articulação, frentes, leis com reação), **Senado** (casa, presidente, pauta e votações), **Supremo** (ministros, ações, liminares, projetos travados, consultas, decisões, vaga) e **Ministérios** (desgaste, meta e reforma), e Fichas. Nação, Economia, Diplomacia, Programas e Vida pessoal aparecem bloqueadas.

**Onde está cada coisa**
- `CLAUDE.md`: regras do projeto e quando abrir uma conversa nova.
- `docs/DESIGN.md`: decisões de desenho, seções 1 a 27 (Supremo em 24.2, 24.2.1 e 26; como ficou a 4C3 em 26.8; plano novo por etapas na seção 27, com a 1A em 27.3, a 1B em 27.4 e a 2 em 27.5).
- `docs/levantamento-video-1.md`: o que o jogo de referência tem e nós não (vídeo 1).
- `CHANGELOG.md`: novidades de cada versão.
- `docs/RELEASES.md`: como publicar.

---

## Roteiro

1. ✅ Retratos e elenco fixo (v0.4.1)
2. ✅ Memória do mundo, consequências, importância, fatos bons e herdados, biografias (v0.5.0)
3. ✅ **3A** resposta em texto ao fato do mês, ministro responsável, catálogo grande de medidas (v0.6.0) · ✅ **3B** camada de IA: conselho do ministro, interpretação do texto livre, chave própria, plano B (v0.7.0) · ✅ **3C** medidas livres montadas pela IA (v0.9.0)
4. ✅ **4A** votação com negociação por lideranças (v0.8.0) · ✅ **4B** Congresso 2.0, votação animada, voto simbólico e reação da sociedade (v0.10.0)
5. Entre mandatos: ✅ **5A** rival, ficha do candidato e promessas de posse (v0.11.0) · **5B** 27 estados e apuração (depois da 4F) · **5C** governo seguinte e herança (depois do vídeo do fim de mandato)
4C. ✅ **4C1** Senado votando (v0.12.0) · ✅ **4C2** Supremo julgando medidas (v0.13.0)
4C3. ✅ **4C3** Supremo no caminho das medidas e abas (v0.14.0). As etapas 4D, 4E e 4F foram fundidas no plano novo (abaixo).

**Plano novo (DESIGN.md, seção 27):** ✅ **0** a rodada (v0.15) · ✅ **1A** causa e consequência (v0.16) · ✅ **1B** o mês mais vivo (v0.17) · ✅ **2** Câmara e partidos (v0.18) · ⏭️ **3** Senado · **4** Supremo profundo · **5** oposição, escândalos e CPI · **6** vice e governo · **7** estados e governadores · **8** começo, sociedade e fim · **9** arte final
6. Depois: Senado com poderes próprios (impeachment), imprensa e pesquisas, orçamento anual, ícones próprios

## Decisões já tomadas (resumo; detalhes no DESIGN.md)

- Mecânicas inspiradas no jogo de referência; nomes, textos, arte e números próprios. Personagens e partidos fictícios, com bancadas inspiradas na Câmara eleita em 2026.
- Campanha contínua entre mandatos, com painel de eleição.
- IA entra na etapa 3B, com chave de API própria e plano B por palavras-chave. Modelo local descartado por ora (DESIGN.md, seção 17).
- O Senado vota leis desde a v0.12 (substitui a decisão antiga de não votar). Poderes próprios (sabatinas, impeachment) e negociação por bancada estadual vêm depois.
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
| 30/10/2026 | — | Levantamento do vídeo 1 copiado para `docs/levantamento-video-1.md`; etapa 5 dividida em 5A, 5B e 5C; plano da 5A no DESIGN.md (seção 23), aguardando aprovação |
| 30/10/2026 | v0.11.0 | Etapa 5A: posse em 3 passos, traços e hábitos, 5 promessas de posse com meta, rival com força, postura, ataques, obstrução e pesquisa mensal; nota final com promessas; save 9 |
| 30/10/2026 | — | Decisão: 4C (Senado e Supremo) antes da 5B; plano aprovado no DESIGN.md (seção 24), dividido em 4C1 Senado e 4C2 Supremo; retratos novos saem dos livres |
| 30/10/2026 | v0.12.0 | Etapa 4C1: Senado com 81 senadores votando depois da Câmara (lei, LC e MP no mesmo mês; PEC no seguinte, em dois turnos), presidente do Senado, rejeição com custo, negociação com 2 lideranças, abas Câmara/Senado na votação e painel de 81 cadeiras; save 10 |
| 30/10/2026 | v0.13.0 | Etapa 4C2: Supremo com 11 ministros, risco jurídico em todas as medidas (mostrado antes de assinar), ações da oposição, julgamento voto a voto com animação, derrubada com fato do mês (acatar, nova proposta, criticar), vaga aos 75 anos com 3 indicáveis e sabatina no Senado; save 11 |
| 30/10/2026 | — | Plano das etapas 4D (Congresso ao vivo), 4E (janelas) e 4F (mês mais vivo) aprovado e escrito no DESIGN.md (seção 25); a 5B passa para depois da 4F |
| 30/10/2026 | — | Decisão: nova etapa 4C3 (Supremo no caminho das medidas, liminar, travar votação, consulta, abas Câmara/Senado/Supremo/Ministérios) antes da 4D; plano no DESIGN.md (seção 26); versões das etapas seguintes renumeradas (4D v0.15, 4E v0.16, 4F v0.17) |
| 30/10/2026 | v0.14.0 | Etapa 4C3: risco jurídico pela regra do instrumento (31 medidas), ação quase certa para risco alto, liminar com fato do mês (esperar, recuar, recorrer, criticar), projeto travado no Supremo, filtro da CCJ, consulta ao Supremo; abas Câmara · Senado · Supremo · Ministérios, com desgaste, meta por pasta e reforma ministerial; save 12 |
| 30/10/2026 | — | Plano novo por etapas com portão (DESIGN.md, seção 27), fundido com 4D/4E/4F: medida do mês vota na hora, 1 projeto da fila por casa, Supremo na mesma rodada |
| 31/10/2026 | v0.15.0 | Etapa 0: a rodada. Votar agora (Câmara → Senado), pautar da fila, articulação na hora, gaveta avisada, MP caduca, Supremo na mesma rodada, faixa da rodada, ilustrações provisórias; save 13 |
| 31/10/2026 | v0.16.0 | Etapa 1A: Ficha de governo, 10 marcas de reputação, desdobramentos, capítulos da presidência com narração pela IA, reputação e escândalo no Painel; 30 retratos provisórios; save 14 |
| 31/10/2026 | v0.16.1 | 88 retratos ilustrados do Douglas (111 a 198) no lugar dos 30 provisórios |
| 31/10/2026 | v0.17.0 | Etapa 1B: post da assessoria (grátis, 1 por mês, com peso do discurso e cansaço), rua (7 crises e fala ao país), agenda limpa, fato bom com resposta escrita e perda de oportunidade (Normal e Difícil), "enquanto você decidia"; save 15 |
| 31/10/2026 | v0.18.0 | Etapa 2: alas e lealdade, traidores no placar, líder indicável, eleições internas, eleição da Mesa (apoio e candidato próprio), conversa por tipos, contraoferta, emendas detalhadas, concessões no texto pela IA, janela da medida em 3 etapas com nota de freios e contrapesos, nome da medida, ministério e urgência na hora; 18 chefes de ala; save 16 |
