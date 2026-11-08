import { causasDe, porque, type CausaSource } from '../game/causas'
import { monthLabel } from '../game/game'
import { GROUP_BY_ID } from '../game/data/groups'
import { econPull } from '../game/groups'
import { absMonth } from '../game/memory'
import type { GameState, GroupId, IndicatorKey } from '../game/types'
import { INDICATORS, num, signed } from './format'
import type { JanelaDef } from './Janelas'
import { CauseList } from './PainelPecas'
import { Sparkline } from './Sparkline'

/**
 * v0.33.0 (6B): a janela "Por quê?". Abre ao clicar num indicador ou grupo e mostra quem mexeu, quando e quanto,
 * a partir do registro de causas (`causas.ts`), mais o que já havia (último mês, economia, memória).
 * O id da janela é `pq:indicador:<chave>` ou `pq:grupo:<id>`.
 */
export type PorQueAlvo = { kind: 'indicator'; key: IndicatorKey } | { kind: 'group'; id: GroupId }

export const idPorQue = (a: PorQueAlvo) => (a.kind === 'indicator' ? `pq:indicador:${a.key}` : `pq:grupo:${a.id}`)

export function alvoPorQue(id: string): PorQueAlvo | null {
  const [p, tipo, resto] = id.split(':')
  if (p !== 'pq' || !resto) return null
  if (tipo === 'indicador' && INDICATORS.some((m) => m.key === resto)) return { kind: 'indicator', key: resto as IndicatorKey }
  if (tipo === 'grupo' && GROUP_BY_ID[resto as GroupId]) return { kind: 'group', id: resto as GroupId }
  return null
}

export function defPorQue(id: string): JanelaDef | null {
  const a = alvoPorQue(id)
  if (!a) return null
  const titulo = a.kind === 'indicator' ? INDICATORS.find((m) => m.key === a.key)!.label : GROUP_BY_ID[a.id].name
  return { id, titulo: `Por quê? ${titulo}`, icone: a.kind === 'indicator' ? '📈' : '👥', largura: 560 }
}

const ORIGEM: Record<CausaSource, string> = {
  medida: 'Medida', acordo: 'Acordo', reputacao: 'Reputação', economia: 'Economia', choque: 'Choque externo',
  supremo: 'Supremo', congresso: 'Congresso', escolha: 'Sua escolha', outro: 'Outros',
}

/** Quem mexeu, em frases: soma por motivo nos últimos 3 meses e a linha do tempo. */
function Quem({ state, subject, decimals, unit, goodUp }: { state: GameState; subject: string; decimals: number; unit: string; goodUp: 1 | -1 | 0 }) {
  const agora = absMonth(state)
  const soma = porque(state, subject, agora, 3).filter((x) => Math.abs(x.delta) >= Math.pow(10, -decimals) / 2)
  const linha = causasDe(state, subject, 12).filter((e) => Math.abs(e.delta) >= Math.pow(10, -decimals) / 2)
  const tom = (v: number) => (goodUp === 0 ? '' : v * goodUp > 0 ? 'pos' : 'neg')
  if (soma.length === 0 && linha.length === 0) return <p className="muted">Ainda não há causa registrada aqui. Ela aparece depois do primeiro fechamento de mês.</p>
  return (
    <>
      <h3>O que mais pesou nos últimos 3 meses</h3>
      {soma.length === 0 ? <p className="muted">Nada relevante nos últimos 3 meses.</p> : (
        <ul className="causes">
          {soma.slice(0, 6).map((x) => (
            <li key={x.why}>
              <span><small className="muted">{ORIGEM[x.source]} · </small>{x.why}</span>
              <span className={tom(x.delta)}>{signed(x.delta, decimals)}{unit}</span>
            </li>
          ))}
        </ul>
      )}
      {linha.length > 0 && (
        <>
          <h3>Linha do tempo</h3>
          <ul className="causes">
            {linha.map((e, i) => (
              <li key={i}>
                <span><small className="muted">{monthLabel(e.at)} · </small>{e.why}{e.by ? <small className="muted"> ({e.by})</small> : null}</span>
                <span className={tom(e.delta)}>{signed(e.delta, decimals)}{unit}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export function PorQueJanela({ state, alvo }: { state: GameState; alvo: PorQueAlvo }) {
  const report = state.lastReport
  const now = state.history[state.history.length - 1]

  if (alvo.kind === 'indicator') {
    const meta = INDICATORS.find((m) => m.key === alvo.key)!
    const values = state.history.map((h) => h.indicators[alvo.key])
    const causes = report?.causes[alvo.key] ?? []
    const dec = meta.decimals === 0 ? 1 : 2
    return (
      <div className="pn-porque">
        <div className="detail__value">{meta.format(values[values.length - 1])}</div>
        <Sparkline values={values} width={500} height={70} />
        <p>{meta.explain}</p>
        <Quem state={state} subject={`indicador:${alvo.key}`} decimals={dec} unit="" goodUp={meta.goodDirection} />
        <h3>O que mexeu no último mês</h3>
        {report ? <CauseList causes={causes} decimals={dec} /> : <p className="muted">O mandato ainda não começou.</p>}
      </div>
    )
  }

  const def = GROUP_BY_ID[alvo.id]
  const g = state.groups[alvo.id]
  const pulls = econPull(alvo.id, now.indicators).filter((p) => Math.abs(p.value) >= 0.5)
  return (
    <div className="pn-porque">
      <div className="detail__value">{num(g.approval, 0)}% de aprovação</div>
      <Sparkline values={state.history.map((h) => h.groups[alvo.id])} width={500} height={70} />
      <p>Se importa com: {def.cares}. Representa {Math.round(def.weight * 100)}% da população.</p>
      <Quem state={state} subject={`grupo:${alvo.id}`} decimals={1} unit="" goodUp={1} />
      <h3>O que mexeu no último mês</h3>
      {report ? <CauseList causes={report.groupCauses[alvo.id]} decimals={1} /> : <p className="muted">O mandato ainda não começou.</p>}
      <h3>Como a economia pesa para eles hoje</h3>
      <p className="muted">A aprovação caminha aos poucos na direção desses valores.</p>
      <CauseList causes={pulls} decimals={1} unit=" pts" />
      {g.memory.length > 0 && (
        <>
          <h3>O que eles ainda lembram</h3>
          <p className="muted">Ganhos são esquecidos em cerca de 9 meses; perdas, em cerca de 2 anos.</p>
          <CauseList causes={g.memory} decimals={1} unit=" pts" />
        </>
      )}
    </div>
  )
}
