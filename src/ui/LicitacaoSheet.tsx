import { useState } from 'react'
import { BILL_BY_ID, GDP_BILLIONS } from '../game/data/bills'
import { CONTRATO, type PerfilEmpresa } from '../game/data/risco'
import { absMonth } from '../game/memory'
import { contratoDe, custoEmpresa, licitacoesAbertas, prazoLicitacao } from '../game/risco'
import type { BillId, GameState } from '../game/types'
import { num } from './format'

/** % do PIB ao ano durante N meses → R$ bi no contrato inteiro. */
const bi = (pctPib: number, months: number) => num((pctPib * GDP_BILLIONS * months) / 1200, 1)

/**
 * v0.27.2: a licitação de uma medida que passou a valer. O presidente escolhe quem executa, com o custo de cada
 * empresa à vista (em reais, no contrato inteiro). A de sempre vem marcada. O risco da empresa não aparece em número.
 */
export function LicitacaoSheet({ state, id, onClose, onChoose }: { state: GameState; id: BillId; onClose: () => void; onChoose: (perfil: PerfilEmpresa) => void }) {
  const lic = licitacoesAbertas(state).find((l) => l.bill === id)
  const [perfil, setPerfil] = useState<PerfilEmpresa>('padrao')
  if (!lic) return null
  const b = BILL_BY_ID[id]
  const c = contratoDe(b)
  const left = prazoLicitacao(lic) - absMonth(state)
  const months = c?.months ?? 12
  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <div className="pn-kicker">🏗️ Licitação · {left <= 0 ? 'vence ao encerrar este mês' : `vence ao encerrar o mês que vem`}</div>
        <h2>{b.name}</h2>
        {c && (
          <p className="pn-hint">
            A medida já vale e contrata cerca de <b>R$ {bi(c.amount, c.months)} bi em {c.months} meses</b>. Escolha quem executa.
            Sem escolha no prazo, fica a empresa de sempre, pelo preço de mercado.
          </p>
        )}
        <div className="pn-empresas">
          {lic.empresas.map((e) => {
            const extra = custoEmpresa(b, e)
            return (
              <button key={e.perfil} type="button" className={`pn-empresa ${perfil === e.perfil ? 'on' : ''}`} onClick={() => setPerfil(e.perfil)}>
                <span>{perfil === e.perfil ? '🔘' : '⚪'}</span>
                <span><b>{e.nome}</b> · {CONTRATO.perfis[e.perfil].rotulo.toLowerCase()}<small>{e.desc}{e.perfil === 'aliada' ? ' ⚠️ Deixa rastro em você.' : ''}</small></span>
                <span className={`pn-empresa__custo ${extra > 0 ? 'dn' : extra < 0 ? 'up' : ''}`}>{extra > 0 ? `+R$ ${bi(extra, months)} bi no contrato` : extra < 0 ? `economia de R$ ${bi(-extra, months)} bi` : 'preço de mercado'}</span>
              </button>
            )
          })}
        </div>
        <p className="pn-hint">A escolha vale na hora e fica na Ficha de governo. Empresa barata ou ligada a aliado pode virar problema no futuro; a de primeira linha custa mais e quase nunca dá dor de cabeça.</p>
        <div className="pn-sheet__foot">
          <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onClose}>Decidir depois</button>
          <button className="pn-btn pn-btn--big" onClick={() => onChoose(perfil)}>🖊️ Assinar o contrato</button>
        </div>
      </div>
    </aside>
  )
}
