/**
 * Etapa 0 (v0.15): ilustrações do jogo.
 *
 * Cada lugar da interface que vai ter uma ilustração tem um "slot" com nome, tamanho e descrição.
 * Enquanto o arquivo não existe, aparece um placeholder com o ícone e a descrição.
 * Para trocar pela arte de verdade: salve a imagem em `public/art/<slot>.webp` (ou .png, mudando `ext`)
 * com a proporção indicada. Não precisa mexer em mais nada.
 */
export interface ArtSlot {
  /** Descrição do que a ilustração deve mostrar (vai no placeholder e no LEIAME). */
  desc: string
  /** Ícone provisório. */
  icon: string
  /** Proporção largura/altura. */
  ratio: number
  ext?: 'webp' | 'png' | 'jpg'
}

export const ART = {
  'rodada': { icon: '🗓️', ratio: 4, desc: 'Faixa da rodada: o Planalto ao amanhecer, com a agenda do presidente na mesa' },
  'camara-plenario': { icon: '🏛️', ratio: 3, desc: 'Plenário da Câmara cheio, painel de votação aceso ao fundo' },
  'senado-plenario': { icon: '🏛️', ratio: 3, desc: 'Plenário do Senado (mesa azul, cadeiras em semicírculo)' },
  'supremo-plenario': { icon: '⚖️', ratio: 3, desc: 'Plenário do Supremo: 11 cadeiras, togas pretas, brasão ao fundo' },
  'gaveta': { icon: '🗄️', ratio: 1.5, desc: 'Gaveta de arquivo entreaberta com um projeto de lei dentro (projeto parado)' },
  'medida-enviada': { icon: '📨', ratio: 1.5, desc: 'Envelope oficial com o brasão saindo do Planalto (medida enviada)' },
  'fim-de-mes': { icon: '🌙', ratio: 4, desc: 'Esplanada à noite, luzes do Planalto acesas (fechando o mês)' },
} satisfies Record<string, ArtSlot>

export type ArtId = keyof typeof ART
