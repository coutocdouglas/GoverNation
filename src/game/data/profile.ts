import type { GroupId } from '../types'
import type { BlocoId } from './groups'

/**
 * Etapa 5A: ficha do candidato. Traços e hábitos do presidente, escolhidos na posse.
 * Cada um mexe pouco no ânimo de cada grupo (ajuste permanente, em pontos de aprovação)
 * e sempre tem quem perde. Nomes e textos nossos.
 * v0.48.1: 14 traços e 14 hábitos, cada um ligado a um dos 5 blocos da sociedade (filtro da tela),
 * com efeito escrito para os 32 grupos. Os ids antigos continuam valendo (saves).
 */
export interface ProfileItemDef {
  id: string
  kind: 'traco' | 'habito'
  /** v0.48.1: bloco da sociedade a que o item fala mais (filtro do passo Perfil). */
  bloco: BlocoId
  name: string
  desc: string
  groups: Partial<Record<GroupId, number>>
}

export const MAX_TRAITS = 2
export const MAX_HABITS = 2

export const TRAITS: ProfileItemDef[] = [
  { id: 'conciliador', kind: 'traco', bloco: 'trabalho', name: 'Conciliador', desc: 'Senta com todo mundo antes de decidir. Agrada quem quer calma; os jovens acham que você cede demais.', groups: { classeMedia: 1.5, empresarios: 1, catolicos: 1, jovens: -2 } },
  { id: 'genteComoAGente', kind: 'traco', bloco: 'trabalho', name: 'Gente como a gente', desc: 'Pega fila, come no boteco, fala sem rodeio. A periferia adora; a classe média torce o nariz.', groups: { baixaRenda: 2, aplicativos: 1, classeMedia: -1.5 } },
  { id: 'servidorDeCarreira', kind: 'traco', bloco: 'trabalho', name: 'Servidor de carreira', desc: 'Passou em concurso e conhece a máquina por dentro. Servidores e professores confiam; o empresário teme mais gasto.', groups: { servidores: 2, professores: 1, empresarios: -1 } },
  { id: 'devoto', kind: 'traco', bloco: 'fe', name: 'Religioso praticante', desc: 'Fala de Deus sem constrangimento. As igrejas se aproximam; jovens, universitários e o LGBT+ se afastam.', groups: { evangelicos: 1.2, catolicos: 1, jovens: -1, universitarios: -1, lgbt: -1.5 } },
  { id: 'ecumenico', kind: 'traco', bloco: 'fe', name: 'Ecumênico', desc: 'Abre a porta para todas as religiões. Os terreiros e os católicos gostam; parte dos evangélicos estranha.', groups: { afro: 2, catolicos: 1, evangelicos: -1 } },
  { id: 'ruralista', kind: 'traco', bloco: 'campo', name: 'Filho do campo', desc: 'Cresceu entre pasto e silo. O agro, a roça e os caminhoneiros se identificam; os ambientalistas desconfiam.', groups: { agro: 2, agriculturaFamiliar: 1.5, caminhoneiros: 1, ambientalistas: -2 } },
  { id: 'verde', kind: 'traco', bloco: 'campo', name: 'Voz da floresta', desc: 'Defende rio, mata e quem vive nela. Indígenas, ribeirinhos e ambientalistas aplaudem; o agronegócio vê ameaça.', groups: { indigenas: 2, tradicionais: 2, ambientalistas: 2, agro: -2 } },
  { id: 'combativo', kind: 'traco', bloco: 'identidade', name: 'Combativo', desc: 'Compra briga em público e não recua. Anima a juventude e os sindicatos; o mercado fica tenso.', groups: { jovens: 2, sindicalistas: 1.5, empresarios: -2, mercado: -1 } },
  { id: 'carismatico', kind: 'traco', bloco: 'identidade', name: 'Carismático', desc: 'Lota praça e vira meme bom. O povo e a internet gostam; o mercado desconfia de quem só fala.', groups: { baixaRenda: 1.5, digital: 1.5, mercado: -1.5 } },
  { id: 'militante', kind: 'traco', bloco: 'identidade', name: 'Militante histórico', desc: 'Vem de movimento social. Movimento negro, mulheres e LGBT+ se veem no governo; os militares não.', groups: { negros: 1.5, mulheres: 1.5, lgbt: 1, militares: -1.5 } },
  { id: 'tecnico', kind: 'traco', bloco: 'capital', name: 'Técnico', desc: 'Fala com planilha na mão. O empresário, o mercado e a ciência levam a sério; nas periferias soa distante.', groups: { empresarios: 2, mercado: 1.5, ciencia: 1, baixaRenda: -1.5 } },
  { id: 'austero', kind: 'traco', bloco: 'capital', name: 'Austero', desc: 'Corta cafezinho do Planalto e manda dar o exemplo. Agrada o mercado e o campo; o funcionalismo se arrepia.', groups: { mercado: 2, agro: 1, servidores: -1.5, sindicalistas: -1 } },
  { id: 'linhaDura', kind: 'traco', bloco: 'capital', name: 'Linha dura', desc: 'Fala grosso sobre crime e ordem. Policiais, militares e o campo aplaudem; os jovens e o LGBT+ não.', groups: { policiais: 2, militares: 1.5, agro: 1, jovens: -2, lgbt: -1 } },
  { id: 'academico', kind: 'traco', bloco: 'capital', name: 'Acadêmico', desc: 'Chega com tese e estudo na mão. Universidades e professores gostam; o policial acha teoria demais.', groups: { universitarios: 2, ciencia: 2, professores: 1, policiais: -1 } },
]

