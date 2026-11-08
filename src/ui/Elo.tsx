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
