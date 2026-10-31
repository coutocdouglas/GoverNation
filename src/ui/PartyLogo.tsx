import { useState } from 'react'
import { PARTY_BY_ID } from '../game/data/parties'
import type { PartyId } from '../game/types'

/**
 * Logo do partido (arte do Douglas, em public/logos/<id>.webp). Sem o arquivo, um selo redondo
 * com a cor e a sigla do partido.
 */
export function PartyLogo({ party, size = 28, title }: { party: PartyId; size?: number; title?: string }) {
  const p = PARTY_BY_ID[party]
  const [missing, setMissing] = useState(false)
  const label = title ?? `${p.name} (${p.sigla} ${p.number})`
  if (missing) {
    return (
      <span className="pn-logo-ph" title={label} style={{ width: size, height: size, background: p.color, fontSize: Math.max(8, size * 0.3) }}>{p.sigla}</span>
    )
  }
  return <img className="pn-plogo" src={`${import.meta.env.BASE_URL}logos/${party}.webp`} alt={p.sigla} title={label} width={size} height={size} onError={() => setMissing(true)} />
}
