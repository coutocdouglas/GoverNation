import { MEMORY } from './data/balance'
import { GROUPS, GROUP_BY_ID, REFERENCES, SENSITIVITY_LABELS, type Sensitivity } from './data/groups'
import type { Cause, Group, GroupId, Impulse, Indicators } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Quanto cada indicador puxa a aprovação do grupo, em pontos. */
export function econPull(id: GroupId, ind: Indicators): Cause[] {
  const s = GROUP_BY_ID[id].sensitivity
  const dev: Record<keyof Sensitivity, number> = {
    inflation: Math.min(ind.inflation, 20) - REFERENCES.inflation,
    unemployment: ind.unemployment - REFERENCES.unemployment,
    growth: clamp(ind.growth, -6, 6) - REFERENCES.growth,
    selic: ind.selic - REFERENCES.selic,
    confidence: ind.confidence - REFERENCES.confidence,
    fx: ind.fx - REFERENCES.fx,
  }
  return (Object.keys(s) as (keyof Sensitivity)[]).map((k) => ({
    label: SENSITIVITY_LABELS[k],
    value: (s[k] ?? 0) * dev[k],
  }))
}

export function econTarget(id: GroupId, ind: Indicators, bonus: number): number {
  return GROUP_BY_ID[id].base + bonus + econPull(id, ind).reduce((a, c) => a + c.value, 0)
}

export function memorySum(memory: Impulse[]): number {
  return memory.reduce((a, m) => a + m.value, 0)
}

export function computeApproval(g: Group): number {
  return clamp(g.econ + memorySum(g.memory), 0, 100)
}

export function initialGroups(ind: Indicators, bonus: number): Record<GroupId, Group> {
  const out = {} as Record<GroupId, Group>
  for (const def of GROUPS) {
    const econ = econTarget(def.id, ind, bonus)
    const g: Group = {
      id: def.id,
      econ,
      memory: [{ label: 'Lua de mel do novo governo', value: MEMORY.honeymoon }],
      approval: 0,
    }
    g.approval = computeApproval(g)
    out[def.id] = g
  }
  return out
}

/** Aprovação geral: média ponderada pelo tamanho de cada grupo. */
export function overallApproval(groups: Record<GroupId, Group>): number {
  return GROUPS.reduce((a, def) => a + def.weight * groups[def.id].approval, 0)
}

/**
 * Avança um mês: a parte econômica anda em direção ao que os indicadores pedem,
 * e as lembranças de ações passadas vão sendo esquecidas.
 * Devolve as principais causas da mudança no mês.
 */
export function stepGroup(g: Group, ind: Indicators, bonus: number, newImpulses: Impulse[]): Cause[] {
  const before = g.approval
  const target = econTarget(g.id, ind, bonus)
  const econDelta = MEMORY.econSpeed * (target - g.econ)
  g.econ += econDelta

  const decayed = g.memory
    .map((m) => {
      const decay = m.label.startsWith('Lua de mel')
        ? MEMORY.honeymoonDecay
        : m.value >= 0
          ? MEMORY.positiveDecay
          : MEMORY.negativeDecay
      return { ...m, value: m.value * decay }
    })
    .filter((m) => Math.abs(m.value) >= 0.2)
  const forgotten = memorySum(decayed) - memorySum(g.memory)

  // Junta efeitos com o mesmo nome para a lista não crescer sem fim.
  const merged = [...decayed]
  for (const imp of newImpulses) {
    const same = merged.find((m) => m.label === imp.label && Math.sign(m.value) === Math.sign(imp.value))
    if (same) same.value += imp.value
    else merged.push({ ...imp })
  }
  g.memory = merged
  g.approval = computeApproval(g)

  // Explicação. O detalhe de qual indicador pesa mais aparece em econPull().
  const causes: Cause[] = []
  if (Math.abs(econDelta) > 0.05) causes.push({ label: 'Situação da economia', value: econDelta })
  if (Math.abs(forgotten) > 0.05) causes.push({ label: 'Efeitos passados sendo esquecidos', value: forgotten })
  for (const imp of newImpulses) causes.push({ label: imp.label, value: imp.value })

  // Ajuste fino para a soma bater com a mudança real (por causa dos limites de 0 a 100).
  const explained = causes.reduce((a, c) => a + c.value, 0)
  const residual = g.approval - before - explained
  if (Math.abs(residual) > 0.1) causes.push({ label: 'Outros fatores', value: residual })

  return causes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}
