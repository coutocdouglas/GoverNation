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
- **Em aberto:** biblioteca compartilhada entre mandatos (medidas criadas num jogo aparecendo em outro); balanceamento pelo simulador.
