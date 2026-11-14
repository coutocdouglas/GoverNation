import type { BillDef } from './bills'
import type { EventDef } from './events'
import type { GroupId } from '../types'

/**
 * Etapa 6G, bloco H3, parte 3 (v0.46.2): efeitos diretos nos grupos novos.
 *
 * Até a v0.46.1 os 25 grupos novos só recebiam o que os 7 antigos recebiam (herança). Aqui ficam os efeitos escritos
 * para eles: piso dos professores mexe com professores, frete mínimo com caminhoneiros, marco temporal com indígenas.
 * O valor direto vale no lugar da herança naquele grupo (mesmo rótulo); os grupos que não aparecem seguem herdando.
 * Os números têm a mesma escala dos outros (de -8 a +8 para medida grande; o grupo-alvo pode passar um pouco, até ±10).
 * A tabela soma-se aos efeitos já escritos quando o jogo carrega (`aplicarDiretos`); entrada já escrita à mão não é trocada.
 */
type Fx = Partial<Record<GroupId, number>>

/** Medidas (por id): o que cada uma faz direto nos grupos novos. */
export const DIRETOS_MEDIDA: Record<string, Fx> = {
  // Economia
  salarioMinimo: { aposentados: 6, sindicalistas: 7, comerciarios: 4, empreendedores: -3 },
  isencaoIR: { comerciarios: 4, professores: 4, profSaude: 4, aposentados: 2 },
  taxarDividendos: { mercado: -9, sindicalistas: 2, empreendedores: 0.5 },
  regraFiscal: { mercado: 7, sindicalistas: -4, professores: -3, profSaude: -2, aposentados: -2 },
  reformaTributaria: { mercado: 4, empreendedores: 2, comerciarios: 1 },
  reformaAdministrativa: { professores: -9, profSaude: -8, policiais: -6, militares: -3, sindicalistas: -7, ciencia: -4, mercado: 4 },
  licenciamento: { ambientalistas: -9, indigenas: -6, tradicionais: -6, agriculturaFamiliar: -2 },
  penasDuras: { policiais: 5, militares: 2, negros: -3, afro: -2 },
  privatizar: { sindicalistas: -6, mercado: 6, ciencia: -1 },
  renegociarDividas: { empreendedores: 2, aposentados: 1 },
  simplesNacional: { empreendedores: 8, comerciarios: 1 },
  cortarIsencoes: { mercado: 2, empreendedores: -1 },
  taxarApostas: { evangelicos: 3, digital: -4 },
  fundoSoberano: { mercado: 3 },
  creditoBNDES: { empreendedores: 4, mercado: -1 },
  abrirComercio: { mercado: 2, sindicalistas: -3, digital: 1 },
  reformaRenda: { mercado: -5, comerciarios: 2, professores: 2 },
  // Saúde
  maisMedicos: { profSaude: -2, mulheres: 2, indigenas: 2, tradicionais: 3 },
  filasCirurgias: { profSaude: 3, aposentados: 4 },
  farmaciaPopular: { aposentados: 5, mulheres: 1 },
  vacinacao: { profSaude: 3, ciencia: 1 },
  pisoEnfermagem: { profSaude: 9, sindicalistas: 3, mulheres: 3 },
  saudeMinima: { profSaude: 6, aposentados: 3, ciencia: 1 },
  hospitaisCampanha: { profSaude: 3, aposentados: 2 },
  // Educação
  escolaIntegral: { professores: 4, mulheres: 4 },
  pisoProfessores: { professores: 10, sindicalistas: 3, universitarios: 1 },
  poupancaEstudante: { universitarios: 2 },
  creches: { mulheres: 6, professores: 2 },
  universidadesVerba: { universitarios: 2, ciencia: 2 },
  escolasCivico: { professores: -5, militares: 5, evangelicos: 2, universitarios: -3, lgbt: -3 },
  ensinoTecnico: { professores: 2, empreendedores: 2, sindicalistas: 1 },
  // Segurança
  forcaNacional: { policiais: 3, militares: 4 },
  susp: { policiais: 4, militares: 1 },
  cameraCorporal: { policiais: -5, negros: 5, afro: 2 },
  armas: { policiais: 3, militares: 3, mulheres: -4, negros: -3 },
  controleArmas: { policiais: -3, mulheres: 3, negros: 3, militares: -3 },
  presidios: { policiais: 3, negros: -2 },
  fronteiras: { militares: 5, policiais: 3, caminhoneiros: -1 },
  // Trabalho
  fimEscala6x1: { sindicalistas: 9, comerciarios: 8, empreendedores: -6 },
  apps: { aplicativos: 4, sindicalistas: 5 },
  primeiroEmprego: { universitarios: 4 },
  qualificacao: { aplicativos: 2, sindicalistas: 1 },
  segDesemprego: { sindicalistas: 5, comerciarios: 4, aplicativos: 2 },
  desonerarFolha: { empreendedores: 4, sindicalistas: -2, comerciarios: 1 },
  reformaPrevidencia: { aposentados: -8, sindicalistas: -9, professores: -7, profSaude: -6, policiais: -4, militares: -3, mercado: 6, comerciarios: -5 },
  // Social
  programaSocial: { mulheres: 3, negros: 3, catolicos: 2, tradicionais: 2 },
  gasDoPovo: { mulheres: 2, aposentados: 1 },
  cestaBasica: { aposentados: 3, mulheres: 2, catolicos: 1 },
  fomeZero: { catolicos: 3, tradicionais: 2, indigenas: 2, agriculturaFamiliar: 3, mulheres: 2 },
  tarifaSocialLuz: { aposentados: 3, tradicionais: 2 },
  pentefino: { aposentados: -3, mulheres: -2, mercado: 2 },
  cuidados: { mulheres: 7, profSaude: 2, aposentados: 3 },
  // Agro
  planoSafra: { agriculturaFamiliar: 1, caminhoneiros: 1 },
  agriculturaFamiliar: { agriculturaFamiliar: 9, tradicionais: 2, ambientalistas: 1, catolicos: 1 },
  estoquesReguladores: { agriculturaFamiliar: -2, aposentados: 1 },
  reformaAgraria: { agriculturaFamiliar: 6, tradicionais: 4, catolicos: 2, indigenas: 1 },
  marcoTemporal: { indigenas: -10, tradicionais: -5, ambientalistas: -6, afro: -1, catolicos: -2 },
  seguroRural: { agriculturaFamiliar: 4 },
  // Ambiente
  fiscalizacaoAmbiental: { ambientalistas: 9, indigenas: 5, tradicionais: 4, agriculturaFamiliar: 1, caminhoneiros: -1 },
  fundoClima: { ambientalistas: 8, indigenas: 3, tradicionais: 3, ciencia: 2, mercado: 1 },
  mercadoCarbono: { ambientalistas: 3, indigenas: -1, tradicionais: -1, mercado: 3 },
  saneamentoMarco: { sindicalistas: -4, mercado: 3, tradicionais: -1 },
  agrotoxicos: { ambientalistas: -9, agriculturaFamiliar: -4, tradicionais: -3, ciencia: -2 },
  defesaCivil: { tradicionais: 3, ciencia: 2, militares: 1 },
  // Energia e transportes
  precoCombustivel: { caminhoneiros: 9, aplicativos: 7, mercado: -3 },
  energiaSolar: { ambientalistas: 4, ciencia: 1 },
  linhasTransmissao: { mercado: 2 },
  margemEquatorial: { ambientalistas: -8, indigenas: -2, tradicionais: -3, ciencia: -1, mercado: 2 },
  nuclear: { ambientalistas: -5, ciencia: 3, militares: 3 },
  concessaoRodovias: { caminhoneiros: -5, aplicativos: -2, mercado: 3 },
  ferrovias: { caminhoneiros: -3, mercado: 1 },
  freteMinimo: { caminhoneiros: 10, mercado: -2, agriculturaFamiliar: -1 },
  onibusEletrico: { ambientalistas: 3 },
  tarifaZero: { universitarios: 3, mulheres: 2 },
  portosAeroportos: { sindicalistas: -4, mercado: 2 },
  // Cidades
  moradiaPopular: { sindicalistas: 2, mulheres: 3, negros: 3 },
  saneamentoObras: { tradicionais: 1, negros: 3 },
  reconstrucao: { militares: 2, catolicos: 2 },
  regularizacao: { negros: 2, tradicionais: 2 },
  // Ciência e política
  internetEscolas: { digital: 5, professores: 3, universitarios: 2 },
  regularRedes: { digital: -9, mulheres: 3, lgbt: 2 },
  agenciaCiber: { digital: 2, ciencia: 3, militares: 3 },
  fundoPesquisa: { ciencia: 9, universitarios: 4, professores: 2 },
  governoDigital: { digital: 5, ciencia: 2, sindicalistas: -2 },
  inteligenciaArtificial: { digital: 4, ciencia: 5, artistas: -3, sindicalistas: -2, mercado: 2 },
  cpiCorrupcao: { policiais: 2 },
  transparencia: { digital: 3 },
  pfAutonoma: { policiais: 3 },
  cultura: { artistas: 10, digital: 3, evangelicos: -2, universitarios: 2, lgbt: 2 },
}

