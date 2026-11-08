# Plano da Etapa 6: o presidente que governa (proposta de 08/11/2026)

> **Aprovado pelo Douglas em 08/11/2026, com as 6 recomendações da seção 8** (ordem 6.0 → 6B → 6A → 6C → 6D → 6E → 6F; pesquisa com margem de erro e aprovação sempre visível; vice sorteado na posse até a Etapa 8; impeachment só depois do 6E; faixa vermelha na ficha e confirmação extra só na medida explosiva; 2 espaços de agenda). Nada deste plano está no código ainda. Segue o formato da Etapa 5: blocos pequenos, cada um com **regras** (sem tela, desligadas) e depois **telas** (que ligam), para o jogo nunca ficar com regra que o jogador não consegue responder.

## 1. Objetivo em uma frase

Hoje o jogador **manda medidas e reage a crises**. Na Etapa 6 ele passa a **governar**: usa a agenda do presidente, fala, cobra, escolhe aliados, administra a própria equipe e enfrenta dilemas, e o jogo mostra o **porquê** de cada número.

## 2. O que já existe e a Etapa 6 usa (não refazer)

| Peça | Onde | Como entra |
|---|---|---|
| Agenda de 2 espaços por mês | `data/caso.ts` (`AGENDA`), `agendaUsada` | Vira o centro da etapa: tudo que o presidente faz sem projeto de lei gasta espaço |
| Registro de causas | `causas.ts` (`porque`) | Base da tela do "Por quê?" |
| Motor do post e da rua (sem tela) | `assessoria.ts`, `data/assessoria.ts`, `data/rua.ts` | Voltam como ações de agenda |
| Curva de efeitos e teto por grupo | `efeitos.ts` | Base da "medida explosiva" e da nota de absurdo |
| Promessas de posse | `OppositionCards.tsx`, `state.promises` | Base da credibilidade |
| Ministérios, interinos, cessão de pastas | `ministerios.ts`, `camara.ts` | Base de "ministérios com vida" |
| Líderes de bancada e lealdade | `partidos.ts`, `base.ts` | Base do líder do governo |
| Janelas e Radar | `Janelas.tsx`, `GameScreen.tsx` | Todo detalhe novo abre em janela; o painel mostra só o resumo |

## 3. Antes de começar (Bloco 6.0: arrumar a casa)

Pequeno, **Sonnet**, sem regra nova. Evita que a Etapa 6 nasça em cima de arquivos gigantes.

1. **Partir o `GameScreen.tsx`** (hoje com mais de 1.100 linhas): extrair o Radar, as janelas e os cartões da coluna da agenda. Só mover código.
2. **Fechar as pendências do lote A2:** aviso "acordo para vencer" na central de pendências e rebalancear o 35% do Senado (`SENADO.dealCarry`) com o seu playtest.
3. **Pendências de visual:** fotos sem Elo em preto e branco nas listas; estender o estilo de vidro e bordas retas às janelas de votação e decisão.
4. **Portão de playtest:** você joga uma partida completa (5B e 5C) e anota. O que quebrar entra antes do 6A.

Versão: **v0.32.x**. Complexidade **baixa a média**.

## 4. Os blocos

Cada bloco sobe `saveVersion` quando mexer no estado (com migração e teste). Numeração sugerida: regras em `0.33.0`, telas em `0.33.1`, e assim por diante.

### 6A. Agenda completa e ação política sem instrumento · Opus (regras) + Sonnet (telas) · complexidade **alta**

A espinha da etapa. Tudo mais se apoia nela.

- **Agenda unificada:** uma janela "Agenda do presidente" mostra o que gasta espaço neste mês (casos, CPI, advogado, inteligência, e as ações novas) e o que sobra. O cartão de cada assunto continua onde está.
- **Ações sem instrumento** (não precisam de lei nem decreto): **post** da assessoria, **ação de rua**, **receber um líder**, **cobrar um ministro**, **falar à nação** (o discurso do 6C), **imprensa** (pedir apoio ou romper com uma voz da imprensa, no máximo uma vez por mês; ideia vinda do jogo de referência, v1.32; apoio rende aprovação e cobertura, rompimento custa cobertura e some se a voz for ignorada; entra no Teste do atalho: sem repetir a mesma voz em meses seguidos). Cada uma tem custo à vista e efeito próprio.
- **Regra de ouro (decisão já tomada):** a ação **gasta espaço e substitui a medida do mês em vez de somar**. É o freio do Teste do atalho: não dá para empilhar posts e ganhar aprovação de graça.
- **Meses sem crise:** "Sua agenda está limpa" ganha um menu com essas ações, em vez de só esperar.
- **Retorno decrescente:** repetir a mesma ação em meses seguidos rende menos (como já fazemos com medidas parecidas).
- **Regras de quem paga:** a assessoria e a rua já têm números prontos em `data/assessoria.ts` e `data/rua.ts`. Rebalancear com o simulador.

