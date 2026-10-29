# Como publicar uma versão

1. Atualize `version` em `package.json` (o Tauri lê a versão de lá) e registre as novidades em `CHANGELOG.md`.
2. Faça commit e envie para a `main`.
3. O GitHub Actions (`.github/workflows/release.yml`) percebe a versão nova, gera o instalador do Windows, assina a atualização e publica a Release `vX.Y.Z` com o arquivo `latest.json`. Se a Release daquela versão já existir, nada acontece.
4. Quem já tem o jogo instalado recebe o aviso "Nova versão disponível" na próxima vez que abrir.

## Assinatura das atualizações

O jogo só aceita atualizações assinadas com a chave privada do projeto.

- A **chave pública** fica em `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).
- A **chave privada** e a **senha** ficam somente nos *secrets* do repositório:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Guarde uma cópia da chave privada e da senha num lugar seguro. **Se forem perdidas, as cópias instaladas deixam de receber atualizações** e será preciso reinstalar manualmente com uma chave nova.

## Quando o repositório virar privado

O atualizador baixa de `releases/latest/download/latest.json`, que exige acesso público. Ao tornar o código privado, crie um repositório público só para os instaladores e troque o `endpoint` em `tauri.conf.json` e o destino da release no workflow.
