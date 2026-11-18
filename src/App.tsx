import { useState } from 'react'
import { UpdateBanner } from './components/UpdateBanner'
import { monthLabel, newGame } from './game/game'
import { deleteSave, loadGame, saveGame } from './game/save'
import type { GameState } from './game/types'
import { EndScreen } from './ui/EndScreen'
import { GameScreen } from './ui/GameScreen'
import { PosseReveal } from './ui/PosseReveal'
import { NovoMandato } from './ui/NovoMandato'

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


type Screen = 'home' | 'new' | 'posse' | 'game'

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
        <NovoMandato
          hasSave={!!game && !game.finished}
          onCancel={() => setScreen('home')}
          onStart={(name, diff, party, face, posse) => {
            update(newGame(name, diff, undefined, party, String(face), face, posse))
            setScreen('posse')
          }}
        />
      )}
      {screen === 'posse' && game && (
        <PosseReveal state={game} onContinue={() => setScreen('game')} />
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
