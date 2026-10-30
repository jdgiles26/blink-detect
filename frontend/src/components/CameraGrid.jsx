import CameraCell from './CameraCell.jsx'

const COLS = { single: 1, dual: 2, quad: 2, hex: 3 }

export default function CameraGrid({ cameras, layout }) {
  const cols = COLS[layout] ?? 2

  // In single layout, only show the first camera
  const visible = layout === 'single' ? cameras.slice(0, 1) : cameras

  return (
    <div
      style={{
        ...S.grid,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
      }}
    >
      {visible.map(cam => (
        <CameraCell key={cam.id} camera={cam} />
      ))}
    </div>
  )
}

const S = {
  grid: {
    flex:       1,
    display:    'grid',
    gap:        2,
    padding:    2,
    background: '#050810',
    overflow:   'hidden',
    minHeight:  0,  // allow flex child to shrink
  },
}
