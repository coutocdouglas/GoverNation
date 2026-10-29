/** Minigráfico de linha. */
export function Sparkline({ values, width = 120, height = 32, color = 'var(--gold)' }: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 4) + 2
      const y = height - 3 - ((v - min) / range) * (height - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const last = pts.split(' ').at(-1)!.split(',')
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  )
}