/** Fatos (por id): o que cada saída faz direto nos grupos novos, na ordem das opções (undefined = nada de novo). */
export const DIRETOS_FATO: Record<string, (Fx | undefined)[]> = {
  dengue: [{ profSaude: 5, aposentados: 3 }, { profSaude: -1 }, { profSaude: -4, aposentados: -3 }],
  caminhoneiros: [{ caminhoneiros: 7, aplicativos: 3 }, { caminhoneiros: 6, agriculturaFamiliar: -1 }, { caminhoneiros: -9, policiais: 2 }, { caminhoneiros: -6 }],
  enchentes: [{ tradicionais: 3, militares: 2, catolicos: 2 }, { militares: 1 }, { tradicionais: -3, catolicos: -2 }],
  professores: [{ professores: 9, sindicalistas: 3, universitarios: 3 }, { professores: 2 }, { professores: -9, sindicalistas: -4, universitarios: -4, policiais: 1 }, { professores: -5, universitarios: -2 }],
  queimadas: [{ ambientalistas: 8, indigenas: 4, tradicionais: 3, agriculturaFamiliar: -1 }, { ambientalistas: -6, indigenas: -3 }, { ambientalistas: -9, indigenas: -4, tradicionais: -3, ciencia: -2 }],
  comida: [{ agriculturaFamiliar: -4, aposentados: 3, catolicos: 1 }, { agriculturaFamiliar: 1, aposentados: 2 }, { aposentados: -4 }],
  terra: [{ agriculturaFamiliar: 6, tradicionais: 3, catolicos: 2, indigenas: 1 }, { agriculturaFamiliar: -4, tradicionais: -3, catolicos: -2, indigenas: -2 }, { agriculturaFamiliar: -1 }],
  vazamento: [{ digital: 4, ciencia: 3, militares: 1 }, { digital: -4 }],
  petroleo: [{ ambientalistas: -3, caminhoneiros: 2 }],
  desemprego: [{ sindicalistas: 3, aplicativos: 3, comerciarios: 2 }, { empreendedores: 3 }, { sindicalistas: -3, comerciarios: -2 }],
  mercado: [{ mercado: 6, sindicalistas: -3, professores: -3 }, { mercado: -7 }],
  barragem: [{ tradicionais: 4, ambientalistas: 3, catolicos: 1 }, { tradicionais: -1, ambientalistas: -3 }, { tradicionais: -6, ambientalistas: -5, catolicos: -2 }],
  universidadesSemVerba: [{ universitarios: 5, ciencia: 5, professores: 3 }, { universitarios: -4, ciencia: -5, professores: -2 }],
  rebeliao: [{ policiais: 2 }, { policiais: -1, negros: -1 }],
  dilVacina: [{ profSaude: 4, ciencia: 3, aposentados: 2, mercado: -3 }, { profSaude: -4, ciencia: -3, mercado: 3 }, { universitarios: -4, profSaude: 1 }, { profSaude: -3, aposentados: -1 }],
  dilLicenca: [{ ambientalistas: -8, indigenas: -5, tradicionais: -5, sindicalistas: 2, mercado: 2 }, { ambientalistas: 6, indigenas: 3, tradicionais: 3, sindicalistas: -2, mercado: -2 }, { ambientalistas: 2, ciencia: 2 }, { ambientalistas: -3, indigenas: -1 }],
  dilReajuste: [{ professores: 4, profSaude: 4, sindicalistas: 3, policiais: 3, mercado: -3 }, { professores: -2, profSaude: -2, sindicalistas: -2 }, { professores: -6, profSaude: -5, sindicalistas: -5, policiais: -4, mercado: 3 }, { professores: -3, profSaude: -3 }],
  dilOperacao: [{ policiais: 6, militares: 3, negros: -6, afro: -3, mulheres: -1 }, { policiais: -6, negros: 5, afro: 2, mulheres: 1 }, { negros: 2, policiais: -1, ciencia: 1 }, { negros: -3, policiais: -1 }],
  dilConta: [{ aposentados: 3, mercado: -3 }, { aposentados: -4, mercado: 3 }, { aposentados: 1 }, { aposentados: -1 }],
  dilTerra: [{ agriculturaFamiliar: 6, tradicionais: 3, catolicos: 2 }, { agriculturaFamiliar: -4, tradicionais: -3, catolicos: -2, indigenas: -1 }, { agriculturaFamiliar: 1 }, { agriculturaFamiliar: -2, tradicionais: -1 }],
  dilQueimadas: [{ ambientalistas: 8, indigenas: 4, tradicionais: 3 }, { ambientalistas: -6, indigenas: -3 }, { ambientalistas: -6, indigenas: -3, tradicionais: -2 }],
  dilBarragem: [{ tradicionais: 5, indigenas: 2, ambientalistas: 3, catolicos: 2 }, { tradicionais: -7, ambientalistas: -6, indigenas: -3, catolicos: -2 }],
  dilGreveServidores: [{ professores: 4, profSaude: 4, sindicalistas: 3 }, { professores: -4, profSaude: -4, sindicalistas: -3 }],
  dilOperacaoLaudo: [{ negros: 3, policiais: -2, afro: 1 }, { negros: -3 }],
  dilVacinaSurto: [{ profSaude: 3, aposentados: 2, ciencia: 2 }, { profSaude: -4, aposentados: -3, ciencia: -2 }],
}

/** Soma os efeitos diretos às medidas (o que já está escrito à mão no grupo novo não é trocado). */
export function aplicarDiretosMedidas(bills: BillDef[]): void {
  for (const b of bills) {
    const d = DIRETOS_MEDIDA[b.id]
    if (d) b.effects = { ...b.effects, groups: { ...d, ...b.effects.groups } }
  }
}

/** Soma os efeitos diretos às saídas dos fatos, pela ordem das opções. */
export function aplicarDiretosFatos(events: EventDef[]): void {
  for (const e of events) {
    const d = DIRETOS_FATO[e.id]
    if (!d) continue
    e.options = e.options.map((o, i) => (d[i] ? { ...o, effects: { ...o.effects, groups: { ...d[i], ...o.effects.groups } } } : o))
  }
}
