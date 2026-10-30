import { useState } from 'react'
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

const ROADMAP = [
  { v: '0.1', label: 'Estrutura e atualização automática', done: true },
  { v: '0.2', label: 'Economia, grupos sociais e turno mensal', done: true },
  { v: '0.3', label: 'Congresso com 513 deputados', done: true },
  { v: '0.4', label: 'Fato do mês, cobranças e personagens', done: true },
  { v: '0.4.x', label: 'Mais medidas e nota final', done: false },
  { v: '0.5', label: 'Medidas em texto livre com IA', done: false },
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
          onStart={(name, diff, party, face) => {
            update(newGame(name, diff, undefined, party, String(face), face))
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

function NewGame({ hasSave, onCancel, onStart }: {
  hasSave: boolean
  onCancel: () => void
  onStart: (name: string, d: GameState['difficulty'], party: PartyId, face: number) => void
}) {
  const [name, setName] = useState('')
  const [diff, setDiff] = useState<GameState['difficulty']>('normal')
  const [party, setParty] = useState<PartyId>('mdn')
  const [face, setFace] = useState(() => PLAYER_POOL[Math.floor(Math.random() * PLAYER_POOL.length)])
  const [filter, setFilter] = useState<'todos' | 'f' | 'm'>('todos')
  return (
    <main className="home">
      <h1 className="newgame__title">Novo mandato</h1>
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
            <button key={p.id} className={`choice ${party === p.id ? 'choice--selected' : ''}`} onClick={() => setParty(p.id)}>
              <strong>{p.label}</strong>
              <small>{p.desc}</small>
            </button>
          ))}
        </div>
      </div>
      {hasSave && <p className="warning">Começar um novo mandato apaga o mandato salvo.</p>}
      <div className="home__menu">
        <button className="btn btn--primary btn--big" onClick={() => onStart(name, diff, party, face)}>
          Tomar posse
          <small>1º de janeiro de 2027</small>
        </button>
        <button className="btn btn--big" onClick={onCancel}>Voltar<small>ao menu</small></button>
      </div>
    </main>
  )
}
