# Plano: reforma do Novo mandato (aprovado pelo Douglas em 17/11/2026)

> Protótipo aprovado: `docs/projeto/prototipo-novo-mandato.html` (v6). Os números do protótipo são ilustrativos e serão balanceados com simulação.

## O que muda (resumo)
- **Candidato:** rosto em moldura redonda, galeria com o gênero certo, os 9 partidos escolhíveis em 3 colunas (Esquerda, Centro, Direita), cartões compactos, dossiê do partido em janela (história, alinhamento, forças, fraquezas, logos de aliados e rivais), barra da Câmara.
- **Dificuldade muda as bancadas:** Fácil aproxima os tamanhos, Difícil afasta. Partido pequeno ganha ânimo extra nos grupos que são base dele.
- **"Como o país te recebe":** os 32 grupos em 5 blocos, sem rolagem, somando dificuldade, partido, perfil, promessas e ministros, com o porquê.
- **Perfil:** mais traços e hábitos, organizados pelos 5 blocos da sociedade.
- **Vice:** linhas por partido, chance de aceitar e bônus para quem é difícil de convencer.
- **Promessas:** mais promessas ligadas aos 32 grupos e às mecânicas; no Normal e no Difícil uma vem travada pela pressão de um grupo antes da eleição (o jogador escolhe 4); bandeiras dos partidos que apoiaram (seguir ou não, fora das 4).
- **Ministérios (passo novo):** cenário pós-eleição (frente ampla, vitória apertada, aliança de última hora, partido rachado) com pedidos de pastas; 13 pastas × 6 candidatos com 6 barras de personalidade, vantagem, desvantagem, história e alinhamento; partido de fora entra na base conforme a distância ideológica e o tamanho; fidelidade da bancada; custo da maioria; botão automático.
- **Tela adaptativa:** o desenho de 1920×1080 se ajusta a qualquer resolução.

## Versões
| Versão | Conteúdo | Modelo | Complexidade |
|---|---|---|---|
| v0.48.0 ✅ (17/11) | Candidato e Vice: dossiê dos 9 partidos, bancadas pela dificuldade (save novo), vantagem do partido pequeno, efeito do partido nos 32 grupos, chance e bônus do vice, tela nova do passo 1 e 3, painel dos 32 grupos, escala adaptativa | Opus (bancadas) · Sonnet (telas) | alta |
| v0.48.1 ✅ (17/11) | Perfil: traços e hábitos novos pelos 5 blocos | Opus (números) · Sonnet (tela) | média |
| v0.48.2 | Promessas: lista nova, pressão do grupo (promessa travada), bandeiras dos apoiadores | Opus | média-alta |
| v0.49.0 | Ministérios, regras: cenário, pedidos de pastas, 78 candidatos, entrada na base, fidelidade, custo da maioria, `sim` das 27 combinações | Opus | alta |
| v0.49.1 | Ministérios, telas e botão automático; compromissos que voltam depois da posse | Sonnet | média |

Cada versão: testes, partida no navegador, CHANGELOG, DESIGN.md, ESTADO.md e publicação.

## Pendências
- Retratos: os 78 ministros pedem rostos próprios; hoje 48 estão livres. Gerar provisórios com `scripts/retratos-provisorios.py` ou o Douglas manda mais.
- Ordem com o H5: decidido pelo Douglas em 17/11/2026, o Novo mandato vem primeiro. O rascunho do H5 (`src/game/data/imprensa.ts`) está no ramo `rascunho-h5`; o H5 volta com os números a partir da v0.50.0.
- v0.48.0 não mexeu no save: a bancada é contada nos deputados do mandato.
- Ideias que ficaram para depois: Caixa de ideias (DESIGN.md 27.1).
