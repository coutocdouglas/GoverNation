import type { ReactNode } from 'react'
import { absMonth, yearOf } from '../game/memory'
import { causasDe } from '../game/causas'
import { credibOf, fatorPalavra, mercadoDaCredib } from '../game/credibilidade'
import { ABSURDO, COMPROMISSO, credibilidadeLigada, EXPLOSIVA } from '../game/data/credibilidade'
import { BILL_BY_ID } from '../game/data/bills'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import { ehExplosiva, faixaAbsurdo, notaAbsurdo, regDe } from '../game/absurdo'
import { retirarBlockedReason, retirarExplosiva } from '../game/rodada'
import type { LeituraGrupo } from '../game/pesquisa'
import type { BillId, GameState } from '../game/types'
import { num } from './format'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const quando = (at: number) => `${MESES[at % 12]}/${yearOf(at)}`

/** Em palavras: como o público ouve o presidente com essa credibilidade. */
export function credibLabel(v: number): { text: string; cls: 'up' | 'warn' | 'dn' } {
  if (v >= 70) return { text: 'palavra de peso', cls: 'up' }
  if (v >= 45) return { text: 'crédito normal', cls: 'warn' }
  if (v >= 25) return { text: 'palavra desgastada', cls: 'dn' }
  return { text: 'ninguém acredita', cls: 'dn' }
}

