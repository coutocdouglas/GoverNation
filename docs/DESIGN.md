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
| 0.3 | Congresso com 513 deputados e votação |
| 0.4 | Catálogo de medidas, crises, nota final (primeiro mandato completo jogável) |
| 0.5 | Texto livre com IA preenchendo a estrutura de medida |
| 0.6+ | Supremo, imprensa, estados, campanha, conquistas |

---

## 10. Técnica

- **App:** Tauri 2 (instalador leve para Windows) com interface em React + TypeScript.
- **Motor do jogo:** TypeScript puro, sem dependência da interface, para poder ser testado sozinho.
- **Dados de balanceamento:** arquivos JSON em `src/game/data/`.
- **Saves:** guardados na pasta de dados do usuário no Windows, fora da pasta do programa. Atualizações não apagam saves.
- **Atualizações:** GitHub Releases + atualizador do Tauri com assinatura digital.
