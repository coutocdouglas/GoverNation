# GoverNation — diretrizes de desenvolvimento

Jogo pessoal de simulação política para Windows (Tauri + React + TypeScript). O dono do projeto, Douglas, não programa: explique em português simples, sem jargão, e diga sempre o nível de complexidade da tarefa e qual modelo usar (Opus para desenho de sistemas e balanceamento; Sonnet para telas, dados e tarefas repetitivas).

## Antes de mexer

0. Leia **`docs/ESTADO.md`**: onde o projeto está e qual é o próximo passo. **Atualize-o a cada mudança** (estado atual, próximo passo e uma linha no histórico).
1. Leia `docs/DESIGN.md` (decisões e roteiro) e `CHANGELOG.md` (o que já existe).
2. Rode `npm ci`, `npm test`, `npx tsc -b`, `npx oxlint`.
3. Trabalhe **uma etapa por vez** e feche-a antes de abrir outra. Cada etapa termina com: testes passando, partida jogada no navegador (`npx vite build && npx vite preview`), CHANGELOG e DESIGN.md atualizados, versão nova publicada.

## Regras do jogo que não podem quebrar

- **Motor sem interface:** `src/game/` não importa nada de `src/ui/`. Todo número de balanceamento mora em `src/game/data/`.
- **Saves:** toda mudança no `GameState` sobe `saveVersion` e ganha migração em `src/game/save.ts`, com teste. Ninguém perde mandato ao atualizar.
- **Retratos:** um retrato por pessoa, nunca repetido (`src/game/data/cast.ts`, há teste). Personagem novo entra no `CAST`.
- **Personagens e partidos são fictícios.** Nada de nomes, marcas, textos ou imagens do jogo de referência.
- **Efeitos visíveis:** toda escolha mostra o custo antes; toda mudança de indicador ou grupo explica a causa.
- **Memória do mundo:** leis, decretos e decisões geram sementes e entradas de biografia; nada importante acontece sem ficar registrado.

## Publicar

Subir `version` em `package.json`, registrar no `CHANGELOG.md`, commit na `main`. O GitHub Actions gera o instalador e o jogo instalado se atualiza sozinho (`docs/RELEASES.md`).

## Quando abrir uma conversa nova (para poupar créditos)

Cada mensagem faz o Claude reler a conversa inteira; conversas longas custam muito mais e ficam mais lentas. Abra uma conversa nova:

1. **Ao fechar cada etapa** (depois da versão publicada). É o melhor momento: o estado está todo no repositório.
2. **Ao trocar de assunto** (ex.: de Congresso para eleição, ou de código para arte).
3. **Depois de mandar muitos prints, PDFs ou arquivos grandes** numa conversa: eles pesam em cada mensagem seguinte.
4. **Quando a conversa passar de umas 30 trocas** ou o Claude começar a esquecer combinados.
5. **Antes de uma etapa grande** (motor novo, Congresso 2.0, eleição): comece limpo.

Continue na mesma conversa quando estiver no meio de uma etapa, corrigindo algo que acabou de ser feito.

**Como começar a conversa nova:** "Projeto GoverNation, repositório coutocdouglas/GoverNation. Leia CLAUDE.md, docs/ESTADO.md e docs/DESIGN.md. Quero fazer a etapa X." Não precisa reenviar prints antigos: o que importa já está no ESTADO.md e no DESIGN.md.

## Roteiro atual (detalhes em docs/DESIGN.md, seção 27, que substitui o roteiro antigo)

Etapas com portão: a próxima só abre quando a anterior fecha; ideia fora de hora vai para a Caixa de ideias da etapa certa (DESIGN.md 27.1).

0. ✅ A rodada (v0.15)
1. ⏭️ Causa e consequência
2. Câmara e partidos · 3. Senado · 4. Supremo profundo · 5. Oposição, escândalos e CPI · 6. Vice e governo · 7. Estados e governadores · 8. Começo, sociedade e fim · 9. Arte final

Antes disso (já feito): retratos, memória do mundo, IA, Congresso 2.0, rival e promessas, Senado votando, Supremo (v0.4 a v0.14).