export const HABITS: ProfileItemDef[] = [
  { id: 'pelada', kind: 'habito', bloco: 'trabalho', name: 'Pelada de domingo', desc: 'Joga bola com os amigos de infância. Simpático para o trabalhador.', groups: { trabalhadores: 1, caminhoneiros: 0.5, empresarios: -0.5 } },
  { id: 'feira', kind: 'habito', bloco: 'trabalho', name: 'Feira de sábado', desc: 'Faz a própria feira e pechincha. Pega bem com quem conta moeda.', groups: { baixaRenda: 1, aposentados: 0.5, mercado: -0.5 } },
  { id: 'estrada', kind: 'habito', bloco: 'trabalho', name: 'Boleia de caminhão', desc: 'Viaja de carona na cabine para ouvir a estrada. Caminhoneiros e motoristas de aplicativo gostam; o ambientalista torce o nariz.', groups: { caminhoneiros: 1.5, aplicativos: 0.8, ambientalistas: -0.5 } },
  { id: 'culto', kind: 'habito', bloco: 'fe', name: 'Culto de domingo', desc: 'Não perde o culto da própria igreja. Os evangélicos notam; jovens e LGBT+ ficam com um pé atrás.', groups: { evangelicos: 1, jovens: -0.5, lgbt: -0.5 } },
  { id: 'missa', kind: 'habito', bloco: 'fe', name: 'Missa das sete', desc: 'Vai à missa e acende vela. Católicos e aposentados se identificam; os jovens acham antigo.', groups: { catolicos: 1.2, aposentados: 0.3, jovens: -0.5 } },
  { id: 'terreiro', kind: 'habito', bloco: 'fe', name: 'Festa no terreiro', desc: 'Aparece em festa de matriz africana. Terreiros e movimento negro valorizam; parte dos evangélicos reclama.', groups: { afro: 1.5, negros: 0.8, evangelicos: -0.8 } },
  { id: 'pescaria', kind: 'habito', bloco: 'campo', name: 'Pescaria no interior', desc: 'Some para o rio no feriado. O campo e os ribeirinhos se identificam; os jovens acham parado.', groups: { agro: 1, tradicionais: 0.5, jovens: -0.5 } },
  { id: 'viola', kind: 'habito', bloco: 'campo', name: 'Viola caipira', desc: 'Toca viola em festa do interior. O campo adora; a juventude urbana estranha.', groups: { agro: 1, agriculturaFamiliar: 0.8, jovens: -0.5 } },
  { id: 'horta', kind: 'habito', bloco: 'campo', name: 'Horta comunitária', desc: 'Cuida de uma horta no bairro. A agricultura familiar e os ambientalistas curtem; o agronegócio vê recado.', groups: { agriculturaFamiliar: 1, ambientalistas: 0.8, agro: -0.5 } },
  { id: 'lives', kind: 'habito', bloco: 'identidade', name: 'Lives toda semana', desc: 'Conversa com o público pelas redes toda quinta. A juventude e a internet acompanham; o funcionalismo acha amador.', groups: { jovens: 1.5, digital: 1.5, servidores: -0.5 } },
  { id: 'corrida', kind: 'habito', bloco: 'identidade', name: 'Corrida de rua', desc: 'Corre 10 km antes do expediente. A classe média aprova; quem pega dois ônibus acha que é tempo sobrando.', groups: { classeMedia: 1, profSaude: 0.5, baixaRenda: -0.5 } },
  { id: 'batalha', kind: 'habito', bloco: 'identidade', name: 'Batalha de rima', desc: 'Aparece em batalha de MC e sarau de periferia. Jovens, artistas e movimento negro gostam; os militares acham demais.', groups: { jovens: 1, artistas: 1, negros: 0.8, militares: -0.5 } },
  { id: 'leitorEconomia', kind: 'habito', bloco: 'capital', name: 'Leitor de economia', desc: 'Lê relatório de banco no café da manhã. O mercado gosta; o chão de fábrica nem tanto.', groups: { empresarios: 1, mercado: 1, trabalhadores: -0.5 } },
  { id: 'bastidor', kind: 'habito', bloco: 'capital', name: 'Café com a bancada', desc: 'Toda manhã toma café com deputado. Empresários veem um presidente que negocia; os sindicatos veem conchavo.', groups: { empresarios: 0.5, comerciarios: 0.5, sindicalistas: -0.5 } },
]

export const PROFILE_ITEMS: ProfileItemDef[] = [...TRAITS, ...HABITS]
export const PROFILE_BY_ID = Object.fromEntries(PROFILE_ITEMS.map((p) => [p.id, p])) as Record<string, ProfileItemDef>
