# Plano do bloco 6G e ajustes: fatos vivos, imprensa, grupos e requerimentos (proposta de 09/11/2026)

> **Etapa 6G aprovada pelo Douglas em 13/11/2026 como etapa separada.** H0 feito (v0.43.2). H1 detalhado em `plano-h1-resposta-ao-fato.md` (aguardando aprovação). Nada dos demais blocos está no código. Segue o formato da Etapa 6: blocos pequenos, **regras** (desligadas) e depois **telas** (que ligam).

## 1. Objetivo em uma frase

Fazer o mundo reagir ao que o presidente faz: fatos variados e com memória, imprensa e setores fortes que pautam o debate, mais grupos sociais, ministros com personalidade e requerimentos resolvidos em passos.

## 2. Os 10 pontos e onde cada um cai

| # | Ponto da revisão | Destino | Tipo |
|---|---|---|---|
| 1 | Duas votações por mês | Decisão do Douglas + bloco H1 | ajuste de regra |
| 2 | Ícones sobre os nomes na aba dos ministérios | Bloco H0 | correção de tela |
| 3 | Requerimentos dos setores em passos | Bloco H4 (junto do 6E) | novo |
| 4 | Fato bom virar ação executiva, sem votação | Bloco H1 (extensão do 6A) | extensão |
| 5 | Ministros sem personalidade e medidas pouco úteis | Bloco H2 | qualidade da IA |
| 6 e 10 | Fatos repetidos, imprensa, consequências | Bloco H5 (6G) | novo |
| 7 | Mais grupos sociais | Bloco H3 (antes do H5) | fundação |
| 8 | Memória entre presidentes | Caixa de ideias da Etapa 8 | futuro |
| 9 | Fato ciente do que já virou lei | Bloco H0 (versão pequena) e H5 | correção + novo |

## 3. Os blocos

### H0. Correções pequenas · Sonnet (Opus no item 2) · baixa a média · 1 versão
1. **Ícones da aba dos ministérios** sobre os nomes: o `ESTADO.md` registra um ajuste de CSS de 09/11 (coluna da foto em 64 px), ainda não publicado. Falta só conferir no jogo se resolveu.
2. **Fato ciente do histórico (ponto 9):** antes de propor resposta, o fato consulta `billStage` e as leis em vigor. Se a medida parecida já é lei, a notícia diz "já foi feito" e oferece o que se integra (reforçar, ampliar, revisar), nunca a mesma de novo. Texto de reserva obrigatório.
Sem mudança no save.

### H1. Resposta ao fato como ação executiva · Opus (regras) + Sonnet (telas) · média-alta · 2 versões
Depende de uma **decisão do Douglas** (seção 5, pergunta 1).
- A janela do fato ganha duas saídas: **medida** (vai a voto, como hoje) e **ação do presidente** (divulgar, campanha, decisão administrativa). A ação **não passa por votação nem Supremo**, pode gastar dinheiro e mexe nos setores como uma medida, com efeito menor que a medida e maior que deixar passar.
- Gasta espaço de agenda (6A) e entra no teto por grupo (`efeitos.ts`).
- Resolve em grande parte o ponto 1: a segunda "votação" do mês passa a ser a ação, sem Congresso.
- Testes: atalho (ação todo mês não vira aprovação grátis: retorno decrescente), beco (sempre dá para deixar passar), sobrecarga (no máximo 2 decisões novas por tela).

### H2. Ministros com personalidade e medidas úteis · Opus · média-alta · 1 a 2 versões
- Perfil por ministro (traços, estilo de falar, bandeiras, o que recusa), usado no parecer e na medida sugerida.
- A medida sugerida passa por filtro de utilidade: tem de responder ao fato (área, grupo, causa). Sem filtro, cai no texto de reserva.
- Precisa dos prints dos casos ruins (imagem 01 da revisão) como casos de teste.
- Todo texto da IA com reserva; erro real vai para o registro com o modelo ativo.

### H3. Mais grupos sociais · Opus · **alta** · 2 versões
- Hoje são 7 (`ESTADO.md:49`). Passar para uma lista maior, com a lista que o Douglas enviou em outro chat (**precisa estar em `docs/projeto/`**, só com a mecânica: nomes e textos nossos, fictícios).
- Mexe em: efeitos das medidas, pesquisa por grupo, "Por quê?", cobranças, reação a medidas, retratos e `GROUPS`. **Sobe `saveVersion`, com migração e teste** (grupos novos nascem a partir dos próximos mais parecidos).
- Rebalancear no simulador: teto por grupo e curva de ganho continuam valendo.
- Teste da interface: o painel mostra resumo (grupos agrupados em blocos); a lista cheia fica na janela.
- Tem de vir **antes do H5**, para o banco de fatos nascer com os grupos novos.

