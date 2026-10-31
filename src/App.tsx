import { useMemo, useState } from 'react'
import { PartyLogo } from './ui/PartyLogo'
import { UpdateBanner } from './components/UpdateBanner'
import { PLAYER_PARTY_CHOICES } from './game/data/parties'
import { monthLabel, newGame } from './game/game'
import { deleteSave, loadGame, saveGame } from './game/save'
import type { GameState, PartyId } from './game/types'
import { EndScreen } from './ui/EndScreen'
import { PLAYER_POOL } from './game/data/cast'
import { PORTRAITS } from './game/data/portraits'
import { PARTY_BY_ID } from './game/data/parties'
import { Portrait } from './ui/Portrait'
import { GameScreen } from './ui/GameScreen'
import { GROUPS } from './game/data/groups'
import { HABITS, MAX_HABITS, MAX_TRAITS, TRAITS, type ProfileItemDef } from './game/data/profile'
import { PROMISES, PROMISES_TO_PICK, SIDE_OF_PARTY } from './game/data/promises'
import { profileOffsets, promiseSideBoosts, type PosseChoices } from './game/promises'
import { RIVAL_BY_PARTY, RIVAL_PARTY_FOR } from './game/data/rival'
import { castPortrait } from './game/data/cast'

const ROADMAP = [
  { v: '0.1', label: 'Estrutura e atualização automática', done: true },
  { v: '0.2', label: 'Economia, grupos sociais e turno mensal', done: true },
  { v: '0.3', label: 'Congresso com 513 deputados', done: true },
  { v: '0.4', label: 'Fato do mês, cobranças e personagens', done: true },
  { v: '0.5–0.7', label: 'Memória do mundo, catálogo de medidas e IA', done: true },
  { v: '0.8–0.10', label: 'Negociação de votos e Congresso 2.0', done: true },
  { v: '0.11', label: 'Rival, ficha do candidato e promessas de posse', done: true },
  { v: '0.12', label: '27 estados e apuração da eleição', done: false },
]

const DIFFICULTIES: { id: GameState['difficulty']; name: string; desc: string }[] = [
  { id: 'facil', name: 'Fácil', desc: 'Menos crises externas e eleitores mais pacientes.' },
  { id: 'normal', name: 'Normal', desc: 'O equilíbrio pensado para o jogo.' },
  { id: 'dificil', name: 'Difícil', desc: 'Crises frequentes e eleitores exigentes.' },
]

type Screen = 'home' | 'new' | 'game'

export default function App() {
  const [game, setGame] = useState<GameState | null>(() => loadGame())
  const [screen, setScreen] = useState<Screen>('home')

  const update = (s: GameState) => {
    setGame(s)
    saveGame(s)
  }

  return (
    <>
      <UpdateBanner />
      {screen === 'home' && (
        <Home
          saved={game}
          onNew={() => setScreen('new')}
          onContinue={() => setScreen('game')}
        />
      )}
      {screen === 'new' && (
        <NewGame
          hasSave={!!game && !game.finished}
          onCancel={() => setScreen('home')}
          onStart={(name, diff, party, face, posse) => {
            update(newGame(name, diff, undefined, party, String(face), face, posse))
            setScreen('game')
          }}
        />
      )}
      {screen === 'game' && game && !game.finished && (
        <GameScreen state={game} onChange={update} onExit={() => setScreen('home')} />
      )}
      {screen === 'game' && game?.finished && (
        <EndScreen
          state={game}
          onHome={() => {
            deleteSave()
            setGame(null)
            setScreen('home')
          }}
        />
      )}
    </>
  )
}

function Home({ saved, onNew, onContinue }: { saved: GameState | null; onNew: () => void; onContinue: () => void }) {
  return (
    <main className="home">
      <header className="home__header">
        <img src="/icon.png" alt="" className="home__logo" />
        <div>
          <h1>GoverNation</h1>
          <p className="home__tagline">Quatro anos. Um país. Cada decisão tem um preço.</p>
        </div>
      </header>

      <section className="home__menu">
        <button className="btn btn--primary btn--big" onClick={onNew}>
          Novo mandato
          <small>quatro anos de governo</small>
        </button>
        <button className="btn btn--big" disabled={!saved} onClick={onContinue}>
          Continuar
          <small>
            {saved
              ? saved.finished
                ? `mandato de ${saved.presidentName} encerrado`
                : `${saved.presidentName} · ${monthLabel(saved.month)}`
              : 'nenhum mandato salvo'}
          </small>
        </button>
      </section>

      <section className="home__roadmap">
        <h2>Em construção</h2>
        <ol>
          {ROADMAP.map((item) => (
            <li key={item.v} className={item.done ? 'done' : ''}>
              <span className="tag">v{item.v}</span> {item.label}
            </li>
          ))}
        </ol>
      </section>

      <footer className="home__footer">versão {__APP_VERSION__}</footer>
    </main>
  )
}

