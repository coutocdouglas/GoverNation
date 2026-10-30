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

## Roteiro atual (detalhes em docs/DESIGN.md, seções 11 a 26)

1. ✅ Retratos e elenco fixo (v0.4.1)
2. ✅ Memória do mundo, consequências, importância, fatos bons e herdados, biografias (v0.5.0)
3. ✅ **3A** resposta em texto ao fato do mês, ministro responsável, catálogo grande de medidas por área (v0.6.0) · ✅ **3B** camada de IA (v0.7.0) · ✅ **3C** medidas livres montadas pela IA (v0.9.0)
4. ✅ 4A votação com negociação (v0.8.0) · ✅ 4B Congresso 2.0, votação animada, voto simbólico, reação da sociedade (v0.10.0)
5. Entre mandatos: ✅ 5A rival, ficha do candidato e promessas de posse (v0.11.0) · 5B 27 estados e apuração (depois da 4F) · 5C governo seguinte e herança (depois do vídeo do fim de mandato)
4C. ✅ 4C1 Senado votando (v0.12.0) · ✅ 4C2 Supremo (v0.13.0)
4C3–4F. 4C3 Supremo no caminho das medidas e abas (próxima, v0.14; seção 26) · 4D Congresso ao vivo (v0.15) · 4E janelas (v0.16) · 4F mês mais vivo (v0.17); plano na seção 25 do DESIGN.md
6. Depois: Senado com poderes próprios, imprensa e pesquisas, orçamento anual
