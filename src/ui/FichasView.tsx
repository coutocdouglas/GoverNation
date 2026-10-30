import { useState } from 'react'
import { CAST, castPortrait, playerPortraitId } from '../game/data/cast'
import { PROFILE_BY_ID } from '../game/data/profile'
import { RIVALS } from '../game/data/rival'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { yearOf } from '../game/memory'
import type { GameState } from '../game/types'
import { Portrait } from './Portrait'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`

/** Fichas dos personagens (biografia acumulada) e memória do país. */
export function FichasView({ state }: { state: GameState }) {
  const people = [
    { name: state.presidentName, role: `Presidente da República (${PARTY_BY_ID[state.playerParty].sigla})`, portrait: playerPortraitId(state), color: PARTY_BY_ID[state.playerParty].color },
    // Só o rival deste mandato aparece; o outro líder de oposição fica de fora.
    ...CAST.filter((c) => (!RIVALS.some((r) => r.name === c.name) || c.name === state.rival?.name) && (!c.role.startsWith('Indicável') || state.bios[c.name]?.length)).map((c) => {
      const party = PARTIES.find((p) => p.leader.name === c.name) ?? (c.name === state.rival?.name ? PARTY_BY_ID[state.rival.party] : undefined)
      return { name: c.name, role: c.name === state.rival?.name ? `Líder da oposição (${PARTY_BY_ID[state.rival.party].sigla})` : c.role, portrait: castPortrait(c.name) ?? c.portrait, color: party?.color ?? '#8a97a8' }
    }),
  ].sort((a, b) => (state.bios[b.name]?.length ?? 0) - (state.bios[a.name]?.length ?? 0))
  const [sel, setSel] = useState(people[0].name)
  const person = people.find((p) => p.name === sel) ?? people[0]
  const bio = [...(state.bios[person.name] ?? [])].reverse()

  return (
    <div className="pn-grid">
      <div className="pn-col">
        <section className="pn-card">
          <h3>📇 Ficha de {person.name}</h3>
          <div className="pn-ficha__head">
            <Portrait id={person.portrait} color={person.color} size={110} title={person.name} />
            <div>
              <h2>{person.name}</h2>
              <p className="pn-hint">{person.role}</p>
              {person.name === state.presidentName && (state.profile?.traits.length || state.profile?.habits.length) ? (
                <div className="pn-ficha__traits">
                  {[...state.profile.traits, ...state.profile.habits].map((id) => PROFILE_BY_ID[id]).filter(Boolean).map((p) => (
                    <span key={p.id} title={p.desc}>{p.kind === 'traco' ? '🧭' : '☕'} {p.name}</span>
                  ))}
                </div>
              ) : null}
              {person.name === state.rival?.name && <p className="pn-hint">{RIVALS.find((r) => r.name === person.name)?.blurb} Força {Math.round(state.rival.strength)}/100.</p>}
              <p className="pn-hint">{bio.length} {bio.length === 1 ? 'registro' : 'registros'} na ficha. A ficha acumulada é a base da escolha de candidatos na eleição.</p>
            </div>
          </div>
          {bio.length === 0 ? (
            <p className="pn-hint">Ainda não fez nada que tenha ficado registrado.</p>
          ) : (
            <ol className="pn-bio">
              {bio.map((b, i) => <li key={i}><span className="pn-bio__when">{when(b.at)}</span>{b.text}</li>)}
            </ol>
          )}
        </section>
      </div>
      <div className="pn-col">
        <section className="pn-card">
          <h3>👥 Personagens</h3>
          <div className="pn-people">
            {people.map((p) => (
              <button key={p.name} className={`pn-person ${p.name === person.name ? 'on' : ''}`} onClick={() => setSel(p.name)}>
                <Portrait id={p.portrait} color={p.color} size={40} />
                <span><b>{p.name}</b><small>{p.role}</small></span>
                <span className="pn-person__n">{state.bios[p.name]?.length ?? 0}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="pn-card">
          <h3>📜 Memória do país</h3>
          <p className="pn-hint">🌱 {state.world.seeds.length} consequências de decisões passadas ainda vão brotar. Algumas serão boas, outras não.</p>
          <ol className="pn-bio">
            {[...state.world.chronicle].reverse().slice(0, 40).map((c, i) => (
              <li key={i} className={c.tone}><span className="pn-bio__when">{when(c.at)}</span>{c.text}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
