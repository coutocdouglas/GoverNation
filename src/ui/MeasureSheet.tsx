import { useEffect, useState } from 'react'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS } from '../game/data/bills'
import { GROUP_BY_ID } from '../game/data/groups'
import { conditionsOf, fichaDaMedida, LEVEL_LABEL } from '../game/ficha'
import { approvalPreview, notasFicha, reactionsFor, resumoExecutivo } from '../game/fluxo'
import { curvaGanho, custoDeEnviar, pesaNoEnvio } from '../game/efeitos'
import { aiReady } from '../lib/ai'
import { askBriefing, askReview } from '../lib/aiActions'
import { ministerOf } from '../game/camara'
import { parecerOf } from '../game/rodada'
import { Portrait } from './Portrait'
import type { BillId, GameState, GroupId, Parecer } from '../game/types'
import { Art } from './Art'
import { ChainSteps } from './Chain'
import { chainAt, chainLabels } from './corrente'
import { ForecastRow } from './CongressView'
import { GROUP_ICON } from './icons'
import { NewBadge, NewBillNotes } from './NewBill'
import { LegalRiskLine } from './SupremoView'
import { num } from './format'
import { contratoDe, custoEmpresa, empresasPara, previsaoControle, riscoOf } from '../game/risco'
import { CONTRATO, type PerfilEmpresa } from '../game/data/risco'

const pct = (x: number) => `${Math.round(x * 100)}%`
const STANCE_CLS = {
  apoia: { label: 'Apoia', cls: 'up' },
  ressalva: { label: 'Apoia com ressalva', cls: 'warn' },
  contra: { label: 'É contra', cls: 'dn' },
} as const

/**
 * A janela da medida, as duas primeiras etapas da corrente do dia (etapa 2 da v0.18, refeita na 2B):
 * 1 · Leitura do gabinete (o que entendemos, "o Presidente anunciou", condições, quem sente antes → depois,
 * quem vai reagir, nome) · 2 · Ficha (resumo executivo, notas Congressual e Judicial, risco jurídico em número,
 * potencial de crescimento e a ficha da pasta). Depois: votação (lei) ou assinatura (decreto, MP).
 */
