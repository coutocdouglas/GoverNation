import type { AreaId } from './ministers'

/**
 * Etapa 6, bloco 6E, parte 2 (v0.38): ministérios com vida. Troca de ministro a cada 3 meses, interino que pode ser
 * efetivado, reforma ministerial (ação de agenda) e "a pasta está em jogo". Todos os números moram aqui.
 * Plano: docs/projeto/plano-etapa-6.md; DESIGN.md 27.36.
 */
export const PASTAS = {
  /** Ligado desde as telas (v0.38.1). Testes e simulador podem usar `ligarPastas`. */
  ativo: true,
  /**
   * Meses entre trocas de ministro (trocar de partido, retomar uma pasta cedida ou fazer a reforma). Ceder a pasta
   * de um interino a um partido não conta como troca e vale a qualquer momento; efetivar o interino também não.
   */
  intervaloTroca: 3,
  /** Interino efetivado: segura pior a crise da área (o desgaste do fato ignorado ou travado sobe nesta proporção). */
  efetivar: { crise: 1.5 },
  /** Reforma ministerial: troca até `maxPastas` de uma vez, no lugar da medida do mês. */
  reforma: {
    maxPastas: 3,
    /** Gesto de renovação: cada pasta desgastada trocada rende este ganho na classe média, até o teto; cada reforma nos últimos 12 meses corta o ganho pela metade. */
    renovacao: { grupo: 'classeMedia', ganho: 0.4, teto: 1, decai: 0.5, janela: 12 },
  },
  /** "A pasta está em jogo": o partido que ocupa uma pasta cobra no Planalto (um por vez). */
  jogo: {
    intervalo: 3,
    duracao: 2,
    /** Abre se o ministro cedido passou deste desgaste ou a fidelidade do partido caiu abaixo disto. */
    desgasteDesde: 60,
    fidelidadeAbaixo: 40,
    chance: 0.4,
    respostas: {
      /** Emendas por 3 meses (o valor do acordo de emendas do partido), conversa da rodada, fidelidade e desgaste. */
      renegociar: { fidelidade: 15, desgaste: -12, relacao: 3, conversas: 1 },
    },
    /** Sem resposta até o fim do prazo. Com a fidelidade abaixo de `entregaAbaixo`, o partido entrega a pasta e sai da base. */
    ignorada: { fidelidade: -12, relacao: -5, entregaAbaixo: 25, rival: 0.5 },
  },
  guardar: 12,
} as const

let ligada: boolean = PASTAS.ativo
/** Liga ou desliga o bloco 6E (parte 2) inteiro (testes e simulador, até as telas da v0.38.1). */
export const ligarPastas = (v: boolean) => { ligada = v }
export const pastasLigadas = () => ligada

export type RespostaPasta = 'renegociar' | 'retirar'
export type { AreaId }
