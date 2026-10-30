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
