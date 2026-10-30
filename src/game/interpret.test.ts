import { describe, expect, it } from 'vitest'
import { interpretMeasure } from './interpret'

const top = (t: string) => interpretMeasure(t).matches[0]?.id
const ids = (t: string) => interpretMeasure(t).matches.map((m) => m.id)

describe('interpretador da medida do mês', () => {
  it('reconhece cortes de gastos', () => {
    expect(top('Corte de 10% nos gastos de custeio dos ministérios')).toBe('cortarGastos')
    expect(top('Contingenciamento do orçamento')).toBe('cortarGastos')
  })

  it('diferencia cortar imposto de cortar gastos', () => {
    expect(top('Cortar imposto para baratear o crédito')).toBe('reduzirIOF')
    expect(top('Aumentar imposto sobre operações financeiras')).toBe('subirIOF')
  })

  it('reconhece obras, juros e pronunciamento', () => {
    expect(top('Acelerar as obras de rodovias no Nordeste')).toBe('anteciparObras')
    expect(top('Cobrar o Banco Central para baixar os juros')).toBe('pressionarBC')
    expect(top('Fazer um pronunciamento em rede nacional')).toBe('pronunciamento')
  })

  it('ignora acentos e maiúsculas', () => {
    expect(top('LIBERAR VERBA PARA A SAÚDE')).toBe('liberarGastos')
  })

  it('reconhece projetos de lei', () => {
    expect(top('Reajuste do salário mínimo acima da inflação')).toBe('salarioMinimo')
    expect(top('Isentar do imposto de renda quem ganha até 5 mil')).toBe('isencaoIR')
    expect(top('Taxar lucros e dividendos dos super-ricos')).toBe('taxarDividendos')
    expect(top('Privatizar a estatal de energia')).toBe('privatizar')
    expect(top('Aprovar a reforma tributária')).toBe('reformaTributaria')
    expect(interpretMeasure('Isentar o imposto de renda').matches[0]).toEqual({ kind: 'bill', id: 'isencaoIR' })
  })

  it('não inventa decisão quando nada combina', () => {
    expect(interpretMeasure('Legalizar a venda de bicicletas voadoras').matches).toEqual([])
    expect(interpretMeasure('   ').matches).toEqual([])
  })

  it('não confunde pedaços de palavras', () => {
    // "pacote" não deve ser lido como "PAC"
    expect(ids('Pacote de bondades')).not.toContain('anteciparObras')
    expect(top('Ampliar o PAC')).toBe('anteciparObras')
  })
})
