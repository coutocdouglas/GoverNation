import type { GroupId } from '../types'

/**
 * Etapa 5A: ficha do candidato. Traços e hábitos do presidente, escolhidos na posse.
 * Cada um mexe pouco no ânimo de cada grupo (ajuste permanente, em pontos de aprovação)
 * e sempre tem quem perde. Nomes e textos nossos.
 */
export interface ProfileItemDef {
  id: string
  kind: 'traco' | 'habito'
  name: string
  desc: string
  groups: Partial<Record<GroupId, number>>
}

export const MAX_TRAITS = 2
export const MAX_HABITS = 2

export const TRAITS: ProfileItemDef[] = [
  { id: 'conciliador', kind: 'traco', name: 'Conciliador', desc: 'Senta com todo mundo antes de decidir. Agrada quem quer calma; os jovens acham que você cede demais.', groups: { classeMedia: 1.5, empresarios: 1, jovens: -1.5 } },
  { id: 'combativo', kind: 'traco', name: 'Combativo', desc: 'Compra briga em público e não recua. Anima a juventude e os sindicatos; o mercado fica tenso.', groups: { jovens: 2, trabalhadores: 1, empresarios: -2, classeMedia: -1 } },
  { id: 'tecnico', kind: 'traco', name: 'Técnico', desc: 'Fala com planilha na mão. O mercado leva a sério; nas periferias soa distante.', groups: { empresarios: 2, classeMedia: 1, baixaRenda: -1.5 } },
  { id: 'carismatico', kind: 'traco', name: 'Carismático', desc: 'Lota praça e vira meme bom. O povo gosta; o mercado desconfia de quem só fala.', groups: { baixaRenda: 1.5, jovens: 1, empresarios: -1.5 } },
  { id: 'austero', kind: 'traco', name: 'Austero', desc: 'Corta cafezinho do Planalto e manda dar o exemplo. Agrada o mercado e o campo; o funcionalismo se arrepia.', groups: { empresarios: 2, agro: 1, servidores: -1.5, baixaRenda: -1 } },
  { id: 'genteComoAGente', kind: 'traco', name: 'Gente como a gente', desc: 'Pega fila, come no boteco, fala sem rodeio. A base adora; a classe média torce o nariz.', groups: { baixaRenda: 2, trabalhadores: 1, classeMedia: -1.5 } },
  { id: 'linhaDura', kind: 'traco', name: 'Linha dura', desc: 'Fala grosso sobre crime e ordem. O campo e parte da classe média aplaudem; os jovens não.', groups: { classeMedia: 1.5, agro: 1.5, jovens: -2 } },
  { id: 'servidorDeCarreira', kind: 'traco', name: 'Servidor de carreira', desc: 'Passou em concurso e conhece a máquina por dentro. O funcionalismo confia; o mercado teme mais gasto.', groups: { servidores: 2, empresarios: -1 } },
]

export const HABITS: ProfileItemDef[] = [
  { id: 'pelada', kind: 'habito', name: 'Pelada de domingo', desc: 'Joga bola com os amigos de infância. Simpático para o trabalhador.', groups: { trabalhadores: 1, empresarios: -0.5 } },
  { id: 'feira', kind: 'habito', name: 'Feira de sábado', desc: 'Faz a própria feira e pechincha. Pega bem com quem conta moeda.', groups: { baixaRenda: 1, empresarios: -0.5 } },
  { id: 'pescaria', kind: 'habito', name: 'Pescaria no interior', desc: 'Some para o rio no feriado. O campo se identifica; os jovens acham parado.', groups: { agro: 1, jovens: -0.5 } },
  { id: 'corrida', kind: 'habito', name: 'Corrida de rua', desc: 'Corre 10 km antes do expediente. A classe média aprova; quem pega dois ônibus acha que é tempo sobrando.', groups: { classeMedia: 1, baixaRenda: -0.5 } },
  { id: 'lives', kind: 'habito', name: 'Lives toda semana', desc: 'Conversa com o público pelas redes toda quinta. A juventude acompanha; o funcionalismo acha amador.', groups: { jovens: 1.5, servidores: -0.5 } },
  { id: 'viola', kind: 'habito', name: 'Viola caipira', desc: 'Toca viola em festa do interior. O campo adora; a juventude urbana estranha.', groups: { agro: 1, jovens: -0.5 } },
  { id: 'leitorEconomia', kind: 'habito', name: 'Leitor de economia', desc: 'Lê relatório de banco no café da manhã. O mercado gosta; o chão de fábrica nem tanto.', groups: { empresarios: 1, trabalhadores: -0.5 } },
  { id: 'horta', kind: 'habito', name: 'Horta comunitária', desc: 'Cuida de uma horta no bairro. Os jovens curtem; o agronegócio vê recado.', groups: { jovens: 1, agro: -0.5 } },
]

export const PROFILE_ITEMS: ProfileItemDef[] = [...TRAITS, ...HABITS]
export const PROFILE_BY_ID = Object.fromEntries(PROFILE_ITEMS.map((p) => [p.id, p])) as Record<string, ProfileItemDef>
