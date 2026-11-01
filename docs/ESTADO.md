# Estado atual do GoverNation

> **Leia este arquivo primeiro.** Ele diz onde o projeto está e qual é o próximo passo.
> Atualize-o a cada mudança: seção "Estado atual", "Próximo passo" e uma linha no "Histórico".

**Última atualização:** 01/11/2026 · **Versão publicada:** v0.23.0

---

## Próximo passo

**Etapa 5: Oposição, escândalos e CPI** (ainda sem plano detalhado; ver `docs/DESIGN.md`, seção 27, e `docs/levantamento-congresso.md`, itens 43 a 46): CPI com 171 assinaturas por 6 meses ("trabalhar as assinaturas" ou "cooperar"), relatório pelas provas, esquemas de corrupção (Controle do Estado, pastas de risco), esquema que estoura e custa bancada na eleição, serviço de inteligência. A Etapa 4 (Supremo profundo) fechou na v0.23: ver 27.13 e 27.14. Primeiro passo: escrever o plano da Etapa 5 no DESIGN.md e aprovar com o Douglas.

Complexidade: **alta**. Opus para o plano e as regras; Sonnet nas telas.

Para começar numa conversa nova: *"Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md (seção 27). Quero planejar a etapa 5."*

**Sugestão (opcional, 1B):** pedir a um Opus uma revisão final dos números da assessoria (`data/assessoria.ts`: `postScale`, `omissoShare`, `fatigueFactor`, `softenMax`; e `data/rua.ts`). O simulador mostra que ficou equilibrado (DESIGN.md 27.4), mas é a primeira etapa balanceada fora do Opus.

**Material de campanha guardado** (para a Etapa 8): `arte/campanha/` (kit por partido, caminhadas, editor de cartazes; ver o LEIAME).

**Pendência do Douglas:** mandar as ilustrações dos slots (`public/art/LEIAME.md`) quando quiser. Retratos: 198 no total, 97 livres; para gerar provisórios de quem ainda não tem rosto, `scripts/retratos-provisorios.py` (sai em `scripts/retratos-provisorios/`, a partir do 199).

---

## Estado atual (o que o jogo já tem)

