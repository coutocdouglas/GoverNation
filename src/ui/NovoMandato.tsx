import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import './novoMandato.css'
import { PARTIES, PARTY_BY_ID, TOTAL_SEATS } from '../game/data/parties'
import { DOSSIE, LADOS } from '../game/data/dossie'
import { newGame } from '../game/game'
import type { GameState, GroupId, PartyId } from '../game/types'
import { castPortrait, PLAYER_POOL } from '../game/data/cast'
import { PORTRAITS, portraitSrc } from '../game/data/portraits'
import { BLOCOS, GROUPS, GROUP_BY_ID, type BlocoId } from '../game/data/groups'
import { HABITS, MAX_HABITS, MAX_TRAITS, TRAITS, type ProfileItemDef } from '../game/data/profile'
import { BANDEIRAS, PRESSAO_POSSE, PROMISE_BY_ID, PROMISE_CATS, PROMISES, PROMISES_TO_PICK, SIDE_OF_PARTY, type PromiseCat } from '../game/data/promises'
import { BILL_BY_ID } from '../game/data/bills'
import { profileOffsets, promisePoints, promiseSideBoosts, PROMISES_MAX, type PosseChoices } from '../game/promises'
import { RIVAL_BY_PARTY, RIVAL_PARTY_FOR } from '../game/data/rival'
import { GOVERNO, VICES } from '../game/data/governo'
import { pistaLealdade, chancesDaProposta } from '../game/governo'
import { DIFFICULTY } from '../game/data/balance'
import { bancadasDaDificuldade } from '../game/bancadas'
import { bandeirasDaPosse, bonusVice, disposicaoVice, gruposBase, impulsosDoPartido, promessaTravada, vantagemPequeno } from '../game/posse'

/**
 * v0.48.0: Novo mandato redesenhado (protótipo v6 aprovado pelo Douglas em 17/11/2026).
 * Passo 1 (candidato, dificuldade que muda as bancadas, os 9 partidos com dossiê), passo 3 (vice com chance e bônus)
 * e o painel dos 32 grupos. Desenho de 1920×1080 que se ajusta à tela.
 */
type Diff = GameState['difficulty']

const DIFFICULTIES: { id: Diff; name: string; desc: string }[] = [
  { id: 'facil', name: 'Fácil', desc: 'Bancadas parecidas, crises raras e eleitores pacientes.' },
  { id: 'normal', name: 'Normal', desc: 'Bancadas como sempre. O equilíbrio pensado para o jogo.' },
  { id: 'dificil', name: 'Difícil', desc: 'Os grandes ficam maiores e os pequenos sofrem. Crises frequentes.' },
]
const ORDEM_CAMARA: PartyId[] = ['fpt', 'pvs', 'mdn', 'psn', 'pra', 'ucd', 'pol', 'mrb', 'nrm']
const SIDE_LABEL = { esquerda: 'Esquerda', centro: 'Centro', direita: 'Direita', qualquer: 'Qualquer governo' } as const
const VICES_A_PROPOR: number = GOVERNO.vice.propostas
const MAIORIA = Math.floor(TOTAL_SEATS / 2) + 1

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const sgn = (v: number) => `${v > 0 ? '+' : ''}${num(Math.round(v * 10) / 10)}`
const nomes = (ids: GroupId[]) => ids.map((g) => GROUP_BY_ID[g].name).join(', ')

