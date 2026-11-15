# Plano H4: requerimentos dos setores em passos (aprovado pelo Douglas em 14/11/2026; **feito nas v0.47.0, v0.47.1 e v0.47.2**)

> **Aprovadas as 3 versões** (v0.47.0 regras, v0.47.1 telas, v0.47.2 requerimentos de grupo). Parte da Etapa 6G (`plano-etapa-6g.md`, bloco H4). Decisões do Douglas: incluir a v0.47.2; a adoção **consome a medida do mês**; a chance da contraproposta aparece em **faixa**; setor ignorado ou desacatado fica **registrado** para o H5 (sem efeito novo nesta etapa).

## 1. O que muda
Hoje a proposta de setor (5A) é um aceitar ou recusar de um clique (7 setores, ganho na hora, rastro e semente de risco se aceitar). Passa a ser um **requerimento** com vida de meses e passos, cada um com o custo à vista e uma saída.

## 2. Os passos
1. **Chegada (fase "aberto", prazo de 3 meses):** reunir ou ignorar. **Reunião** é uma ação política da agenda (6A): gasta o espaço do mês, no lugar da medida. **Ignorar** (ou deixar o prazo vencer) tira relação do setor e planta uma semente que volta como fato ("o setor cobra a conta do descaso").
2. **Pautas (fase "pautas", prazo de 2 meses):** a reunião devolve duas pautas que o **setor oferece**: a *intermediária* e a *duvidosa* (a oferta de hoje, com rastro e semente de risco). O jogador escolhe uma, ou **contrapõe** pedindo a *limpa* (sem risco, ganho pequeno).
3. **Contraproposta:** uma só vez, com sorteio. A chance depende da relação com o setor, do que já foi ignorado ou desacatado e da pauta pedida; mostrada em **faixa** (improvável, arriscada, provável). Se o setor **recusa**, só resta acatar a duvidosa ou **desacatar** (o setor se afasta mais).
4. **Acatado (prazo de 4 meses):** o ganho da pauta vem na hora; o requerimento continua na janela do problema.
5. **Estruturação pelo ministro** da área (perfil do H2): no mês seguinte entrega a medida pronta com os pontos que acha pertinentes e, se for o caso, uma ressalva. Adotar **antes** da estruturação contraria o ministro (desgaste pequeno).
6. **Adoção ou desistência:** adotar é mandar a medida do setor como a **medida do mês** (uma por rodada); a reação do setor e dos atingidos é a da medida. Desistir depois de acatar custa mais que recusar antes. Prazo vencido conta como desistência.

## 3. Regras de desenho
- **Atalho:** um requerimento ativo por vez; intervalo de 3 meses entre requerimentos e de 9 meses por setor; uma contraproposta por requerimento; reunir não repete.
- **Beco:** sempre dá para ignorar, desistir ou desacatar; o prazo é visível e nada some sem aviso.
- **Sobrecarga:** no máximo 1 decisão nova por tela; o resto aparece em "o que mudou".
- **Memória do mundo:** cada passo gera crônica, biografia e Ficha; a pauta duvidosa continua plantando rastro e semente de risco (5A); ignorar planta a semente do fato de cobrança.
- **Gancho do H5:** cada setor guarda `relacao`, `ignorados` e `desacatados` (só dado).

## 4. Versões
| Versão | Conteúdo | Modelo | Complexidade |
|---|---|---|---|
| v0.47.0 | Regras (desligadas): `GameState.requerimentos`, os passos, 7 setores com 3 pautas, chance da contraproposta, sementes, `AcaoAgenda` "reuniao", save 45 com migração da proposta atual, `npm run sim10` | Opus | alta |
| v0.47.1 | Telas (ligam): janela passo a passo, cartão na central de pendências, resumo no Radar, ação "Reunião" na agenda | Sonnet | média |
| v0.47.2 | Requerimentos dos grupos: tensão acima de 70 abre um requerimento do grupo (caminhoneiros, professores...); atender baixa a tensão | Opus | média |
