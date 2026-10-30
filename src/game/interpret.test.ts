import { describe, expect, it } from 'vitest'
import { interpretMeasure } from './interpret'

const top = (t: string) => interpretMeasure(t).matches[0]

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

  it('não inventa decisão quando nada combina', () => {
    expect(interpretMeasure('Legalizar a venda de bicicletas voadoras').matches).toEqual([])
    expect(interpretMeasure('   ').matches).toEqual([])
  })

  it('não confunde pedaços de palavras', () => {
    // "pacote" não deve ser lido como "PAC"
    expect(interpretMeasure('Pacote de bondades').matches).not.toContain('anteciparObras')
    expect(top('Ampliar o PAC')).toBe('anteciparObras')
  })
})