const sinal = (x: number, casas = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${num(Math.abs(x), casas)}`

/** Bloco 6C (v0.35.1): a janela "Credibilidade": quanto vale a sua palavra, o compromisso em aberto e o que mexeu nela. */
export function CredibilidadeJanela({ state }: { state: GameState }) {
  const c = credibOf(state)
  const lab = credibLabel(c.valor)
  const fator = fatorPalavra(state)
  const mercado = mercadoDaCredib(state)
  const agora = absMonth(state)
  const causas = causasDe(state, 'credibilidade', 8)
  const comp = c.compromisso
  return (
    <div>
      <p className="pn-hint">Credibilidade <b>sobe só com entrega</b> (promessa cumprida, compromisso honrado) e cai mais rápido do que sobe. Ela dá peso ao que você diz e um pouco de ar ao mercado.</p>
      <div className="pn-pv">
        <div>🎖️ Credibilidade<b className={lab.cls}>{Math.round(c.valor)}<i>/100</i></b></div>
        <div>🗣️ Peso da sua fala<b className={fator >= 1 ? 'up' : 'dn'}>{Math.round(fator * 100)}%</b></div>
        <div>🤝 Mercado por mês<b className={mercado > 0 ? 'up' : mercado < 0 ? 'dn' : ''}>{mercado ? sinal(mercado, 2) : 'neutro'}</b></div>
      </div>
      <p className="pn-hint" style={{ marginTop: 6 }}>{lab.text}. {c.valor >= 80 ? 'Acima de 80 cada ganho vale a metade.' : ''}</p>
      {comp ? (
        <div className="pn-announce">
          <small>📺 Compromisso em aberto</small>
          <p>“{comp.titulo}”: uma medida nova de {MINISTER_BY_AREA[comp.area].areaName.toLowerCase()} valendo até {quando(comp.ate)} (faltam {Math.max(0, comp.ate - agora)} {comp.ate - agora === 1 ? 'mês' : 'meses'}).</p>
          <small>Cumprir dá credibilidade {sinal(COMPROMISSO.cumprido, 0)}. Não cumprir custa {sinal(COMPROMISSO.falhou, 0)} e dá força à oposição. Uma medida que já valia não conta.</small>
        </div>
      ) : <p className="pn-hint">Nenhum compromisso em aberto. Em crise, “Falar à nação” na agenda permite assumir um.</p>}
      <div className="pn-label">O que mexeu nela</div>
      {causas.length ? (
        <ul className="causes">
          {causas.map((e, i) => <li key={i}><span>{e.why} <small className="muted">· {quando(e.at)}</small></span><span className={e.delta < 0 ? 'neg' : 'pos'}>{sinal(e.delta)}</span></li>)}
        </ul>
      ) : <p className="pn-hint">Ainda nada: a credibilidade começa em 55 e só se mexe quando você entrega ou falha.</p>}
    </div>
  )
}

const FAIXA_ROTULO = { normal: '', impopular: 'impopular', absurda: 'absurda', explosiva: 'explosiva' } as const

/** Nota de absurdo da medida, para a ficha (some se o bloco estiver desligado ou a medida for comum). */
export function AbsurdoLinha({ id }: { id: BillId }) {
  if (!credibilidadeLigada()) return null
  const b = BILL_BY_ID[id]
  const nota = notaAbsurdo(b)
  const faixa = faixaAbsurdo(nota)
  if (faixa === 'normal') return null
  const tom = faixa === 'impopular' ? 'warn' : 'dn'
  return (
    <p className={`pn-hint ${tom}`} style={{ margin: '6px 0 0' }}>
      🔥 <b>Nota de absurdo {num(nota, 1)}/10 ({FAIXA_ROTULO[faixa]})</b>
      {faixa === 'impopular' && ': a medida fere mais gente do que ajuda, mas tem razão de ser.'}
      {faixa === 'absurda' && ': fere muita gente sem trazer nada à altura. Espere reação forte.'}
      {faixa === 'explosiva' && `: passa do limite (${ABSURDO.explosiva}). Tem custo extra e não dá ganho a ninguém.`}
    </p>
  )
}

/** O aviso grande antes de assinar ou mandar uma medida explosiva. Com `ciente`, o botão de confirmar libera. */
export function ExplosivaAviso({ id, ciente, onCiente }: { id: BillId; ciente: boolean; onCiente: (v: boolean) => void }) {
  const b = BILL_BY_ID[id]
  if (!ehExplosiva(b)) return null
  const acts = b.instrument === 'decreto' || b.instrument === 'mp'
  const k = 1 + (notaAbsurdo(b) - ABSURDO.explosiva) * EXPLOSIVA.porNota
  const arred = (x: number) => Math.round(Math.abs(x) * k)
  const A = EXPLOSIVA.anuncio
  const I = EXPLOSIVA.insistir
  const soma = (f: 'rival' | 'credibilidade' | 'base' | 'dolarPct') => (acts ? A[f] + I[f] : A[f])
  return (
    <div className="pn-announce" style={{ borderColor: 'var(--pn-red)' }}>
      <small>💣 MEDIDA EXPLOSIVA · nota {num(notaAbsurdo(b), 1)}/10</small>
      <p>
        {acts
          ? 'Vale na hora e o país reage no mesmo dia. Só dá para revogar até o mês seguinte, com custo.'
          : 'Ao mandar, ela fica uma rodada na pauta sem voto. Dá para retirar com custo menor; levar a voto paga a segunda parte.'}
      </p>
      <ul className="pn-reacts">
        <li><span className="pn-reacts__p">🪪</span><span>Reputação: marca forte de “impopular”<small>fica na Ficha de governo</small></span></li>
        <li><span className="pn-reacts__p">⚔️</span><span>Oposição ganha cerca de {arred(soma('rival'))} pontos de força<small>{acts ? 'as duas partes juntas' : 'na primeira parte; mais na votação'}</small></span></li>
        <li><span className="pn-reacts__p">🤝</span><span>Credibilidade −{arred(soma('credibilidade'))} · a base se afasta cerca de {arred(soma('base'))}<small>partido do governo e aliados</small></span></li>
        <li><span className="pn-reacts__p">💵</span><span>Mercado nervoso: confiança cai e o dólar sobe cerca de {num(soma('dolarPct') * k, 1)}%<small>vira um fato de protesto no mês</small></span></li>
      </ul>
      <label className="pn-name" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={ciente} onChange={(e) => onCiente(e.target.checked)} />
        <span>Estou ciente do custo e quero seguir mesmo assim.</span>
      </label>
    </div>
  )
}

/** Medidas explosivas que ainda dão para retirar (da pauta) ou revogar (decreto e MP no mês seguinte). */
export function explosivasAbertas(state: GameState): BillId[] {
  if (!credibilidadeLigada()) return []
  return (state.credib?.explosivas ?? []).filter((r) => (r.fase === 'anunciada' || r.fase === 'vigor') && !retirarBlockedReason(state, r.bill)).map((r) => r.bill)
}

/** Medidas explosivas anunciadas ou em vigor, qualquer que seja o prazo (para o resumo do Radar). */
export function explosivasVivas(state: GameState): BillId[] {
  if (!credibilidadeLigada()) return []
  return (state.credib?.explosivas ?? []).filter((r) => r.fase === 'anunciada' || r.fase === 'cobrada' || r.fase === 'vigor').map((r) => r.bill)
}

/** Janela "Medida explosiva": o que está em jogo e a saída de retirar ou revogar, com o custo à vista. */
export function ExplosivasJanela({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }): ReactNode {
  const vivas = explosivasVivas(state)
  if (!vivas.length) return <p className="pn-hint">Nenhuma medida explosiva em andamento.</p>
  return (
    <div>
      <p className="pn-hint">Medida explosiva: o país reage além da conta. <b>Na pauta</b> dá para retirar com custo menor; <b>em vigor</b> (decreto ou MP) só dá para revogar até o mês seguinte. Retirar ou revogar bloqueia a mesma medida por {EXPLOSIVA.voltaEm} meses, para não sair de graça.</p>
      {vivas.map((id) => {
        const b = BILL_BY_ID[id]
        const r = regDe(state, id)!
        const motivo = retirarBlockedReason(state, id)
        const vigor = r.fase === 'vigor'
        const custo = vigor ? EXPLOSIVA.revogar : EXPLOSIVA.retirar
        return (
          <div key={id} className="pn-announce">
            <small>{vigor ? 'Em vigor' : r.fase === 'cobrada' ? 'Levada a voto' : 'Na pauta, sem voto'} · {quando(r.at)}</small>
            <p><b>{b.name}</b> · nota {num(notaAbsurdo(b), 1)}/10</p>
            <small>{vigor ? 'Revogar' : 'Retirar da pauta'} custa credibilidade {sinal(custo.credibilidade, 0)} e dá {sinal(custo.rival, 0)} de força à oposição. {r.fase === 'anunciada' && 'Para levar a voto, pauta o projeto na fila da Câmara (paga a segunda parte).'}</small>
            <div className="pn-row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="pn-btn pn-btn--small"
                disabled={!!motivo}
                title={motivo ?? undefined}
                onClick={() => {
                  try { onState(retirarExplosiva(state, id)); onToast(vigor ? `↩️ “${b.name}” revogada.` : `↩️ “${b.name}” retirada da pauta.`) } catch (e) { onToast(`✋ ${(e as Error).message}`) }
                }}
              >{vigor ? 'Revogar a medida' : 'Retirar da pauta'}</button>
              {motivo && <small className="pn-hint">🔒 {motivo}</small>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Ponto médio de cada faixa de leitura dos grupos, para a barra do cartão sem entregar o número exato. */
export function faixaMeio(faixa: string): number {
  return ({ 'Muito baixo': 12, Baixo: 32, Médio: 50, Alto: 67, 'Muito alto': 88 } as Record<string, number>)[faixa] ?? 50
}

/** Entre pesquisas, o grupo aparece em faixa com seta; com pesquisa recente, o número com a margem de erro. */
export function GrupoLeitura({ lei }: { lei: LeituraGrupo }) {
  const seta = lei.seta === 'sobe' ? '↗' : lei.seta === 'cai' ? '↘' : '→'
  const cls = lei.seta === 'sobe' ? 'up' : lei.seta === 'cai' ? 'dn' : ''
  return (
    <span title={lei.pesquisa ? `Pesquisa de ${lei.pesquisa.idade === 0 ? 'este mês' : `há ${lei.pesquisa.idade} ${lei.pesquisa.idade === 1 ? 'mês' : 'meses'}`}; o valor de hoje pode ter mudado.` : 'Sem pesquisa recente: só a faixa e a tendência dos últimos meses.'}>
      <b>{lei.pesquisa ? `${lei.pesquisa.valor}% ±${lei.pesquisa.margem}` : lei.faixa}</b> <span className={cls}>{seta}</span>
      {lei.pesquisa && <small className="muted"> {lei.pesquisa.idade === 0 ? 'agora' : lei.pesquisa.idade === 1 ? 'mês passado' : `há ${lei.pesquisa.idade} meses`} · {lei.faixa}</small>}
    </span>
  )
}
