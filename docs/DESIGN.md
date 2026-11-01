# GoverNation — Documento de desenho (v0.1)

Jogo de simulação política para um jogador: você é presidente de um país inspirado no Brasil, governa mês a mês por um mandato de 48 meses e recebe uma nota no fim.

Este documento descreve **a primeira versão jogável**. Tudo que não está aqui entra em versões futuras (ver "Roteiro").

---

## 1. Princípios

1. **Toda vantagem tem um custo.** Nenhuma medida só traz benefícios.
2. **Efeitos demoram.** Juros, obras e reformas agem ao longo de meses, não no mesmo turno.
3. **Valores têm limites e retornos decrescentes.** Insistir na mesma alavanca rende cada vez menos.
4. **O jogador sempre vê o porquê.** Cada mudança importante mostra suas causas principais ("inflação subiu: gasto público +0,3; câmbio +0,1").
5. **Os números moram em arquivos de dados, não no código.** Assim dá para ajustar o balanceamento sem reescrever o jogo.

---

## 2. Estrutura de um turno (1 mês)

1. **Briefing:** jornal do mês com indicadores, crise do mês (se houver) e cobranças dos grupos.
2. **Ação principal:** propor **uma medida** (ou responder à crise).
3. **Ações secundárias:** até 2 articulações políticas (conversar com partido, liberar emendas, ir à TV).
4. **Congresso:** se a medida precisa de votação, ela é votada deputado a deputado.
5. **Fechamento:** economia, aprovação e relações são recalculadas. Efeitos atrasados de meses anteriores são aplicados.

Calendário fixo: recesso em janeiro e julho (sem votações), Copom a cada ~6 semanas (8 reuniões/ano), eleição no mês 46 (outubro do 4º ano).

---

## 3. Variáveis do país

### 3.1 Economia

| Variável | Faixa | Valor inicial | Observação |
|---|---|---|---|
| Crescimento do PIB (% ao ano) | -8 a 8 | 2,0 | Média móvel dos últimos 12 meses |
| Inflação (% em 12 meses) | -2 a 40 | 4,5 | Meta 3,0, tolerância ±1,5 |
| Juros básicos (% ao ano) | 2 a 25 | 13,75 | Definidos pelo Banco Central |
| Desemprego (%) | 3 a 20 | 6,5 | Segue o PIB com atraso (lei de Okun) |
| Dívida / PIB (%) | 30 a 150 | 77 | Muda com déficit, juros e crescimento |
| Resultado primário (% do PIB) | -6 a 4 | -0,5 | Receita menos despesa, sem juros |
| Confiança do mercado | 0 a 100 | 50 | Afeta câmbio, juros longos e investimento |
| Câmbio (moeda local por dólar) | 3 a 10 | 5,4 | Sobe com desconfiança, empurra inflação |

### 3.2 Regras econômicas mensais (versão simplificada)

- **Inflação:** puxada por inércia (70% do mês anterior), pela expectativa (confiança do mercado), pelo câmbio e pelo excesso de gasto público. Juros altos a reduzem com atraso de 6 a 9 meses.
- **Crescimento:** cai com juros altos (atraso de 6 a 12 meses), sobe com investimento público, confiança e reformas. Choques (crises) entram direto.
- **Desemprego:** para cada 1 ponto de crescimento acima de 2,5%, o desemprego cai cerca de 0,4 ponto ao longo de um ano.
- **Dívida:** sobe quando os juros reais superam o crescimento ou quando há déficit primário.
- **Banco Central:** independente. Segue uma regra simples (sobe juros se a inflação esperada passa da meta). O presidente pode **pressionar**, o que ajuda no curto prazo e derruba a confiança do mercado.

### 3.3 Grupos sociais

Cada grupo tem **aprovação de 0 a 100** e um **peso na população**. A aprovação geral é a média ponderada.

| Grupo | Peso | Se importa com |
|---|---|---|
| Trabalhadores formais | 25% | emprego, salário real, direitos |
| Famílias de baixa renda | 25% | programas sociais, preço da comida, inflação |
| Classe média urbana | 20% | inflação, impostos, serviços públicos, segurança |
| Empresários e mercado | 5% | impostos, dívida, regras estáveis |
| Agronegócio | 10% | crédito rural, câmbio, meio ambiente (contra regras rígidas) |
| Servidores públicos | 5% | salários, concursos, previdência |
| Jovens | 10% | emprego, educação, internet, meio ambiente |

Memória dos grupos: **ganhos são esquecidos em ~9 meses, perdas em ~24 meses.** Grupos com aprovação muito baixa geram **protestos** (crise do mês).

---

## 4. Congresso

### 4.1 Composição

- **513 deputados** individuais e **81 senadores**.
- **8 partidos fictícios**, cada um com:
  - posição econômica (-100 estatista a +100 liberal)
  - posição de costumes (-100 progressista a +100 conservador)
  - tamanho da bancada
  - **disciplina** (quanto os deputados seguem a orientação do partido)
  - **relação com o governo** (0 a 100)
- Cada deputado tem a posição do partido com uma variação pessoal, uma **região** e uma **fidelidade**.

### 4.2 Como um deputado vota

Para cada medida, cada deputado calcula uma pontuação:

```
pontuação = afinidade ideológica com a medida
          + relação do partido com o governo
          + orientação do partido × disciplina
          + pressão da base eleitoral (aprovação da medida entre os eleitores dele)
          + favores recebidos (emendas, cargos)
          + ruído aleatório pequeno
```

Pontuação acima de zero vota **sim**, abaixo vota **não**. Uma parte se **abstém** se a pontuação estiver muito perto de zero.

### 4.3 Instrumentos

| Instrumento | Votos necessários | Efeito |
|---|---|---|
| Decreto | Nenhum | Só para assuntos administrativos (remanejar até um teto, ajustar alguns impostos regulatórios) |
| Medida provisória | Maioria simples em até 4 meses | Vale na hora; se cair, os efeitos são desfeitos e há custo político |
| Lei ordinária | Maioria simples dos presentes | Efeito após aprovação |
| Lei complementar | 257 deputados e 41 senadores | Temas fiscais e estruturais |
| Emenda constitucional | 308 deputados e 49 senadores, em 2 turnos | Mudanças profundas |

O jogo escolhe o instrumento de acordo com o tipo de medida. O jogador pode tentar um instrumento "mais fácil", com risco de questionamento.

### 4.4 Articulação

- **Conversar com partido:** sobe a relação, uma vez por mês por partido.
- **Liberar emendas:** sobe o apoio imediatamente, mas custa dinheiro (piora o primário).
- **Ceder ministério:** o partido entra na base e vota mais com o governo; se a promessa for quebrada, a relação despenca.
- **Ir à TV:** pressão popular sobre os deputados, gasta capital político.

---

## 5. Medidas

### 5.1 O que é uma medida

Toda medida, venha de um catálogo ou (no futuro) de texto livre interpretado por IA, vira a mesma estrutura:

```
Medida {
  título
  tema (fiscal, social, trabalho, meio ambiente, segurança, ...)
  instrumento
  posição econômica e de costumes da medida
  custo ou receita por mês
  efeitos: lista de { variável, valor, atraso em meses, duração }
  impacto em cada grupo social
}
```

Isso permite começar com um **catálogo de medidas prontas com parâmetros** (v0.1) e depois ligar a IA, que só precisa preencher essa mesma estrutura.

### 5.2 Catálogo inicial (exemplos)

- Ajustar alíquota de imposto (renda, consumo, empresas), com retorno decrescente
- Criar, ampliar ou cortar programa social
- Investimento em obras (com prazo de execução)
- Reajuste do salário mínimo
- Reforma trabalhista ou previdenciária (efeito lento e forte)
- Regra fiscal (teto de gasto ou meta)
- Política ambiental (endurecer ou flexibilizar)
- Privatizar ou capitalizar estatal
- Segurança pública (mais polícia, mudança penal)

---

## 6. Crises e eventos

Todo mês há uma chance de crise, maior quando os indicadores estão ruins:
- choque externo (crise global, alta do petróleo)
- desastre natural
- escândalo de corrupção
- greve ou protesto de um grupo insatisfeito
- crise com um partido da base

Cada crise oferece de 2 a 4 respostas, cada uma com custos diferentes. Ignorar a crise também é uma opção, e geralmente ela piora.

---

## 7. Eleição e nota final

### 7.1 Eleição (mês 46)

A chance de reeleição depende da aprovação geral, do desemprego e da inflação nos últimos 12 meses. Na v0.1 não há campanha jogável.

### 7.2 Nota final (0 a 1000)

| Componente | Peso |
|---|---|
| Aprovação média no mandato | 25% |
| Indicadores no fim (crescimento, desemprego, inflação na meta) | 30% |
| Medidas aprovadas e promessas cumpridas | 25% |
| Saúde fiscal (dívida, primário) | 20% |

Descontos: crises não respondidas, impeachment, inflação acima de 10%.

---

## 8. O que fica fora da v0.1

- Texto livre interpretado por IA
- Supremo, impeachment detalhado, CPI
- Governadores e estados
- Imprensa e redes sociais
- Empresas e estatais detalhadas
- Campanha eleitoral jogável

---

## 9. Roteiro

| Versão | Conteúdo |
|---|---|
| 0.1 | Estrutura do app, atualização automática, tela inicial ✓ |
| 0.2 | Motor de economia e grupos, turno mensal, ações por decreto, salvar e carregar ✓ |
| 0.3 | Congresso com 513 deputados e votação ✓ |
| 0.4 | Fato do mês (crises com escolha), cobranças dos grupos, caricaturas ✓ · catálogo maior de medidas e nota final ainda pendentes |
| 0.5 | Texto livre com IA preenchendo a estrutura de medida |
| 0.6+ | Supremo, imprensa, estados, campanha, conquistas |

---

## 10. Técnica

- **App:** Tauri 2 (instalador leve para Windows) com interface em React + TypeScript.
- **Motor do jogo:** TypeScript puro, sem dependência da interface, para poder ser testado sozinho.
- **Dados de balanceamento:** arquivos JSON em `src/game/data/`.
- **Saves:** guardados na pasta de dados do usuário no Windows, fora da pasta do programa. Atualizações não apagam saves.
- **Atualizações:** GitHub Releases + atualizador do Tauri com assinatura digital.

---

## 11. Decisões de desenho (29/10/2026)

Tomadas depois de estudar o tutorial do jogo de referência. Valem para as próximas versões.

1. **Roteiro por blocos, integrando a cada bloco** (não só no fim). Ordem: base → medidas e Congresso → orçamento e impostos → reação do país → instituições → eleição e nota final → texto livre com IA → expansões.
2. **Senado simplificado:** não vota leis. Sabatina indicados ao Supremo e julga ministros do tribunal. Isso reduz bastante o trabalho do Congresso.
3. **Texto livre com IA** continua depois de um catálogo de medidas sólido (bloco 6).
4. **Efeitos mais rápidos:** a causa deve aparecer para o jogador em cerca de 2 a 4 meses, em vez de 7 a 12. O painel de causas continua explicando o que mexeu em cada indicador.
5. **O mês é um recurso:** algumas ações (viagem, audiência, reunião) ocupam o mês inteiro; escolher uma é abrir mão de outra.
6. **Painel de trabalho** com assunto do mês no centro e uma "banca de jornal" com manchetes que apontam o problema. Serve também para ensinar o jogador a ler a situação.
7. **Gasto público em áreas** (infraestrutura, saúde, educação, outras), com investimento elevando o crescimento no longo prazo.
8. **Grupos por interesse e identidade** (por exemplo evangélicos, sindicalistas, agro, periferia, mercado, militares, universitários), com presença diferente em cada estado. Os dados por estado entram na base; o mapa vem depois.
9. **Risco-país** como indicador.
10. **Vários finais**, tutorial revisável nas configurações e botão de bugs e sugestões em toda tela.

Fica para os blocos seguintes: gabinete, governadores, gabinete secreto, empresas, diplomacia, projetos de mandato inteiro, vida pessoal do presidente.

---

## 12. Visual e painel (29/10/2026, v0.2.1)

1. **Cara de jogo sem perder complexidade:** ícones, animações e elementos visuais que contam a história (banca de jornal, calendário virando, plantão). Os ícones atuais são emojis provisórios.
2. **O mês em 3 passos visíveis:** o que aconteceu → suas decisões → encerrar o mês.
3. **A medida do mês fica sempre à vista**, num quadro próprio. Hoje ela é lida por palavras-chave (`src/game/interpret.ts`) e aponta para o catálogo de decretos; na v0.5 a IA preenche a mesma estrutura.
4. **Seções futuras aparecem bloqueadas no menu**, para o jogador entender o que vem.
5. **Antes de governar haverá uma campanha** (criação do personagem, semanas de palanque, mapa por estado, pesquisas, montagem do ministério), como no jogo de referência. Entra depois que o governo estiver completo.

---

## 13. Congresso como implementado (v0.3)

Ajustes em relação à seção 4:

- **9 partidos fictícios** (não 8), com bancadas inspiradas na Câmara eleita em 2026: `src/game/data/parties.ts`.
- **O jogador escolhe o partido** ao tomar posse (esquerda, centro ou direita). A relação inicial de cada partido depende da distância ideológica ao partido do presidente e do quanto ele é fisiológico.
- **Senado não vota leis** (decisão 2 da seção 11).
- **Regra de voto** (`src/game/congress.ts`): afinidade ideológica (peso maior), relação com o governo, orientação do partido × lealdade do deputado, popularidade da medida nos grupos, aprovação do governo, emendas recebidas e um viés a favor do status quo (mais forte em PEC). Ruído por deputado e um "humor do dia" por bancada. Pontuação perto de zero vira abstenção; cerca de 4% faltam.
- **Calibragem:** medidas populares (isenção do IR, reforma tributária) passam com qualquer presidente; tributar dividendos não passa num Congresso inclinado à direita; reforma administrativa empaca; privatizar depende do lado do presidente. A previsão do gabinete acerta mais de 90% dos resultados claros (teste automático).
- **Ritmo do mês:** até 2 decretos + 1 projeto para a Câmara + até 2 articulações. Projetos são votados no fim do mês de envio (MP no mês seguinte); no recesso (janeiro e julho) esperam.
- **Articulação:** conversar sobe a relação (+7, uma vez a cada 3 meses por partido); emendas dão um bônus que cai pela metade por mês e custam ~0,03% do PIB por 3 meses. Partidos não fisiológicos não aceitam emendas.
- **Derrota custa:** projeto rejeitado tira ~1 ponto de todos os grupos e só pode ser reenviado em 6 meses. MP derrubada desfaz o efeito e os grupos que ganharam perdem parte do ganho.
- **Fica para depois:** ceder ministérios a partidos, emendas parlamentares ao orçamento, CPIs, federações e troca de partido.

---

## 14. Fato do mês, cobranças e personagens (v0.4)

- **Fato do mês** (`src/game/data/events.ts`, `src/game/events.ts`): sorteado no começo de cada mês (80% de chance), sem repetir o mesmo fato em 18 meses. Alguns dependem do estado do país (`when`). Cada opção tem efeitos (mesma estrutura das ações), mudanças de relação com partidos e uma manchete. A opção `default` vale se o jogador não decidir e costuma ser a pior: ignorar tem custo.
- **Cobranças** (`src/game/data/demands.ts`): até 3 abertas; chance de 35% por mês (×1,5 se algum grupo estiver abaixo de 40%); grupos menos satisfeitos cobram mais. São atendidas por decreto, MP editada ou lei aprovada dentro do prazo. Recompensa e penalidade entram como memória do grupo.
- **Caricaturas** (`src/ui/Caricature.tsx`): desenho em SVG gerado a partir de uma semente (mesmo nome, mesmo rosto). Provisórias até haver arte própria. Todos os personagens são fictícios.
- **Efeito no balanceamento:** estratégias que nunca respondem aos fatos do mês perdem cerca de 60 pontos de nota no simulador (a ordem entre estratégias não muda).

### 14.1 Retratos e elenco (v0.4.1)

- 110 retratos em `public/portraits/` (marcados por sexo, idade e traços em `src/game/data/portraits.ts`). Regra: **um retrato por pessoa, sem repetir**. O elenco está em `src/game/data/cast.ts` e há teste automático contra repetição.
- Retratos reservados (`RESERVED`) para personagens futuros: Forças Armadas, magistratura, povos indígenas, campo e tradições de matriz africana. O presidente escolhe entre os 72 livres.
- Todo personagem novo (ministro, líder, governador) precisa entrar no `CAST` com um retrato livre ou reservado; o teste falha se faltar.

---

## 15. Decisões de 29/10 à noite (rumo à v0.5)

1. **Campanha contínua:** os mandatos se encadeiam. Entre um e outro haverá um painel de eleição. Se o jogador perder, o jogo simula o governo seguinte, que deixa leis e consequências para o mandato futuro.
2. **Memória do mundo:** toda lei, decreto, programa e resposta a fato do mês vira uma "semente" gravada (data, autor, partido) que brota depois como fato bom ou ruim, inclusive mandatos adiante.
3. **Fatos do mês com importância de 1 a 5**, fatos bons ou herdados (promover-se, dar crédito ou ignorar) e resposta em texto, com "pedir leitura do ministro". A resposta aceita vira decreto, PL, MP ou PEC e **não gasta a medida do mês**.
4. **Texto livre sem IA por enquanto:** catálogo maior de medidas por área, com palavras-chave. IA fica para depois e, por ser um jogo pessoal, pode ser um modelo local ou uma chave própria.
5. **Congresso 2.0** antes do Senado: veto e derrubada, relator e emendas ao texto, comissões e presidente da Câmara, frentes temáticas, pautas-bomba, ministérios cedidos. O Senado votando PEC e lei complementar fica para depois.

---

## 16. Memória do mundo, consequências e biografias (v0.5)