export function MeasureSheet({ state, id, ids, request, constraints, speech, notes, startStep = 1, onClose, onConfirm, consult, onConsult, backLabel, onParecer, onRewrite }: {
  state: GameState
  id: BillId
  /** Outras leituras possíveis do mesmo pedido (troca na etapa 1). */
  ids?: BillId[]
  /** O que o presidente escreveu. */
  request: string
  /** Condições lidas pela IA ("respeitando: ..."); sem IA, tiradas do texto. */
  constraints?: string[]
  /** Fala de quem leu (IA). */
  speech?: string
  /** Ajustes do motor numa medida nova redigida pela IA. */
  notes?: string[]
  /** A resposta ao fato já passou pela leitura com o ministro: começa na ficha. */
  startStep?: 1 | 2
  onClose: () => void
  /** Confirma: manda para a votação (lei) ou assina (decreto, MP), com o nome dado. */
  onConfirm: (id: BillId, title?: string, empresa?: PerfilEmpresa) => void
  consult?: BillId | null
  onConsult?: (id: BillId | null) => void
  backLabel?: string
  /** Fase A: guarda o parecer do ministro na rodada (um por mês por ministro). */
  onParecer?: (p: Parecer) => void
  /** Fase A: "acatar as sugestões e reescrever": devolve o texto novo para o campo da medida. */
  onRewrite?: (text: string) => void
}) {
  const [step, setStep] = useState<1 | 2>(startStep)
  const [cur, setCur] = useState<BillId>(id)
  const [title, setTitle] = useState(state.names?.[id] ?? '')
  const [summary, setSummary] = useState<{ id: BillId; text: string | null } | null>(null)
  const [pending, setPending] = useState<BillId | null>(startStep === 2 && aiReady() ? id : null)
  const [hearing, setHearing] = useState(false)
  const b = BILL_BY_ID[cur]
  const f = fichaDaMedida(state, cur)
  const n = notasFicha(state, cur)
  const labels = chainLabels(state, cur)
  const conds = constraints && constraints.length ? constraints : conditionsOf(request)
  const groups = (Object.entries(b.effects.groups ?? {}) as [GroupId, number][]).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, z) => z[1] - a[1])
  const acts = b.instrument === 'decreto' || b.instrument === 'mp'
  const reacts = reactionsFor(state, cur)
  const ap = approvalPreview(state, cur)
  // v0.26: lei, LC e PEC já pesam no envio em quem a medida atinge.
  const envio = pesaNoEnvio(b.instrument) ? (Object.entries(custoDeEnviar(b.effects)) as [GroupId, number][]).filter(([, v]) => v <= -0.5).sort((a, z) => a[1] - z[1]) : []
  const fallback = resumoExecutivo(state, cur)

  // Resumo executivo: com IA, narrado pela Casa Civil a partir dos números do motor (pedido ao abrir a ficha).
  useEffect(() => {
    if (!pending) return
    let live = true
    const ff = fichaDaMedida(state, pending)
    askBriefing(state, pending, `${resumoExecutivo(state, pending)} Comunicação: ${ff.comunicacao.text} Complexidade: ${ff.complexidade.text} Risco central: ${ff.risco.text}`)
      .then((t) => { if (live) { setSummary({ id: pending, text: t }); setPending(null) } })
    return () => { live = false }
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps
  const toFicha = () => { setStep(2); if (aiReady() && summary?.id !== cur) setPending(cur) }

  // Fase A: ouvir o ministro da pasta antes de assinar (um parecer por mês por ministro; sem IA, o parecer sai pelas regras).
  const minister = ministerOf(state, b.area)
  const saved = parecerOf(state, b.area)
  const hear = async () => {
    if (!onParecer || hearing || saved) return
    setHearing(true)
    const r = await askReview(state, b.area, request, cur)
    setHearing(false)
    onParecer({ area: b.area, bill: cur, stance: r.stance, speech: r.speech, suggestions: r.suggestions })
  }
  const accept = () => {
    if (!saved || !onRewrite) return
    onRewrite(`${request.trim()}\n\nIncorporando o parecer de ${minister.name}:\n${saved.suggestions.map((x) => `- ${x}`).join('\n')}`)
  }
  const nCls = (x: number) => (x >= 7 ? 'up' : x >= 4 ? 'warn' : 'dn')
  const swap = (x: BillId) => { setCur(x); setTitle(state.names?.[x] ?? ''); setPerfil('padrao') }
  // Etapa 5A: a empresa que executa o contrato (a de sempre vem marcada) e o efeito no Controle do Estado.
  const [perfil, setPerfil] = useState<PerfilEmpresa>('padrao')
  const confirm = () => onConfirm(cur, title.trim() || undefined, contratoDe(b) ? perfil : undefined)
  const contratoBox = <ContratoBox state={state} id={cur} perfil={perfil} onPerfil={setPerfil} acts={acts} />
  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet pn-sheet--wide" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <Art slot="medida-enviada" height={64} />
        <ChainSteps chain={chainAt(labels, step === 1 ? 'Leitura' : 'Ficha')} />
        <div className="pn-kicker">{step === 1 ? 'Leitura do gabinete · antes de assinar' : 'Briefing da Casa Civil'}</div>
        <h2>{b.name} <NewBadge id={cur} /></h2>

        {step === 1 && (
          <>
            {request.trim() && (
              <div className="pn-announce">
                <small>O Presidente anunciou:</small>
                <p>“{request.trim()}”</p>
                <small>Nome oficial: <b>{b.name}</b> · {INSTRUMENTS[b.instrument].label}</small>
              </div>
            )}
            {speech && <p className="pn-advice">🧑‍💼 “{speech}”</p>}
            {b.custom && <NewBillNotes id={cur} notes={notes ?? []} />}
            {ids && ids.length > 1 && (
              <div className="pn-row">
                <span className="pn-hint" style={{ margin: 0 }}>Outra leitura possível:</span>
                {ids.filter((x) => x !== cur).map((x) => <button key={x} className="pn-btn pn-btn--ghost" onClick={() => swap(x)}>{BILL_BY_ID[x].name}</button>)}
              </div>
            )}
            {conds.length > 0 ? (
              <div className="pn-respect">
                <b>Respeitando:</b>
                <ul>{conds.map((c, i) => <li key={i}>✔ {c}</li>)}</ul>
                <small className="pn-hint">Confira se o gabinete entendeu as suas condições. Se não, volte e reescreva: nada foi assinado ainda.</small>
              </div>
            ) : <p className="pn-hint">Nenhuma condição especial no pedido.</p>}
            <div className="pn-pv">
              <div>📜 Vira<b>{INSTRUMENTS[b.instrument].label}</b></div>
              <div>💸 Contas<b className={f.fiscal.perYear > 0 ? 'dn' : f.fiscal.perYear < 0 ? 'up' : ''}>{f.fiscal.text}</b></div>
              <div>⏱️ Quando vale<b>{acts ? 'Na hora' : 'Se aprovada'}</b></div>
            </div>
            <p className="pn-hint" style={{ margin: '2px 0 4px' }}>{INSTRUMENTS[b.instrument].rule}</p>
            <div className="up">+ {b.pros}</div>
            <div className="dn">− {b.cons}</div>
            {contratoBox}

            {groups.length > 0 && (
              <>
                <div className="pn-label">Quem sente</div>
                <div className="pn-feel">
                  {groups.map(([g, v]) => {
                    const before = state.groups[g].approval
                    const after = Math.max(0, Math.min(100, before + curvaGanho(v)))
                    return <span key={g} className={v > 0 ? 'up' : 'dn'}>{GROUP_ICON[g]} {GROUP_BY_ID[g].name} {Math.round(before)}% → {Math.round(after)}%</span>
                  })}
                </div>
                <p className="pn-hint" style={{ margin: '4px 0 0' }}>Aprovação geral no dia do anúncio: <b>{num(ap.before, 1)}% → {num(ap.after, 1)}%</b> (sem contar o resto do mês).</p>
                {envio.length > 0 && (
                  <p className="pn-hint dn" style={{ margin: '4px 0 0' }}>
                    ⚠️ <b>Só de mandar ao Congresso</b>, mesmo que não passe: {envio.map(([g, v]) => `${GROUP_BY_ID[g].name} −${num(-v, 1)}`).join(' · ')}. Se virar lei, essa parte já fica contada.
                  </p>
                )}
              </>
            )}

            <div className="pn-label">Quem vai reagir</div>
            {reacts.length === 0 ? <p className="pn-hint">Ninguém deve fazer barulho: a medida passa sem reação prevista.</p> : (
              <ul className="pn-reacts">
                {reacts.map((r) => (
                  <li key={r.id}>
                    <span className="pn-reacts__p">{pct(r.chance)}</span>
                    <span>{r.icon} {r.label}<small>{r.effect}</small></span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pn-hint" style={{ marginTop: 2 }}>As chances valem no anúncio: o sorteio acontece quando você {acts ? 'assina' : 'envia'}.</p>

            {onParecer && (
              <div className="pn-label">{minister.icon} Ouvir {minister.feminine ? 'a ministra' : 'o ministro'} da pasta</div>
            )}
            {onParecer && !saved && (
              <button className="pn-btn pn-btn--ghost pn-btn--wide" disabled={hearing} onClick={hear}>
                {hearing ? `⏳ ${minister.name} está lendo…` : `🗣️ Ouvir ${minister.name} (${minister.areaName}) antes de assinar`}
              </button>
            )}
            {saved && (
              <div className="pn-review">
                <div className="pn-review__head">
                  <Portrait name={minister.name} feminine={minister.feminine} color={minister.color} size={40} title={minister.name} />
                  <div><b>{minister.name}</b> <span className="muted">· {minister.areaName}</span></div>
                  <span className={`pn-stance ${STANCE_CLS[saved.stance].cls}`}>{STANCE_CLS[saved.stance].label}</span>
                </div>
                <p className="pn-review__quote">“{saved.speech}”</p>
                {saved.suggestions.length > 0 && <ul>{saved.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                <p className="pn-hint">{saved.bill !== cur ? `Parecer sobre “${BILL_BY_ID[saved.bill].name}”. ` : ''}{minister.feminine ? 'Ela' : 'Ele'} opina pelo que acredita, não pelo que é melhor para o país. Um parecer por mês por ministro. Decidir continua sendo seu.</p>
                {saved.suggestions.length > 0 && onRewrite && (
                  <button className="pn-btn pn-btn--ghost pn-btn--wide" onClick={accept}>Acatar as sugestões e reescrever</button>
                )}
              </div>
            )}
            <label className="pn-name">
              <span>🏷️ Nome da medida <small>(opcional: vira a manchete do telejornal e fica na Ficha de governo)</small></span>
              <input className="pn-input" maxLength={60} value={title} placeholder="Ex.: Renda Livre, Brasil Sem Fila" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="pn-sheet__foot">
              <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onClose}>{backLabel ?? 'Voltar e reescrever'}</button>
              <button className="pn-btn pn-btn--big" onClick={toFicha}>Ver a ficha →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="pn-memo pn-memo--flat">
              <b>Resumo executivo</b>
              <p>{pending === cur ? '⏳ A Casa Civil está redigindo…' : (summary?.id === cur && summary.text) || fallback}</p>
            </div>
            <div className="pn-notas">
              <div>
                <small>🏛️ Nota Congressual</small>
                <b className={nCls(n.congressual.nota)}>{num(n.congressual.nota, 1)}</b>
                <span>{n.congressual.reason}</span>
              </div>
              <div>
                <small>⚖️ Nota Judicial</small>
                <b className={nCls(n.judicial.nota)}>{num(n.judicial.nota, 1)}</b>
                <span>{n.judicial.reason}</span>
              </div>
              <div>
                <small>📐 Risco jurídico</small>
                <b className={n.risco.score >= n.risco.limit ? 'dn' : n.risco.score >= 20 ? 'warn' : 'up'}>{n.risco.score}<i>/100</i></b>
                <span>{n.risco.text}</span>
              </div>
              <div>
                <small>📈 Potencial de crescimento</small>
                <b className={n.crescimento.tone === 'good' ? 'up' : n.crescimento.tone === 'bad' ? 'dn' : ''} style={{ fontSize: 15 }}>{n.crescimento.tone === 'good' ? 'Sobe' : n.crescimento.tone === 'bad' ? 'Cai' : 'Neutro'}</b>
                <span>{n.crescimento.text}</span>
              </div>
            </div>
            <div className="pn-ficha">
              <div className="pn-ficha__nota">
                <small>Freios e contrapesos</small>
                <b className={nCls(f.nota)}>{num(f.nota, 1)}</b>
                <span className={nCls(f.nota)}>{f.notaLabel}</span>
                <small>as duas notas juntas: Câmara {pct(f.chances.camara)} · Senado {pct(f.chances.senado)} · Supremo {pct(f.chances.supremo)}</small>
              </div>
              <div className="pn-ficha__grid">
                <div><span>📣 Comunicação pública</span><b className={f.comunicacao.tone === 'good' ? 'up' : f.comunicacao.tone === 'bad' ? 'dn' : 'warn'}>{f.comunicacao.text}</b></div>
                <div><span>💸 Impacto fiscal</span><b>{f.fiscal.text}</b></div>
                <div><span>🧱 Complexidade de entrega</span><b>{LEVEL_LABEL[f.complexidade.level]}</b><small>{f.complexidade.text}</small></div>
                <div><span>🌡️ Sensibilidade pública</span><b>{LEVEL_LABEL[f.sensibilidade.level]}</b><small>{f.sensibilidade.text}</small></div>
                <div><span>⚠️ Risco central</span><b className={f.risco.where === 'nenhum' ? 'up' : 'warn'}>{f.risco.text}</b></div>
                <div><span>🧑‍💼 Recomendação da pasta</span><b className={f.recomendacao.stance === 'apoia' ? 'up' : f.recomendacao.stance === 'contra' ? 'dn' : 'warn'}>{f.recomendacao.text}</b></div>
              </div>
            </div>
            {startStep === 2 && contratoBox}
            <LegalRiskLine state={state} id={cur} consult={consult === cur} onConsult={onConsult} />
            {!acts && <ForecastRow state={state} id={cur} />}
            <p className="pn-hint">As notas mudam com a negociação: acordos com as bancadas sobem a Congressual; concessão ao TCU deixa o texto mais seguro no Supremo.{acts ? ' Decreto e MP valem na hora; se houver ação, o Supremo julga no mesmo dia.' : ' Aprovada, a lei vale na hora; se houver ação, o Supremo julga no mesmo dia.'}</p>
            <div className="pn-sheet__foot">
              <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={() => (startStep === 2 ? onClose() : setStep(1))}>← Voltar</button>
              <button className="pn-btn pn-btn--big" disabled={consult === cur} title={consult === cur ? 'Você pediu parecer ao Supremo sobre esta medida: ela espera a resposta.' : ''} onClick={confirm}>
                {b.instrument === 'decreto' ? '🖊️ Assinar o decreto' : b.instrument === 'mp' ? '⚡ Editar a medida provisória' : '🗳️ Ir para a votação →'}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

/**
 * Etapa 5A (v0.27.1): Controle do Estado e escolha da empresa, com o custo à vista antes de assinar.
 * A de sempre vem marcada (preço de mercado). O risco da empresa não aparece em número: só a descrição.
 */
function ContratoBox({ state, id, perfil, onPerfil, acts }: { state: GameState; id: BillId; perfil: PerfilEmpresa; onPerfil: (p: PerfilEmpresa) => void; acts: boolean }) {
  const b = BILL_BY_ID[id]
  const ctl = previsaoControle(state, b)
  const c = contratoDe(b)
  const list = c ? empresasPara(state, b) : []
  if (!ctl && !list.length) return null
  const now = Math.round(riscoOf(state).controle)
  return (
    <>
      {ctl !== 0 && (
        <p className={`pn-hint ${ctl > 0 ? 'up' : 'dn'}`} style={{ margin: '6px 0 0' }}>
          🔍 <b>Controle do Estado</b> {now} → {Math.round(Math.max(0, Math.min(100, now + ctl)))} {acts ? 'na hora' : 'se virar lei'}
          {ctl > 0 ? ' (mais vigilância: escolhas arriscadas viram esquema com menos facilidade).' : ' (menos vigilância: escolhas arriscadas viram esquema com mais facilidade).'}
          {b.rastro ? ' ⚠️ Deixa rastro em você.' : ''}
        </p>
      )}
      {list.length > 0 && c && (
        <>
          <div className="pn-label">🏗️ Quem executa o contrato</div>
          <p className="pn-hint" style={{ margin: '2px 0' }}>
            A medida contrata cerca de R$ {num(c.amount * GDP_BILLIONS / 100, 0)} bi por ano durante {c.months} meses. {acts ? 'O contrato é assinado junto com a medida.' : 'A escolha fica guardada e o contrato só é assinado se a lei passar.'}
          </p>
          <div className="pn-empresas">
            {list.map((e) => {
              const extra = custoEmpresa(b, e)
              return (
                <button key={e.perfil} type="button" className={`pn-empresa ${perfil === e.perfil ? 'on' : ''}`} onClick={() => onPerfil(e.perfil)}>
                  <span>{perfil === e.perfil ? '🔘' : '⚪'}</span>
                  <span><b>{e.nome}</b> · {CONTRATO.perfis[e.perfil].rotulo.toLowerCase()}<small>{e.desc}{e.perfil === 'aliada' ? ' ⚠️ Deixa rastro em você.' : ''}</small></span>
                  <span className={`pn-empresa__custo ${extra > 0 ? 'dn' : extra < 0 ? 'up' : ''}`}>{extra > 0 ? `+R$ ${num(extra * GDP_BILLIONS / 100, 1)} bi por ano` : extra < 0 ? `economia de R$ ${num(-extra * GDP_BILLIONS / 100, 1)} bi por ano` : 'preço de mercado'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
