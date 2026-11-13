/**
 * Etapa 6, bloco 6C (v0.35): a pesquisa encomendada e a leitura dos grupos entre pesquisas.
 *
 * Gasta agenda e dinheiro e não entra no lugar da medida. A aprovação geral segue sempre visível; os grupos
 * aparecem em faixa com seta e, depois de uma pesquisa, com número e margem de erro. Números em data/credibilidade.ts.
 */
import { credibOf } from './credibilidade'
import { credibilidadeLigada, PESQUISA, type NivelPesquisa } from './data/credibilidade'
import { GROUPS, type BlocoId } from './data/groups'
import { absMonth } from './memory'
import type { Rng } from './rng'
import type { Economy, GameState, GroupId, Headline } from './types'

export function pesquisaBlockedReason(s: GameState, nivel: NivelPesquisa): string | null {
  if (!credibilidadeLigada()) return 'Pesquisas ainda não estão disponíveis.'
  if (s.finished) return 'O mandato já terminou.'
  if (!PESQUISA.niveis[nivel]) return 'Tipo de pesquisa desconhecido.'
  return null
}

/** Paga a pesquisa (antes de a economia andar). */
export function pagarPesquisa(nivel: NivelPesquisa, e: Economy, taken: string[]): void {
  const n = PESQUISA.niveis[nivel]
  e.tempSpending.push({ label: n.nome, amount: n.pctPib, monthsLeft: n.meses })
  taken.push(`Encomendou: ${n.nome.toLowerCase()}`)
}

/** Faz a pesquisa com os grupos já fechados: o erro nunca passa da margem, e o miolo é mais provável que as pontas. */
export function fazerPesquisa(s: GameState, nivel: NivelPesquisa, rng: Rng, headlines: Headline[]): void {
  const { margem, nome } = PESQUISA.niveis[nivel]
  const grupos = Object.fromEntries(GROUPS.map((g) => {
    const erro = ((rng.next() + rng.next()) / 2 - 0.5) * 2 * margem
    return [g.id, Math.round(Math.max(0, Math.min(100, s.groups[g.id].approval + erro)))]
  })) as Record<GroupId, number>
  const cr = credibOf(s)
  cr.pesquisas.push({ at: absMonth(s), nivel, margem, grupos })
  if (cr.pesquisas.length > PESQUISA.guardar) cr.pesquisas.splice(0, cr.pesquisas.length - PESQUISA.guardar)
  headlines.push({ text: `${nome} do governo chega à mesa do presidente: margem de ${margem} pontos`, tone: 'neutral' })
}

export interface LeituraGrupo {
  faixa: string
  seta: 'sobe' | 'cai' | 'parado'
  /** Última pesquisa, com a idade em meses. */
  pesquisa?: { valor: number; margem: number; idade: number }
}

/** O que o presidente sabe de um grupo: faixa e tendência sempre; número só com pesquisa. */
export function leituraGrupo(s: GameState, g: GroupId): LeituraGrupo {
  const real = s.groups[g].approval
  const faixa = PESQUISA.faixas.find(([ate]) => real < ate)![1]
  const h = s.history
  const antes = h[Math.max(0, h.length - 1 - PESQUISA.seta.meses)].groups[g]
  const dif = h[h.length - 1].groups[g] - antes
  const seta = dif >= PESQUISA.seta.minimo ? 'sobe' : dif <= -PESQUISA.seta.minimo ? 'cai' : 'parado'
  const ult = s.credib?.pesquisas.at(-1)
  return { faixa, seta, pesquisa: ult ? { valor: ult.grupos[g], margem: ult.margem, idade: absMonth(s) - ult.at } : undefined }
}

/**
 * Etapa 6G, H3 (v0.46): a leitura de um bloco de grupos (média pelo tamanho), no mesmo formato da leitura do grupo:
 * faixa e tendência sempre; número só com pesquisa.
 */
export function leituraBloco(s: GameState, bloco: BlocoId): LeituraGrupo {
  const gs = GROUPS.filter((g) => g.bloco === bloco)
  const peso = gs.reduce((a, g) => a + g.weight, 0) || 1
  const media = (f: (id: GroupId) => number | undefined) => gs.reduce((a, g) => a + g.weight * (f(g.id) ?? 50), 0) / peso
  const real = media((id) => s.groups[id]?.approval)
  const faixa = PESQUISA.faixas.find(([ate]) => real < ate)![1]
  const h = s.history
  const dif = media((id) => h[h.length - 1].groups[id]) - media((id) => h[Math.max(0, h.length - 1 - PESQUISA.seta.meses)].groups[id])
  const seta = dif >= PESQUISA.seta.minimo ? 'sobe' : dif <= -PESQUISA.seta.minimo ? 'cai' : 'parado'
  const ult = s.credib?.pesquisas.at(-1)
  return { faixa, seta, pesquisa: ult ? { valor: Math.round(media((id) => ult.grupos[id])), margem: ult.margem, idade: absMonth(s) - ult.at } : undefined }
}

/** O grupo do bloco que está pior (o que a tela destaca). */
export function piorDoBloco(s: GameState, bloco: BlocoId): GroupId {
  return GROUPS.filter((g) => g.bloco === bloco).sort((a, b) => (s.groups[a.id]?.approval ?? 50) - (s.groups[b.id]?.approval ?? 50))[0].id
}