- **Sementes** (`src/game/memory.ts`, regras em `src/game/data/consequences.ts`): ao aprovar uma lei, editar uma MP ou antecipar obras, o jogo planta sementes com autor, partido, data e mês de brotar. Ao brotar, a semente entra numa fila e vira o fato do mês seguinte (fila tem prioridade sobre o sorteio). O texto do fato recebe {lei}, {autor} e {ano}.
- **Tempo absoluto:** `term` (mandato) e meses absolutos desde jan/2027, para as sementes atravessarem mandatos na campanha contínua.
- **Herança:** o 1º mandato recebe 3 sementes do "Governo anterior" (partido rival do jogador).
- **Importância 1–5** em todo fato; os padrões de fatos pequenos têm pouco ou nenhum custo.
- **Fatos bons** (`kind: 'bom'`): promover (risco de 35% de desmentido se o autor for outro, com perda em classe média, jovens e trabalhadores), dar crédito (+6 de relação com o partido do autor) ou deixar passar (sem efeito). Alguns bons são sorteáveis (`random: true`), os ligados a leis só nascem de sementes.
- **Biografias** (`bios`, por nome): posse, sanções e derrotas do presidente, decisões em fatos importantes; voto orientado por cada líder em cada votação; conversas e emendas; o que cada ministro levou ao presidente. Limite de 200 registros por pessoa.
- **Crônica do país** (`world.chronicle`): leis, heranças e consequências, para a futura tela de eleição e para os mandatos seguintes.
- Resposta em texto ao fato do mês: feita na v0.6 (seção 18).

---

## 17. IA entra na etapa 3 (30/10/2026)

Substitui a decisão 4 da seção 15 ("texto livre sem IA por enquanto").

1. **A IA entra agora.** A leitura por palavras-chave ficou simples demais e os conselhos dos ministros precisam ter a cara de cada um.
2. **A IA interpreta e fala; o motor calcula.** Ela devolve a estrutura de medida (instrumento, área, efeitos) e o motor valida, limita os valores e faz as contas. Nunca decide números sozinha.
3. **O ministro fala a partir da ficha:** biografia acumulada, partido, relação com o presidente e estado real do país (economia, Congresso, grupos). O conselho tem de ser coerente com a situação e com a personalidade dele.
4. **Modo híbrido:** sem chave ou sem internet, o jogo usa a leitura por palavras-chave (plano B). Erro ou resposta inválida da IA também cai no plano B, sem travar a partida.
5. **Chave de API própria**, digitada nas configurações do jogo e guardada só no computador do jogador. **O repositório é público: a chave nunca vai para o código, para o save ou para os logs.**
6. **Modelos por tarefa:** um modelo barato (Haiku) para as falas dos ministros e um intermediário (Sonnet) para interpretar medidas. Medir o custo de uma partida de 48 meses antes de fixar a escolha.
7. **Modelo local descartado por ora:** exige placa de vídeo forte, instalação complicada e rende pior em português.
8. **Etapa 3 dividida:** 3A (catálogo de ~80 medidas, fato com área e ministro responsável, campo "agir", tudo por palavras-chave) e 3B (camada de IA com configuração da chave, interpretação estruturada, conselho dos ministros e plano B). A 3A vem primeiro e serve de base e de plano B para a 3B.


---

## 18. Resposta ao fato do mês, ministros e catálogo (v0.6, etapa 3A)

- **Áreas e ministros** (`src/game/data/ministers.ts`): 13 áreas, cada uma com um ministro no `CAST`. Todo `EventDef` tem `area`; quem apresenta o fato pode ser outra pessoa (governador, líder sindical), mas o ministro da área é o responsável pela resposta.
- **Catálogo** (`src/game/data/measures.ts`): 81 medidas novas somadas às 10 leis antigas em `BILLS` (91), mais os 7 decretos rápidos de `actions.ts`. `BillId` virou texto livre e o instrumento ganhou `decreto` (vale na hora, sem votação, entra em `congress.laws` e não se repete).
- **Resposta escrita** (`MonthPlan.eventResponse`, `responseBlockedReason` em `game.ts`, `interpretResponse` em `interpret.ts`): só vale medida da mesma área do fato e não vale para boa notícia. Substitui as opções prontas e não gasta a medida do mês (pode haver as duas no mesmo mês, desde que sejam medidas diferentes).
  - Decreto ou MP: resolve na hora; o custo de ignorar não é aplicado.
  - Lei, lei complementar ou PEC: resolve se aprovada no fim do mesmo mês. Em recesso ou se for rejeitada, aplica-se a opção padrão do fato (o problema segue), e a lei continua na pauta.
  - O relatório do mês guarda `event.response` e `event.resolved` (`option: -1` quando resolvido).
- **Sementes do catálogo** (`consequences.ts`): regra padrão de 45% (leis) ou 30% (decretos) de render, 8 a 20 meses depois, o fato bom `frutos_<área>`; algumas medidas têm sementes próprias (reforma da Previdência, desoneração da folha, presídios, agrotóxicos).
- **Balanceamento:** no simulador, a estratégia equilibrada que responde a todo fato com o decreto mais barato da área sobe de 566 para 637 pontos. É o tamanho do custo de ignorar os fatos (seção 14), e responder ainda custa dinheiro.
- **Para a 3B:** a IA só precisa devolver o id de uma medida do catálogo (ou a mesma estrutura de `BillDef`), e `interpretResponse` vira o plano B.


---

## 19. Camada de IA (v0.7, etapa 3B)

- **Divisão:** `src/game/ai.ts` é a parte sem internet (monta pedidos e confere respostas, com testes em `ai.test.ts`); `src/lib/ai.ts` faz a chamada, guarda chave, configuração e gasto; `src/lib/aiActions.ts` junta os dois com o plano B. O motor (`game.ts`) não sabe que a IA existe: recebe só ids do catálogo, como na 3A.
- **A IA nunca define números.** Ela devolve JSON com ids; `parseAdvice` e `parseInterpretation` descartam ids inexistentes, repetidos ou de outra área, limitam a 3 opções e cortam falas em 300 caracteres. O texto do jogador vai cortado em 600.
- **Formatos:** conselho `{"sugestoes":[{"fala","medida"}]}`; interpretação `{"medidas":[ids],"fala"}`. Decretos rápidos entram como `decreto:<id>` e só valem na medida do mês.
- **Contexto enviado:** data, presidente e partido, aprovação, indicadores, aprovação por grupo, o fato do mês e o catálogo da área. Ministros têm `party` e `style` (`ministers.ts`); a relação com o presidente sai da distância ideológica entre os partidos (`relationWith`).
- **Chave:** `localStorage` do app (`gn.ai.key`), separada do save; testada antes de salvar; mostrada mascarada; só sai no cabeçalho para api.anthropic.com (chamada direta, com `anthropic-dangerous-direct-browser-access`, já que não há servidor); mensagens de erro passam por `safeError`, que nunca a repete. Limite: quem tiver acesso ao computador consegue lê-la; cofre do Windows fica para depois, se for preciso.
- **Plano B:** sem chave, IA desligada, sem internet, tempo acima de 20 s, erro da API ou JSON inválido → `interpretMeasure`/`interpretResponse`, com aviso. Se a IA achar que nada serve, as palavras-chave ainda tentam. O botão de conselho só aparece com IA pronta.
- **Modelos por tarefa:** `fala` = Haiku, `interpretar` = Sonnet, trocáveis nas configurações. O gasto (pedidos, falhas, tokens lidos e escritos por modelo) é medido em `gn.ai.usage` para fixar os modelos com base em custo real. Ordem de grandeza nos testes: ~1.000 tokens lidos e ~100 escritos por pedido.
- **Save:** não mudou (continua versão 5).
- **Provedores (v0.7.1):** `PROVIDERS` em `src/lib/ai.ts`. Anthropic usa o formato próprio; Gemini, Groq e OpenRouter usam o formato compatível com OpenAI (`/chat/completions`, chave como `Bearer`), então um só caminho atende os três. Chaves separadas por provedor (`gn.ai.key` para a Anthropic, `gn.ai.key.<provedor>` para os outros); modelos em `modelsBy[provedor][tarefa]`, editáveis. Groq e OpenRouter recebem `response_format: json_object`; o Gemini não, e a conferência de sempre (`parseAdvice`/`parseInterpretation`) cuida do resto. Configuração da v0.7.0 (`models`) é lida como a da Anthropic.
- **Fluxo de resposta (v0.7.2), inspirado na mecânica do jogo de referência, com textos e personagens próprios:** (1) opinião: `ministerAdvicePrompt` → `{"parecer","opcoes":[{"ordem","medida"}]}`; a ordem é texto livre que vai para o campo; (2) leitura: `interpretPrompt` → `{"medidas","resumo","respeitando"}`, mostrada em `ReadingSheet` (`ResponseBox.tsx`) com instrumento, custo, efeitos e "quem sente" (aprovação atual do grupo + impulso da medida, aproximado); (3) parecer: `ministerReviewPrompt` → `{"posicao":"apoia|ressalva|contra","fala","sugestoes"}`; "acatar" anexa as sugestões ao texto e o jogador lê de novo. As sugestões não mudam números: a ordem continua sendo uma medida do catálogo. Medidas com efeitos montados pela IA (fora do catálogo) ficam para uma etapa futura, se quisermos.
- **v0.7.3:** `AiUsage` guarda `lastError` por modelo. Padrão do Gemini = `gemini-3.5-flash-lite` nas duas tarefas (único confirmado em uso real); `gemini-3.8-flash` salvo é trocado na leitura da configuração.

---

## 20. Votação e negociação com lideranças (v0.8, etapa 4A)

- **Pedido do Douglas (30/10):** quando algo vai à Câmara, abre a janela de votação com a composição do plenário como se fosse votado agora, e a opção de negociar com cada partido; só se ouve 3 partidos por rodada (mês), e cada um oferece algo de acordo com o alinhamento ao governo e o eleitorado. Referência visual: telas de votação do jogo de referência; textos, nomes e números próprios.
- **Ofertas** (`src/game/deals.ts`, números em `src/game/data/deals.ts`): `offerFor` é determinística. Seu partido → nada; bancada já ≥85% sim → "já está com você"; afinidade com o texto < −0,55 e fisiologismo < 0,3 → "não vende"; fisiologismo ≥ 0,7 e ≥ 40 deputados → cargos; ≥ 0,45 → emendas; senão → pauta (projeto-bandeira = medida do catálogo mais afim ao partido, ainda não enviada; sem bandeira, vira emendas).
- **Efeito no voto:** acordo soma `boost` à orientação do partido e metade disso a cada deputado (`partyOrientation`/`deputyScore` em `congress.ts`). A previsão usa o valor esperado (confiabilidade × boost + falha × 25%); a votação sorteia se a bancada entrega (`runVote` devolve `broken`, que vira manchete e biografia).
- **Preço** (pago ao encerrar o mês, em `advanceMonth`, passo 1c2): emendas = 0,0006% do PIB/ano por deputado, por 3 meses; cargos = +9 de escândalo e −3 na relação com o próprio partido; pauta = promessa com prazo de 3 meses (+5 se cumprida, −20 se não). Escândalo: chance mensal = risco/260; −2,5 em todos os grupos; risco cai 4% ao mês.
- **Estado:** `PendingBill.deals`, `CongressState.promises` e `CongressState.scandal` (save versão 6). `MonthPlan.deals` (até 3), validado por `dealBlockedReason`. O limite de "ouvir 3" fica na tela; o motor limita a 3 acordos.
- **Tela** (`src/ui/VoteSheet.tsx`): previsão grande, plenário de 513 quadrados, lideranças em cartões, cartão da proposta (fala, o que pede, votos antes → depois, confiabilidade, custo, risco). Abre ao enviar medida ou resposta que vá à Câmara e pelo botão "Negociar votos" na aba Governo.
- **Modo sem opções prontas:** com IA pronta e dificuldade diferente de fácil, o fato do mês mostra só "Se deixar passar" e o catálogo de decretos some; as falas das lideranças são modelos fixos (IA nas lideranças fica para depois).
- **Falta na etapa 4 (4B):** veto e derrubada, relator e emendas ao texto, comissões, presidente da Câmara, frentes temáticas, pautas-bomba, ministérios cedidos de verdade (troca de ministro), "deixar na pauta" sem votar, freio do Supremo.

---

## 21. Medidas livres montadas pela IA (decisão de 30/10, etapa 3C)

- **Problema:** a IA só podia escolher entre as 91 medidas; ordens inusitadas (ex.: PEC proibindo greve de caminhoneiros) caíam na medida mais parecida, que não era o que o jogador pediu.
- **Decisão (Douglas):** sem limitação de medidas. O catálogo continua existindo; quando surgir algo inusitado, o jogo estrutura a medida e a adiciona ao catálogo.
- **Desenho proposto:**
  1. A IA tenta casar com o catálogo (inclusive medidas criadas antes). Se casar, segue como hoje.
  2. Se não casar, devolve uma ficha `BillDef` nova: nome, resumo, área, instrumento, posição econômica e de costumes, gasto/receita, efeitos em grupos e partidos, confiança do mercado, risco jurídico, prós e contras.
  3. O motor valida: instrumento mínimo pela matéria (direitos fundamentais, tributo novo e estrutura do Estado pedem lei, LC ou PEC; decreto não cria tributo nem despesa nova grande); todos os números presos a faixas tiradas do catálogo atual; regra de "não existe almoço grátis" (soma dos ganhos nos grupos limitada pelo custo e pelos perdedores); sementes de consequência padrão por área.
  4. A medida nova vai para `GameState.customBills` (save sobe de versão) e passa a aparecer no catálogo daquele mandato, com a marca "criada pelo governo". Medidas repetidas não são duplicadas.
  5. Sem IA, nada muda: palavras-chave e catálogo fixo.
- **Em aberto:** biblioteca compartilhada entre jogos (medidas criadas num jogo aparecendo em outro); balanceamento pelo simulador.

### 21.1 Como ficou (v0.9)

- **Arquivos:** `src/game/custom.ts` (conferência, registro e save), números em `src/game/data/custom.ts`, testes em `custom.test.ts`. Telas: `src/ui/NewBill.tsx` (marca e notas), `MeasureBox` em `GameScreen.tsx` e `ResponseBox.tsx`.
- **Um pedido só:** `interpretPrompt` pede `{"medidas","resumo","respeitando","nova"}`. Com `medidas` vazia, `nova` traz a ficha em português (`nome, resumo, area, instrumento, materia[], economia, costumes, gasto, receita, temporario, potencial, divida, confianca, expectativa, grupos, risco_juridico, pros, contras, palavras`). `maxTokens` subiu para 1.200.
- **Conferência (`buildCustomBill`):** área válida (na resposta ao fato, a área do fato é imposta); efeitos presos a `LIMITS` (mínimo e máximo de cada efeito no catálogo fixo, calculados ao carregar); instrumento mínimo por `MATTERS` (`fixInstrument`; MP não serve para matéria penal, direito fundamental ou Constituição); risco jurídico médio −1 e alto −3 de confiança e aviso nos contras; "não existe almoço grátis" (`noFreeLunch`): soma dos ganhos ≤ 5 + 1,3 × custo, com custo = gasto/renúncia em % do PIB × 40 (temporário pelo ritmo anual) + perdas nos grupos + perda de confiança × 0,5 + peso do instrumento (MP 0,5, lei 1, LC 2, PEC 3). A régua aceita 90 das 91 medidas do catálogo fixo (só a força-tarefa contra a corrupção, que não custa nada, passa do teto; teste exige mais de 95%).
- **Repetidas:** mesmo nome normalizado, ou nome quase igual (Jaccard ≥ 0,75 nas palavras longas) na mesma área → usa a existente. Limite de 40 medidas criadas por mandato.
- **Catálogo vivo:** `BILLS`, `BILL_BY_ID` e `SEED_RULES` são preenchidos com as medidas do save (`syncCustomBills` em `newGame` e no `migrate`), então o motor, a Câmara, os acordos, as sementes (regra padrão `frutos_<área>`) e a IA tratam a medida como qualquer outra. Medidas criadas não viram projeto-bandeira de partido.
- **Quando entra no catálogo:** assim que o gabinete redige (na leitura), para a previsão de votos funcionar; mesmo sem assinar, ela fica disponível para reuso. Biografia do ministro da área e crônica do país registram a criação.
- **Fim do "mais parecido":** se a IA diz que nada serve e não manda ficha válida, a leitura fica vazia (não cai mais nas palavras-chave). Palavras-chave só quando a IA falha ou está desligada.
- **Save versão 7:** `GameState.customBills` (vazio nos saves antigos).
- **Fica para depois:** biblioteca compartilhada entre jogos; Supremo usando o risco jurídico para suspender medidas (etapa 6); IA nas falas das lideranças.


---

## 22. Congresso 2.0 (v0.10, etapa 4B)