**Base técnica**
- App de Windows (Tauri 2 + React + TypeScript). O instalador é gerado pelo GitHub Actions e o jogo se atualiza sozinho, com atualização assinada.
- O motor do jogo (`src/game/`) fica separado das telas (`src/ui/`). Os números de balanceamento ficam em `src/game/data/`.
- 304 testes automáticos. Saves antigos são migrados (versão atual do save: 22).

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
- **Página inicial e fluxo do dia (v0.19):** fato do mês em destaque com **Agir** (resumo da assessoria, opinião do ministro com 2 ou 3 ordens, campo de escrever, post e rua) ou **Deixar passar** (sem opções prontas, menos nos fatos do Supremo); central de pendências por urgência; "o que mudou no mês passado" recolhido no fim; corrente de janelas "Etapa N de M" (Leitura → Ficha → Votação → Placar → Supremo → O país reage → Encerrar o mês), também para decreto e MP; quem vai reagir (8 reações com chance e efeito, sorteadas no envio); notas Congressual e Judicial, risco jurídico em número, potencial de crescimento e resumo executivo; **o Supremo julga no mesmo dia** (ação, relator, liminar e plenário); mercado precifica 1/3 da lei no envio; "já valeu" (prévia da aprovação) e primário antes → depois.
- **Mesa de negociação e base (v0.20):** acordo vale na Câmara e no Senado (3 conversas por rodada no total); cardápio de 2 ou 3 pedidos por liderança (14 tipos, de emendas e obra a pasta, relatoria, favor e palanque), cada um com os votos que converte nas duas casas; as ruas (ato nacional ≈ +6 votos, greve geral ≈ +12, com chance de esvaziar e de confronto); pauta que esfria e é arquivada em 6 rodadas; base como contrato (cota de 80% dos presentes, linha vermelha, fidelidade 0 a 100, "A base nesta votação", "Base X · Fiel Y"); pacto de base sem ministério (6 meses, sondar de graça, até 3); registro de como cada partido votou e quem isso agradou ou desagradou ("Como os partidos votaram" nas Fichas), medida barrada e "com os votos de quem" na Ficha de governo.
- **Senado por estado (v0.21):** 27 estados (nomes reais) com 3 senadores fictícios cada e os deputados proporcionais; relação de cada bancada estadual com o governo e pedido (obra, cargo, não negocia, com você); senador vota pelo estado; página do Senado com "Como o Senado está hoje", bancadas com filtros, "Pagar as N obras" e 9 líderes de bancada; indecisos com preço na votação (até 3 por rodada); comissões do Senado (CCJ e CAE) que desidratam sem devolver à Câmara; meia sessão em junho e dezembro; impeachment de ministro (54 votos, fato do mês); pacto de base mais exigente. **v0.21.1:** plenário em semicírculo, ficha de cada senador (fama, imagem no estado, votos, acordos), presidente do Senado com opções liberadas pela relação menos a cobrança, falar direto com um senador, valor diferente de cada favor nos estados, cartões dos estados com logos, votações resumidas; post da assessoria fora da página inicial.
- **Supremo profundo, parte 1 (v0.22):** a ação chega com autor (partido, entidade fictícia, Procuradoria ou governo de um estado), tipo e fundamento; 5 doutrinas (garantista, conservador, fiscalista, formalista, federalista), cada uma pesando um tipo de fundamento; relator por sorteio animado ou por prevenção, e quem tem a doutrina dele tende a segui-lo; **trabalhar o plenário** (até 2 audiências com indecisos, que podem vazar) ou **aguardar o julgamento**; **pedido de vista** (o julgamento para 1 a 3 rodadas; dá para trabalhar de novo ou recuar); acórdão com a frase de cada ministro e o porquê em selos.
- **Supremo profundo, parte 2 (v0.23):** índice "A seu favor" da Corte (0 a 100), que multiplica liminar, vista e projeto travado; precedente de cada julgamento por 24 meses (a favor protege o fundamento; contra o deixa mais arriscado, e a leitura do gabinete avisa); depois da derrubada, seis saídas com o custo à vista (acatar, nova proposta, criticar, **embargos**, **o ministro da área sai**, **descumprir**); **"O Supremo pede você"**: a cada 2 anos, a cadeira de jurista no tribunal eleitoral, com 4 juristas, rigor e preço (o rigor fica guardado para a eleição).
- **Logos dos partidos (v0.19.1):** arte do Douglas em `public/logos/`, na posse, no Painel, na Câmara, nas lideranças e no cartão da oposição; número na urna de cada partido.
- **Retratos:** 110 fotos, cada uma usada por uma pessoa só, e 88 retratos ilustrados (111 a 198) feitos pelo Douglas. 97 rostos livres para personagens novos e para o presidente (18 foram para os chefes de ala na v0.18 e 9 para os líderes de bancada do Senado na v0.21). O presidente escolhe o rosto na posse (41 livres) e 15 retratos ficam reservados para Defesa, povos indígenas, campo e tradições.

**Telas:** Posse em 3 passos, Painel (com cara de jogo, animações, plantão de notícias, fato do mês em destaque, central de pendências, cartões de Oposição, Promessas e Supremo), Governo com quatro abas: **Câmara** (mesa de sanção, presidente da Câmara, pauta com a chance nas duas casas, partidos e articulação, frentes, leis com reação), **Senado** (casa, presidente, como está hoje, bancadas por estado, líderes, pauta e votações), **Supremo** (ministros, ações, liminares, projetos travados, consultas, decisões, vaga) e **Ministérios** (desgaste, meta e reforma), e Fichas. Nação, Economia, Diplomacia, Programas e Vida pessoal aparecem bloqueadas.

**Onde está cada coisa**
- `CLAUDE.md`: regras do projeto e quando abrir uma conversa nova.
- `docs/DESIGN.md`: decisões de desenho, seções 1 a 27 (Supremo em 24.2, 24.2.1 e 26; como ficou a 4C3 em 26.8; plano novo por etapas na seção 27, com a 1A em 27.3, a 1B em 27.4, a 2 em 27.5, o plano da 2B e da 2C em 27.6, como ficou a 2B em 27.7 e a 2C em 27.8; plano da Etapa 3 em 27.9, como ficou em 27.10 e os ajustes em 27.11; plano da Etapa 4 em 27.12, como ficou a v0.22 em 27.13 e a v0.23 em 27.14).
- `docs/levantamento-video-1.md`: o que o jogo de referência tem e nós não (vídeo 1).
- `docs/levantamento-congresso.md`: o mesmo para o Congresso, a medida do dia e o Supremo (prints de 31/10), com a proposta da Etapa 2B.
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

