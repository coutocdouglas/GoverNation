import { useState } from 'react'
import { ART, type ArtId } from './art'

/** Ilustração de um slot (etapa 0). Sem arquivo em public/art, mostra o placeholder com ícone e descrição. */
export function Art({ slot, height = 90, caption }: { slot: ArtId; height?: number; caption?: string }) {
  const a = ART[slot]
  const [missing, setMissing] = useState(false)
  const src = `${import.meta.env.BASE_URL}art/${slot}.${'ext' in a ? a.ext : 'webp'}`
  return (
    <div className={`pn-art ${missing ? 'pn-art--ph' : ''}`} style={{ height, aspectRatio: undefined }} title={missing ? `Ilustração provisória: ${a.desc} (arquivo public/art/${slot}.webp)` : a.desc}>
      {!missing && <img src={src} alt={a.desc} onError={() => setMissing(true)} />}
      {missing && <><span className="pn-art__icon">{a.icon}</span><small>{caption ?? a.desc}</small></>}
    </div>
  )
}