- **Pedido do Douglas (30/10):** fazer a 4B e, junto, (1) animação dos votos sendo computados no painel, (2) voto simbólico quando a maioria é esmagadora, sem painel, (3) página de reação da sociedade depois de cada lei aprovada, com nota de popularidade e informações da medida.
- **Arquivos:** números e conteúdo em `src/game/data/camara.ts` (presidente da Câmara, comissões, frentes, jabutis, pautas-bomba, indicados para ministérios) e `src/game/data/reactions.ts`; regras sem votação em `src/game/camara.ts` (frentes, relator e parecer, texto efetivo, comissão, ministro de cada área); votações em `congress.ts`; reação em `src/game/reaction.ts`; `affinity` mudou para `src/game/ideology.ts` (reexportada por `congress.ts`). Testes em `camara.test.ts`.
- **Caminho do projeto** (`advanceMonth`, passo 1d): (1d1) sessões de derrubada de vetos do mês anterior; (1d2) sanção ou veto do que espera a caneta (sem decisão = sanção tácita); (1d3) projetos do governo: comissão → gaveta do presidente da Câmara → plenário (simbólica ou nominal); (1d4) pauta-bomba.
  - **Comissão:** `stage: 'comissao'` ao enviar (MP vai direto ao plenário). Engaveta 1 vez se o partido que preside tem orientação < −0,45 e relação < 45. PEC: CCJ e um mês de comissão especial (não vota no mês do envio). Urgência pula.
  - **Presidente da Câmara:** `congress.speaker.relation` acompanha o UCD (deriva 10% ao mês). Abaixo de 35 segura 1 projeto por mês (o menos afim ao UCD), no máximo 2 vezes o mesmo; MP e urgência escapam. Conversar: +8, a cada 2 meses (articulação `presidente`). Urgência: −5.
  - **Relator** (`relatorFor`, determinístico, guardado em `PendingBill.amendment` no envio): relação ≥ 60 → partido grande e amigo mais afim; 40–60 → centrão mais afim; < 40 → partido grande menos afim. Relator do seu partido ou com afinidade ≥ 0,6 mantém. Fisiológico (≥ 0,5) ou MP → jabuti do partido (`JABUTIS`, desloca o texto 8%); ideológico → desidrata (efeitos × 0,6, desloca 40%). Insistir no original: −0,2 na orientação do partido do relator. Em média o parecer vale uns 30 votos.
  - **Jabuti aprovado:** o texto principal entra em vigor; o trecho vai a `toSanction` (veto parcial possível).
  - **Frentes:** filiação fixa por deputado (sorteio pelo índice e perfil, sem save). Posição = efeito no grupo da frente / 6 + regra temática; peso 0,15 por frente no voto do membro.
  - **Ministérios cedidos** (`GameState.cabinet`): +15 de relação, +12 na base, +0,35 na orientação enquanto durar; seu partido −4, quem perdeu a pasta −6, escândalo +3; máximo 4, uma por partido, Fazenda e Relações Institucionais não. Retomar: −20. `ministerOf(s, área)` troca o ministro em fatos, biografias e pedidos à IA.
  - **Pautas-bomba** (`BOMBS`, entram em `BILL_BY_ID` mas não em `BILLS`): a partir do 4º mês, chance = 3% + 0,6% por ponto de relação do presidente da Câmara abaixo de 50 + 0,5% por ponto de aprovação abaixo de 40 (teto 30%); a Câmara vota com a relação invertida (oposição vota mais a favor). Uma por vez na mesa; não repete em 24 meses.
  - **Veto:** irrita o partido (−6), o presidente da Câmara (−6 se pauta-bomba) e quem ganharia (até −2,5). Derrubada no mês seguinte: 257 votos, com relação, aprovação e emendas valendo ao contrário (`gov = −1`) e ministérios cedidos segurando o veto. Derrubado: efeitos aplicados, −0,8 em todos os grupos.
  - **Deixar na pauta:** `MonthPlan.hold`. MP não pode ser segurada se vencer (prazo de 4 meses).
- **Votação simbólica:** só lei ordinária ou MP, chance ≥ 97% e sim ≥ 70% dos presentes (`symbolicBlockedReason`), conferida de novo na hora de votar. Aprova sem sorteio (`kind: 'simbolica'`), placar = previsão; acordos são entregues.
- **Animação** (`src/ui/VoteAnimation.tsx`): 513 cadeiras por partido (esquerda → direita), ordem fixa por votação, ~4 s com aceleração, contador, piso, votos por partido e carimbo; “Pular”. Votações simbólicas não têm painel.
- **Reação** (`lawReaction`): nota = 5 + 1,1 × popularidade (média pesada do efeito nos grupos) + 0,15 × confiança, de 0 a 10; a favor = 50 + 8 × popularidade (5% a 95%). Humor por grupo pelo efeito (≥ 4 comemora, ≥ 1,5 aprova, > −1,5 indiferente, > −4 critica, senão revolta), com fala genérica por grupo; aprovação do grupo antes → depois pelo histórico; mercado; frentes; voto por partido; texto desidratado conta só o que ficou (`VoteRecord.scale`). Abre depois de cada lei (fila do pós-mês em `GameScreen`) e pelas leis na aba Governo.
- **Retratos:** 7 personagens novos. O teste do grupo de rostos do presidente caiu de >60 para >55 (sobram 58). Para saves antigos, cada um tem um `alt`: se o presidente do save já usava o mesmo rosto, o personagem novo usa o reserva (`setPresidentPortrait`).
- **Save versão 8:** `congress.speaker`, `toSanction`, `vetoes`, `bombLog`, `GameState.cabinet`; projetos já na Câmara seguem no plenário com o texto original.
- **Balanceamento:** a ordem das estratégias no simulador não mudou (equilibrado 566 → 558, por causa das pautas-bomba sancionadas tacitamente).
- **Fica para depois:** eleição da Mesa (fev/2029), negociar com frentes, IA nas falas do relator e do presidente da Câmara, Senado e Supremo (etapa 6), freio do Supremo nas medidas com risco jurídico.


---

## 23. Etapa 5A: rival, ficha do candidato e promessas de posse (plano aprovado em 30/10; feito na v0.11)

- **Decisão do Douglas (30/10):** a etapa 5 foi dividida em **5A** (agora), **5B** (27 estados e apuração da eleição) e **5C** (governo seguinte e herança, só depois do vídeo do fim de mandato e da eleição). Fica fora da 5A: Senado, Supremo, CPIs, vice, inteligência e governadores. Base: `docs/levantamento-video-1.md` (itens 3, 6, 15 e 16). Tudo fictício e próprio.

### 23.1 O rival (líder da oposição)

- **Quem é:** um personagem novo no `CAST`, com retrato próprio, do maior partido do lado oposto ao do presidente (presidente da FPT → rival do POL; presidente do POL ou do MDN → rival da FPT ou do POL, o mais distante na ideologia). Dois rivais fictícios, um de cada lado; nomes e falas inventados por nós. Existe desde o mês 1 e tem ficha (biografia) como os outros.
- **Estado novo** (`GameState.rival`): nome, partido, **força** (0 a 100), **postura** e **pesquisas** (uma por mês: governo, rival, brancos e indecisos).
- **Força** (números em `src/game/data/rival.ts`): começa em ~35 e se mexe todo mês com causas visíveis: aprovação do governo abaixo de 50 fortalece, acima de 55 enfraquece; escândalo, derrota na Câmara e veto derrubado fortalecem; o tempo de mandato fortalece um pouco (a oposição se organiza para a eleição).
- **Postura**, conforme a força: **observa** (abaixo de 40, só fala), **desgaste** (40 a 65: todo mês ataca o grupo mais insatisfeito ou uma promessa fora do rumo, com perda pequena, de 0,5 a 1,5 ponto, mostrada como "Ataques de <rival>") e **obstrução** (acima de 65: a bancada dele e as próximas a ela votam um pouco mais contra o governo; aparece como causa na previsão de votos).
- **Intenção de voto** (pesquisa "se a eleição fosse hoje", governo contra rival): o governo parte da aprovação e é ajustado por desemprego e inflação; o rival parte da força dele e do desgaste do governo; sobram brancos e indecisos (8% a 25%). Calibrar no simulador para que aprovação perto de 45–50% dê empate técnico.
- **Na tela:** cartão "Oposição" no Painel (retrato, partido, força, postura, intenção de voto e a linha mês a mês, com a causa da mudança). Manchete quando o rival muda de postura ou passa à frente na pesquisa. Falas fixas por enquanto (sem IA).
- **A eleição de verdade (votos, apuração)** fica para a 5B. Na 5A, o fim do mandato mostra a última pesquisa.

### 23.2 Ficha do candidato: traços e hábitos

- Na posse, depois do partido e do rosto, o jogador escolhe **até 2 traços** e **até 2 hábitos** (`GameState.profile`). Cada um mexe pouco nos 7 grupos e **sempre tem quem perde** (regra 1: toda vantagem tem custo). Um painel ao lado mostra, a cada escolha, a aprovação inicial de cada grupo.
- **Como age:** um ajuste permanente pequeno no alvo de cada grupo (`econTarget`), que aparece nas causas como "Perfil do presidente". Traços: de −2 a +2 por grupo; hábitos: de −0,5 a +1,5.
- **Traços (rascunho, textos nossos):** Conciliador, Combativo, Técnico, Carismático, Austero, Gente como a gente, Linha dura, Servidor de carreira.
- **Hábitos (rascunho):** Pelada de domingo, Feira de sábado, Pescaria no interior, Corrida de rua, Lives toda semana, Viola caipira, Leitor de economia, Horta comunitária.
- A ficha (Fichas) passa a mostrar traços e hábitos do presidente e a biografia do rival. A "biografia acumulada" é a que já existe.

### 23.3 Promessas de posse

- Na posse o jogador escolhe **exatamente 5** de um catálogo de ~14 (`src/game/data/promises.ts`), cada uma com **meta medida** pelo motor: no fim do mandato (ex.: desemprego abaixo de 6%, inflação dentro da meta, dólar abaixo de R$ 5, aprovação final de 50% ou mais, aprovação de um grupo de 55 ou mais), na média do mandato (crescimento médio de 2,5% ou mais) ou por contagem (aprovar uma PEC, aprovar 12 leis, 3 leis da área social, dívida sem subir mais de 3 pontos).
- Cada promessa tem uma marca: **esquerda**, **centro**, **direita** ou **qualquer governo**. As do lado do presidente dão um pequeno ânimo inicial ao grupo interessado (some com o tempo).
- **Acompanhamento:** cartão "Promessas" no Painel com barra e situação (no rumo, em risco, longe). A promessa fora do rumo vira alvo dos ataques do rival.
- **Cobrança no fim:** cumprida, quase (a menos de 10% da meta) ou quebrada. Entra na biografia do presidente e na crônica do país.

### 23.4 Nota final (substitui a nota provisória)

| Parte | Peso |
|---|---|
| Aprovação média | 250 |
| Economia no fim | 250 |
| Saúde fiscal | 200 |
| Promessas de posse | 300 (60 por promessa: 60 cumprida, 25 quase, 0 quebrada) |

Saves antigos sem promessas: a parte das promessas sai e as outras são reescaladas para 1000, com aviso na tela.

### 23.5 Save, testes e balanceamento

- **Save versão 9:** `rival`, `profile` e `promises`. Migração: o rival nasce com força tirada da aprovação atual e as pesquisas dos meses passados são recalculadas pelo histórico; perfil vazio; sem promessas.
- **Testes:** escolha do rival por partido; força e postura com suas causas; pesquisa (aprovação alta → governo na frente; baixa → rival na frente); traços somando perdedores; limite de 2+2 e de 5 promessas; avaliação de cada tipo de meta; nota final com e sem promessas; migração 8 → 9; retratos sem repetir.
- **Simulador:** a ordem das estratégias não pode mudar; conferir que o rival não derruba sozinho um governo bem avaliado.

### 23.6 Telas

- **Posse:** passos novos "Perfil" (traços e hábitos) e "Promessas", com o painel de grupos ao lado.
- **Painel:** cartões "Oposição" e "Promessas".
- **Fichas:** traços e hábitos do presidente; ficha do rival.
- **Fim do mandato:** nota final nova, promessas uma a uma e a última pesquisa ("a eleição chega na 5B").

### 23.7 Como ficou (v0.11)

- **Arquivos:** números e textos em `src/game/data/rival.ts`, `profile.ts` e `promises.ts`; regras em `src/game/rival.ts` (força, postura, ataque, obstrução, pesquisa) e `src/game/promises.ts` (medição, situação, perfil, escolhas da posse, pontos); testes em `rival.test.ts`. Telas: `NewGame` em `src/App.tsx` (3 passos com painel ao lado), `src/ui/OppositionCards.tsx` (cartões do Painel), `FichasView`, `EndScreen` e aviso de obstrução no `VoteSheet`.
- **Rivais:** Leopoldo Rezende (POL, aliados MRB e NRM) e Clarice Siqueira (FPT, aliado PVS), no `CAST` com retrato e reserva (`alt`). `RIVAL_PARTY_FOR` define o rival por partido do presidente (FPT e PVS → POL; MDN e PSN → POL; os outros → FPT). Nas Fichas só aparece o rival do mandato.
- **Força** (`updateRival`, fim do mês, depois dos grupos): +0,06 por ponto de aprovação abaixo de 50; −0,05 por ponto acima de 55; +0,15 por mês (+0,4 no último ano); volta 3% ao mês para 35 (a oposição também cansa); escândalo +5; cada derrota do governo na Câmara +2 (pautas-bomba e vetos não contam); veto derrubado +3. Limites 5 a 95.
- **Ataque** (`rivalAttack`, antes dos grupos): em desgaste ou obstrução, de 0,3 a 0,8 ponto conforme a força, com 50% de chance de mirar o grupo de uma promessa "longe" (se houver); senão, o grupo mais insatisfeito. **Mudança em relação ao plano:** o plano dizia 0,5 a 1,5; no simulador isso derrubava 3 a 4 pontos de aprovação no fim (as perdas são lembradas por ~2 anos) e o rival vencia em 30 de 30 partidas.
- **Obstrução:** −0,25 na orientação do partido do rival e −0,1 nos aliados, somada ao reforço dos ministérios cedidos (`govBoost` em `congress.ts`; na sessão de veto vale ao contrário).
- **Pesquisa** (`pollFor`): governo = 5 + 0,7 × aprovação − 0,8 × (desemprego − 7)⁺ − 0,5 × (inflação − 4,5)⁺; rival = 12 + 0,45 × força + 0,25 × (55 − aprovação); brancos e indecisos de 8% a 25%, reescalados. Aprovação 47 com força 50 dá empate técnico. `rival.polls[i].month` acompanha `history[i].month`.
- **Perfil:** ajuste permanente no alvo de cada grupo (`profileOffsets` somado ao bônus de dificuldade em `initialGroups` e `stepGroup`). Traços de −2 a +2, hábitos de −0,5 a +1,5; todos têm ganhador e perdedor (teste).
- **Promessas:** 15 no catálogo; `posseBlockedReason` exige exatamente 5 (ou nenhuma, para testes e simulador). Situação durante o mandato: valor que já cumpre = no rumo; dentro da folga (`slack`) = em risco; senão, longe. Contagens (PEC, leis, área social) comparam com o ritmo esperado até o mês 42. No fim: cumprida (60), quase (25), quebrada (0). Promessa do lado do presidente (`SIDE_OF_PARTY`) dá +1,5 de lembrança ao grupo que cobra.
- **Nota final** (`finalScore`, substitui `provisionalScore`): 250 + 250 + 200 + 300. Sem promessas, as três primeiras partes são reescaladas (357 + 357 + 286) e a tela avisa.
- **Memória:** posse registra traços, hábitos e promessas na biografia e na crônica; o rival ganha ficha na posse, a cada mudança de postura e quando a liderança na pesquisa troca de lado; no fim, cada promessa vai para a biografia do presidente e o balanço para a crônica.
- **Save versão 9:** `rival`, `profile` e `promises`. Migração: força = 35 + (50 − aprovação) × 0,5; pesquisas recalculadas pelo histórico; perfil vazio; sem promessas.
- **Simulador** (`npm run sim`, agora com 5 promessas "de qualquer governo"): a ordem das estratégias não mudou (responde aos fatos 588 > austero 551 > equilibrado 509 > passivo 460 > populista 311; antes, 622 / 620 / 558 / 488 / 393, numa escala sem promessas). Com aprovação final perto de 48% o governo lidera a pesquisa em 27 de 30 partidas; perto de 42%, o rival lidera em quase todas. A obstrução só aparece com governo fraco.
- **Fica para a 5B e a 5C:** a eleição de verdade (votos, 27 estados, apuração), falas do rival por IA, rival com metas próprias (derrubar ministro, derrotar o governo no plenário) e herança para o mandato seguinte.

---

## 24. Etapa 4C: Senado e Supremo (plano aprovado em 30/10; feito na v0.12 e na v0.13)

- **Decisão do Douglas (30/10):** fazer a 4C depois da 5A e antes da 5B. Substitui a decisão 2 da seção 11 e a regra da seção 13 ("o Senado não vota leis"). Base: `docs/levantamento-video-1.md`, itens 25, 29, 30 e 31. Tudo fictício e próprio. Ficam fora: CPIs, vice, inteligência e governadores.
- **Divisão aprovada:** **4C1 Senado** (v0.12) e depois **4C2 Supremo** (v0.13), cada uma testada e publicada separadamente.

### 24.1 Senado (4C1)

- **81 senadores** dos 9 partidos fictícios, com bancadas próprias (o Senado é mais de centro e mais governista que a Câmara), lealdade e ruído como os deputados. A regra de voto é a mesma da Câmara (`deputyScore`), com pesos próprios em `src/game/data/senado.ts`.
- **O que passa pelo Senado:** lei ordinária e MP (maioria dos presentes), lei complementar (41 votos) e PEC (49 votos, em dois turnos). Decreto não passa.
- **Quando vota:** lei, LC e MP aprovadas na Câmara vão ao Senado **no mesmo encerramento de mês**, logo depois (assim a resposta ao fato do mês continua resolvendo no mesmo mês). PEC vai ao Senado **no mês seguinte**.
- **Presidente do Senado** (personagem novo, com retrato): tem relação com o governo e, se estiver de mal, segura um projeto por mês, como o presidente da Câmara. Conversar com ele é uma articulação.
- **Negociação no Senado:** mesma janela da Câmara, com aba "Senado": previsão de placar, plenário de 81 cadeiras e lideranças. Até **2 lideranças por mês** no Senado (além das 3 da Câmara), com os mesmos preços (emendas, pauta, cargos ou "não vende").
- **Rejeitado no Senado:** o projeto volta para a fila com o mesmo prazo de 6 meses, custa um pouco de aprovação, conta como derrota para o rival (5A) e vira manchete ("o assunto volta, e você volta mais fraco"). A obstrução do rival também vale no Senado.
- **Animação:** o painel de votação ganha a versão do Senado (81 cadeiras). Votação simbólica vale nas duas casas.
- **Fica para a 5B:** negociação por bancada estadual (3 senadores por estado, cada estado pedindo uma coisa), que precisa dos 27 estados.

