# Plano H3: 31 grupos sociais, com peso e tensão (proposta de 13/11/2026)

> **Aprovado pelo Douglas em 13/11/2026. Parte 1 feita na v0.46.0** (na prática, 32 grupos: o bloco Capital e Estado tem 5). Tensão na v0.46.1; efeitos diretos na v0.46.2. Decisões já tomadas em 13/11/2026: **31 grupos**, **tensão** (grupo muito insatisfeito ameaça greve, protesto ou bloqueio) e **peso pelo tamanho no eleitorado**. A lista veio de prints do jogo de referência: entra só a mecânica (grupos por bloco, peso, base, tensão). Os nomes dos blocos, a forma de escrever os grupos, as cores e os números são nossos.

## 1. O problema
Hoje são 7 grupos. Medidas, fatos e pedidos já mexem com gente que não tem grupo próprio (caminhoneiros, evangélicos, motoristas de aplicativo, professores), e o efeito se perde num grupo genérico.

## 2. A lista do GoverNation (31 grupos em 5 blocos)

| Bloco | Grupos |
|---|---|
| **Trabalho e renda** (12) | Periferia e informais · Classe média urbana · Trabalhadores formais · Aposentados · Pequenos empreendedores · Servidores públicos · Sindicalistas · Professores · Trabalhadores de aplicativo · Profissionais da saúde · Policiais · Caminhoneiros |
| **Fé** (3) | Evangélicos · Católicos · Religiões afro-brasileiras |
| **Campo e floresta** (4) | Agronegócio · Agricultura familiar · Comunidades tradicionais (ribeirinhos e quilombolas) · Povos indígenas |
| **Identidade e causas** (8) | Jovens · Mulheres · Movimento negro · Universitários · Cultura digital · Ambientalistas · LGBT+ · Artistas |
| **Capital e Estado** (4 + 1) | Empresários · Comerciários e bancários · Mercado financeiro · Militares · Ciência e universidades |

Os pesos (tamanho no eleitorado) serão nossos, somando 100%. Os 7 grupos de hoje continuam, com o mesmo id: "Famílias de baixa renda" vira **Periferia e informais**. Os outros 24 são novos.

## 3. Como funciona sem reescrever o jogo inteiro
- **Herança:** cada grupo novo herda dos 7 de hoje (ex.: Caminhoneiros = 60% agronegócio + 40% trabalhadores formais; Evangélicos = 50% periferia + 30% classe média + reação aos costumes). As mais de cem medidas, os fatos e os pedidos escritos para os 7 continuam valendo e chegam aos 31 por essa herança.
- **Ajuste por tema:** medidas de costumes mexem mais com os grupos de fé, LGBT+ e movimento negro; medidas ambientais, com ambientalistas, indígenas e agronegócio; algumas medidas e fatos ganham efeito direto num grupo (piso dos professores → professores; frete mínimo → caminhoneiros; regular aplicativos → trabalhadores de aplicativo).
- **Peso:** a aprovação geral é a média ponderada pelos 31 pesos, como já é hoje com os 7.
- **Base:** grupos que votaram no presidente (pelo partido) marcados "sua base".
- **Tensão (0 a 100):** sobe com aprovação baixa e com medida que fere o grupo; desce com o tempo e quando o governo atende. Acima de 70, aviso ("caminhoneiros falam em parar"); acima de 90, o grupo age: greve, protesto ou bloqueio, como fato do mês com as duas saídas (agir ou deixar passar). No máximo um por vez.

## 4. Tela (Teste da interface)
- **Painel:** os 5 blocos, cada um com a aprovação média e o grupo mais tenso em destaque.
- **Janela "Grupos sociais":** a lista completa por bloco, com o peso, "sua base", a tensão e o "Por quê?" de cada grupo.
- **Medidas, fatos e pesquisa** mostram os grupos atingidos (no máximo os 4 maiores efeitos; o resto em "+ outros").

## 5. Save
Sobe o `saveVersion` (de 42 para 43), com migração e teste: cada grupo novo nasce com a aprovação herdada dos 7 de hoje. Ninguém perde mandato.

## 6. Versões
| Versão | Conteúdo | Modelo | Complexidade |
|---|---|---|---|
| v0.46.0 | Fundação: os 31 grupos, herança, pesos, base, save 43, painel por blocos e janela da lista, simulador rebalanceado | Opus (regras) + Sonnet (telas) | **alta** |
| v0.46.1 | Tensão: cálculo, aviso, greve, protesto e bloqueio como fato do mês | Opus + Sonnet | média-alta |
| v0.46.2 | Conteúdo: efeitos diretos por grupo em medidas, fatos e pedidos; pedidos dos grupos novos; IA com a lista nova | Opus | média |

## 7. Cuidados
- **Teste do atalho:** agradar grupo pequeno vale pouco na aprovação (peso); a tensão não some com post.
- **Teste da sobrecarga:** a tela principal mostra 5 blocos, não 31 linhas.
- **Simulador:** a aprovação média, o primeiro ano e o fim de mandato não podem disparar nem desabar em relação à v0.45.
- **Retratos:** se algum grupo ganhar personagem (líder sindical, pastor), ele entra no `CAST`.
