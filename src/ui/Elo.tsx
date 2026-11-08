import { useId, useState } from 'react'
import { eloInfo, pessoaDe, type ContextoPessoa, type EloInfo } from '../game/risco'
import type { GameState } from '../game/types'

/**
 * Etapa 5A (v0.27.1): o Elo de reputação na tela. Só o que o público sabe (o metal e a divisão);
 * o risco oculto aparece apenas como pista em palavras (`eloTexto.ts`).
 */
const TIER_ICON: Record<EloInfo['tier'], string> = { Bronze: '🥉', Prata: '🥈', Ouro: '🥇', Platina: '💠', 'Sob suspeita': '⚠️' }
const TIER_CLS: Record<EloInfo['tier'], string> = { Bronze: 'bronze', Prata: 'prata', Ouro: 'ouro', Platina: 'platina', 'Sob suspeita': 'suspeita' }
const ELO_HINT = 'Elo de reputação: o que o público sabe da pessoa (imagem, competência e fama de honestidade). Cai rápido e sobe devagar.'

export function EloBadge({ info, small }: { info: EloInfo; small?: boolean }) {
  return (
    <span className={`pn-elo pn-elo--${TIER_CLS[info.tier]} ${small ? 'pn-elo--small' : ''}`} title={ELO_HINT}>
      {TIER_ICON[info.tier]} {info.label}
    </span>
  )
}

/** Elo de alguém pelo papel (a pessoa guardada, ou a padrão para quem ainda não foi guardado). */
export function EloOf({ state, name, ctx, small }: { state: GameState; name: string; ctx: ContextoPessoa; small?: boolean }) {
  return <EloBadge info={eloInfo(pessoaDe(state, name, ctx).nivel)} small={small} />
}

/** v0.31: explicação em palavras de cada metal, mostrada ao passar o mouse na foto. */
const TIER_WHY: Record<EloInfo['tier'], string> = {
  Platina: 'Reputação de primeira. Referência em honestidade e competência.',
  Ouro: 'Muito bem vista pelo público. Pouco a temer.',
  Prata: 'Respeitada, mas com ressalvas na imagem.',
  Bronze: 'Pouco conhecida ou com imagem frágil.',
  'Sob suspeita': 'A fama está em ruínas. Qualquer apoio a essa pessoa custa caro.',
}

/**
 * O Elo literal (v0.31): corrente de 12 elos em volta da foto, na cor do metal; "sob suspeita" é a corrente
 * rompida. Três pontinhos mostram a divisão. Ao passar o mouse, o Elo aparece por escrito.
 * O tamanho total é o da foto: a foto encolhe um pouco para caber dentro da corrente.
 */
export function EloRing({ info, size, children }: { info: EloInfo; size: number; children: React.ReactNode }) {
  const gid = useId().replace(/:/g, '')
  const cls = TIER_CLS[info.tier]
  const N = 12
  const lw = size * 0.17
  const lh = size * 0.095
  const links: React.ReactNode[] = []
  for (let i = 0; i < N; i++) {
    if (info.tier === 'Sob suspeita' && (i === 2 || i === 3)) continue
    const w = i % 2 === 0 ? lw : lw * 0.62
    links.push(
      <g key={i} transform={`rotate(${(i * 360) / N} ${size / 2} ${size / 2}) translate(${size / 2} ${size * 0.03 + lh / 2})`}>
        <rect x={-w / 2} y={-lh / 2} width={w} height={lh} rx={lh / 2} fill="none" stroke={`url(#${gid})`} strokeWidth={size * 0.035} />
      </g>,
    )
  }
  const inner = size * 0.78
  /** O texto abre em posição fixa para não ser cortado por listas com rolagem. */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ left: Math.min(Math.max(r.left + r.width / 2, 125), window.innerWidth - 125), top: r.bottom + 10 })
  }
  return (
    <span className={`pn-eloring pn-eloring--${cls}`} style={{ width: size, height: size }} onMouseEnter={onEnter} onMouseLeave={() => setPos(null)}>
      <svg className="pn-eloring__chain" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--t1)" /><stop offset="1" stopColor="var(--t2)" /></linearGradient>
        </defs>
        {links}
        {info.tier === 'Sob suspeita' && (
          <g transform={`rotate(75 ${size / 2} ${size / 2}) translate(${size / 2} ${size * 0.03 + lh / 2})`}>
            <path d={`M ${-lw / 2} 0 l ${lw * 0.22} ${-lh * 0.9} M ${lw / 2} 0 l ${-lw * 0.22} ${lh * 0.9}`} stroke="var(--t1)" strokeWidth={size * 0.03} strokeLinecap="round" fill="none" />
          </g>
        )}
      </svg>
      <span className="pn-eloring__ph" style={{ width: inner, height: inner }}>{children}</span>
      {size >= 48 && info.divisao && (
        <span className="pn-eloring__pips" aria-hidden="true">
          {[1, 2, 3].map((k) => <i key={k} className={k >= 4 - info.divisao! ? 'on' : ''} />)}
        </span>
      )}
      <span className="pn-eloring__tip" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : undefined}>
        <b><i />{info.label}</b>
        {TIER_WHY[info.tier]}
        <small>{ELO_HINT}</small>
      </span>
    </span>
  )
}

/** Elo de alguém pelo papel, para passar à foto (`<Portrait elo={...} />`). */
export function eloDe(state: GameState, name: string, ctx: ContextoPessoa): EloInfo {
  return eloInfo(pessoaDe(state, name, ctx).nivel)
}