#### 24.1.1 Como ficou (v0.12)

- **Arquivos:** números em `src/game/data/senado.ts` (`SENATE_SEATS`, `SENADO`); a regra de voto de `congress.ts` virou de duas casas (`House = 'camara' | 'senado'`, pesos por casa, `forecastSenate`, `runSenateVote`, `senateDealsOf`, `senatePending`, `seatsIn`); o caminho do projeto está em `advanceMonth` (passos 1d3 e 1d3b, com `reject` e `enact`); testes em `senado.test.ts`. Telas: abas em `VoteSheet.tsx`, `SenateCard` em `CamaraPanels.tsx`, `VoteAnimation` e `Scoreboard` com 81 cadeiras.
- **Bancadas (81):** POL 16, FPT 11, UCD 13, PSN 11, MRB 5, MDN 13, PRA 7, PVS 3, NRM 2. Senadores variam menos em torno do partido (desvio 11, deputados 14). A relação de cada partido é a da Câmara (mais um bônus de 2).
- **Pesos:** afinidade 0,85, relação 0,36, orientação 0,45, popularidade 0,07, aprovação 0,22, status quo 0,16, viés governista 0,04, ruído 0,16, ausência 5%. A Câmara ganhou `lean: 0`. Frentes parlamentares só na Câmara.
- **Estado:** `CongressState.senate` (`senators`, `president`, `pending`). Projeto aprovado na Câmara sai de `pending` e entra em `senate.pending` com o parecer do relator (o texto não muda no Senado), `camara` (placar) e os acordos de Senado fechados antes (`PendingBill.senateDeals`). `Deal.house` e `VoteRecord.house = 'senado'`; `Articulation.kind = 'senado'`.
- **Ordem no fim do mês:** plenário da Câmara → Senado (projetos que chegaram agora e os que esperavam). PEC que chegou neste mês espera. A presidente do Senado (relação < 35) segura 1 projeto por mês, no máximo 2 vezes o mesmo, nunca MP. "Deixar na pauta" vale também no Senado (não para MP). Urgência e texto original não valem mais depois da Câmara.
- **Vira lei só depois do Senado:** efeitos, sementes, jabuti (vai à sanção), crônica e reação da sociedade. A resposta ao fato do mês resolve se virou lei no mês (`enacted`); cobranças idem.
- **Rejeição no Senado:** `blockedUntil` de 6 meses, −0,8 em todos os grupos ("Derrota do governo no Senado"), MP desfeita, conta como derrota para o rival, manchete e crônica.
- **Negociação:** 2 lideranças por mês no Senado (`SENADO.listenPerMonth`), validadas à parte das 3 da Câmara. Emendas por senador = 0,0035% do PIB/ano (cerca de 6× o deputado); cargos a partir de 8 senadores.
- **Promessas de contagem** contam só o que virou lei (`promiseValue`); o histórico de votações guardado subiu de 24 para 48.
- **Save versão 10:** migração cria o Senado com a semente do save; nada mais muda.
- **Simulador** (`npm run sim`, novo bloco "Senado"): com um projeto a cada 2 meses, o Senado barra cerca de 4% (esquerda), 1% (centro) e 13% (direita) do que a Câmara aprova; a direita perde mais porque o Senado, mais de centro, segura as pautas mais liberais (privatização, regra fiscal). A ordem das estratégias não mudou (responde aos fatos 583 > austero 551 > equilibrado 509 > passivo 460 > populista 311).
- **Fica para depois:** sessão de vetos com o Senado (hoje só a Câmara vota), IA nas falas das lideranças do Senado, negociação por bancada estadual (5B), sabatinas e impeachment (etapa 6), Supremo (4C2).

### 24.2 Supremo (4C2)

- **11 ministros fictícios**, cada um com doutrina (garantista, moderado ou conservador, mais uma inclinação econômica), relação com o governo e quem o indicou (presidentes anteriores fictícios). Personagens no `CAST`, com retrato.
- **Risco jurídico das medidas:** hoje só as medidas criadas pela IA têm. Passa a existir em todas (padrão "baixo"); umas 20 medidas do catálogo, as mais polêmicas, ganham "médio" ou "alto". A leitura do gabinete passa a mostrar o risco antes de assinar.
- **Ação no Supremo:** todo mês, leis, MPs e decretos em vigor com risco médio ou alto podem ser contestados por partidos de oposição. A chance cresce com o risco e com a força do rival. No máximo um julgamento por mês.
- **Julgamento:** um relator sorteado; os 11 votos aparecem um a um (painel pequeno). Cada ministro vota pela doutrina contra o texto da medida, pelo risco jurídico e pela relação com o governo. Maioria (6) derruba.
- **Medida derrubada:** os efeitos são desfeitos (como a MP derrubada, que já existe), os grupos que ganharam sentem a perda, e vem um **fato do mês** com caminhos:
  - **acatar** (custo pequeno);
  - **mandar nova proposta** com instrumento mais forte (ex.: virou PEC), liberando o reenvio na hora;
  - **criticar o Supremo** em público (a base gosta, o mercado e os ministros do Supremo não).
- **Vaga no Supremo:** um ministro faz 75 anos durante o mandato (data fixa por ministro) e se aposenta. O presidente escolhe entre 3 nomes fictícios (técnico, aliado, conservador ou garantista, conforme o partido), cada um com bônus e risco. O **Senado sabatina** (41 votos) e pode rejeitar.
- **Aba Governo** ganha a subaba "Supremo": os 11 ministros, ações em andamento e decisões passadas. Tudo vai para biografias e para a crônica.

#### 24.2.1 Como ficou (v0.13)

- **Arquivos:** números, ministros, indicáveis, risco jurídico do catálogo e o fato da derrubada em `src/game/data/supremo.ts`; regras em `src/game/supremo.ts`; sabatina em `congress.ts` (`forecastNomination`, `runNomination`, mesma regra do Senado); testes em `supremo.test.ts`. Telas: `src/ui/SupremoView.tsx` (subaba Supremo, `LegalRiskLine` nas leituras, `SupremoMini` no Painel e `RulingAnimation` depois do mês), subabas Congresso/Supremo em `GameScreen`.
- **Ministros:** 4 garantistas, 4 moderados e 3 conservadores, com posição nos dois eixos, indicados por presidentes anteriores fictícios. Relação com o governo = 62 − 0,3 × distância ao partido do presidente (10 a 85), derivando 5% ao mês para esse alvo; indicado pelo presidente atual: 82. Aposentadoria aos 75 por data fixa (`retireAt`, mês absoluto): Celina Prates em ago/2028 (a única do 1º mandato), Eduardo Saraiva em ago/2031. Uma vaga aberta por vez.
- **Risco jurídico:** `legalRiskOf` = risco da ficha (medidas da IA) ou `LEGAL_RISK` (24 medidas, 7 altas) ou baixo. Mostrado com o motivo e a chance de cair hoje (`forecastRuling`, distribuição exata dos 11 votos).
- **Na mira (`supremo.watch`):** decreto assinado, MP editada ou lei sancionada com risco médio/alto, por 24 meses. MP derrubada no Congresso sai da mira.
- **Ação:** por medida e por mês, chance 1,2% (médio) ou 4,5% (alto) × (0,5 + força do rival/100). Quem contesta (`challengerOf`): partido fora do governo com afinidade < 0,1 e relação < 55, o mais contrário. Uma ação por mês, no máximo 2 abertas; julgamento 2 a 4 meses depois; relator sorteado. Uma medida é julgada só uma vez.
- **Voto:** derruba se −0,6 + risco (baixo −0,6, médio +0,3, alto +0,5) + 0,5 × (0,4 − afinidade) + 0,3 × (50 − relação)/50 + ruído (0,4) > 0. Exemplos com a corte inicial: posse de armas cai em ~90%; penas duras, 30% a 50%; isenção do IR, 1% a 2%.
- **Derrubada (`advanceMonth`, passo 1d6):** desfaz gasto, receita, potencial e confiança (vezes a fração do texto desidratado); obras e dívida já aconteceram. Quem ganhava perde 70% do ganho, quem perdia sente 30% de alívio. Sai das leis, reenvio bloqueado 6 meses, rival +3. O fato `stfDerrubada` entra na frente da fila (só escolhas prontas, `choiceOnly`): acatar (corte +4, seu partido −2, confiança +1), nova proposta (`newVersionBill`: decreto/MP → lei, lei/LC → PEC, risco baixo, entra no catálogo do mandato e vai direto à comissão) ou criticar (corte −12, seu partido +6, +1 para quem ganhava, confiança −3, rival +2).
- **Vaga:** 3 indicáveis (`nomineesOffered`): o técnico, a aliada (posição = 80% da do partido do presidente, relação 90) e o garantista (partido progressista nos costumes) ou o conservador. Sabatina no Senado com 41 votos e reforço de +0,9 em todos os partidos (−0,9 a mais contra a aliada, menos do partido do presidente). Previsão com a corte inicial: técnico ~100%; aliada ~58% (centro), ~42% (direita), ~0% (esquerda); garantista ~70% com governo de esquerda. Efeitos: técnico confiança +2; doutrina: fãs +5, adversários −4; aliada: classe média −1,5 e rival +3. Rejeitado: sai da lista, −0,8 em todos os grupos, conta como derrota. Sem sabatina no recesso.
- **Sorteios:** o Supremo usa uma semente própria do mês (`prev.rngState`), para não mexer no resto do jogo.
- **Save versão 11:** `GameState.supremo` (`justices`, `cases`, `rulings`, `watch`, `vacancy`, `used`); `EventOrigin.bill`; `VoteRecord.kind = 'sabatina'`. Migração cria a corte sem ações e sem medidas na mira.
- **Retratos:** 15 personagens novos (11 ministros e 4 indicáveis); a presidente da corte usa o retrato da magistratura (109); os outros saem dos livres, com reservas compartilhados (16 e 23, só um personagem troca de rosto por vez). Sobram 41 rostos para o presidente.
- **Simulador** (`npm run sim`, bloco "Supremo"): com um projeto a cada 2 meses, cerca de 5 a 6 medidas com risco em vigor, 1,3 a 1,6 ação e 0,4 a 0,5 derrubada por mandato (0 a 2 em todas as 90 partidas). As estratégias só de decreto quase não chegam ao Supremo. A ordem das estratégias não mudou (responde aos fatos 583 > austero 551 > equilibrado 509 > passivo 460 > populista 311).
- **Fica para depois:** articular com o Supremo (audiências, AGU defendendo a medida), liminar suspendendo a medida antes do julgamento, ações contra leis de governos anteriores, IA nos votos dos ministros, impeachment e CPIs.

### 24.3 Save, testes e balanceamento

- **Save:** versão 10 (Senado) e 11 (Supremo), com migração: projetos que já passaram na Câmara em saves antigos são considerados aprovados no Senado; o Supremo começa sem ações.
- **Testes:** composição do Senado; quóruns (41 e 49); PEC em dois turnos nas duas casas; rejeição no Senado; negociação com limite de 2; voto de cada ministro; derrubada desfazendo efeitos; vaga e sabatina; retratos sem repetir; migrações.
- **Simulador:** a ordem das estratégias não pode mudar; conferir quantas leis caem no Senado e no Supremo por mandato (alvo: o Senado barra poucas coisas que passaram na Câmara; o Supremo derruba de 0 a 2 medidas por mandato).

### 24.4 Retratos

- Precisam de rosto: presidente do Senado (1), 11 ministros do Supremo e 3 a 4 indicáveis para vaga, cerca de 16 pessoas. Há 1 retrato reservado para a magistratura; o resto sai dos retratos livres. A escolha de rosto do presidente cai de 54 para cerca de 39 opções (aprovado pelo Douglas).


---

## 25. Etapas 4D, 4E e 4F: Congresso ao vivo, janelas e mês mais vivo (plano aprovado em 30/10)

- **Pedido do Douglas (30/10, depois da 4C2):** o Senado ficou simples; a votação deve acontecer quando o jogador mandar, não no fechamento do mês; mais complexidade com líderes e bancadas; negociação com probabilidade e contraoferta; janela para a medida (com opção de desistir); sorteio do relator no Supremo; fato bom com botão de agir. Base: `docs/levantamento-video-1.md` (itens 12, 13, 14, 17, 24, 26, 27, 28). Tudo fictício e próprio.
- **Divisão aprovada:** **4C3 Supremo no caminho das medidas e abas** (v0.14, seção 26) · **4D Congresso ao vivo** (v0.15, Opus) · **4E Janelas** (v0.16, Sonnet serve) · **4F Mês mais vivo** (v0.17). A 5B (27 estados e apuração) passa para depois da 4F.
- **Decisões do Douglas sobre as dúvidas:** (1) **uma votação por casa por mês**: uma na Câmara e uma no Senado; um projeto aprovado na Câmara pode votar no Senado no mesmo mês, se a votação do Senado ainda estiver livre; (2) **PEC**: cada turno é uma votação marcada por você, em meses diferentes, e cada um gasta a votação da casa no mês; (3) **recesso** (janeiro e julho): continua sem votação; (4) o que não for votado **fica parado na fila**, e as gavetas (comissão, presidentes da Câmara e do Senado) continuam valendo.

### 25.1 Etapa 4D: Congresso ao vivo (v0.15)

**Votar na hora**
- Cada projeto na pauta ganha o botão **"Pautar agora"** (Câmara e Senado). A votação roda na hora, com painel animado; **a lei aprovada entra em vigor no mês atual**, antes de encerrar, e já aparece no Painel, nos indicadores e na resposta ao fato do mês.
- O fechamento do mês **não vota mais sozinho**. Continuam acontecendo no fechamento: comissões avançando, gaveta, sanção ou veto, derrubada de veto, pautas-bomba e o Supremo.
- **MP:** vale na hora, como hoje, mas precisa ser votada. Passado o prazo de 4 meses sem votar, **caduca** e os efeitos são desfeitos (manchete e crônica).
- **Motor:** `voteNow(estado, projeto, casa)` devolve o estado novo e o registro da votação; `advanceMonth` deixa de votar plenário. Estado do mês (`GameState.monthUse`): votação da Câmara e do Senado usadas, medida negociada. Zera ao virar o mês.
- **Supremo:** projeto com votação suspensa pelo Supremo (seção 26.3) aparece com o botão "Pautar agora" bloqueado e o motivo.
- **Gavetas à vista:** se a comissão ou o presidente da casa vão barrar, o botão avisa o motivo antes, sem gastar a votação do mês.
- **Negociação:** uma medida negociada por mês em cada casa (a janela atual de lideranças passa a valer para um projeto só por casa).

**Página própria do Senado**
- Subabas da aba Governo: **Câmara · Senado · Supremo · Ministérios** (o esqueleto das quatro é montado na 4C3, seção 26; aqui a do Senado ganha o conteúdo).
- A página do Senado tem: os 81 senadores por bancada, **líder de cada bancada** (9 personagens novos, fictícios, com retrato), presidente da casa, **relação individual** com as lideranças, comissões do Senado (CCJ, assuntos econômicos...) com o partido que preside, o que está na fila, **os indecisos** da próxima votação (até 5 senadores mais perto do limite, cada um com preço próprio: ligar, obra no estado, cargo regional) e o histórico das votações.
- **Bancada estadual** (3 por estado) fica para a 5B, quando houver os 27 estados.

**Líderes e eleições internas**
- **Líder da bancada do seu partido** (Câmara e Senado): escolhido na posse e a cada 2 anos. 3 candidatos, cada um com perfil (governista, independente ou fisiológico); você apoia um e a bancada vota. Líder governista segura a disciplina e aproxima a bancada; líder rebelde atrapalha e cobra mais caro. Candidatos usam caricatura provisória (sem retrato próprio).
- **Eleição da Mesa** (presidente da Câmara e do Senado) em **fevereiro de 2029** (mês 25 do mandato): 2 candidatos por casa, votação animada; você pode apoiar um (custo: emendas, cargos ou promessa). O eleito muda a relação e as gavetas.
- **Líderes dos outros partidos** trocam sozinhos a cada 2 anos, com manchete e mudança de perfil (relação e disciplina).
- **Alas internas (levantamento, item 28), versão enxuta:** cada partido tem uma ala governista e uma de oposição; o líder reflete a que está por cima.

**Relação com os líderes, emendas e contraoferta**
- **Conversar** tem tipos (ligação, almoço, receber na residência oficial, visita à base), cada um com custo e **chance de render efeito positivo**; pode render nada e, raramente, azedar.
- **Emendas detalhadas:** emenda individual (pequena), de bancada e carimbada de obra, com valor em R$ bi à escolha, efeito proporcional, risco de escândalo e **chance de o partido aceitar e votar com você** (mostrada antes).
- **Contraoferta:** o líder faz uma oferta pelo voto (tipo e preço). Você **aceita, recusa ou contrapõe** (preço menor, outro tipo ou outro prazo). A chance de aceitar depende da relação, da distância entre a oferta e a contraproposta e do fisiologismo; no máximo 2 rodadas. Recusar demais irrita e sobe o preço. Falhar custa um pouco de relação.
- **Concessões que mudam o texto** (item 26): o líder pede uma cláusula ou a retirada de um trecho; o jogo mostra quanto o projeto enfraquece (ex.: "enfraquece o projeto em 19%") em troca do voto.
- **Placar com traidores** (item 27): quantos votaram contra a própria liderança e como cada bancada votou.