const SIDE_LABEL = { esquerda: 'Esquerda', centro: 'Centro', direita: 'Direita', qualquer: 'Qualquer governo' } as const

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`

function EffectList({ groups }: { groups: ProfileItemDef['groups'] }) {
  return (
    <span className="posse__fx">
      {GROUPS.filter((g) => groups[g.id]).map((g) => (
        <span key={g.id} className={groups[g.id]! > 0 ? 'up' : 'down'}>{g.name} {signed(groups[g.id]!)}</span>
      ))}
    </span>
  )
}

function NewGame({ hasSave, onCancel, onStart }: {
  hasSave: boolean
  onCancel: () => void
  onStart: (name: string, d: GameState['difficulty'], party: PartyId, face: number, posse: PosseChoices) => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<GameState['difficulty']>('normal')
  const [party, setParty] = useState<PartyId>('mdn')
  const [face, setFace] = useState(() => PLAYER_POOL[Math.floor(Math.random() * PLAYER_POOL.length)])
  const [filter, setFilter] = useState<'todos' | 'f' | 'm'>('todos')
  const [traits, setTraits] = useState<string[]>([])
  const [habits, setHabits] = useState<string[]>([])
  const [promises, setPromises] = useState<string[]>([])

  // Painel ao lado: aprovação inicial de cada grupo com as escolhas feitas até aqui.
  const base = useMemo(() => newGame('Prévia', diff, 1, party, 'previa', face), [diff, party, face])
  const offsets = profileOffsets({ traits, habits })
  const boosts = promiseSideBoosts(promises, party)
  const preview = GROUPS.map((g) => {
    const before = base.groups[g.id].approval
    const extra = offsets[g.id] + boosts.filter((b) => b.group === g.id).reduce((a, b) => a + b.value, 0)
    return { g, before, after: Math.max(0, Math.min(100, before + extra)), extra }
  })
  const approval = preview.reduce((a, p) => a + p.g.weight * p.after, 0)
  const rival = RIVAL_BY_PARTY[RIVAL_PARTY_FOR[party]]

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list)

  const side = SIDE_OF_PARTY[party]
  const steps = ['Candidato', 'Perfil', 'Promessas']

  return (
    <main className="home posse">
      <h1 className="newgame__title">Novo mandato</h1>
      <ol className="posse__steps">
        {steps.map((label, i) => (
          <li key={label} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>
            <button onClick={() => setStep((i + 1) as 1 | 2 | 3)}>{i + 1}. {label}</button>
          </li>
        ))}
      </ol>

      <div className="posse__body">
        <div className="posse__main">
          {step === 1 && (
            <>
              <div className="field">
                <span>Seu rosto</span>
                <div className="newgame__face">
                  <Portrait id={face} color={PARTY_BY_ID[party].color} size={110} title="Seu rosto" />
                  <div className="newgame__filters">
                    {([['todos', 'Todos'], ['f', 'Mulheres'], ['m', 'Homens']] as const).map(([k, label]) => (
                      <button key={k} className={`btn ${filter === k ? 'btn--primary' : ''}`} onClick={() => setFilter(k)}>{label}</button>
                    ))}
                    <button className="btn" onClick={() => {
                      const pool = PLAYER_POOL.filter((id) => filter === 'todos' || PORTRAITS[id - 1].gender === filter)
                      setFace(pool[Math.floor(Math.random() * pool.length)])
                    }}>🎲 Sortear</button>
                  </div>
                </div>
                <div className="newgame__gallery">
                  {PLAYER_POOL.filter((id) => filter === 'todos' || PORTRAITS[id - 1].gender === filter).map((id) => (
                    <button key={id} className={`newgame__pick ${id === face ? 'on' : ''}`} onClick={() => setFace(id)} aria-label={`Retrato ${id}`}>
                      <Portrait id={id} color={id === face ? PARTY_BY_ID[party].color : 'transparent'} size={64} />
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>Nome do presidente</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado" maxLength={40} autoFocus />
              </label>
              <div className="field">
                <span>Dificuldade</span>
                <div className="choices">
                  {DIFFICULTIES.map((d) => (
                    <button key={d.id} className={`choice ${diff === d.id ? 'choice--selected' : ''}`} onClick={() => setDiff(d.id)}>
                      <strong>{d.name}</strong>
                      <small>{d.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>Seu partido</span>
                <div className="choices">
                  {PLAYER_PARTY_CHOICES.map((p) => (
                    <button key={p.id} className={`choice ${party === p.id ? 'choice--selected' : ''}`} onClick={() => { setParty(p.id); setPromises([]) }}>
                      <PartyLogo party={p.id} size={56} />
                      <strong>{p.label}</strong>
                      <small>{p.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="muted">Escolha até {MAX_TRAITS} traços e até {MAX_HABITS} hábitos. Cada um agrada uns grupos e desagrada outros, para o mandato inteiro. Pode deixar em branco.</p>
              <div className="field">
                <span>Traços ({traits.length}/{MAX_TRAITS})</span>
                <div className="posse__grid">
                  {TRAITS.map((t) => (
                    <button key={t.id} className={`choice ${traits.includes(t.id) ? 'choice--selected' : ''}`}
                      disabled={!traits.includes(t.id) && traits.length >= MAX_TRAITS}
                      onClick={() => toggle(traits, setTraits, t.id, MAX_TRAITS)}>
                      <strong>{t.name}</strong>
                      <small>{t.desc}</small>
                      <EffectList groups={t.groups} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>Hábitos ({habits.length}/{MAX_HABITS})</span>
                <div className="posse__grid">
                  {HABITS.map((t) => (
                    <button key={t.id} className={`choice ${habits.includes(t.id) ? 'choice--selected' : ''}`}
                      disabled={!habits.includes(t.id) && habits.length >= MAX_HABITS}
                      onClick={() => toggle(habits, setHabits, t.id, MAX_HABITS)}>
                      <strong>{t.name}</strong>
                      <small>{t.desc}</small>
                      <EffectList groups={t.groups} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="muted">
                Escolha exatamente {PROMISES_TO_PICK} promessas. Elas são acompanhadas no Painel e cobradas no fim do mandato: valem até 300 pontos da nota final.
                As do seu lado ({SIDE_LABEL[side]}) animam o grupo que cobra logo na posse.
                {rival && <> Promessa fora do rumo vira munição para {rival.name}.</>}
              </p>
              <div className="field">
                <span>Promessas ({promises.length}/{PROMISES_TO_PICK})</span>
                <div className="posse__grid">
                  {PROMISES.map((p) => (
                    <button key={p.id} className={`choice ${promises.includes(p.id) ? 'choice--selected' : ''}`}
                      disabled={!promises.includes(p.id) && promises.length >= PROMISES_TO_PICK}
                      onClick={() => toggle(promises, setPromises, p.id, PROMISES_TO_PICK)}>
                      <strong>{p.name}</strong>
                      <small>{p.desc}</small>
                      <span className={`posse__side ${p.side === side ? 'mine' : ''}`}>{SIDE_LABEL[p.side]}{p.side === side ? ' · do seu lado' : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="posse__aside">
          <h3>Como o país te recebe</h3>
          <p className="posse__approval">Aprovação inicial <b>{approval.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</b></p>
          <ul>
            {preview.map((p) => (
              <li key={p.g.id}>
                <div className="group__head">
                  <span>{p.g.name}</span>
                  <span>
                    {Math.round(p.after)}
                    {Math.abs(p.extra) >= 0.05 && <small className={p.extra > 0 ? 'up' : 'down'}> {signed(Math.round(p.extra * 10) / 10)}</small>}
                  </span>
                </div>
                <div className="bar"><div style={{ width: `${p.after}%`, background: p.extra > 0 ? 'var(--green)' : p.extra < 0 ? 'var(--red)' : 'var(--gold)' }} /></div>
              </li>
            ))}
          </ul>
          {rival && (
            <div className="posse__rival">
              <Portrait id={castPortrait(rival.name) ?? 1} color={PARTY_BY_ID[rival.party].color} size={48} />
              <div>
                <small className="muted">Seu rival</small>
                <strong>{rival.name}</strong>
                <small className="muted">{PARTY_BY_ID[rival.party].sigla} · {rival.blurb}</small>
              </div>
            </div>
          )}
        </aside>
      </div>

      {hasSave && <p className="warning">Começar um novo mandato apaga o mandato salvo.</p>}
      <div className="home__menu">
        {step < 3 ? (
          <button className="btn btn--primary btn--big" onClick={() => setStep((step + 1) as 2 | 3)}>
            Continuar
            <small>{step === 1 ? 'traços e hábitos' : 'promessas de posse'}</small>
          </button>
        ) : (
          <button className="btn btn--primary btn--big" disabled={promises.length !== PROMISES_TO_PICK}
            onClick={() => onStart(name, diff, party, face, { traits, habits, promises })}>
            Tomar posse
            <small>{promises.length === PROMISES_TO_PICK ? '1º de janeiro de 2027' : `faltam ${PROMISES_TO_PICK - promises.length} promessas`}</small>
          </button>
        )}
        <button className="btn btn--big" onClick={step === 1 ? onCancel : () => setStep((step - 1) as 1 | 2)}>
          Voltar<small>{step === 1 ? 'ao menu' : 'passo anterior'}</small>
        </button>
      </div>
    </main>
  )
}
