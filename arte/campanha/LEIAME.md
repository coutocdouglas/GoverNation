# Projeto gráfico dos partidos e das campanhas (Douglas, 31/10/2026)

Material guardado para a **Etapa 8 (campanha e eleição)**. Fica fora de `public/`, então **não entra no instalador** até ser usado.

## O que tem aqui

Uma pasta por partido, com o número na urna (`SIGLA-NÚMERO`):

| Pasta | Partido |
|---|---|
| `POL-14` | Partido da Ordem Liberal |
| `FPT-28` | Frente Popular Trabalhista |
| `UCD-32` | União Centro Democrático |
| `PSN-37` | Partido Social Nacional |
| `PVS-46` | Partido Verde Socialista |
| `MRB-54` | Movimento Republicano Brasileiro |
| `MDN-62` | Movimento Democrático Nacional |
| `PRA-73` | Partido Renovação e Avanço |
| `NRM-89` | Novo Rumo |

Em cada pasta:
- `cartaz.webp`: cartaz de campanha com o espaço do retrato (círculo) e a faixa "Nome do candidato".
- `post.webp`: post quadrado para redes.
- `adesivo.webp`: adesivo redondo com logo e número.
- `bandeira.webp`: bandeira com logo e número.
- `previa.webp`: o kit inteiro montado (cartaz, post, adesivo e bandeira).
- `caminhada.webp`: multidão numa caminhada presidencial com as bandeiras do partido.

Além disso:
- `logos-originais/`: os logos em PNG 512×512 (a versão usada no jogo está em `public/logos/<id>.webp`, 256×256).
- `editar-cartazes.html`: o editor de cartazes (abre no navegador; escolhe o partido, escreve o nome do candidato e salva o PNG). Serve de referência para o jogo montar o cartaz com o nome e o rosto do presidente.

As imagens foram convertidas de PNG para WEBP (qualidade 88, lado maior até 2048 px) para o repositório não pesar. Os originais em PNG ficaram com o Douglas (`PROJETO_GRÁFICO_PARTIDOS_E_CAMPANHAS.rar`).

## Ideias para quando chegar a hora (Etapa 8)
- Tela de campanha com o **cartaz do partido do presidente**, o **retrato dele no círculo** e o **nome na faixa** (como o editor faz).
- A **caminhada** como cena de comício ou de vitória; a **bandeira** e o **adesivo** na apuração e nos debates.
- O **número na urna** já está nos dados de cada partido (`number` em `src/game/data/parties.ts`).