Testes: atalho (post todo mês não pode virar aprovação grátis), beco (sempre dá para escolher "deixar passar"), sobrecarga (no máximo 2 decisões novas por tela).

### 6B. A tela do "Por quê?" e a ficha com "antes → depois" · Sonnet · complexidade **média**

Quase só tela, porque o registro de causas já existe. Entra cedo porque **ajuda a medir tudo o que vem depois**.

- Janela **"Por quê?"** a partir de qualquer indicador ou grupo: lista de quem mexeu, quando e quanto (o que o `causas.ts` já guarda), em frases.
- **Ficha da medida** mostra o **antes → depois** de cada grupo, para o jogador sentir a escala dos efeitos.
- **"Enquanto você decidia"** e **"Precisa de você"**: alertas (exposição a escândalo alta, caixa baixo, promessa atrasada), no Radar.
- Pequena regra: nenhuma. Se faltar causa registrada em algum ponto, completa.

### 6C. Credibilidade, discurso, pesquisa e medida explosiva · Opus (regras) + Sonnet (telas) · complexidade **alta**

- **Crédito de expectativa e credibilidade:** a promessa de posse e o que você diz criam expectativa; entregar sobe a credibilidade, falhar derruba (e a derrubada é mais rápida que a subida, como no Elo). Afeta o peso das suas palavras e o mercado.
- **Discurso:** peso diferente por tipo de crise (crise material não se resolve com discurso; crise de confiança, sim). Gasta agenda (6A).
- **Pesquisa:** o presidente encomenda uma pesquisa (gasta agenda e dinheiro) e vê a aprovação **com margem de erro**, por grupo. A aprovação real continua escondida entre pesquisas, só com a pista.
- **Medida explosiva** (ideia sua de 07/11): um degrau acima da medida ruim, **com alerta antes de assinar** e extras (marca forte de reputação, força ao rival, mercado e dólar, base fugindo, fato de protesto). Saída de **retirar da pauta** com custo menor. Cuidado dos testes: nada de degrau seco e nada de ganho para algum grupo.
- **Nota de absurdo** das medidas, ligada à explosiva.

### 6D. Pressão antes da votação · Opus (desenho) + Sonnet (telas) · complexidade **média-alta**

- Com a lei na pauta, surgem **fatos de pressão** (agência de risco, atos nas ruas, mercado nervoso) com **efeito real no voto**, e saídas: **retirar da pauta, adiar, negociar ou enfrentar**.
- **Resposta do jogador aos grupos que se organizam** (ideia do jogo de referência, v1.25 "O país reage"): hoje o jogador só vê as 8 reações. Passa a poder responder ao grupo que se mexe (receber, ceder em parte, enfrentar, ignorar), com custo à vista e a resposta marcando a Ficha de governo. No máximo um grupo por vez (Teste da sobrecarga).
- Reaproveita a mesa de negociação, as ruas e a agenda.
- Teste do atalho: **retirar e reenviar não pode ser grátis** (custo que volta no tempo). Teste da sobrecarga: no máximo uma pressão ativa por vez.

### 6E. Governo com vida: líder do governo, vice, ministérios e círculo de confiança · Opus (regras) + Sonnet (telas) · complexidade **alta**

- **Líder do governo na Câmara** e **vice-líder:** quem articula por você. Têm lealdade, competência e Elo. Podem falhar, trair ou vazar.
- **Vice-presidente:** aparece com perfil, lealdade e ações (dar espaço, isolar, confrontar em público, vigiar). **É o único que ganha se você cair**; vira fonte de crise e de impeachment. *Nota:* a escolha do vice na chapa é da Etapa 8; aqui ele nasce **sorteado na posse** (e Etapa 8 troca o sorteio pela escolha). Pede save novo.
- **Ministérios com vida:** metas por pasta já existem; entram **desgaste**, **"a pasta está em jogo"** (fato do mês com escolha: renegociar ou tirar a pasta), **nomear titular no lugar do interino** e reforma ministerial.
- **Círculo de confiança:** uma janela com quem o presidente escuta (advogado, líder, vice, ministros-chave) e o Elo de cada um. Cada um dá **parecer** nas decisões; ouvir quem tem risco alto tem custo.

### 6F. Dilemas e fecho · Opus (desenho) + Sonnet (telas) · complexidade **média**

- **Dilemas:** fatos em que **dois bens colidem** (ex.: salvar o orçamento ou proteger um grupo; ceder ao aliado ou à opinião pública). Duas ou três saídas com custo à vista, nenhuma "certa". Entram no lugar de parte do catálogo atual, não somam.
- **Fecho da etapa:** simulação (`sim6`), partida jogada por você, DESIGN.md 27.x, CHANGELOG, versão.

## 5. Ordem e por que