**Save, testes e balanceamento**
- **Save versão 13:** `monthUse`, líderes (`congress.leaders`), líderes do Senado, eleições internas e da Mesa, ofertas em andamento. Migração: líderes atuais mantidos, `monthUse` zerado, projetos que esperavam votação seguem na fila.
- **Testes:** uma votação por casa por mês; efeito da lei no mesmo mês; MP caduca; PEC em turnos separados; gavetas avisadas; contraoferta (aceita, recusa, rodadas); eleições internas e da Mesa; migração 12 → 13.
- **Simulador:** os bots passam a chamar `voteNow` (um projeto por casa por mês); a ordem das estratégias não pode mudar; conferir quantas leis passam por mandato (hoje cerca de 17 a 23 com um projeto a cada 2 meses).
- **Retratos:** 9 líderes do Senado + 4 candidatos à Mesa = 13 pessoas. A escolha de rosto do presidente cairia de 41 para cerca de 28. **Pendência para o Douglas:** mandar mais retratos antes da 4D (sugestão: +30).

### 25.2 Etapa 4E: Janelas (v0.16)

- **Janela da medida** (levantamento, item 24): ao pedir a leitura do gabinete, abre uma janela na frente, bem diagramada, em etapas: **1 leitura** (o que o gabinete entendeu e o parecer do ministro), **2 impacto fiscal e prazos**, **3 Congresso e Supremo** (nota de 0 a 10 de quanto a medida sobrevive no Congresso e no Supremo, com o risco jurídico que já existe) e **4 decisão**. **Nada vai ao Congresso até confirmar**: dá para descartar e voltar atrás. A medida enviada fica no plano do mês e pode ser **retirada** até a votação (depois de votada, não).
- **Nome da medida** (item 14): opcional, vira a manchete do telejornal.
- **Sorteio do relator no Supremo:** janela separada que abre na frente quando uma ação é aberta: os 11 retratos giram e param no relator. Entra na fila do pós-mês, antes do julgamento quando os dois caem no mesmo mês.
- **Fato bom com botão de agir:** no modo **fácil** só as sugestões; nos modos **médio e difícil**, o botão de agir como nos fatos ruins (as opções prontas ficam como "se deixar passar"). A resposta escrita é lida pelo ministro e vira promover, dar crédito ou ignorar, mais uma medida da área, se houver. Sem IA continuam as opções prontas.

### 25.3 Etapa 4F: Mês mais vivo (v0.17)

- **Três caminhos para responder a uma crise** (item 12): escrever uma medida, **fazer um post** (a assessoria redige; não resolve o problema material, mas mexe em quem leva a culpa e na lealdade da base) ou **tratar com quem está na rua** (receber, ceder, mandar desobstruir, falar em cadeia nacional).
- **"Sua agenda está limpa"** (item 13): em mês sem crise, a chance de liderar nos seus termos, com sugestões de iniciativa.
- **"Enquanto você decidia"** (item 17): o que a oposição, o empresariado e a Câmara fizeram no mês, no Painel.

### 25.4 Fica para depois

Exposição a escândalo visível de 0 a 100 (item 20), CPIs (35), vice-presidente (32), execução e regulamentação das leis (34), bancada estadual no Senado e mapa por estado (5B), governadores (36), serviço de inteligência (33), conquistas (19) e cenas de transição (22). Ordem: 4C3, 4D, 4E, 4F e depois a 5B.

---

## 26. Etapa 4C3: o Supremo no caminho das medidas e as abas do Governo (plano aprovado em 30/10; feito na v0.14)

- **Pedido do Douglas (30/10):** hoje tudo vai direto ao Congresso e ao Senado e o Supremo só aparece, raramente, depois. Algumas medidas devem passar pelo Supremo. Criar abas ao lado do Senado para o **Supremo** e para os **Ministérios**. Decisões dele: fazer a 4C3 **antes** da 4D; entram **liminar**, **travar votação durante a tramitação** e **consulta ao Supremo**. Base: `docs/levantamento-video-1.md`, itens 29, 30 e 37.
- **Por que:** nas simulações da 4C2 o Supremo derrubava só 0,4 a 0,5 medida por mandato e abria 1,3 a 1,6 ação, e o jogador quase nunca o sentia. A meta passa a ser **1 a 3 julgamentos por mandato** para quem usa medidas arriscadas, quase nenhum para quem não usa, sempre avisado antes.

### 26.1 Risco jurídico por regra (e não só por lista)

- `legalRiskOf` passa a ser o **maior** entre a ficha (medidas da IA), a lista `LEGAL_RISK` e a **regra do instrumento**, calculada com o que o jogo já sabe de cada assunto (`MATTERS` e `minimumInstrument` em `custom.ts`):
  - decreto que **cria ou muda imposto** (efeito em receita): alto, "decreto não pode criar imposto";
  - decreto com **despesa nova permanente** acima de um limite (a definir no simulador, perto de 0,15% do PIB): médio, "despesa nova precisa de lei"; acima do dobro, alto;
  - **MP** sobre matéria que só lei pode tratar (penal, direito fundamental, Constituição): alto;
  - instrumento **mais fraco que o mínimo** do assunto: alto, "vício de forma".
- O motivo aparece na leitura do gabinete, com a chance de a medida cair. Meta: de 24 para cerca de 30 a 35 medidas do catálogo com risco médio ou alto. Os números ficam em `data/supremo.ts`.

### 26.2 Ação mais certa e liminar

- **Ação (medida em vigor):** risco alto passa a ter chance alta de ser contestada (cerca de 35% ao mês, vezes a força do rival) e o julgamento sai em **1 a 2 meses**; médio sobe um pouco. Até 3 ações abertas ao mesmo tempo. A leitura diz "o Supremo deve ser provocado".
- **Liminar:** no dia da ação, o relator sorteado pode **suspender a medida na hora**, antes do plenário. Chance pela própria inclinação dele (`strikeProb` do relator, com risco alto). Medida suspensa: gasto, receita e confiança são desfeitos e voltam se o plenário mantiver. O Painel e a página do Supremo mostram **"suspensa por liminar"**.
- **Fato do mês `stfLiminar`** (só escolhas prontas): **esperar o plenário** (nada muda), **recuar** (revogar a medida sem custo político) ou **recorrer** (leva ao plenário no mês seguinte; a corte gosta menos), mais **criticar o Supremo**, como na derrubada.

### 26.3 Durante a tramitação: travar a votação

- A oposição também pode contestar um **projeto ainda no Congresso**: PEC que mexe em direito fundamental, projeto de risco alto ou texto com jabuti. O relator pode **suspender a tramitação**: o projeto não é votado até o plenário julgar (1 a 3 meses). Se o plenário derruba, o projeto é arquivado e só volta em 6 meses; se mantém, segue.
- Na 4C3 o projeto suspenso é pulado no fechamento do mês; na 4D o botão "Pautar agora" aparece bloqueado, com o motivo.

### 26.4 Filtro da CCJ

- Na etapa de comissão, projeto de risco alto passa pela CCJ, que pode **aprovar**, **aprovar com emenda de adequação** (risco cai um nível, efeitos ×0,85) ou **barrar como inconstitucional** (volta em 6 meses). A chance depende da relação com o partido que preside, da doutrina e do risco, e a **previsão aparece antes de enviar**.

### 26.5 Consulta ao Supremo

- Opção na janela da medida: **"Pedir parecer ao Supremo"**. A medida espera **2 meses** e só uma consulta fica aberta por vez. O resultado sai por sorteio com a própria previsão (`1 − chance de cair`): **chancelada** (fica imune a ações por 24 meses) ou **reprovada** (você sabe antes de gastar a votação; a relação dos ministros cai 3). Custa tempo e a corte "fica de olho" em você.

### 26.6 As quatro abas

- **Governo: Câmara · Senado · Supremo · Ministérios.**
  - **Câmara:** o que já está na página do Congresso (menos o Senado e os ministérios).
  - **Senado:** o cartão do Senado e as previsões do Senado saem da página da Câmara e viram a aba (conteúdo básico agora; a 4D amplia).
  - **Supremo:** a subaba atual, com ações, liminares, consultas, projetos suspensos e decisões.
  - **Ministérios:** os 13 ministros com retrato, partido (se a pasta foi cedida), **desgaste** de 0 a 100 (cresce com crise mal resolvida e medida da área derrubada, cai com sucesso), **meta por pasta** medida pelo motor (um indicador ligado à área, com situação: no rumo, em risco, longe), **reforma ministerial** (trocar o ministro, com custo político e indicado pelo partido) e ceder ou retomar pastas (o cartão que hoje mora no Congresso).
- Sem personagens novos com retrato: a reforma usa os indicados que já existem.

### 26.7 Save, testes e balanceamento

- **Save versão 12:** `supremo.liminares`, `supremo.consultas`, ações sobre projetos em tramitação, e `ministries` (desgaste e meta). Migração: sem liminares nem consultas; desgaste calculado do histórico.
- **Testes:** cada regra de risco por instrumento; ação quase certa para risco alto; liminar suspende e desfaz os efeitos, e a medida volta se mantida; recuar e recorrer; projeto suspenso é pulado e volta depois; CCJ (aprova, adequa, barra); consulta (chancela imune a ação, reprova); abas; reforma ministerial; migração 11 → 12.
- **Simulador:** a ordem das estratégias não pode mudar; conferir ações, liminares e derrubadas por mandato com a meta de 26 (1 a 3 julgamentos para quem usa medidas arriscadas; quase nenhum para quem só usa decretos seguros).

### 26.8 Como ficou (v0.14)

- **Arquivos:** números em `src/game/data/supremo.ts` (bloco "Etapa 4C3" do `SUPREMO`, `CATALOG_MATTERS`, `NO_MP_MATTERS`, `RULE_EXEMPT`, `STF_LIMINAR_EVENT`) e `src/game/data/ministerios.ts` (`MINISTERIOS`, `AREA_GROUP`, `MINISTRY_GOALS`); regras em `src/game/supremo.ts` e `src/game/ministerios.ts`; testes em `supremo4c3.test.ts`. Telas: `LegalRiskLine` e `SupremoView` em `SupremoView.tsx`, abas novas em `src/ui/GovTabs.tsx` (`SenadoView`, `MinistriosView`), abas em `GameScreen.tsx`. O cartão de ministérios saiu de `CamaraPanels.tsx`; o do Senado saiu da página da Câmara.
- **Risco por regra (`ruleRiskOf`, `legalReadOf`):** o maior entre a lista, a regra e a ficha da IA (empate: lista, depois regra). Decreto com receita positiva: alto; decreto que abre mão de mais de 0,03% do PIB: médio; decreto com despesa permanente acima de 0,05% do PIB: médio, acima de 0,10%: alto (o limite é o mesmo que já empurra medidas da IA para MP); MP sobre pena, direito fundamental ou Constituição: alto; instrumento abaixo do mínimo da matéria: alto ("vício de forma"). As matérias vêm da ficha da IA (`CustomInfo.matters`, guardado a partir de agora) ou de `CATALOG_MATTERS`. Tarifa de importação (`abrirComercio`) fica de fora: imposto regulatório. Resultado no catálogo: **31 medidas** com risco (pela regra entram cesta básica, Plano Safra e a agência de cibersegurança; 4 polêmicas novas na lista: marco do saneamento, reforma política, corte de isenções e regra fiscal).
- **Risco neste jogo (`legalRiskIn`):** o da medida, ou o rebaixado pela CCJ (`supremo.adjusted`).
- **Ação:** chance por mês em vigor = 3% (médio) ou 35% (alto) × (0,5 + força do rival/100); julgamento em 2 a 4 meses (médio) ou 1 a 2 (alto); até 3 ações abertas; uma ação nova contra medida em vigor e uma contra projeto por mês; um julgamento por mês (o recurso do governo primeiro).
- **Liminar:** no dia da ação, chance = 0,35 (médio) ou 0,8 (alto) × chance de o relator votar para derrubar. A medida fica em `c.laws`, com a ação marcada `suspended`; o motor desfaz gasto, receita, potencial e confiança (`undoEffects`) e devolve tudo se o plenário mantiver (`restored`). Com liminar o plenário julga em 3 a 5 meses. Derrubada depois de suspensa não desfaz o dinheiro de novo (`wasSuspended`); MP suspensa e rejeitada no Congresso, idem. Fato `stfLiminar` (só escolhas prontas): esperar (nada), recuar (revoga; quem ganhava perde como na derrubada; corte +2), recorrer (julgamento no mês seguinte, `appealed`; corte −3), criticar (como na derrubada). Rival +1,5 com a liminar.
- **Projeto travado:** `CourtCase.kind = 'projeto'`. Motivos (`projectChallengeOf`): risco alto (40%/mês), PEC com direito fundamental (30%), jabuti no parecer (12%), × fator do rival; julga como risco médio no mínimo. O relator trava com 0,8 × chance de ele derrubar. Projeto travado é pulado na Câmara e no Senado; julgado em 1 a 3 meses; derrubado = arquivado com `blockedUntil` de 6 meses e rival +1,5. `Ruling.project` marca esses julgamentos (a animação diz "projeto arquivado/liberado").
- **CCJ:** só projeto (lei, LC, PEC) de risco alto, na comissão, sem urgência, uma vez (`PendingBill.ccj`). Nota = 0,15 + 1,2 × (afinidade do POL − 0,4) + 0,02 × (relação − 50) + ruído (0,5): acima de 0,4 aprova, abaixo de −0,45 barra, no meio adequa (efeitos × 0,85 na sanção e na mira do Supremo, risco cai para médio). Sorteio com a semente do Supremo. Previsão em `ccjForecast`, mostrada antes de enviar. Urgência pula a CCJ (como pula a comissão).
- **Consulta:** `MonthPlan.consult` (não gasta a medida do mês; não pode ser a mesma medida enviada no mês). Uma aberta por vez, só para medida com risco, antes de enviar; a medida fica bloqueada até a resposta (`billBlockedReason`). Pedir custa −1 de relação com a corte; a resposta sai em 2 meses pela própria previsão do plenário: reprovada (−3) ou chancelada (imune a ações e a contestação de projeto por 24 meses, e pula a CCJ).
- **Ministérios (`GameState.ministries`):** desgaste por pasta, começa em 20 e recomeça quando o ministro muda (ceder, retomar, trocar). Por mês: fato do mês da área resolvido com medida −10, escolha feita −2, ignorado (opção padrão) +6, resposta travada +8; cada medida da área em vigor −4; derrubada no Supremo +20, liminar +10, projeto barrado (CCJ ou Supremo) +8; meta no rumo −1,5, em risco +0,3, longe +0,8. A partir de 70: −0,2 por mês no grupo da pasta e manchete na primeira vez. Metas (`MINISTRY_GOALS`, medidas como as promessas): inflação ≤ 4,5% (economia), desemprego ≤ 6,5% (trabalho), aprovação de um grupo (social, agro, educação, segurança), confiança ≥ 50 (energia), aprovação geral ≥ 45 (política) e entregas da área (saúde, cidades e transportes 2; meio ambiente e ciência 1; "longe" só quando a pasta está uma medida inteira atrás do ritmo). **Reforma ministerial:** `ministryBlockedReason` passa a aceitar trocar a pasta de um partido direto para outro (o que sai perde −20 de relação, o que entra ganha como numa cessão). Fazenda e Relações Institucionais continuam do presidente: sem personagens novos, não há com quem trocar.
- **Save versão 12:** `supremo.consultas`, `supremo.adjusted`, `ministries`; campos opcionais novos em `CourtCase` (`kind`, `suspended`, `appealed`, `reason`, `risk`), `PendingBill.ccj`, `Ruling.project`, `CustomInfo.matters`. Migração 11 → 12: sem consultas nem ajustes; desgaste 20 + 20 por medida da área já derrubada.
- **Simulador** (`npm run sim`): a ordem das estratégias não mudou (responde aos fatos 582 > austero 551 > equilibrado 509 > passivo 460 > populista 311). Projeto a cada 2 meses (mistura comum): 2 a 4 ações por mandato e 0,2 a 0,7 derrubada; estratégias só de decreto seguro: nenhuma ação. Bloco novo "medidas arriscadas" (uma medida com risco a cada 2 meses, o caso extremo): 8 a 10 julgamentos, 1,6 a 2,4 derrubadas e 1,5 a 1,9 liminar por mandato; a CCJ barra 3,1 projetos por mandato de um governo de esquerda (o POL preside) e quase nada de um de direita; projetos contestados durante a tramitação são raros (0,4 por mandato), porque passam rápido e a fila de ações costuma estar cheia. O desgaste quase não mexe na nota: quem ignora as crises chega ao fim com 0 a 3 ministros desgastados; quem responde aos fatos, com nenhum.
- **Fica para depois:** "Pautar agora" bloqueado com o motivo (4D), articular com o Supremo (audiências, AGU), IA nos votos dos ministros, ações contra leis de governos anteriores, ministros substitutos com retrato próprio (para trocar Fazenda e Política), metas por pasta escolhidas pelo jogador.


---

## 27. Plano novo por etapas com portão (decisão de 30/10/2026, substitui as seções 25 e o roteiro antigo daqui para frente)

**Pedido do Douglas:** o tempo do jogo deve ser mais "jogo" que realidade. Só escrever uma medida nova é limitado (uma por rodada); Câmara, Senado e Supremo agem **na mesma rodada**. Causa e consequência forte (medida impopular enviada marca a reputação mesmo sem aprovar), fatos do mês vindos dos desdobramentos, narrativa da presidência, mais uso da IA, Senado e STF mais profundos, vice com ações, interface com ilustrações (placeholders). Etapas com portão: a próxima só abre quando a anterior fecha; ideia fora de hora vai para a **Caixa de ideias** da etapa certa. Plano completo também no doc do projeto `plano-de-desenvolvimento.md`.

