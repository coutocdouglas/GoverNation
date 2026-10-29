import { UpdateBanner } from './components/UpdateBanner'

const ROADMAP = [
  { v: '0.1', label: 'Estrutura e atualização automática', done: true },
  { v: '0.2', label: 'Economia, grupos sociais e turno mensal', done: false },
  { v: '0.3', label: 'Congresso com 513 deputados', done: false },
  { v: '0.4', label: 'Medidas, crises e nota final', done: false },
  { v: '0.5', label: 'Medidas em texto livre com IA', done: false },
]

export default function App() {
  return (
    <>
      <UpdateBanner />
      <main className="home">
        <header className="home__header">
          <img src="/icon.png" alt="" className="home__logo" />
          <div>
            <h1>GoverNation</h1>
            <p className="home__tagline">Quatro anos. Um país. Cada decisão tem um preço.</p>
          </div>
        </header>

        <section className="home__menu">
          <button className="btn btn--primary btn--big" disabled>
            Novo mandato
            <small>disponível na versão 0.2</small>
          </button>
          <button className="btn btn--big" disabled>
            Continuar
            <small>nenhum mandato salvo</small>
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
    </>
  )
}
