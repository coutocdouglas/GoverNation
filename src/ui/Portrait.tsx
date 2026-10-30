import { castPortrait } from '../game/data/cast'
import { portraitSrc } from '../game/data/portraits'
import { Caricature } from './Caricature'

/**
 * Rosto de um personagem. Usa o retrato (por número ou pelo nome no elenco);
 * se não houver retrato, cai na caricatura provisória.
 */
export function Portrait({ id, name, color = '#c9a227', size = 56, feminine, title }: {
  id?: number
  name?: string
  color?: string
  size?: number
  feminine?: boolean
  title?: string
}) {
  const pid = id ?? (name ? castPortrait(name) : undefined)
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