**Plano novo (DESIGN.md, seção 27):** ✅ **0** a rodada (v0.15) · ✅ **1A** causa e consequência (v0.16) · ✅ **1B** o mês mais vivo (v0.17) · ✅ **2** Câmara e partidos (v0.18) · ✅ **2B** página inicial e fluxo do dia (v0.19) · ✅ **2C** mesa de negociação e base (v0.20) · ✅ **3** Senado (v0.21) · ✅ **4** Supremo profundo (v0.22 e v0.23) · **5** oposição, escândalos e CPI · **6** vice e governo · **7** estados e governadores · **8** começo, sociedade e fim · **9** arte final
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
| 31/10/2026 | — | Levantamento do Congresso, da medida do dia e do Supremo (prints do jogo de referência) em `docs/levantamento-congresso.md`; proposta da Etapa 2B aguardando decisão |
| 31/10/2026 | — | Plano das etapas 2B e 2C (DESIGN.md 27.6) com as decisões do Douglas; levantamento do Congresso ampliado (CPI, Senado por estado, Painel); placeholders dos logos dos partidos |
| 31/10/2026 | v0.19.0 | Etapa 2B: fato do mês em destaque com Agir ou Deixar passar, central de pendências, corrente de janelas "Etapa N de M" (também decreto e MP), quem vai reagir, notas Congressual e Judicial, Supremo no mesmo dia, mercado no envio, "já valeu"; save 17 |
| 31/10/2026 | v0.19.1 | Logos dos partidos (arte do Douglas) no jogo e número na urna; material de campanha guardado em `arte/campanha/` para a Etapa 8 |
| 01/11/2026 | v0.20.0 | Etapa 2C: acordo nas duas casas, cardápio de pedidos (14 tipos), as ruas, pauta que esfria, base como contrato com fidelidade e "A base nesta votação", pacto sem ministério, registro de votos dos partidos; ruas calibradas no simulador novo (`npm run sim2c`); save 18 |
| 01/11/2026 | — | Decisão: pacto de base sem ministério mais exigente (ajuste no começo da Etapa 3) |
| 01/11/2026 | — | Pacto de base mais exigente (aprovação e pactos em vigor pesam; 24 → 11 a 16 pactos por mandato no simulador) e plano da Etapa 3 (Senado) no DESIGN.md 27.9, aguardando as respostas do Douglas |
| 01/11/2026 | v0.21.0 | Etapa 3: 27 estados com bancadas estaduais, senador vota pelo estado, página do Senado, indecisos com preço, comissões do Senado, meia sessão, impeachment de ministro, 9 líderes de bancada no Senado; save 19 |
| 01/11/2026 | v0.21.1 | Senado revisto: semicírculo, ficha dos senadores, opções da presidente do Senado com cobrança, falar direto com um senador, valor dos favores, cartões dos estados com logos, votações resumidas; post da assessoria fora da página inicial; save 20 |
| 01/11/2026 | — | Plano da Etapa 4 (Supremo profundo) no DESIGN.md 27.12, aprovado pelo Douglas (5 doutrinas, descumprir entra, TSE agora, duas versões) |
| 01/11/2026 | v0.22.0 | Etapa 4, blocos A a C: ação com autor (partido, entidade, Procuradoria, estado), tipo e fundamento; 5 doutrinas; relator por sorteio ou prevenção; trabalhar o plenário ou aguardar; pedido de vista; acórdão com frases; correção da MP no Supremo; simulador `npm run sim4`; save 21 |
| 01/11/2026 | v0.23.0 | Etapa 4, blocos D a F (a etapa fecha): índice "A seu favor" da Corte, precedentes, embargos, o ministro sai, descumprir a decisão, cadeira no tribunal eleitoral ("O Supremo pede você"); `npm run sim4` ampliado; save 22 |
