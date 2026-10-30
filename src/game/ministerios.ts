// Etapa 4C3: os 13 ministérios. Desgaste de cada ministro, meta da pasta e o que mexe nisso.
import { BILL_BY_ID } from './data/bills'
import { AREA_GROUP, MINISTERIOS, MINISTRY_GOALS } from './data/ministerios'
import { MINISTERS, type AreaId } from './data/ministers'
import { ministerOf } from './camara'
import { clamp } from './ideology'
import { absMonth, addBio } from './memory'
import { promiseStatus, type PromiseStatus } from './promises'
import type { Cause, GameState, GroupId, Headline, Impulse, MinistrySeat } from './types'

export const AREAS: AreaId[] = MINISTERS.map((m) => m.area)

/** Ministérios no começo do mandato (ou de um save antigo: desgaste tirado das derrubadas no Supremo). */
export function initialMinistries(s: Pick<GameState, 'month' | 'term'> & Partial<Pick<GameState, 'supremo'>>): Record<AreaId, MinistrySeat> {
  const now = absMonth(s)
  const out = {} as Record<AreaId, MinistrySeat>
  for (const area of AREAS) {
    const struck = (s.supremo?.rulings ?? []).filter((r) => r.struck && BILL_BY_ID[r.bill]?.area === area).length
    out[area] = { wear: clamp(MINISTERIOS.start + struck * MINISTERIOS.struck, 0, 100), since: now }
  }
  return out
}

/** Meta da pasta e situação agora. */
export function ministryGoal(s: GameState, area: AreaId): { name: string; desc: string; value: number; status: PromiseStatus; progress: number; unit: string; target: number; dir: 'min' | 'max'; count: boolean } {
  const def = MINISTRY_GOALS[area]
  const r = promiseStatus(s, def, false)
  const count = def.metric.type === 'leisArea'
  let status = r.status
  if (count && r.status !== 'cumprida') {
    // Entregas: "longe" só quando a pasta está uma medida inteira atrás do ritmo esperado.
    const expected = def.target * Math.min(1, s.month / (48 - 6))
    status = r.value >= expected ? 'rumo' : r.value >= expected - 1 ? 'risco' : 'longe'
  }
  return { name: def.name, desc: def.desc, value: r.value, status, progress: r.progress, unit: def.unit, target: def.target, dir: def.dir, count }
}

export const wearLabel = (w: number) => (w >= MINISTERIOS.worn ? 'Desgastado' : w >= 45 ? 'Pressionado' : 'Firme')

/** Novo ministro na pasta: o desgaste recomeça. */
export function resetMinistry(s: GameState, area: AreaId): void {
  s.ministries[area] = { wear: MINISTERIOS.start, since: absMonth(s) }
}

/** O que aconteceu no mês com cada pasta (montado pelo motor em advanceMonth). */
export interface MinistryMonth {
  /** Fato do mês da área: como o presidente lidou. */
  event?: { area: AreaId; kind: keyof typeof MINISTERIOS.event }
  enacted: AreaId[]
  struck: AreaId[]
  liminar: AreaId[]
  barred: AreaId[]
}

/** Atualiza o desgaste de cada ministro e cobra os desgastados. */
export function stepMinistries(s: GameState, m: MinistryMonth, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): void {
  for (const area of AREAS) {
    const seat = s.ministries[area] ?? { wear: MINISTERIOS.start, since: absMonth(s) }
    const causes: Cause[] = []
    const add = (label: string, v: number) => { if (v) causes.push({ label, value: v }) }
    if (m.event?.area === area) {
      const labels = { resolvido: 'Resolveu o fato do mês', escolha: 'Lidou com o fato do mês', ignorado: 'Crise da área sem resposta', falhou: 'Resposta à crise travou' }
      add(labels[m.event.kind], MINISTERIOS.event[m.event.kind])
    }
    const n = m.enacted.filter((a) => a === area).length
    if (n) add(n > 1 ? `${n} medidas da área em vigor` : 'Medida da área em vigor', MINISTERIOS.enacted * n)
    if (m.struck.includes(area)) add('Medida da área derrubada no Supremo', MINISTERIOS.struck)
    if (m.liminar.includes(area)) add('Medida da área suspensa por liminar', MINISTERIOS.liminar)
    if (m.barred.includes(area)) add('Projeto da área barrado', MINISTERIOS.barred)
    const goal = ministryGoal(s, area)
    add(`Meta da pasta: ${goal.status === 'rumo' || goal.status === 'cumprida' ? 'no rumo' : goal.status === 'risco' ? 'em risco' : 'longe'}`, MINISTERIOS.goal[goal.status] ?? 0)
    const before = seat.wear
    seat.wear = clamp(seat.wear + causes.reduce((a, c) => a + c.value, 0), 0, 100)
    seat.causes = causes
    s.ministries[area] = seat
    const who = ministerOf(s, area)
    if (seat.wear >= MINISTERIOS.worn) {
      impulses[AREA_GROUP[area]].push({ label: `${who.name} desgastad${who.feminine ? 'a' : 'o'} no cargo`, value: MINISTERIOS.wornHit })
      if (before < MINISTERIOS.worn) {
        headlines.push({ text: `Imprensa pede a cabeça de ${who.name}: ${who.role.toLowerCase()} está desgastad${who.feminine ? 'a' : 'o'}`, tone: 'bad' })
        addBio(s, who.name, `Ficou desgastad${who.feminine ? 'a' : 'o'} no cargo (${who.role}); a imprensa pediu a demissão.`)
      }
    }
  }
}

/** Pastas em situação ruim (desgastadas ou com a meta longe), para o aviso de reforma ministerial. */
export function ministriesInTrouble(s: GameState): AreaId[] {
  return AREAS.filter((a) => (s.ministries?.[a]?.wear ?? 0) >= MINISTERIOS.worn || ministryGoal(s, a).status === 'longe')
}