**Decisões (30/10):** (1) fundir com o plano antigo (4D/4E/4F); (2) **a medida do mês vota na hora**, nas duas casas, e além dela **1 projeto da fila por casa** pode ser pautado no mês (substitui "uma votação por casa por mês"); (3) **o Supremo julga na mesma rodada**; só a consulta prévia e as ações com liminar ficam para a rodada seguinte. PEC: os dois turnos acontecem na mesma rodada (substitui a decisão 25(2)).

**Princípios:** realidade na lógica, jogo no tempo · regras decidem, IA narra · todo resultado tem "por que isso aconteceu?".

| Etapa | Conteúdo | Origem |
|---|---|---|
| **0 · A rodada** (v0.15) | Medida do mês e resposta ao fato votam na hora (Câmara → Senado), gavetas avisadas antes, CCJ na hora; "Pautar agora" para 1 projeto da fila por casa; MP caduca em 4 meses sem votação; Supremo julga no fechamento da mesma rodada; buffer da rodada no estado; fases visíveis; sistema de ilustrações placeholder | 4D (votar na hora) |
| **1 · Causa e consequência** | Ficha de governo com marcas de reputação (medida enviada já marca), desdobramentos em 3 camadas, anti-repetição, capítulos da presidência com IA, exposição a escândalo visível, três caminhos para a crise (post, rua), agenda limpa, enquanto você decidia, fato bom com botão de agir | 4E, 4F, novo |
| ✅ **2 · Câmara e partidos** (v0.18) | Líder do seu partido indicável, eleições internas e da Mesa, alas, conversa por tipos, emendas detalhadas, contraoferta, concessões no texto, traidores, janela da medida em etapas com nota de freios e contrapesos, nome da medida | 4D, 4E |
| ✅ **2B · A página inicial e o fluxo do dia** (v0.19) | Fato do mês em destaque com Agir ou Deixar passar; pendências por urgência; corrente de janelas "etapa N de M"; Supremo no mesmo dia; "quem vai reagir"; notas Congressual e Judicial; "já valeu" | média-alta · Sonnet nas telas, Opus no Supremo e no "já valeu" |
| ✅ **2C · A mesa de negociação e a base** (v0.20) | Acordo vale nas duas casas; cardápio de pedidos variado com votos convertidos; as ruas; pauta que esfria; base como contrato com fidelidade; pacto sem ministério; registro de votos dos partidos; logos | muito alta · Opus |
| **3 · Senado** | Página própria, líderes de bancada, indecisos com preço, comissões do Senado, 27 estados com bancadas estaduais, emendas por estado | 4D, 5B (parte) |
| **4 · Supremo profundo** | Sorteio do relator, validação que protege, crise pós-derrubada ampliada, reputação jurídica, pedido de vista | 4E, novo |
| **5 · Oposição, escândalos e CPI** | Escândalos revelados, CPI, inteligência | levantamento |
| **6 · Vice e governo** | Vice com ações e lealdade, execução das leis, relógios do mandato | levantamento |
| **7 · Estados e governadores** | 27 governadores, mapa por estado, apuração | 5B |
| **8 · Começo, sociedade e fim** | Candidatura completa, pessoas fictícias e jornais, conquistas, fim de mandato e herança | 5C |
| **9 · Arte final** | Trocar placeholders, painéis personalizáveis, polimento | — |

**Definição de pronto de cada etapa:** testes passando, partida simulada de 12 rodadas sem erro, balanceamento revisado, efeitos ligados à memória do mundo, placeholders cadastrados, sem regressão, versão publicada, Caixa de ideias revisada.

### 27.2 Como ficou a Etapa 0 (v0.15)
- **Motor:** `src/game/rodada.ts`. `sendMeasure` (medida do mês ou resposta ao fato), `voteNow` (um projeto da fila por casa), `articulate`; `gavetaReason` e `sendBlockedReason`/`voteNowBlockedReason` para avisar antes. Os efeitos ficam em `GameState.round` (impulsos, confiança, manchetes, votações, leis) e `advanceMonth` aplica e zera. Planos no formato antigo (simulador, testes) passam por `applyPlanToRound`. `applyEffects` foi para `src/game/effects.ts`.
- **Regras:** lei, LC e PEC votam na hora (Câmara → Senado; PEC com os dois turnos juntos). MP vale na hora e fica na fila; caduca se não for pautada até a 4ª rodada. Gaveta (comissão, presidente da Câmara, presidente do Senado) e CCJ na hora; recesso e projeto travado pelo Supremo ficam na fila. O fechamento não vota plenário; continuam lá vetos, sanções, pautas-bomba e o Supremo.
- **Supremo:** prazos de julgamento zerados (`data/supremo.ts`); no fechamento, primeiro as novas ações, depois os julgamentos (um contra medida em vigor e um contra projeto por mês). Liminar julgada na rodada seguinte; consulta responde em 1 rodada.
- **Telas:** botão "Votar agora" na janela de votação (com o aviso da gaveta), "Negociar e pautar agora" nas filas, faixa da rodada, medida enviada no lugar da caixa de texto, articulação na hora, animações das votações na hora (sem repetir no fechamento).
- **Ilustrações:** `src/ui/artSlots.ts` (slots) e `src/ui/Art.tsx` (placeholder até existir `public/art/<slot>.webp`).
- **Balanceamento:** simulador com `pautarFila` (pauta o que estiver livre na fila). Ordem das estratégias igual; leis por mandato no mesmo nível de antes (16 a 22 com um projeto a cada 2 meses).
- **Save versão 13.**

### 27.3 Etapa 1 dividida: 1A feita (v0.16), 1B a seguir
- **1A (v0.16), causa e consequência:** `src/game/reputacao.ts` e `data/marks.ts`. Ficha de governo (`GameState.reputation.record`), 10 marcas (0 a 100, caem 5%/mês, pesam acima de 15, viram desdobramento acima de 35 com 45% de chance por mês e intervalo de 12 meses), 10 desdobramentos em `data/repEvents.ts` (o {lei} é a decisão mais recente que puxou a marca), capítulos a cada 6 meses com narração opcional pela IA (`chapterRequest` em `game/ai.ts`), cartão de reputação e exposição a escândalo no Painel, Ficha na aba Fichas. Gatilhos: envio da medida (impopular se a popularidade ≤ -0,8; gasto/ajuste pelo efeito líquido; decreto), derrota, crise respondida/ignorada (importância ≥ 3), promessa a partido cumprida/quebrada, crítica ao Supremo. Balanceamento: ignorar crises pesa mais (passivo 460 → 443; responder aos fatos 594 → 620), ordem das estratégias igual. Save 14.
- **Retratos:** na v0.16.1 os provisórios deram lugar a 88 retratos ilustrados do Douglas (111 a 198, recortados de uma grade). O script `scripts/retratos-provisorios.py` agora gera provisórios a partir do 199, fora de `public/portraits`; a tag `provisorio` continua fora da escolha do presidente.
- **1B (v0.17, feita):** três caminhos para a crise, agenda limpa, "enquanto você decidia", fato bom com resposta escrita e perda de oportunidade. Detalhes em 27.4.

### 27.4 Etapa 1B: o mês mais vivo (v0.17, decidido e feito em 30/10/2026)

**Respostas do Douglas:** o post é grátis, 1 por mês, soma com a medida; a rua só aparece onde há rua de verdade (mais "falar ao país" nas crises graves); o fato bom pode se perder no Normal e no Difícil **e** aceita resposta escrita como o fato ruim.

**Três caminhos para a crise** (podem ser combinados; tudo vale no fechamento do mês, como as opções prontas):
1. **Medida** (já existia): opção pronta ou resposta escrita.
2. **Post da assessoria** (`data/assessoria.ts`, 1 por mês, grátis): 3 tons de crise (nota de solidariedade, apontar o culpado, chamar a base) e, em mês sem crise, 3 de agenda (pauta positiva, prestar contas, chamar a base). O efeito é multiplicado pelo **peso do discurso** da crise (`SPEECH_WEIGHT` em `data/assessoria.ts`, 0 a 1: crise material como dengue ou apagão quase não se resolve falando; escândalo e polêmica sim; fórmula `0,3 + 0,7 × peso`; fato sem peso cadastrado vale 0,5). Dois freios contra spam: repetir o mesmo tom em 3 meses vale a metade, e **postar dois meses seguidos cansa** (metade; um mês de intervalo volta ao cheio). Os dois se acumulam. Ajuste geral `postScale` 0,7 e bônus de mês limpo ×1,15.
3. **Rua** (`data/rua.ts`): ações de presença em 7 crises (dengue, caminhoneiros, enchentes, professores, desemprego, terra, comida), 2 por crise, e "falar ao país" em qualquer crise de importância 4+ (1 a cada 4 meses; usa o peso do discurso). Uma ação de rua por crise.

**Se o jogador deixa a crise passar, mas posta ou vai à rua:** a penalidade da opção padrão é **amenizada** (`soften`, no máximo 60%), e a marca "Foge das crises" pesa 70% do normal (nota em vez de medida: pesa menos que ignorar, mas **não** vira "Enfrenta as crises"). Começou em 40%, mas o simulador mostrou que isso fazia a nota virar atalho (só postar valia +11% de nota e +10 pontos de aprovação); com 70%, cai para cerca de +4 pontos. Quem responde com medida ou opção pronta não recebe esse desconto, só os efeitos do post e da rua.

**Apontar o culpado** tem risco: se a crise nasceu de uma lei do próprio governo, 50% de chance de desmentido (a base não vem e os grupos se irritam).

**Agenda limpa:** mês sem crise vira um cartão "Sua agenda está limpa" com os posts de agenda (efeito cheio, sem peso do discurso, ×1,3).

**Fato bom:** (a) aceita resposta escrita (ministro da área, medida do catálogo): se vale no mês, a oportunidade é aproveitada (efeitos de "promover" ×1,25, sem risco de desmentido); (b) no Normal e no Difícil, deixar passar faz a oposição levar o crédito (rival ganha força: 1,2 no Normal, 2,4 no Difícil, × importância/3) e a Ficha anota a oportunidade perdida; no Fácil continua sem custo.

**Enquanto você decidia:** `MonthReport.meanwhile` (oposição, empresariado e Câmara) aparece no passo 1 do mês seguinte, com a causa de cada linha.

**Save 15:** `statementLog` (posts e falas ao país dos últimos 12 meses, para a repetição, o cansaço e o intervalo da fala) e `MonthReport.meanwhile` e `MonthReport.assessoria`.

**Como ficou (código):** `src/game/assessoria.ts` (efeitos, bloqueios, `applyAssessoria`, `softenEffects`), `src/game/entretanto.ts` ("enquanto você decidia"), dados em `data/assessoria.ts` e `data/rua.ts`, tela em `src/ui/AssessoriaBox.tsx` (usada no `EventPanel` para crise, fato bom e mês limpo). `MonthPlan.statement` e `MonthPlan.street` valem no fechamento (como `eventChoice`), em `advanceMonth` 1d7, antes do fato do mês. Fato do Supremo (`choiceOnly`) não aceita post nem rua. O fato bom passa a aceitar `eventResponse` (`responseBlockedReason` e `sendBlockedReason` deixaram de bloquear).

**Balanceamento (simulador, 30 sementes, Normal, mesmas sementes):** nada: aprovação 33,8, nota 435 · só post: 35,6 / 450 · só rua: 36,7 / 455 · post e rua: 38,3 / 469 (força do rival 67 → 76) · responde fatos: 50,2 / 616 · responde fatos + assessoria: 51,8 / 636 (força do rival 55 → 66). Ou seja: a assessoria dá uns 2 a 4 pontos de aprovação e custa força à oposição ("a briga"), sem substituir governar. **Revisão de números por Opus fica sugerida** (a nota de quem posta e vai à rua todo mês).

**Caixa de ideias desta etapa:** "precisa de você" (alertas) e cenas de transição ficam para a Etapa 8; post com texto livre escrito pela IA fica para a Etapa 9 (polimento).

### 27.5 Etapa 2: Câmara e partidos (v0.18, aprovada em 31/10/2026)

**Respostas do Douglas (31/10):** (1) **uma versão só** (v0.18), sem dividir em 2A e 2B; os blocos abaixo continuam como ordem de trabalho; (2) na eleição da Mesa o presidente pode **apoiar um candidato e também lançar um candidato próprio** do seu partido; (3) as **concessões no texto são escritas pela IA** (o motor confere os números); sem chave, cai numa lista pronta de tipos; (4) **sempre 3 alas** por partido.

**Ponto de partida (v0.17):** 9 partidos com disciplina e fisiologismo; cada deputado tem posição própria e lealdade; o líder de cada partido só tem nome; a negociação oferece um preço fixo por partido (emendas, pauta ou cargos) que se aceita ou não; o placar mostra sim e não por partido; a janela de votação é uma tela só; o presidente da Câmara (Dagoberto Leme, UCD) é fixo.

**Ordem de trabalho** (tudo sai na v0.18):

**Bloco A · Os partidos por dentro**
1. **Alas.** Cada partido ganha 3 alas (ex.: na UCD, "cúpula", "baixo clero" e "bancada do agro"), cada uma com tamanho, posição (desvio de econ/costumes), fisiologismo e **lealdade ao partido** (0 a 100). Cada deputado pertence a uma ala. A orientação do partido chega à ala pesada pela lealdade: ala pouco leal vota pela própria cabeça. Dados em `data/alas.ts`. Continuam 9 partidos (a referência tem 22; as alas dão a variedade sem poluir).
2. **Traidores no placar.** `VoteRecord` passa a guardar a orientação de cada bancada e quantos votaram contra ela. Placar com abstenções, ausentes e "N traíram a própria liderança"; gráfico "como cada bancada votou" (sim, não, abstenção, ausente, traidores); "piso" (mínimo de votos sobre os presentes) visível nas votações por maioria simples. Traição repetida vira linha na biografia do partido.
3. **Líder do seu partido indicável.** Na posse e depois a cada fevereiro, o presidente escolhe entre 3 deputados do próprio partido (fictícios, com retrato), cada um com um estilo: **articulador** (conversas rendem mais), **disciplinador** (bancada trai menos), **popular** (bancada vai melhor com a aprovação alta). Trocar no meio do ano custa relação com a ala do líder derrubado.
4. **Eleições internas.** Todo fevereiro os outros partidos podem trocar de líder (chance maior se a relação com o governo mudou muito). Líder novo puxa a relação para o lado da ala que o elegeu. Vira manchete e "enquanto você decidia".
5. **Eleição da Mesa.** Fevereiro de 2027 (mês 2) e de 2029: eleição do presidente da Câmara com 2 ou 3 candidatos fictícios (o atual entre eles). O jogador pode **apoiar** um candidato (custa emendas, cargos ou relação com quem perdeu), **lançar um candidato próprio** do seu partido (mais caro e arriscado: o centrão resiste) ou ficar neutro. Votação animada, secreta (traição maior). O eleito vira o dono da pauta, com relação inicial que depende do apoio.

**Bloco B · A mesa de negociação e a janela da medida**
6. **Conversa por tipos, com chance.** "Conversar" vira 4 tipos, cada um com a chance de dar certo mostrada antes: **pedir apoio** (depende da relação), **apelar à base** (depende da aprovação no grupo do partido), **oferecer espaço futuro** (promessa; cobrada depois) e **endurecer** (cortar emendas; ganha disciplina dos aliados, perde o partido). Falhar também tem efeito.
7. **Contraoferta.** Diante do preço, o jogador pode oferecer menos (metade das emendas, cargo menor, prazo maior para a pauta). Chance de aceitar pela necessidade do governo, fisiologismo e relação; recusa gasta a conversa e custa um pouco de relação.
8. **Emendas detalhadas.** Emenda com destino (saúde, estrada, saneamento, segurança) e tipo (individual ou de bancada); o efeito no primário e no risco-país aparece **na hora**, e o destino agrada o grupo ligado a ele.
9. **Concessões que mudam o texto.** Algumas lideranças pedem mudança no texto em vez de moeda. **Com chave de IA, a IA escreve a concessão para a medida** (o pedido do líder e o que muda no texto) e o motor fixa os números pelo tipo; sem chave, a lista pronta de tipos: cláusula de validade (a lei caduca em X anos), retirar um trecho, condicionar ao TCU, regra de transição. Cada concessão mostra "enfraquece o projeto em N%" e o que muda (efeitos menores, risco jurídico menor, um grupo a menos irritado). Partidos ideológicos às vezes respondem "não temos preço, temos posição".
10. **Janela da medida em etapas** (também para decreto, que ganha confirmação antes de assinar): **1 · O que entendemos** (texto lido, "respeitando: ..." com as condições que o jogador escreveu, custo, quem sente); **2 · Ficha da medida** (comunicação, impacto fiscal, complexidade de entrega, sensibilidade pública, risco central, recomendação da pasta e **nota de freios e contrapesos de 0 a 10**, juntando a chance na Câmara, no Senado e o risco no Supremo); **3 · Votação** (a janela atual, com negociação).
11. **Nome da medida** (opcional): o jogador batiza a medida; o nome vira a manchete do telejornal e fica na Ficha de governo.
12. **Da Caixa de ideias:** ministério cedido valendo na hora; urgência como ação da rodada.

**Fica fora (vai para a Caixa):** vice-líder do governo (Etapa 6, junto do vice); orçamento paralelo do relator (Etapa 5).

**Save:** 16 (alas, líderes, Mesa, orientação no `VoteRecord`, contraofertas, concessões, nome da medida), com migração.

**Balanceamento a conferir no simulador:** leis por mandato no mesmo nível (16 a 22); traição média entre 3% e 10% por votação; apoiar o candidato vencedor da Mesa vale a pena, apoiar o perdedor custa; contraoferta não pode virar desconto garantido.

