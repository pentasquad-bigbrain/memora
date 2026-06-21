export default function Skeleton({ width = '100%', height = 14, radius = 'var(--r-sm)', style }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonVaultCard() {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <Skeleton height={110} radius={0} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={12} width="70%" />
        <Skeleton height={10} width="90%" />
      </div>
    </div>
  )
}

export function SkeletonLine({ width, height, style }) {
  return <Skeleton width={width} height={height} style={style} />
}