/** Escala do desenho de 1920×1080 para a janela (como o protótipo). */
function useEscala() {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight
    const z = Math.max(0.5, Math.min(2, Math.min(w / 1920, h / 1080)))
    return { z, w: w / z, h: h / z }
  }
  const [e, setE] = useState(calc)
  useEffect(() => {
    const on = () => setE(calc())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return e
}

function Logo({ party, size }: { party: PartyId; size?: number }) {
  const [falta, setFalta] = useState(false)
  const p = PARTY_BY_ID[party]
  return (
    <span className="nm-ring logo" style={{ '--c': p.color, width: size, height: size } as CSSProperties}>
      {falta ? <span className="nm-ph" style={{ background: p.color }}>{p.sigla}</span>
        : <img src={`${import.meta.env.BASE_URL}logos/${party}.webp`} alt={p.sigla} onError={() => setFalta(true)} draggable={false} />}
    </span>
  )
}

function Face({ id, color, size }: { id: number; color: string; size?: number }) {
  return <span className="nm-ring" style={{ '--c': color, width: size, height: size } as CSSProperties}><img src={portraitSrc(id)} alt="" draggable={false} /></span>
}

function Efeitos({ groups }: { groups: ProfileItemDef['groups'] }) {
  return (
    <span className="nm-fx">
      {GROUPS.filter((g) => groups[g.id]).map((g) => (
        <span key={g.id} className={groups[g.id]! > 0 ? 'up' : 'down'}>{g.name} {sgn(groups[g.id]!)}</span>
      ))}
    </span>
  )
}

export function NovoMandato({ hasSave, onCancel, onStart }: {
  hasSave: boolean
  onCancel: () => void
  onStart: (name: string, d: Diff, party: PartyId, face: number, posse: PosseChoices) => void
}) {
  const esc = useEscala()
  const [claro, setClaro] = useState(() => { try { return localStorage.getItem('gn-tema') !== 'escuro' } catch { return true } })
  const trocaTema = () => { const v = !claro; setClaro(v); try { localStorage.setItem('gn-tema', v ? 'claro' : 'escuro') } catch { /* sem armazenamento */ } }
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<Diff>('normal')
  const [party, setParty] = useState<PartyId>('mdn')
  const [face, setFace] = useState(() => PLAYER_POOL[Math.floor(Math.random() * PLAYER_POOL.length)])
  const [filter, setFilter] = useState<'todos' | 'f' | 'm'>('todos')
  const [traits, setTraits] = useState<string[]>([])
  const [habits, setHabits] = useState<string[]>([])
  const [promises, setPromises] = useState<string[]>([])
  const [vices, setVices] = useState<string[]>([])
  const [dossie, setDossie] = useState<PartyId | null>(null)
  const [catT, setCatT] = useState<BlocoId | 'todos'>('todos')
  const [catH, setCatH] = useState<BlocoId | 'todos'>('todos')
  const [catP, setCatP] = useState<PromiseCat>('economia')
  const [bandeiras, setBandeiras] = useState<Partial<Record<PartyId, boolean>>>({})

  const cor = PARTY_BY_ID[party].color
  const bancadasJa = useMemo(() => bancadasDaDificuldade(diff, party), [diff, party])
  const bancadasNormal = useMemo(() => bancadasDaDificuldade('normal'), [])

  // Painel: aprovação inicial de cada grupo com as escolhas até aqui, e a soma do que mexeu.
  const base = useMemo(() => newGame('Prévia', diff, 1, party, 'previa'), [diff, party])
  const doPartido = useMemo(() => {
    const out = {} as Record<GroupId, number>
    for (const i of impulsosDoPartido(party, diff)) out[i.group] = (out[i.group] ?? 0) + i.value
    return out
  }, [party, diff])
  const offsets = profileOffsets({ traits, habits })
  // v0.48.2: no Normal e no Difícil uma promessa vem travada pela pressão; as livres são as outras.
  const travada = promessaTravada(party, diff)
  const nLivres = travada ? PROMISES_TO_PICK - 1 : PROMISES_TO_PICK
  const livres = promises.filter((id) => id !== travada).slice(0, nLivres)
  const todas = travada ? [travada, ...livres] : livres
  const pedidos = useMemo(() => bandeirasDaPosse(party, diff), [party, diff])
  const seguidas = pedidos.filter((b) => bandeiras[b.party] === true)
  const boosts = promiseSideBoosts(todas, party)
  const bonusDif = DIFFICULTY[diff].approvalBonus
  const linhas = GROUPS.map((g) => {
    const antes = base.groups[g.id].approval
    const escolha = (offsets[g.id] ?? 0) + boosts.filter((b) => b.group === g.id).reduce((a, b) => a + b.value, 0)
    const ex = bonusDif + (doPartido[g.id] ?? 0) + escolha
    return { g, ex, depois: Math.max(0, Math.min(100, antes + escolha)) }
  })
  const aprovacao = linhas.reduce((a, l) => a + l.g.weight * l.depois, 0)
  const ord = [...linhas].sort((a, b) => b.ex - a.ex)
  const rival = RIVAL_BY_PARTY[RIVAL_PARTY_FOR[party]]
  const side = SIDE_OF_PARTY[party]

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list)
  const escolherPartido = (p: PartyId) => { if (p !== party) { setParty(p); setPromises([]); setBandeiras({}) } setDossie(null) }

  const steps = ['Candidato', 'Perfil', 'Vice', 'Promessas']
  const decididas = pedidos.every((b) => bandeiras[b.party] !== undefined)
  const pronto = livres.length === nLivres && vices.length === VICES_A_PROPOR && decididas
  const faltam = (n: number, um: string, varios: string) => (n === 1 ? `Falta 1 ${um}.` : `Faltam ${n} ${varios}.`)
  const falta = vices.length !== VICES_A_PROPOR ? faltam(VICES_A_PROPOR - vices.length, 'nome de vice', 'nomes de vice') : livres.length !== nLivres ? faltam(nLivres - livres.length, 'promessa', 'promessas') : !decididas ? 'Decida se segue cada bandeira.' : ''

  const galeria = PLAYER_POOL.filter((id) => filter === 'todos' || PORTRAITS[id - 1].gender === filter)
  const trocaFiltro = (f: 'todos' | 'f' | 'm') => {
    setFilter(f)
    if (f !== 'todos' && PORTRAITS[face - 1].gender !== f) {
      const pool = PLAYER_POOL.filter((id) => PORTRAITS[id - 1].gender === f)
      if (pool.length) setFace(pool[0])
    }
  }

  const painel = (
    <aside className="nm-card nm-aside">
      {step === 3 && (
        <>
          <h3>Sua proposta <span className="nm-muted">{vices.length}/{VICES_A_PROPOR}</span></h3>
          <div className="nm-slots">
            {Array.from({ length: VICES_A_PROPOR }, (_, i) => {
              const v = VICES.find((x) => x.id === vices[i])
              if (!v) return <div key={i} className="nm-sl"><span className="nm-muted">Vaga {i + 1}: escolha um nome</span></div>
              const b = bonusVice(party, v.id)
              const chance = vices.length === VICES_A_PROPOR ? chancesDaProposta(party, vices)[i] : null
              return (
                <div key={i} className="nm-sl f">
                  <Face id={v.portrait} color={PARTY_BY_ID[v.party].color} />
                  <div>
                    <b>{v.name}</b> <small>{PARTY_BY_ID[v.party].sigla} · disposição {disposicaoVice(party, v.party)}%{chance !== null && ` · chance de ser o vice ${Math.round(chance * 100)}%`}</small><br />
                    <small>{b.valor > 0 ? `${sgn(b.valor)} em ${nomes(b.grupos)} se aceitar` : 'sem bônus extra'}</small>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="nm-hint">Só um aceita, sorteado pelas chances. Quanto mais distante do seu partido, menor a disposição e maior o bônus (entra no gráfico só na posse).</p>
        </>
      )}
      {step === 4 && (
        <>
          <h3>Suas promessas <span className="nm-muted">{todas.length}/{PROMISES_TO_PICK}{seguidas.length ? ` +${seguidas.length}` : ''}</span></h3>
          <div className="nm-slots">
            {travada && <div className="nm-sl lk">🔒 <div><b>{PROMISE_BY_ID[travada].name}</b><br /><small>pressão: {GROUP_BY_ID[PRESSAO_POSSE[party].grupo].name} · {promisePoints(PROMISE_BY_ID[travada])} pts</small></div></div>}
            {Array.from({ length: nLivres }, (_, i) => {
              const p = PROMISE_BY_ID[livres[i]]
              return p
                ? <div key={i} className="nm-sl f"><div><b>{p.name}</b><br /><small>{PROMISE_CATS.find((c) => c.id === p.cat)!.label} · {promisePoints(p)} pts</small></div></div>
                : <div key={i} className="nm-sl"><span className="nm-muted">Promessa livre {i + 1}</span></div>
            })}
            {seguidas.map((b) => <div key={b.party} className="nm-sl bx">🤝 <div><b>{BILL_BY_ID[b.bill]?.name ?? b.bill}</b><br /><small>bandeira do {PARTY_BY_ID[b.party].sigla} · extra, {BANDEIRAS.pontos} pts se virar lei</small></div></div>)}
          </div>
          <p className="nm-hint">Pontos possíveis: {todas.reduce((a, id) => a + promisePoints(PROMISE_BY_ID[id]), 0) + seguidas.length * BANDEIRAS.pontos}; a nota das promessas para em {PROMISES_MAX}. Quem arrisca pode errar uma e ainda chegar lá.</p>
        </>
      )}
      <h3>Como o país te recebe <span>aprovação <b>{Math.round(aprovacao)}%</b></span></h3>
      <div className="nm-blocks">
        {BLOCOS.map((b) => (
          <div key={b.id} className={`nm-blk ${b.id === 'trabalho' ? 'span2' : ''}`}>
            <h4>{b.nome}</h4>
            {linhas.filter((l) => l.g.bloco === b.id).map((l) => {
              const tom = l.ex >= 0.5 ? 'up' : l.ex <= -0.5 ? 'down' : ''
              return (
                <div key={l.g.id} className="nm-g" title={l.g.name}>
                  <span>{l.g.name}</span>
                  <span className={tom}>{Math.round(l.depois)}{Math.abs(l.ex) >= 0.5 && <small>{sgn(l.ex)}</small>}</span>
                  <div className="nm-bar"><i style={{ width: `${l.depois}%`, background: tom === 'up' ? 'var(--green)' : tom === 'down' ? 'var(--red)' : 'var(--gold)' }} /></div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {step < 3 && (
        <div className="nm-why">
          Mais favorável: <span className="up">{ord.slice(0, 2).map((l) => l.g.name).join(', ')}</span>. Mais frio: <span className="down">{ord.slice(-2).map((l) => l.g.name).join(', ')}</span>.
          {' '}O gráfico soma dificuldade ({sgn(bonusDif)}), identidade do {PARTY_BY_ID[party].sigla}, perfil e promessas do seu lado.
        </div>
      )}
      {rival && step < 3 && (
        <div className="nm-rival">
          <Face id={castPortrait(rival.name) ?? 1} color={PARTY_BY_ID[rival.party].color} size={40} />
          <div><small>Seu rival</small><br /><b>{rival.name}</b><br /><small>{PARTY_BY_ID[rival.party].sigla} · {rival.blurb}</small></div>
        </div>
      )}
    </aside>
  )

  const pequeno = vantagemPequeno(party, diff)

  return (
    <div className={`nm ${claro ? 'nm--claro' : ''}`} style={{ zoom: esc.z, width: esc.w, height: esc.h, '--pc': cor } as CSSProperties}>
      <header className="nm-top">
        <div className="nm-logo">GoverNation<small>Novo mandato</small></div>
        <ol className="nm-steps">
          {steps.map((label, i) => (
            <li key={label} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>
              <button onClick={() => setStep((i + 1) as 1 | 2 | 3 | 4)}>{i + 1}. {label}</button>
            </li>
          ))}
        </ol>
        <span className="nm-sp" />
        <button className="nm-btn" onClick={trocaTema} title="Trocar tema">☀ / 🌙</button>
        <button className="nm-btn" onClick={onCancel}>Voltar ao menu</button>
      </header>

      <div className="nm-body">
        {step === 1 && (
          <div className="nm-main nm-s1">
            <div className="nm-card nm-face">
              <div className="nm-lbl" style={{ width: '100%' }}><span>Seu rosto</span></div>
              <div className="nm-bigring"><img src={portraitSrc(face)} alt="Seu rosto" draggable={false} /></div>
              <div className="nm-plate">{name || 'Sem nome ainda'}</div>
              <div className="nm-filters">
                {([['todos', 'Todos'], ['f', 'Mulheres'], ['m', 'Homens']] as const).map(([k, label]) => (
                  <button key={k} className={`nm-btn ${filter === k ? 'on' : ''}`} onClick={() => trocaFiltro(k)}>{label}</button>
                ))}
                <button className="nm-btn" title="Sortear" onClick={() => setFace(galeria[Math.floor(Math.random() * galeria.length)])}>🎲</button>
              </div>
              <div className="nm-gal">
                {galeria.map((id) => (
                  <button key={id} className={id === face ? 'on' : ''} onClick={() => setFace(id)} aria-label={`Retrato ${id}`}>
                    <img src={portraitSrc(id)} alt="" draggable={false} />
                  </button>
                ))}
              </div>
            </div>
            <div className="nm-mid">
              <div className="nm-row2">
                <div className="nm-card">
                  <div className="nm-lbl">Nome do presidente</div>
                  <input className="nm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado" maxLength={40} autoFocus />
                </div>
                <div className="nm-card">
                  <div className="nm-lbl">Dificuldade · muda o tamanho das bancadas</div>
                  <div className="nm-diffs">
                    {DIFFICULTIES.map((d) => (
                      <button key={d.id} className={`nm-diff ${diff === d.id ? 'on' : ''}`} onClick={() => setDiff(d.id)}>
                        <b>{d.name}</b><small>{d.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="nm-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="nm-lbl" style={{ margin: 0 }}>
                  <span>Seu partido · clique no cartão para ver o dossiê (cadeiras se for o seu)</span>
                  <span>{PARTY_BY_ID[party].sigla}: {bancadasJa[party]} dos {TOTAL_SEATS} deputados</span>
                </div>
                <div className="nm-spec">
                  {LADOS.map((l) => (
                    <div key={l.id} className="nm-col">
                      <div className={`nm-colh ${l.id}`}>{l.nome}</div>
                      {PARTIES.filter((p) => DOSSIE[p.id].lado === l.id).map((p) => {
                        const tam = bancadasDaDificuldade(diff, p.id)[p.id]
                        const d = tam - bancadasNormal[p.id]
                        const sb = vantagemPequeno(p.id, diff)
                        return (
                          <button key={p.id} className={`nm-party ${party === p.id ? 'on' : ''}`} style={{ '--c': p.color } as CSSProperties} onClick={() => setDossie(p.id)}>
                            <Logo party={p.id} />
                            <b>
                              {p.sigla}
                              <small title="Bancada se for o seu partido">{tam} cad.{d !== 0 && <> <span className={d > 0 ? 'up' : 'down'}>{sgn(d)}</span></>}</small>
                              {sb > 0 && <span className="nm-tag ok" title="Vantagem de partido pequeno">+{num(sb)}</span>}
                              {party === p.id && <span className="nm-ok">✓</span>}
                            </b>
                            <span className="nm-tg">{DOSSIE[p.id].lema}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <div className="nm-lbl" style={{ margin: '8px 0 6px' }}>
                    <span>A Câmara com a dificuldade {DIFFICULTIES.find((d) => d.id === diff)!.name}</span><span>maioria: {MAIORIA}</span>
                  </div>
                  <div className="nm-hemi">
                    {ORDEM_CAMARA.map((id) => (
                      <i key={id} title={`${PARTY_BY_ID[id].sigla} ${bancadasJa[id]}`}
                        style={{ flex: bancadasJa[id], background: PARTY_BY_ID[id].color, ...(id === party ? { outline: '2px solid var(--text)', outlineOffset: -2, zIndex: 1 } : {}) }}>
                        <span>{PARTY_BY_ID[id].sigla}</span>
                      </i>
                    ))}
                    <b className="nm-maj" />
                  </div>
                  <p className="nm-hint" style={{ marginTop: 8 }}>
                    {pequeno > 0
                      ? <><b className="up">{PARTY_BY_ID[party].sigla} tem vantagem de partido pequeno:</b> {sgn(pequeno)} de ânimo inicial em {nomes(gruposBase(party))}.</>
                      : <>{PARTY_BY_ID[party].sigla} é bancada grande: não recebe vantagem compensatória.</>}
                    {' '}A dificuldade nunca joga contra a sua mão: no Fácil o seu partido não encolhe, no Difícil não cresce.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="nm-main nm-s2">
            {([['Traços', TRAITS, traits, setTraits, MAX_TRAITS, catT, setCatT], ['Hábitos', HABITS, habits, setHabits, MAX_HABITS, catH, setCatH]] as const).map(([titulo, lista, sel, set, max, cat, setCat]) => (
              <div key={titulo} className="nm-card">
                <div className="nm-lbl"><span>{titulo} · até {max}</span><span>{sel.length}/{max}</span></div>
                <div className="nm-cats">
                  {(['todos', ...BLOCOS.map((b) => b.id)] as const).map((c) => (
                    <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                      {c === 'todos' ? 'Todos' : BLOCOS.find((b) => b.id === c)!.nome}
                    </button>
                  ))}
                </div>
                <div className="nm-pgrid">
                  {lista.filter((t) => cat === 'todos' || t.bloco === cat || sel.includes(t.id)).map((t) => (
                    <button key={t.id} className={`nm-opt ${sel.includes(t.id) ? 'on' : ''}`} disabled={!sel.includes(t.id) && sel.length >= max}
                      onClick={() => toggle(sel as string[], set, t.id, max)}>
                      <span className="nm-cat-tag">{BLOCOS.find((b) => b.id === t.bloco)!.nome}</span>
                      <b>{t.name}</b>
                      <p>{t.desc}</p>
                      <Efeitos groups={t.groups} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="nm-main">
            <div className="nm-card nm-s3">
              <p className="nm-hint">Proponha exatamente {VICES_A_PROPOR} nomes, de qualquer partido (pode ser do seu). Um só aceita, e você só descobre quem na posse. A porcentagem é a disposição de cada nome; um nome de fora rende mais, se aceitar.</p>
              {LADOS.map((l) => (
                <div key={l.id} style={{ display: 'contents' }}>
                  <div className={`nm-vhead ${l.id}`}>{l.nome}</div>
                  {ORDEM_CAMARA.filter((pid) => DOSSIE[pid].lado === l.id).map((pid) => {
                    const p = PARTY_BY_ID[pid]
                    return (
                      <div key={pid} className="nm-vrow" style={{ '--c': p.color } as CSSProperties}>
                        <div className="nm-vlab"><Logo party={pid} /><div><b>{p.sigla}</b><br /><small>{pid === party ? 'seu partido' : p.name}</small></div></div>
                        {VICES.filter((v) => v.party === pid).map((v) => {
                          const ch = disposicaoVice(party, pid)
                          const cl = ch >= 70 ? 'hi' : ch >= 45 ? 'mid' : 'lo'
                          const b = bonusVice(party, v.id)
                          const on = vices.includes(v.id)
                          return (
                            <button key={v.id} className={`nm-vice ${on ? 'on' : ''}`} style={{ '--c': p.color } as CSSProperties}
                              disabled={!on && vices.length >= VICES_A_PROPOR} onClick={() => toggle(vices, setVices, v.id, VICES_A_PROPOR)}>
                              <Face id={v.portrait} color={p.color} />
                              <b>{v.name}<span className={`nm-ch ${cl}`}>{ch}%</span></b>
                              <small title={`${v.perfil} ${pistaLealdade(v.lealdade)}`}>{v.perfil}</small>
                              <span className="nm-bn">{b.valor > 0 ? `se aceitar: ${sgn(b.valor)} em ${nomes(b.grupos)}` : 'sem bônus extra'}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="nm-main nm-s4">
            {travada ? (
              <div className="nm-press">
                <div className="ic">📣</div>
                <div>
                  <h3>Pressão antes da eleição: {GROUP_BY_ID[PRESSAO_POSSE[party].grupo].name}</h3>
                  <p>{PRESSAO_POSSE[party].texto} A promessa ao lado já vem escolhida e conta na nota como as outras.</p>
                </div>
                <div className="nm-lock">
                  <small>Promessa obrigatória · {'★'.repeat(PROMISE_BY_ID[travada].stars)}</small>
                  <b>{PROMISE_BY_ID[travada].name}</b><br /><span>{PROMISE_BY_ID[travada].desc}</span>
                </div>
              </div>
            ) : (
              <div className="nm-press livre">
                <div className="ic">🗳️</div>
                <div><h3>Dificuldade Fácil: sem pressão antes da eleição</h3><p>Você escolhe as {PROMISES_TO_PICK} promessas livremente.</p></div>
                <span />
              </div>
            )}
            <div className="nm-card nm-bands">
              <div className="nm-lbl"><span>Bandeiras de quem apoiou a sua eleição</span><span>fora das {PROMISES_TO_PICK} promessas · decida cada uma</span></div>
              <div className="nm-bandrow">
                {pedidos.map((b) => {
                  const q = PARTY_BY_ID[b.party], v = bandeiras[b.party]
                  return (
                    <div key={b.party} className={`nm-ped ${v === true ? 'sim' : v === false ? 'nao' : ''}`} style={{ '--c': q.color } as CSSProperties}>
                      <Logo party={b.party} />
                      <div><b>{q.sigla}</b> pede <b>{BILL_BY_ID[b.bill]?.name ?? b.bill}</b><br />
                        <small>Seguir: relação +{BANDEIRAS.seguir} e {BANDEIRAS.pontos} pts se virar lei; se não for a voto até o mês {BANDEIRAS.cobrancaMes}, relação {BANDEIRAS.cobranca}. Recusar: relação {BANDEIRAS.recusar}.</small>
                      </div>
                      <div className="nm-pbt">
                        <button className={v === true ? 'on' : ''} onClick={() => setBandeiras({ ...bandeiras, [b.party]: true })}>Seguir</button>
                        <button className={v === false ? 'on' : ''} onClick={() => setBandeiras({ ...bandeiras, [b.party]: false })}>Recusar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="nm-card">
              <div className="nm-lbl"><span>Escolha {nLivres} promessas · 1, 2 ou 3 estrelas valem 40, 60 ou 90 pontos</span><span>{livres.length}/{nLivres}</span></div>
              <div className="nm-mix">
                <span>Ousadia do pacote: <b className="nm-st">{'★'.repeat(todas.reduce((a, id) => a + PROMISE_BY_ID[id].stars, 0)) || '–'}</b></span>
                <span>Misture áreas para não depender de um só indicador. As do seu lado ({SIDE_LABEL[side]}) animam o grupo que cobra na posse.{rival && <> Promessa fora do rumo vira munição para {rival.name}.</>}</span>
              </div>
              <div className="nm-cats">
                {PROMISE_CATS.map((c) => (
                  <button key={c.id} className={catP === c.id ? 'on' : ''} onClick={() => setCatP(c.id)}>
                    {c.label} <span className="nm-muted">{livres.filter((id) => PROMISE_BY_ID[id].cat === c.id).length || ''}</span>
                  </button>
                ))}
              </div>
              <div className="nm-pgrid four">
                {PROMISES.filter((p) => p.cat === catP && p.id !== travada).map((p) => (
                  <button key={p.id} className={`nm-opt ${livres.includes(p.id) ? 'on' : ''}`} disabled={!livres.includes(p.id) && livres.length >= nLivres}
                    onClick={() => toggle(livres, setPromises, p.id, nLivres)}>
                    <span className="nm-cat-tag"><span className="nm-st">{'★'.repeat(p.stars)}</span> {promisePoints(p)} pts</span>
                    <b>{p.name}</b>
                    <p>{p.desc}</p>
                    <span className={`nm-side ${p.side === side ? 'mine' : ''}`}>{SIDE_LABEL[p.side]}{p.side === side ? ` · do seu lado: +1,5 em ${GROUP_BY_ID[p.group].name}` : ''}</span>
                    <span className="nm-meta">Medida: {p.mede}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {painel}
      </div>

      <footer className="nm-foot">
        {hasSave && <span className="nm-warn">Começar um novo mandato apaga o mandato salvo.</span>}
        <span className="nm-sp" />
        {step === 4 && falta && <span className="nm-warn">{falta}</span>}
        <button className="nm-btn" onClick={step === 1 ? onCancel : () => setStep((step - 1) as 1 | 2 | 3)}>Voltar</button>
        {step < 4 ? (
          <button className="nm-btn nm-btn--primary" onClick={() => setStep((step + 1) as 2 | 3 | 4)}>
            Continuar: {step === 1 ? 'perfil' : step === 2 ? 'vice' : 'promessas'}
          </button>
        ) : (
          <button className="nm-btn nm-btn--primary" disabled={!pronto} onClick={() => onStart(name, diff, party, face, { traits, habits, promises: todas, vices, bandeiras: seguidas.map((b) => b.party) })}>
            Tomar posse · 1º de janeiro de 2027
          </button>
        )}
      </footer>

      {dossie && <Dossie party={dossie} diff={diff} escolhido={party === dossie} onClose={() => setDossie(null)} onEscolher={() => escolherPartido(dossie)} />}
    </div>
  )
}

function Dossie({ party, diff, escolhido, onClose, onEscolher }: { party: PartyId; diff: Diff; escolhido: boolean; onClose: () => void; onEscolher: () => void }) {
  const p = PARTY_BY_ID[party]
  const d = DOSSIE[party]
  const tam = bancadasDaDificuldade(diff, party)[party]
  const sb = vantagemPequeno(party, diff)
  const rel = (ids: PartyId[], cls: string) => ids.length
    ? <div className={`nm-rel ${cls}`}>{ids.map((a) => <span key={a}><Logo party={a} />{PARTY_BY_ID[a].sigla}</span>)}</div>
    : <small>nenhum fixo</small>
  return (
    <div className="nm-veil" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="nm-win" style={{ '--pc': p.color, '--c': p.color } as CSSProperties}>
        <header><h3>Dossiê do partido</h3><button onClick={onClose} aria-label="Fechar">✕</button></header>
        <div className="nm-wbody">
          <div className="nm-wl">
            <Logo party={party} />
            <h2>{p.name}</h2>
            <div className="nm-chips">
              <span className="nm-tag">{p.sigla} {p.number}</span>
              <span className="nm-tag">{LADOS.find((l) => l.id === d.lado)!.nome}</span>
              <span className="nm-tag">{tam} de {TOTAL_SEATS} deputados</span>
            </div>
            <div className="nm-meters">
              <div>Economia<i><u style={{ left: `${(p.econ + 100) / 2}%` }} /></i></div>
              <div>Costumes<i><u style={{ left: `${(p.costumes + 100) / 2}%` }} /></i></div>
            </div>
            <small>Líder na Câmara: {p.leader.name}</small>
          </div>
          <div className="nm-wr">
            <div><h5>História</h5><p>{d.historia}</p></div>
            <div><h5>Por que se alinha assim</h5><ul>{d.alinhamento.map((a) => <li key={a}>{a}</li>)}</ul></div>
            <div className="nm-two">
              <div><h5>Forças</h5><ul>{d.forcas.map((a) => <li key={a}>{a}</li>)}</ul></div>
              <div><h5>Fraquezas</h5><ul>{d.fraquezas.map((a) => <li key={a}>{a}</li>)}</ul></div>
            </div>
            <div className="nm-two">
              <div><h5>Aliados</h5>{rel(d.aliados, 'fr')}</div>
              <div><h5>Oposição</h5>{rel(d.rivais, 'foe')}</div>
            </div>
            <div><h5>Base no eleitorado</h5><p>{nomes(gruposBase(party)) || 'sem grupo fiel'}</p></div>
            {sb > 0 && <div className="nm-vant"><b>Vantagem de partido pequeno</b><br />{sgn(sb)} de ânimo inicial em {nomes(gruposBase(party))}.</div>}
          </div>
        </div>
        <footer>
          <button className="nm-btn" onClick={onClose}>Fechar</button>
          <button className="nm-btn nm-btn--primary" onClick={onEscolher}>{escolhido ? 'Já é o seu partido' : 'Escolher este partido'}</button>
        </footer>
      </div>
    </div>
  )
}