### H4. Requerimentos dos setores em passos · Opus (regras) + Sonnet (janela) · alta · 2 versões
Substitui o simples aceitar/recusar da proposta de setor (5A). Ao clicar no requerimento da pendência, abre uma janela passo a passo:
1. **Reunião ou ignorar.** Ignorar gera efeito futuro e fica guardado nas sementes (sem custo imediato, com custo que volta no tempo).
2. **Pautas da reunião.** A reunião devolve algumas pautas. O jogador escolhe: comprometer-se, ou **contrapropor**. Há chance de o setor **não aceitar a contraproposta**; aí o jogador acata ou desacata a proposta original.
3. **Acatada:** ganha mais prazo e o requerimento continua na janela do problema.
4. **Estruturação pelo ministro responsável** (usa o perfil do H2): entrega a medida pronta com os pontos que ele considera pertinentes.
5. **Adoção como medida de governo** (ou desistência). Reação do setor e dos atingidos, como já é hoje.
- Gasta agenda na reunião (6A). Cada passo mostra o custo antes e deixa uma saída (desistir, renegociar).
- Prazo visível, para o requerimento não sumir sem aviso.
- Testes: atalho (setor não pode ser "comprado" repetindo reuniões), beco, memória do mundo (sementes e biografia).
- Encaixa junto do 6E (ministros com vida); pode ser feito logo depois dele.

### H5 (6G). Fatos vivos e imprensa · Opus (desenho) + Sonnet (textos e telas) · **alta** · 3 a 4 versões
- **Banco muito maior** de fatos, por área e por grupo (incluindo os novos do H3), com sorteio que evita repetir o mesmo fato e a mesma consequência em partidas e meses seguidos.
- **Tipos novos:** reportagem bombástica da oposição, matéria tendenciosa de jornal econômico, boato, elogio da imprensa, **mês sem fato importante** (descanso real).
- **Responder ou ignorar** com consequência medida: desmentir, enfrentar, calar; ignorar pode não dar em nada.
- **Imprensa que pauta o governo:** uma narrativa não enfrentada vira tema por um tempo e pesa na aprovação e na pesquisa. Ataque à imprensa pode ser mal visto pelo povo (liga com a ação de imprensa do 6A).
- **Setores fortes não atendidos** (comércio, agro, etc.) podem financiar veículos e pautar notícia tendenciosa. Gatilho ligado ao requerimento ignorado (H4) e à lealdade do setor.
- **Fatos que nascem de decisões antigas** (causa e consequência), usando sementes e `causas.ts`.
- Super medido: peso por fato, limite de 1 narrativa ativa por vez, teto de efeito e variação para nunca repetir a mesma consequência (teste do atalho).
- Todo texto com reserva; "Por quê?" explica cada efeito.

## 4. Ordem proposta e dependências

1. **H0** (correções) já, independente de tudo.
2. **Decisão do ponto 1** e depois **H1**, logo após o bloco 6D (usa a agenda do 6A).
3. **H2** (ministros), antes do H4.
4. **H3** (grupos), antes do H5.
5. **H4** junto ou logo depois do 6E.
6. **H5** por último, depois de H2, H3 e H4.
Ponto 8 (memória entre presidentes) vai para a Caixa de ideias da Etapa 8.

## 5. Perguntas para o Douglas (com a minha recomendação)

1. **Duas votações por mês:** hoje valem a medida do mês e a resposta ao fato (mais a fila). Quer manter, ou a resposta ao fato passa a ser ação executiva sem votação (H1)? **Recomendo H1**: mantém uma votação por mês, como combinado.
2. **Ordem:** fazer o H0 antes de continuar o 6D? **Recomendo que sim**, é pequeno.
3. **Lista de grupos:** colocar o arquivo com os grupos do jogo de referência em `docs/projeto/` para o H3. **Preciso dele antes de estimar.**
4. **Prints:** mandar os prints da aba dos ministérios e da imagem 01 (respostas ruins).
5. **Tamanho:** os blocos somam cerca de 11 a 14 versões. Quer manter tudo dentro da Etapa 6 ou abrir uma **Etapa 6G** separada? **Recomendo separada**, para não inchar a 6.

## 6. Fora deste plano
- **Memória entre presidentes e leis desatualizadas** (ponto 8): Etapa 8/9, Caixa de ideias, Opus ou Fable.
- Orçamento detalhado, sessão de vetos e modo de realismo continuam de fora.

## 7. Como termina
Testes passando · simulação sem disparar nem desabar · partida jogada pelo Douglas · efeitos ligados à memória do mundo · todo texto de IA com reserva · versão publicada · DESIGN.md, CHANGELOG, ESTADO.md e CLAUDE.md atualizados.
