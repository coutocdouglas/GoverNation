import { castPortrait } from '../game/data/cast'
import { portraitSrc } from '../game/data/portraits'
import type { EloInfo } from '../game/risco'
import { Caricature } from './Caricature'
import { EloRing } from './Elo'

/**
 * Rosto de um personagem. Usa o retrato (por número ou pelo nome no elenco);
 * se não houver retrato, cai na caricatura provisória.
 * Com `elo`, a foto ganha a corrente do Elo em volta (v0.31).
 */
export function Portrait({ id, name, color = '#c9a227', size = 56, feminine, title, elo }: {
  id?: number
  name?: string
  color?: string
  size?: number
  feminine?: boolean
  title?: string
  elo?: EloInfo
}) {
  const pid = id ?? (name ? castPortrait(name) : undefined)
  if (elo) {
    const inner = Math.round(size * 0.78)
    const face = pid === undefined
      ? <Caricature seed={name ?? 'anon'} color={color} size={inner} feminine={feminine} title={title ?? name} />
      : <img className="portrait" src={portraitSrc(pid)} width={inner} height={inner} alt={title ?? name ?? 'Retrato'} style={{ borderColor: 'transparent' }} draggable={false} />
    return <EloRing info={elo} size={size}>{face}</EloRing>
  }
  if (pid === undefined) return <Caricature seed={name ?? 'anon'} color={color} size={size} feminine={feminine} title={title ?? name} />
  return (
    <img
      className="portrait"
      src={portraitSrc(pid)}
      width={size}
      height={size}
      alt={title ?? name ?? 'Retrato'}
      title={title ?? name}
      style={{ borderColor: color }}
      draggable={false}
    />
  )
}