**Como ficou (v0.18, código):**
- **Alas e líderes:** `data/alas.ts` (`ALAS`, `PARTIDOS`, `MESA`) e `src/game/partidos.ts`. Deputado com `ala`; `PartyState.alas` (lealdade) e `leader`. A lealdade entra no voto como fator do peso da orientação (`alaFactor`: 1 + (lealdade − 62)/100 × 1,1; média das bancadas = 61,6, então o Congresso como um todo ficou no mesmo lugar). Estilo do líder: disciplinador +0,15 no fator; articulador +10% de chance e ×1,4 de ganho nas conversas; popular ×1,8 no peso da aprovação. `leaderOf` e `speakerOf` substituem o nome fixo nas telas e biografias. Lealdade volta 6%/mês para a de partida.
- **Traidores:** `runWith` registra `orient`, `traitors` e abstenções/ausentes por partido no `VoteRecord` (orientação acima de ±0,25 fecha questão). `noteTraitors` dá manchete com 4+ traidores e 12% da bancada; a ala que mais traiu perde 4 de lealdade.
- **Eleições internas:** todo fevereiro, chance 14% + 0,6% por ponto que a relação se afastou da de partida (+20% se a ala do líder estiver abaixo de 42), no máximo 55%. A ala nova muda a relação em até ±8 pela distância ideológica ao presidente. Sorteios com semente própria do mês.
- **Mesa:** abre no mês 0 e no 24 (`openMesa`), vota no fechamento do mesmo mês (`runMesa`), voto secreto (lealdade ×0,6, ruído 0,35), segundo turno sem 257. Apoio: declarado 0,15, emendas 0,3 (0,05% do PIB por 3 meses), cargos 0,42 (escândalo +8, seu partido −3); puxão por bancada = força × (0,5 + (relação − 40)/60). Candidato próprio: −0,35 nos fisiológicos e −15 com o presidente atual. Resultado (simulador): com o MDN, cargos deixam a disputa empatada; com o POL, até o apoio declarado vira a eleição (a bancada de 118 segue o governo); candidato próprio com emendas não venceu em 30 partidas com MDN ou FPT.
- **Negociação:** `data/negociacao.ts` e `src/game/negociacao.ts`. Conversa por tipo (`Articulation.tipo`, resultado em `ok`), promessa de espaço (`Promise_.kind = 'espaco'`, cumprida ao ceder ministério ou cargos; −18 se vencer). Contraoferta sorteada uma vez por rodada (`RoundBuffer.counters`): chance 0,3 + fisiologismo × 0,25 + (relação − 50) × 0,006 − necessidade × 0,35; aceita = metade do dinheiro e do escândalo, 65% do reforço, pauta em 6 meses. Emendas: individual ×0,6 do valor e ×0,8 do reforço; bancada ×1,25 e ×1,15; confiança −40 por ponto % do PIB; destino +0,6 no grupo.
- **Concessões:** `src/game/concessoes.ts`. Partido com fisiologismo < 0,45 que pediria pauta pede concessão (metade das vezes, ou sempre sem projeto-bandeira) em lei, LC e PEC. O tipo vem da medida (`concessionTypeFor`); o efeito multiplica tudo pela escala e os efeitos negativos por `negMul`; TCU rebaixa o risco jurídico. As concessões da Câmara seguem para o Senado (`PendingBill.conceded`). A IA escreve as frases (`concessionPrompt` em `game/ai.ts`, `askConcession` em `lib/aiActions.ts`).
- **Ficha da medida:** `src/game/ficha.ts` (`fichaDaMedida`, `conditionsOf`). Nota = 10 × chance na Câmara × chance no Senado × (1 − chance de ser contestada em 12 meses × chance de cair). Tela `src/ui/MeasureSheet.tsx`.
- **Na hora:** `ministryNow` e `urgencyNow` em `rodada.ts` (uma de cada por rodada); `applyMinistryChange` é o mesmo código do fechamento.
- **Telas:** `src/ui/PartidosPanels.tsx` (alas, conversa por tipos, líder, Mesa, gráfico das bancadas), oferta nova na `VoteSheet` (concessão, contraoferta, emendas), traidores na votação animada e no placar.
- **Save 16** (`names`, alas, Mesa, nome do presidente da Câmara guardado). 232 testes.

### 27.6 Etapas 2B e 2C (aprovadas em 31/10/2026; a 2B foi feita na v0.19, ver 27.7; a 2C na v0.20, ver 27.8)

**Origem:** `docs/levantamento-congresso.md` (prints do jogo de referência) e as decisões do Douglas da seção J do levantamento. A 2B e a 2C entram **antes do Senado** (Etapa 3). Cada uma fecha com o portão de sempre (testes, simulador, partida no navegador, CHANGELOG, DESIGN, ESTADO e versão publicada).

**Defaults que o Douglas pode trocar:** (1) post da assessoria e ação de rua continuam dentro de **Agir**, ao lado de "escrever uma medida"; (2) os fatos do Supremo (liminar, derrubada, vaga), que não têm medida possível, mantêm as opções próprias dentro de **Agir**; (3) as duas etapas saem em duas versões, 2B (v0.19) e 2C (v0.20), nessa ordem; (4) o painel "já valeu no dia do anúncio" começa só mostrando a prévia da aprovação, e aplicar na hora fica como decisão de balanceamento.

#### 2B · A página inicial e o fluxo do dia (v0.19)
**Complexidade: média-alta. Modelo: Sonnet nas telas; Opus nas regras de tempo do Supremo e no "já valeu".**

*Página inicial*
- **P1.** O cartão "Seu mês em 4 passos" é dividido: a **faixa dos passos** fica onde está; o **"O que mudou no mês passado"** e o **"Enquanto você decidia"** descem para o fim da coluna, num cartão de menos destaque (recolhido).
- **P2.** O **fato do mês** é a primeira coisa abaixo da faixa dos passos (cartão grande, com quem traz o problema, a importância e a origem), com **dois botões: Agir ou Deixar passar**. Vale para fatos bons e ruins.
- **P3.** **Saem** as opções prontas dos fatos: "promover o governo", "dar crédito a quem fez", "ignorar" (fatos bons) e as opções prontas dos fatos ruins. **Deixar passar** aplica a consequência que hoje é a opção padrão do fato, mostrada antes em chips de efeito.
- **P4.** **Agir** abre: (a) um **texto curto escrito pela IA** que explica o acontecimento (sem IA, o texto do fato); (b) o **campo de escrever** a medida; (c) **"Pedir a opinião do ministro"** (IA): 2 ou 3 ordens, pela situação real, pelo perfil dele e pelo alinhamento do partido dele (já existe em `ministerAdvicePrompt`; ajustar o prompt); (d) **acatar copia a ordem exatamente como o ministro escreveu** para o campo; (e) o jogador escolhe **"Mandar medida"** e entra no fluxo do dia (F1), com a leitura do gabinete pela IA.
- **P5.** Reaproveitar `ResponseBox` (leitura, conselho, catálogo) e `AssessoriaBox` (post e rua); `EventPanel` é reorganizado, sem perder a resposta escrita da 3A.
- **P6.** **Central de pendências** no Painel, **por urgência** (prazo restante e gravidade, em vermelho, amarelo e verde, com clique que leva ao lugar): cobranças dos grupos, promessas de posse em risco, promessas a partidos, vaga e indicação ao Supremo, sanção ou veto esperando, MP perto de caducar, projetos na fila. Greves e pedidos aparecem quando existirem como fatos em andamento. Substitui os cartões soltos de cobranças e promessas.

*Fluxo do dia (a corrente de janelas)*
- **F1.** Uma sequência de janelas com **"Etapa N de M"**, cada uma abrindo depois da anterior: 1 Leitura do gabinete → 2 Briefing e freios → 3 Votação (Câmara → Senado) → 4 Placar e partidos → 5 Supremo (se houver ação) → 6 O país reage → Encerrar o mês. A votação aceita "Decidir depois". **Decreto e MP** também passam pela corrente (leitura, ficha, assinar).
- **F2.** A **leitura do gabinete** vira janela (hoje fica na página). Inclui **antes → depois** nos grupos, **"Quem vai reagir"** (reações previstas com **chance** e **efeito por mês**: carta aberta da indústria, dólar em alta, protestos, grupos de família inflamados, exposição a escândalo; números nossos, ligados às marcas e aos desdobramentos da 1A) e o **nome oficial** ("o Presidente anunciou: ‘suas palavras’").
- **F3.** A **ficha** passa a ter **duas notas, Congressual e Judicial (0 a 10)**, cada uma com a razão em uma frase; o risco jurídico aparece também em número, com o limite em que a oposição gasta uma ação; **potencial de crescimento** e **resumo executivo** (narrado pela IA, sem IA um texto pronto).
- **F4.** **O Supremo julga no mesmo dia** (muda a decisão 27(3), que deixava a liminar para a rodada seguinte): ao assinar decreto ou MP, ou ao aprovar uma lei, a ação (sorteada), o relator, a liminar, o plenário e o acórdão acontecem na corrente, em janelas. A consulta prévia continua em 1 rodada. "Trabalhar o plenário", sorteio com doutrina e acórdão com a frase de cada ministro ficam para a Etapa 4.
- **F5.** **O mercado precifica parte no envio** (cerca de 1/3 do choque de confiança; o resto na aprovação; barrada, desfaz).
- **F6.** **"O país reage"** ganha **"já valeu no dia do anúncio"** (prévia da aprovação) e **"entra no fechamento do mês"** (resultado primário antes → depois).

#### 2C · A mesa de negociação e a base (v0.20, feita: ver 27.8)
**Complexidade: muito alta. Modelo: Opus (regras e balanceamento); Sonnet nas telas.**

- **N1.** **Um acordo com um partido vale nas duas casas:** a oferta mostra "converte X na Câmara e Y no Senado" e entra na contagem das duas. **3 conversas por rodada no total** (hoje 3 na Câmara + 2 no Senado). Mantém só a revelação ao clicar: o partido só mostra o que quer depois de aberto.
- **N2.** **Cardápio de pedidos (acaba a repetição):** cada partido aberto mostra **2 ou 3 opções**, cada uma com o que pede, o custo, a confiabilidade e **os votos convertidos**. Catálogo de cerca de 14 tipos: emendas (individual ou de bancada, com destino), obra grande no estado do líder, cargo de segundo escalão, diretoria de estatal (**risco de esquema**, ligado à CPI), pasta (contrato da base), relatoria de projeto dele, pauta do projeto-bandeira, mudança no texto, **compensação ao setor prejudicado**, compromisso de sancionar ou não vetar outro projeto, **favor** (voto devido numa votação futura), renegociação da dívida do estado, palanque na eleição (perto da eleição), **adiar a votação em um mês**. A escolha das opções depende do **perfil do partido**, do **tema** da medida, do **espaço fiscal**, da **exposição a escândalo**, das **pastas que ele já tem** e dos **acordos recentes**, para não repetir. A IA escreve a fala; os números são do motor (substitui a lógica "um preço fixo por perfil" de `offerFor`).
- **N3.** **As ruas**, para quando faltam votos: *ato nacional* (+6 votos, sem custo no caixa) e *greve geral* (+12 votos, custa crescimento e depende dos sindicatos), cada um com público a favor e contra, **chance de esvaziar** e **de confronto**. "Só enche se a medida tem apoio; rejeitada, junta gente contra." Esvaziar custa popularidade e vira manchete.
- **N4.** **Levar à votação ou deixar na pauta:** o projeto deixado **esfria** a cada rodada sem votar e é **arquivado depois de 6 rodadas**; derrota em plenário pesa na reputação (v0.16).
- **B1.** **A base como contrato:** pasta cedida = contrato com **cota por votação** ("o acordo pede N dos M presentes"), **linha vermelha** (o que o partido nunca vota), **fidelidade 0 a 100** (sobe ao entregar, cai ao trair), **"A base nesta votação"** depois do placar (entregou ou não, fidelidade antes → depois), perda ou renegociação da pasta ao trair; contadores **"Base X de 513 · Fiel Y"**; "o governo orienta" e "a oposição orienta" no cabeçalho.
- **B2.** **Pacto de base sem ministério** (6 meses, por emendas por mês ou por relatoria; até 3 ao mesmo tempo, 1 novo por mês) e **"sondar é de graça"**: o partido diz o que quer e só assina quem quer.
- **H1.** **Registro de votos dos partidos (reputação deles):** para cada votação, cada partido guarda **como votou** e **quais grupos e setores agradou ou desagradou** (efeito da medida × lado do voto), nas coisas boas e nas ruins; tela por partido na Ficha. **Toda medida levada ao Congresso, passe ou não, marca o presidente** (a v0.16 marca no envio; acrescentar "medida absurda barrada", "lei aprovada com apoio de quem") com o que ela agradou e desagradou. Os dois registros são a **matéria-prima da eleição** (debates e campanhas, Etapas 7 e 8).
- **L1.** ✅ **Logos dos partidos (adiantado na v0.19.1):** `public/logos/<id>.webp` (256×256, arte do Douglas), componente `src/ui/PartyLogo.tsx` (sem o arquivo, um selo com a cor e a sigla). Usados na posse, no topo do Painel, nos cartões dos partidos, nas lideranças, no gráfico das bancadas e no cartão da oposição. Cada partido ganhou `number` (número na urna) em `data/parties.ts`.

#### O que fica para outras etapas
- **Etapa 3 (Senado):** bancadas por estado (27, com relação, pedido de obra ou cargo, "não negocia", filtros e "pagar as N obras"), "senador vota pelo estado", sabatina (41), impeachment de ministro (54), "meia sessão" perto do recesso.
- **Etapa 4 (Supremo):** ação com autor nomeado, sorteio do relator com a doutrina dos 11, acórdão com a frase de cada ministro, "Trabalhar o plenário", índice "A seu favor" da Corte, "o precedente agora é seu", **cadeira no TSE** (popup "O Supremo pede você"), "Embalo" e "Planalto x Supremo" (pedir no próximo vídeo).
- **Etapa 5 (Oposição, escândalos e CPI):** CPI com 171 assinaturas por 6 meses ("trabalhar as assinaturas" ou "cooperar"), relatório pelas provas, **esquemas** (Controle do Estado, tipos de esquema por pasta de risco, instituições), esquema que estoura e **consequência na eleição** (o partido perde até 7,5% da bancada).
- **Etapa 6:** líder do governo na Câmara e vice-líder.
- **Etapa 7:** mapa por estado. **Etapa 8:** pessoas fictícias e jornais, partido do presidente por dentro, federação, incorporação, fusão, cláusula de barreira e janela partidária.
- **Quando abrirem Economia e Programas:** impacto por setor ("o que muda nas empresas").

### 27.7 Como ficou a Etapa 2B (v0.19)

**Defaults mantidos** (27.6): post e rua dentro de Agir; os fatos do Supremo (`choiceOnly`) mantêm as escolhas próprias dentro de Agir; "já valeu" é só prévia (a aprovação muda de vez no fechamento); 2B e 2C em versões separadas.

**Página inicial (P1 a P6):**
- `src/ui/EventPanel.tsx`: o fato do mês é o cartão logo abaixo dos passos, com **Agir** e **Deixar passar** (que marca a opção padrão do fato e mostra os efeitos antes). As opções prontas saíram de todos os fatos, menos dos do Supremo. **Agir** = resumo da assessoria (`eventBriefPrompt`, IA; sem IA, vale o relato), `ResponseBox` (opinião do ministro com 2 ou 3 ordens; o prompt agora pede para seguir a situação real, o perfil e o alinhamento do partido; "Usar" copia a ordem exata) e `AssessoriaBox` (post e rua).
- Central de pendências: `src/game/pendencias.ts` (motor, só lê o estado) e `PendenciasCard` em `src/ui/FluxoSheets.tsx`, no topo da coluna da direita. Ordem: vermelho (vence em 1 mês ou menos), amarelo (grave ou até 3 meses), verde; dentro da cor, pelo peso. Promessa de posse fora da meta só vira pendência nos últimos `FLUXO.promiseWindow` (18) meses; antes, fica no cartão de promessas. Saíram o `DemandsCard` e o cartão "Esperando sua caneta".
- "O que mudou no mês passado" + "Enquanto você decidia" num cartão recolhido no fim da coluna da esquerda (o passo 1 abre e rola até ele).

**Corrente de janelas (F1, F2):** `src/ui/corrente.ts` (`chainLabels`, `chainAt`) e `src/ui/Chain.tsx` (`ChainSteps`, "Etapa N de M"). Etiquetas: Leitura, Ficha, (Votação, Placar: só lei, LC e PEC), (Supremo: só se a medida tem risco jurídico), O país reage. Janelas: `MeasureSheet` (Leitura e Ficha), `VoteSheet` (Votação), `VoteAnimation` (Placar), `CourtSheet` (Supremo: ação, relator, liminar) e `RulingAnimation` (plenário), `ReactionSheet` (O país reage, com "Encerrar o mês"). A medida do mês abre a leitura em janela direto; a resposta ao fato passa pela leitura com o ministro (`ReadingSheet`) e cai na Ficha (`MeasureSheet startStep=2`). O nome da medida vale também para a resposta. Pautar projeto da fila não leva a corrente (só as janelas).

