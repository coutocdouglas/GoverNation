/** v0.33.0 (6B): limites dos alertas "Precisa de você" do Radar (só leitura; não mudam regra nenhuma). */
export const ALERTAS = {
  /** Exposição a escândalo (0 a 100) a partir da qual o alerta aparece; vermelho acima de `escandaloGrave`. */
  escandalo: 40,
  escandaloGrave: 60,
  /** Resultado primário (% do PIB) igual ou abaixo disto: contas no vermelho. */
  primarioVermelho: -1.5,
  /** Confiança do mercado igual ou abaixo disto: mercado nervoso. */
  confiancaBaixa: 35,
  /** Promessa de posse "longe da meta" só alerta depois deste mês do mandato. */
  promessaDepoisDoMes: 12,
  /** Quantos alertas o Radar mostra de uma vez (Teste da sobrecarga). */
  max: 3,
} as const
