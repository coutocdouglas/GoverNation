import type { ChainInfo } from './corrente'

/**
 * Etapa 2B (v0.19): a corrente de janelas do dia. Cada janela mostra "Etapa N de M" e a trilha inteira:
 * Leitura → Ficha → (Votação → Placar) → (Supremo) → O país reage. Decreto e MP não votam agora;
 * o Supremo só entra quando a medida tem risco jurídico (sem risco, ninguém gasta uma ação).
 */
export function ChainSteps({ chain }: { chain?: ChainInfo | null }) {
  if (!chain) return null
  return (
    <div className="pn-chain">
      <div className="pn-chain__n">Etapa {chain.idx + 1} de {chain.labels.length} · <b>{chain.labels[chain.idx]}</b></div>
      <div className="pn-steps3">
        {chain.labels.map((l, i) => <span key={l} className={i === chain.idx ? 'on' : i < chain.idx ? 'ok' : ''}>{i < chain.idx ? '✓ ' : ''}{l}</span>)}
      </div>
    </div>
  )
}