**Motor:**
- **Supremo no mesmo dia (F4):** `courtNow` em `supremo.ts`, chamado por `rodada.ts` quando a medida passa a valer (decreto e MP em `sendInto`; lei em `enactBill`). Chance = 1 − (1 − chance por mês)^`FLUXO.signingMonths` (2). Com ação: relator sorteado, liminar sorteada (mostrada), plenário julga na hora (`judge`), o julgamento vai para `supremo.rulings`. Derrubada aplica já o mesmo que o fechamento fazia (`applyStruckNow`: desfaz os efeitos, impulsos nos grupos, sai das leis, bloqueia por 6 meses, fato `stfDerrubada` no mês seguinte, oposição +3 via `round.rival`). Sem ação: `InForce.grace` = agora + `FLUXO.graceMonths` (3); o sorteio mensal do fechamento pula a medida até lá. As ações do fechamento (meses depois, projetos no Congresso) continuam como antes; o "Trabalhar o plenário" e o sorteio com doutrina ficam para a Etapa 4. Primeira tentativa com 3 meses na assinatura dava o mesmo total; ficou 2 meses (com 3 de folga) para a liminar no mesmo dia não aumentar demais as derrubadas.
- **Mercado no envio (F5):** `PendingBill.priced` = confiança da lei × `FLUXO.pricedAtSend` (1/3), somado no envio; na aprovação, a lei soma o total menos o já precificado; barrada (`rejectBill`), desfaz. Passa da Câmara ao Senado junto com o projeto.
- **Quem vai reagir (F2):** `src/game/fluxo.ts` (`reactionsFor`, `rollReactions`) e números em `data/fluxo.ts` (`REACOES`, `REACAO_CHANCE`): 8 reações (indústria, dólar, mercado aplaude, protesto do grupo que mais perde, comemoração do que mais ganha, grupos de família em pauta de costumes, oposição nas redes em medida impopular, Câmara reclama de decreto forte). Sorteadas no envio (todas as medidas), valem na rodada e ficam em `round.reactions` (com `fired` e `good`).
- **Ficha (F3):** `notasFicha` (Congressual = 10 × chance na Câmara × chance no Senado, decreto = 10; Judicial = 10 × (1 − chance de ação no dia × chance de cair); risco jurídico em número = `legalRiskScore`, a chance de cair se fosse julgada, com o limite `FLUXO.riskLimit` 45; potencial de crescimento pelo `effects.potential`) e `resumoExecutivo` (texto pronto; com IA, `briefingPrompt` narra a partir dele).
- **Já valeu (F6):** `approvalPreview` (aprovação geral com o efeito da medida nos grupos, sem o resto do mês) e `primaryPreview` (primário antes → depois pelo custo por ano), mostrados na Leitura e em "O país reage". Só prévia.

**Save 17** (campos novos opcionais: `round.court`, `round.reactions`, `round.rival`, `InForce.grace`, `PendingBill.priced`). 242 testes (10 novos em `fluxo.test.ts`).

**Balanceamento (simulador, 30 sementes):** notas iguais em passivo, populista, austero, equilibrado e só assessoria; responde aos fatos 615 → 607 e com assessoria 636 → 636; leis por mandato iguais (MDN 22, POL 20, FPT 12). Derrubadas no Supremo sobem um pouco (responde aos fatos 0,2 → 0,5 por mandato; medidas arriscadas 2,1 → 3,3 com o FPT), porque a liminar agora vai ao plenário no mesmo dia e não dá mais tempo de recuar. O simulador passou a pautar a fila antes de escolher os decretos (a derrubada na hora pode mudar o que é permitido).

**Caixa de ideias desta etapa:** "Trabalhar o plenário" e aguardar o julgamento, sorteio do relator com a doutrina, acórdão com a frase de cada ministro (Etapa 4); "o que muda nas empresas" (quando abrirem Economia e Programas); aplicar o "já valeu" na hora (decisão de balanceamento, se o Douglas quiser).

### 27.8 Como ficou a Etapa 2C (v0.20)

**Motor** (números todos em `src/game/data/base.ts`):
- **Cardápio (N2):** `menuKinds` em `deals.ts` pontua os 14 tipos (`ASKS`) pelo fisiologismo, tamanho da bancada, tema da medida (obra em área de obra, pasta desejada na área), caixa apertado (`MENU.tightPrimary`: pedidos de dinheiro × 0,6), exposição a escândalo (`MENU.exposedAt` 45: pedidos arriscados × 0,45), pastas que o partido já tem e pedidos repetidos nos últimos 6 meses (`dealLog`, −0,7 cada), mais um sorteio fixo por partido, medida e mês. Fica com 3 (2 para bancada pequena ou partido muito ideológico). `offerFor` devolve `options` (cada uma com `yesWith` e, se o projeto está na Câmara, `senado`); a primeira vira a oferta padrão (compatível com o código antigo). Efeitos dos pedidos novos em `applyAsk` (`rodada.ts`): obra e dívida agradam o grupo do partido (`PARTY_GROUP`), compensação devolve metade da perda ao grupo prejudicado, estatal irrita o seu partido, pasta muda o ministério na hora, relatoria vale para o próximo projeto enviado, "não vetar" e "favor" viram promessas (`Promise_.kind`; favor quitado por um acordo pago ao partido; quebrados custam relação e a marca de palavra), palanque irrita o seu partido, adiar põe `waitUntil` no projeto.
- **Duas casas (N1):** acordo fechado com o projeto na Câmara entra em `deals` e segue para o Senado (`floorCamara` copia, menos "adiar"); emendas cobrem as duas bancadas (`emendasAmount(…, 'ambas')`). `round.dealsDone` conta os acordos da rodada (limite `MENU.perRound` 3, as duas casas juntas).
- **Ruas (N3):** `mesa.ts` (`ruaPreview`, `mobilize`). Reforço em todas as bancadas: ato 0,022 e greve 0,042, **calibrados no simulador** (cerca de 290 votos na Câmara por ponto: ato ≈ +6, greve ≈ +12; esvaziado tira metade). Chance de encher pela popularidade da medida e pela aprovação (greve: mais a aprovação dos trabalhadores e o partido sindical); confronto mais provável em medida impopular. O resultado fica em `round.rua` e no projeto (`PendingBill.rua`, segue para o Senado). Medido em 40 partidas: ato enche 45% das vezes, greve 38%, confronto 17% e 35%.
- **Pauta que esfria (N4):** `ESFRIA` (−0,04 de apoio por rodada, até −0,2); `archiveStale` arquiva no fechamento da 6ª rodada contando a do envio (MP fica de fora: tem o prazo próprio de 4 rodadas).
- **Base (B1):** `base.ts`. `baseMembers` = pastas cedidas + pactos em vigor. `baseBoost` substitui o reforço fixo da pasta: reforço × (0,4 + fidelidade/117, até 1,2). `afterGovVote` confere a cota (80% dos presentes) em cada votação da Câmara e do Senado: entregou +2; traiu −(6 + 0,6 × votos faltando, até 18) e −3 de relação; linha vermelha (afinidade < −0,45) libera. Abaixo de 30 vira manchete de racha. Bancada grande (60+) com uma pasta só perde 1 de fidelidade por mês sem acordo recente. Guardado em `VoteRecord.base` e mostrado em `VoteAnimation`.
- **Pacto (B2):** `signPact` (`mesa.ts`); topa quem tem relação + 30 × fisiologismo ≥ 50. Emendas: 0,0004% do PIB ao ano por deputado durante 6 meses; relatoria: promessa de pautar o projeto do partido em 3 meses. Fidelidade de partida 65 (pasta: 70).
- **Registro (H1):** `notePartyVotes` guarda em `congress.record[partido]` (até 80 por partido) o lado do voto e os grupos agradados e desagradados (efeito da medida ≥ 0,6 × lado). `noteBarred` marca a Ficha do presidente (medida com popularidade ≤ −1 vira "medida impopular barrada"); lei aprovada anota os partidos que mais deram votos.

**Telas:** `VoteSheet` (cardápio com os votos nas duas casas, selo de base e de linha vermelha, contador de conversas, as ruas, aviso da pauta esfriando, "Base X · Fiel Y" e quem orienta), `VoteAnimation` ("A base nesta votação"), `PartidosPanels` (cartão "A base do governo" com fidelidade, pactos e "Sondar (grátis)"), `FichasView` ("Como os partidos votaram"), `pendencias.ts` (pauta esfriando, favor e "não vetar" devidos).

**Save 18:** quem tinha pasta entra com fidelidade 70; `pacts`, `dealLog` e `record` começam vazios. 258 testes (16 novos, 15 deles em `mesa.test.ts`).

**Balanceamento (simuladores, 30 sementes):** `npm run sim`: notas e leis iguais às da 2B (responde aos fatos 607, com assessoria 636; MDN 22, POL 20, FPT 11 leis). `npm run sim2c` (novo; uma lei difícil a cada 2 meses, chance entre 25% e 60%): sem acordo, 1 a 2 leis por mandato; negociando (pasta no começo, pactos, até 3 acordos por rodada), cerca de 5, com R$ 4 a 10 bi em acordos, escândalo +2 a +3,5 e a base entregando cerca de 75% das vezes (fidelidade final perto de 60). Pedidos mais escolhidos: mudar o texto, compensação, pasta, pauta, favor e relatoria. **Decidido (01/11, Douglas):** o pacto quase sempre é aceito (dá para manter 3 o mandato inteiro); deixar os partidos **mais exigentes** (subir `PACTO.willingRelation`, talvez pesar a aprovação), como primeiro passo da Etapa 3, conferindo com `npm run sim2c`.

**Caixa de ideias desta etapa:** a fala de cada pedido escrita pela IA (hoje são frases prontas por tipo; fica para a Etapa 9, polimento); "a pasta está em jogo" virar um fato do mês com escolha (renegociar ou tirar a pasta) na Etapa 6 (governo); diretoria de estatal alimentando os esquemas na Etapa 5; palanque e registro de votos usados nas campanhas e debates na Etapa 8; reaproveitar o cardápio nas bancadas estaduais do Senado na Etapa 3.

### 27.9 Etapa 3: o Senado (plano de 01/11/2026, aprovado pelo Douglas no mesmo dia)

**Complexidade: alta. Modelo: Opus nas regras (voto pelo estado, indecisos com preço, impeachment) e no balanceamento; Sonnet nas telas e nos dados dos 27 estados.**

**Ponto de partida (v0.20):** 81 senadores sem nome e sem estado, votando com a mesma fórmula da Câmara (pesos próprios); presidente do Senado (Hermínia Valença) que segura projetos; o cardápio da 2C já converte votos nas duas casas; sabatina só para o Supremo; o Senado é uma aba dentro de Governo.

**0 · Feito primeiro: pacto mais exigente (decisão de 01/11).** Topa o pacto quem tiver relação + 25 × fisiologismo + 0,6 × (aprovação − 50) − 8 × pactos já em vigor ≥ 62 (antes: relação + 30 × fisiologismo ≥ 50). A sondagem diz por que não topa (relação, aprovação, pactos em vigor e quantos pontos faltam). Simulador (`npm run sim2c`, 30 sementes): pactos por mandato do negociador 24 → 11 (MDN), 13 (FPT) e 16 (POL); leis e nota no mesmo nível (MDN 5,5 → 6,6 leis; POL 5,3 → 5,2).

**Bloco A · Os 27 estados**
1. **Dados dos estados** (`data/estados.ts`): as 27 unidades da federação com sigla, região e o grupo social que mais pesa nelas (agro, trabalhadores, classe média...). Cada estado tem **3 senadores** (fictícios, com nome, partido e posição própria) e **os deputados proporcionais à população** (o deputado ganha `uf`; nesta etapa só serve para as fichas e para a Etapa 7).
2. **Relação do estado com o governo** (−50 a +50, começa pela distância ideológica entre o presidente e a bancada do estado, mais ruído): sobe com obra entregue, cargo e lei que agrade o grupo do estado; cai com promessa de obra não paga, lei que machuque o grupo do estado e crise regional ignorada (ex.: enchente, seca).
3. **O que cada bancada estadual quer** (renovado a cada 6 meses): **obra** (R$ bi, entra no primário por 12 meses, risco de escândalo), **cargo regional** (superintendência, sem dinheiro, com escândalo), **não negocia** (bancada ideológica, só muda pela relação) ou **com você** (já é aliada).

**Bloco B · Senador vota pelo estado**
4. **Na fórmula de voto do senador entra a relação do estado** (peso novo `wState` em `data/senado.ts`), e a orientação do partido pesa menos que na Câmara. Assim um senador de partido da base pode votar contra se o estado está de mal com o governo, e um de oposição pode votar a favor se o estado ganhou a obra. Meta de balanceamento: o Senado continua barrando mais ou menos o mesmo de hoje quando o jogador não faz nada com os estados.
5. **Indecisos com preço:** na janela de votação do Senado, os senadores perto da linha (que a previsão dá entre 35% e 65%) aparecem pelo nome, com o estado e o que pedem (obra, cargo, emenda ou "não tem preço"). Comprar um indeciso vale só para aquela votação e conta como uma das 3 conversas da rodada (ou um limite próprio de 3 indecisos por rodada; ver pergunta 3).
6. **"Pagar as N obras":** botão na página do Senado que paga de uma vez as obras pedidas por um filtro de estados, com o custo total no primário mostrado antes.

**Bloco C · A página do Senado** (a aba Senado vira uma página própria dentro de Governo)
7. **Mesa** (presidente, relação, estado da sessão), **"Como o Senado está hoje"** (barra: com você, indecisos, contra) e **"Com você: X de 81"** (quantos deles são de partidos da base).
8. **Bancadas por estado:** os 27 cartões com a relação, os 3 senadores, o pedido e o botão de atender; filtros **Todas, Obra, Cargo, Não negociam, Com você**.
9. **Líderes de bancada no Senado:** um por partido (fictício, nome; retrato ver pergunta 2), que é quem aparece no cardápio quando o projeto está no Senado.
10. **Comissões do Senado:** CCJ e CAE (Assuntos Econômicos). Projeto de risco jurídico alto passa pela CCJ do Senado; projeto com custo alto pela CAE; cada uma pode aprovar, **desidratar** (o texto perde força) ou segurar 1 rodada. Mostradas antes de votar, como a CCJ da Câmara.
11. **"Meia sessão" perto do recesso** (junho e dezembro): mais ausentes no Senado (5% → 15%) e a presidente só pauta 1 projeto na rodada. Aparece na faixa da rodada.

**Bloco D · Poderes próprios do Senado**
12. **Sabatinas na página do Senado:** a do Supremo (já existe, 41 votos) passa a mostrar os senadores indecisos e aceita a mesma negociação por estado.
13. **Impeachment de ministro** (crime de responsabilidade, 54 votos em voto secreto): quando um ministro está muito desgastado (80+) e a exposição a escândalo está alta, a oposição pode pedir o afastamento; vira fato do mês com **Agir** (defender: negociar os votos no Senado) ou **Deixar passar** (o ministro cai, custo de imagem). Demitir antes da votação evita a derrota mas também marca a Ficha.

**Fica fora (Caixa de ideias):** governador puxando a bancada (Etapa 7); mapa do Brasil por estado (Etapa 7); CPI no Senado (Etapa 5); a fala dos senadores escrita pela IA (Etapa 9); Senado emendando e devolvendo o projeto à Câmara (ver pergunta 4).

**Save 19:** `SenateState` ganha `states` (relação e pedido por estado), senadores com `uf` e `name`, deputados com `uf`, líderes de bancada, impeachment em andamento. Migração gera tudo com a semente do save.

**Balanceamento a conferir (simuladores):** sem mexer nos estados, o Senado barra o mesmo de hoje (cerca de 1% a 13% do que a Câmara aprova, conforme o partido); pagar obras vale a pena só para lei difícil (R$ por voto mais caro que no cardápio da Câmara); indecisos não podem virar compra garantida; impeachment de ministro aparece 0 a 2 vezes por mandato para quem deixa ministros desgastados.

**Respostas do Douglas (01/11):** (1) **nomes reais das 27 UFs** (senadores fictícios); (2) **retrato só para os 9 líderes de bancada** no Senado; (3) indecisos com **limite próprio de 3 por rodada**, além das 3 conversas; (4) o texto desidratado no Senado **não volta à Câmara**. Default mantido: **uma versão só (v0.21)**, com os blocos como ordem de trabalho.

### 27.1 Caixa de ideias por etapa
- Etapa 1 (revisada ao fechar a 1B): conquistas como selos da Ficha vão para a Etapa 8 (já lista conquistas); nome da medida no telejornal e decreto também com janela de confirmação antes de assinar vão para a Etapa 2 (janela da medida em etapas).
- Etapa 2 (da 1B): o post de agenda com texto livre escrito pela IA fica para a Etapa 9 (polimento); "precisa de você" (alertas) e cenas de transição, para a Etapa 8.
- Etapa 2 (feito na v0.18): ministério cedido valendo na hora; urgência como ação da rodada.
- Etapa 2 (revisada ao fechar): vice-líder do governo vai para a Etapa 6 (vice e governo); orçamento paralelo como escândalo vai para a 5; 22 partidos como na referência ficou de fora (as alas dão a variedade); "precisa de você" quando a ala do seu partido estiver perto de rachar, para a Etapa 8.
- Etapa 3: governador puxando a bancada (vai para a 7).
- Da Etapa 2 (levantamento do Congresso, 31/10): ideias que ficaram para o Judiciário, já mapeadas em `docs/levantamento-congresso.md`: popup "O Supremo pede você" (cadeira de jurista no TSE, com 1 mês, padrão e preço), ação já na assinatura com autor nomeado e fundamento, sorteio do relator com a doutrina dos 11, acórdão com a frase de cada ministro, "Trabalhar o plenário", índice "A seu favor" da Corte e "o precedente agora é seu".
- Da Etapa 2, para a Etapa 8: partido do presidente por dentro (direção, congresso do partido, linha, escola de formação, estatuto, convenção, puxador de votos), federação, incorporação, fusão, cláusula de barreira e janela partidária, ala que muda de legenda.
- Da Etapa 2, para a Etapa 6: líder do governo na Câmara (junto com o vice-líder).
- Para a Etapa 8 (31/10, material do Douglas em `arte/campanha/`, ver o LEIAME): kit de campanha por partido (cartaz com o círculo do retrato e a faixa do nome, post, adesivo, bandeira, prévia), caminhada presidencial com as bandeiras e o editor de cartazes (`editar-cartazes.html`) como referência para o jogo montar o cartaz com o rosto e o nome do presidente. Fica fora de `public/` até ser usado.

