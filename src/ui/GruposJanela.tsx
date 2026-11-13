import type { ReactNode } from 'react'
import { credibilidadeLigada } from '../game/data/credibilidade'
import { BLOCOS, GROUP_BY_ID, GROUPS } from '../game/data/groups'
import { ehBase } from '../game/groups'
import { leituraBloco, leituraGrupo, piorDoBloco } from '../game/pesquisa'
import type { GameState, GroupId } from '../game/types'
import { faixaMeio, GrupoLeitura } from './CredibilidadeJanela'
import { num } from './format'
import { GROUP_ICON } from './icons'

const tom = (v: number) => (v >= 55 ? 'var(--up, #3fb950)' : v >= 40 ? 'var(--gold, #d4a72c)' : 'var(--dn, #f85149)')
const pct = (x: number) => `${num(x * 100, 1)}%`

/**
 * Etapa 6G, H3 (v0.46): o resumo dos grupos no painel. Cinco blocos, cada um com a leitura média e o grupo que está pior.
 * O detalhe dos 32 grupos fica na janela "Grupos sociais" (Teste da interface).
 */
export function BlocosCard({ state, onAbrir }: { state: GameState; onAbrir: () => void }): ReactNode {
  const leitura = credibilidadeLigada()
  return (
    <section className="pn-card">
      <h3>👥 Grupos sociais</h3>
      <div className="pn-groups">
        {BLOCOS.map((b) => {
          const gs = GROUPS.filter((g) => g.bloco === b.id)
          const peso = gs.reduce((a, g) => a + g.weight, 0)
          const real = gs.reduce((a, g) => a + g.weight * state.groups[g.id].approval, 0) / (peso || 1)
          const lei = leitura ? leituraBloco(state, b.id) : null
          const largura = lei ? (lei.pesquisa ? lei.pesquisa.valor : faixaMeio(lei.faixa)) : real
          const pior = GROUP_BY_ID[piorDoBloco(state, b.id)]
          return (
            <button key={b.id} type="button" className="pn-group" onClick={onAbrir} title="Ver os grupos deste bloco">
              <span className="pn-group__ic">{b.icone}</span>
              <span className="pn-group__body">
                <span className="pn-group__head">
                  <span>{b.nome}</span>
                  <span>{lei ? <GrupoLeitura lei={lei} /> : <b>{num(real, 0)}%</b>}</span>
                </span>
                <span className="pn-meter"><span style={{ width: `${largura}%`, background: tom(largura) }} /></span>
                <small>{gs.length} grupos · {pct(peso)} do eleitorado · mais insatisfeito: {GROUP_ICON[pior.id]} {pior.name}</small>
              </span>
            </button>
          )
        })}
      </div>
      <div className="pn-row"><button type="button" className="pn-btn pn-btn--ghost pn-btn--small" onClick={onAbrir}>Ver os 32 grupos ↗</button></div>
    </section>
  )
}

/** Janela "Grupos sociais": os 32 grupos por bloco, com o tamanho, a marca "sua base" e o "Por quê?" de cada um. */
export function GruposJanela({ state, onPorQue }: { state: GameState; onPorQue: (id: GroupId) => void }): ReactNode {
  const leitura = credibilidadeLigada()
  return (
    <div>
      <p className="pn-hint">A aprovação geral é a média dos grupos, pesada pelo tamanho de cada um no eleitorado. Clique num grupo para ver o porquê.</p>
      {BLOCOS.map((b) => (
        <div key={b.id} style={{ marginBottom: 12 }}>
          <div className="pn-label">{b.icone} {b.nome}</div>
          <div className="pn-groups">
            {GROUPS.filter((g) => g.bloco === b.id).map((g) => {
              const v = state.groups[g.id].approval
              const lei = leitura ? leituraGrupo(state, g.id) : null
              const largura = lei ? (lei.pesquisa ? lei.pesquisa.valor : faixaMeio(lei.faixa)) : v
              return (
                <button key={g.id} type="button" className="pn-group" onClick={() => onPorQue(g.id)}>
                  <span className="pn-group__ic">{GROUP_ICON[g.id]}</span>
                  <span className="pn-group__body">
                    <span className="pn-group__head">
                      <span>{g.name}</span>
                      <span>{lei ? <GrupoLeitura lei={lei} /> : <b>{num(v, 0)}%</b>}</span>
                    </span>
                    <span className="pn-meter"><span style={{ width: `${largura}%`, background: tom(largura) }} /></span>
                    <small>{pct(g.weight)} do eleitorado{ehBase(state, g.id) ? ' · sua base' : ''} · {g.cares}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
