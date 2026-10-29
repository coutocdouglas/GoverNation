# GoverNation

Jogo de simulação política para Windows: governe um país por 48 meses, negocie com o Congresso, equilibre a economia e receba uma nota no fim do mandato.

- Desenho do jogo: [`docs/DESIGN.md`](docs/DESIGN.md)
- Novidades: [`CHANGELOG.md`](CHANGELOG.md)
- Como publicar versões: [`docs/RELEASES.md`](docs/RELEASES.md)

## Instalar

Baixe o instalador `.exe` mais recente em **Releases** e execute. Depois disso, o jogo se atualiza sozinho.

## Desenvolver

```bash
npm install
npm run tauri dev     # abre o jogo em modo de desenvolvimento
npm run dev           # só a interface, no navegador
npm test              # testes do motor do jogo
npm run sim           # simula mandatos inteiros com estratégias diferentes
```

O motor do jogo fica em `src/game/` e os números de balanceamento em `src/game/data/`.

Requisitos para rodar o app localmente: Node 22 e Rust (via rustup).