1. **6.0** (arrumar) → 2. **6B** (o "Por quê?", que ajuda a ver tudo) → 3. **6A** (agenda e ações) → 4. **6C** → 5. **6D** → 6. **6E** → 7. **6F**.

6B vem antes de 6A de propósito: com o "Por quê?" pronto, você **vê** o efeito de cada ação nova nas rodadas de teste. 6A vem antes de 6C, 6D e 6E porque todos gastam agenda.

## 6. Quanto de trabalho (estimativa)

| Bloco | Modelo | Complexidade | Tamanho (versões) |
|---|---|---|---|
| 6.0 Arrumar | Sonnet | baixa a média | 1 |
| 6B "Por quê?" | Sonnet | média | 1 |
| 6A Agenda e ações | Opus + Sonnet | alta | 2 (regras, telas) |
| 6C Credibilidade e discurso | Opus + Sonnet | alta | 2 |
| 6D Pressão antes da votação | Opus + Sonnet | média-alta | 2 |
| 6E Governo com vida | Opus + Sonnet | alta | 2 a 3 |
| 6F Dilemas e fecho | Opus + Sonnet | média | 1 a 2 |

Total: cerca de **12 a 14 versões**. É a maior etapa até agora, por isso o formato em blocos pequenos e o portão de playtest entre eles.

## 7. O que fica **fora** (para não inchar)

- **Mapa por estado, governadores, desastres e crises com relógio:** Etapa 7.
- **Congresso vivo e partido do presidente por dentro, frentes parlamentares, visual dos cartões dos partidos:** é a **Etapa 6B do roteiro** (não confundir com o bloco 6B deste plano, o "Por quê?"). Fica para depois da Etapa 6.
- **Candidatura completa e escolha do vice:** Etapa 8. Por decisão do Douglas (08/11/2026), a Etapa 8 inclui a **campanha completa de 13 semanas** (candidatos rivais, debates, sabatinas, horário eleitoral, pesquisas, segundo turno, apuração) e as **práticas ilegais de campanha com risco de representação no TSE** (o jogo de referência tem 14). Regra do projeto mantida: candidatos, veículos e sabatinas são **fictícios** (inspirados na realidade, sem nomes nem marcas reais). Ideias do jogo de referência para a mesma etapa: derrota que não acaba a partida e "noite da derrota", noite da apuração animada, autópsia do governo.
- **Parlamentarismo e golpe com junta militar:** **futuro, depois da Etapa 9**, como modo de regime opcional (confiança da Câmara, moção de censura, dissolução; golpe como aposta com eixos caserna, rua, mercado, Congresso e Supremo, e escolha do tipo de regime). Só entra depois do ciclo completo de eleição e de impeachment, pois depende deles. Complexidade muito alta · Opus ou Fable. Fica na Caixa de ideias.
- **Impeachment do presidente:** ficou na Caixa (usa `comissoes.contraPresidente`, `investigacao.denuncias` e `supremo.defied`). Proposta: **decidir depois do 6E**, quando o vice existir. Complexidade alta · Opus.
- **Diplomacia e Programas** (viajar, receber empresa): abas ainda em branco, Etapa 7B.
- Orçamento anual detalhado, sessão de vetos, modo de realismo: continuam de fora.

## 8. Perguntas para você decidir (cada uma com a minha recomendação)

1. **Ordem:** começar pelo 6.0 e pelo "Por quê?" (6B) antes da agenda (6A)? **Recomendo que sim.**
2. **Pesquisa com margem de erro** (aprovação escondida entre pesquisas): entra no 6C? É mais realista e dá decisão ("encomendar uma pesquisa?"), mas esconde um número que hoje aparece sempre. **Recomendo que entre, com a aprovação sempre visível no painel e a pesquisa servindo para os grupos.**
3. **Vice sorteado na posse** até a Etapa 8 trazer a escolha: ok? **Recomendo que sim.**
4. **Impeachment:** fica para depois do 6E (como acima) ou entra na etapa? **Recomendo depois do 6E.**
5. **Medida explosiva:** quer o **alerta antes de assinar** como janela de confirmação própria (um clique a mais) ou só uma faixa vermelha na ficha? **Recomendo a faixa na ficha e a confirmação só no nível "explosiva".**
6. **Meta de tamanho:** manter 2 espaços de agenda por mês, ou subir para 3 com as ações novas? **Recomendo manter 2** (a escassez é o que dá escolha) e medir no simulador.

## 9. Como a etapa termina (definição de pronto)

Testes passando · `sim6` sem disparar nem desabar · partida completa jogada por você (portão de playtest) · efeitos ligados à memória do mundo · todo texto de IA com texto de reserva · versão publicada · DESIGN.md 27.x, CHANGELOG, ESTADO.md e CLAUDE.md atualizados · Caixa de ideias revisada.
