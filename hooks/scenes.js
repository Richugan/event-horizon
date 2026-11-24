// Six animated backdrop scenes, each a pure-vector SVG string with CSS animation.
// buildScene(kind, heat) -> svg. heat is 0..1 (see heatFromPercent): it shifts the
// palette toward amber/orange/red, speeds animation up, and adds flicker and a
// warning vignette at the top end. Shared by the preview page and the mod.

export const STYLES = {
  grid: { name: 'Neural Grid', bg0: '#04081a', bg1: '#0a1736', a: '#2fe3ff', b: '#3d7bff' },
  rain: { name: 'Data Rain', bg0: '#020a06', bg1: '#05170e', a: '#39ff8a', b: '#1fbf6a' },
  circuit: { name: 'Circuit Board', bg0: '#04100f', bg1: '#08201d', a: '#2ee6c8', b: '#d4a84b' },
  radar: { name: 'HUD Radar', bg0: '#03100d', bg1: '#071d18', a: '#5cffc8', b: '#2fbf95' },
  plasma: { name: 'Plasma Core', bg0: '#06041a', bg1: '#0e0a2c', a: '#9b6bff', b: '#4d7cff' },
  space: { name: 'Event Horizon', bg0: '#010104', bg1: '#05060f', a: '#ffcf8a', b: '#8fb4ff' },
}

// ---------- colour + heat helpers ----------
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const toHex = rgb => '#' + rgb.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => {
  const x = toRgb(a), y = toRgb(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

const AMBER = '#ffb020', ORANGE = '#ff5a1f', RED = '#ff2436'

// Continuous mapping so stage changes blend instead of jumping at 50/75/90.
export function heatFromPercent(p) {
  if (p == null || p <= 50) return 0
  if (p <= 75) return ((p - 50) / 25) * 0.4
  if (p <= 90) return 0.4 + ((p - 75) / 15) * 0.35
  return 0.75 + clamp((p - 90) / 10) * 0.25
}

export function heatColor(base, h) {
  if (h <= 0) return base
  if (h <= 0.4) return mix(base, AMBER, h / 0.4)
  if (h <= 0.75) return mix(AMBER, ORANGE, (h - 0.4) / 0.35)
  return mix(ORANGE, RED, (h - 0.75) / 0.25)
}

export const speedFor = h =>
  1 + 0.15 * clamp(h / 0.4) + 0.25 * clamp((h - 0.4) / 0.35) + 0.3 * clamp((h - 0.75) / 0.25)

// Deterministic so the scene doesn't reshuffle every time heat changes.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f1 = n => Math.round(n * 10) / 10

// 7-segment hex glyphs, drawn as rect paths (no fonts allowed in scenes).
const SEG = {
  a: [2, 0, 8, 2], b: [10, 2, 2, 8], c: [10, 12, 2, 8], d: [2, 20, 8, 2],
  e: [0, 12, 2, 8], f: [0, 2, 2, 8], g: [2, 10, 8, 2],
}
const DIGITS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc',
  8: 'abcdefg', 9: 'abcdfg', A: 'abcefg', B: 'fedcg', C: 'afed', D: 'bcdeg', E: 'afged', F: 'afge',
}
function glyph(ch, x, y, s = 1) {
  return [...(DIGITS[ch] || '')]
    .map(k => {
      const [sx, sy, w, hh] = SEG[k]
      return `M${f1(x + sx * s)} ${f1(y + sy * s)}h${f1(w * s)}v${f1(hh * s)}h${f1(-w * s)}z`
    })
    .join('')
}
const glyphs = (str, x, y, s = 1, gap = 16) => [...str].map((c, i) => glyph(c, x + i * gap * s, y, s)).join('')

// ---------- shared layers ----------
function frame(p, body, extraCss, opts) {
  const { h, spd } = p
  const flick = clamp((h - 0.4) / 0.6)
  const warn = clamp((h - 0.75) / 0.25)
  const dim = f1(1 - 0.14 * flick)
  const css = `
.fx{${flick > 0 ? `animation:flk ${f1(3.2 / spd)}s steps(1,end) infinite;` : ''}}
@keyframes flk{0%,100%{opacity:1}7%{opacity:${dim}}10%{opacity:1}43%{opacity:${f1((1 + +dim) / 2)}}46%{opacity:1}71%{opacity:${dim}}74%{opacity:1}}
.warn{opacity:${f1(0.25 * warn)};animation:wp ${f1(1.6 / spd)}s ease-in-out infinite}
@keyframes wp{0%,100%{opacity:${f1(0.18 * warn)}}50%{opacity:${f1(0.5 * warn)}}}
.hide{animation:hd 1s forwards}@keyframes hd{to{opacity:0}}
${extraCss}`
  const pct = opts && opts.pct != null && opts.showPct ? pctReadout(p, opts.pct) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><style>${css}</style>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg0}"/><stop offset=".55" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg0}"/></linearGradient>
<radialGradient id="veil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${p.bg0}" stop-opacity="${p.veil ?? 0.72}"/><stop offset=".7" stop-color="${p.bg0}" stop-opacity=".25"/><stop offset="1" stop-color="${p.bg0}" stop-opacity="0"/></radialGradient>
<radialGradient id="wv" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="${RED}" stop-opacity="0"/><stop offset="1" stop-color="${RED}" stop-opacity=".75"/></radialGradient>
${p.defs || ''}
</defs>
<rect width="1600" height="1000" fill="url(#bg)"/>
<g class="fx">${body}</g>
<ellipse cx="800" cy="480" rx="520" ry="430" fill="url(#veil)"/>
${pct}
${warn > 0 ? '<rect class="warn" width="1600" height="1000" fill="url(#wv)"/>' : ''}
</svg>`
}

function pctReadout(p, pct) {
  const n = String(Math.round(clamp(pct, 0, 100))).padStart(3, '0')
  const col = p.h >= 0.75 ? mix(p.A, '#ffffff', 0.2) : p.A
  return `<g opacity=".8"><path fill="${col}" d="${glyphs(n, 1440, 60, 1.4)}"/><path fill="none" stroke="${col}" stroke-width="2" d="M1430 46h-14v54h14M1512 46h14v54h-14"/></g>`
}

function palette(kind, h) {
  const s = STYLES[kind]
  return { ...s, h, spd: speedFor(h), A: heatColor(s.a, h), B: heatColor(s.b, h * 0.9), bg1: mix(s.bg1, '#1a0806', h * 0.5), bg0: mix(s.bg0, '#0d0404', h * 0.5) }
}

// ---------- 1. Neural Grid ----------
function grid(p, opts) {
  const { A, B, spd } = p
  const HZ = 430
  let v = ''
  for (let x = -2600; x <= 4200; x += 200) {
    v += `M${f1(800 + (x - 800) * 0.06)} ${HZ}L${x} 1000`
  }
  // resting horizontals (shown only when motion is stripped) + movers
  let still = '', movers = ''
  for (let z = 1; z <= 9; z++) still += `M-200 ${f1(HZ + 570 / z)}H1800`
  const N = 9, T = 9 / spd
  for (let i = 0; i < N; i++) {
    movers += `<path class="mv" style="animation-delay:${f1(-(i * T) / N)}s" d="M-200 ${HZ + 2}H1800"/>`
  }
  // nodes: kept to the sides, away from where chat text sits
  const r = rng(7)
  let nodes = '', links = ''
  const pts = []
  for (let i = 0; i < 22; i++) {
    const left = i % 2 === 0
    const x = left ? 60 + r() * 380 : 1160 + r() * 380
    const y = 50 + r() * 330
    pts.push([x, y])
  }
  pts.forEach(([x, y], i) => {
    pts.forEach(([x2, y2], j) => {
      if (j > i && Math.hypot(x - x2, y - y2) < 170) links += `M${f1(x)} ${f1(y)}L${f1(x2)} ${f1(y2)}`
    })
    const d = f1(-r() * 4)
    nodes += `<circle cx="${f1(x)}" cy="${f1(y)}" r="10" class="halo" style="animation-delay:${d}s;transform-origin:${f1(x)}px ${f1(y)}px"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="${A}"/>`
  })
  // a few nodes on the floor too
  for (let i = 0; i < 6; i++) {
    const x = [180, 420, 1180, 1420, 300, 1300][i], y = [860, 720, 720, 860, 960, 960][i]
    nodes += `<circle cx="${x}" cy="${y}" r="12" class="halo" style="animation-delay:${f1(-i * 0.7)}s;transform-origin:${x}px ${y}px"/><circle cx="${x}" cy="${y}" r="3" fill="${A}"/>`
  }
  p.defs = `<linearGradient id="fv" gradientUnits="userSpaceOnUse" x1="0" y1="${HZ}" x2="0" y2="1000"><stop offset="0" stop-color="${A}" stop-opacity="0"/><stop offset="1" stop-color="${A}" stop-opacity=".55"/></linearGradient>
<radialGradient id="hz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${A}" stop-opacity=".35"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient>`
  const css = `
.mv{fill:none;stroke:${A};stroke-width:1.6;opacity:0;animation:mv ${f1(T)}s cubic-bezier(.75,0,1,1) infinite}
@keyframes mv{0%{transform:translateY(0);opacity:0}15%{opacity:.25}100%{transform:translateY(570px);opacity:.6}}
.halo{fill:none;stroke:${A};stroke-width:1.5;opacity:.35;animation:pl ${f1(4 / spd)}s ease-out infinite}
@keyframes pl{0%{transform:scale(.4);opacity:.7}100%{transform:scale(1.8);opacity:0}}`
  const body = `<ellipse cx="800" cy="${HZ}" rx="980" ry="70" fill="url(#hz)"/>
<path d="${v}" fill="none" stroke="url(#fv)" stroke-width="1.2"/>
<path class="hide" d="${still}" fill="none" stroke="${A}" stroke-opacity=".3" stroke-width="1.2"/>
${movers}
<path d="M0 ${HZ}H1600" stroke="${A}" stroke-opacity=".5" stroke-width="1.5"/>
<path d="${links}" fill="none" stroke="${B}" stroke-opacity=".28" stroke-width="1"/>
${nodes}`
  return frame(p, body, css, opts)
}

// ---------- 2. Data Rain ----------
function rain(p, opts) {
  const { A, spd } = p
  const r = rng(11)
  const keys = Object.keys(DIGITS)
  const head = mix(A, '#ffffff', 0.55)
  let cols = ''
  for (let x = 14; x < 1600; x += 54) {
    const far = Math.abs(x - 800) / 800
    const op = f1(0.22 + 0.55 * far * far)
    const s = 0.8 + r() * 0.45
    const n = 9 + Math.floor(r() * 10)
    const dur = f1((11 + r() * 12) / spd)
    const delay = f1(-r() * 20)
    const baseY = Math.round(r() * 900)
    let trail = ''
    for (let k = 0; k < n; k++) {
      const ch = keys[Math.floor(r() * keys.length)]
      const gy = baseY - k * 30 * s
      const o = k === 0 ? 1 : f1(Math.max(0.08, 1 - k / n))
      trail += `<path d="${glyph(ch, x, gy, s)}" fill="${k === 0 ? head : A}" opacity="${o}"/>`
    }
    cols += `<g class="col" opacity="${op}" style="animation-duration:${dur}s;animation-delay:${delay}s">${trail}</g>`
  }
  const css = `
.col{animation:fall linear infinite}
@keyframes fall{0%{transform:translateY(-1100px)}100%{transform:translateY(1100px)}}
.scan{animation:scan ${f1(14 / spd)}s linear infinite}
@keyframes scan{0%{transform:translateY(-200px)}100%{transform:translateY(1200px)}}`
  p.defs = `<linearGradient id="sc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A}" stop-opacity="0"/><stop offset=".5" stop-color="${A}" stop-opacity=".07"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></linearGradient>`
  const body = `${cols}<rect class="scan" x="0" y="0" width="1600" height="160" fill="url(#sc)"/>`
  return frame(p, body, css, opts)
}

// ---------- 3. Circuit Board ----------
function circuit(p, opts) {
  const { A, B, spd } = p
  const r = rng(23)
  const inCenter = (x, y) => x > 430 && x < 1170 && y > 170 && y < 790
  const traces = []
  const starts = []
  for (let i = 0; i < 44; i++) {
    const side = i % 4
    const t = r()
    const pt = side === 0 ? [0, t * 1000] : side === 1 ? [1600, t * 1000] : side === 2 ? [t * 1600, 0] : [t * 1600, 1000]
    starts.push([pt, side])
  }
  for (const [[sx, sy], side] of starts) {
    let x = Math.round(sx / 20) * 20, y = Math.round(sy / 20) * 20
    let dir = side === 0 ? [1, 0] : side === 1 ? [-1, 0] : side === 2 ? [0, 1] : [0, -1]
    const pts = [[x, y]]
    let len = 0
    const segs = 3 + Math.floor(r() * 4)
    for (let k = 0; k < segs; k++) {
      const step = 60 + Math.round(r() * 8) * 20
      const nx = x + dir[0] * step, ny = y + dir[1] * step
      if (inCenter(nx, ny) || nx < -10 || nx > 1610 || ny < -10 || ny > 1010) break
      len += Math.hypot(nx - x, ny - y)
      x = nx; y = ny
      pts.push([x, y])
      // turn 45° or 90°
      const opts45 = dir[0] === 0 ? [[1, dir[1]], [-1, dir[1]], [1, 0], [-1, 0]] : dir[1] === 0 ? [[dir[0], 1], [dir[0], -1], [0, 1], [0, -1]] : [[dir[0], 0], [0, dir[1]]]
      dir = opts45[Math.floor(r() * opts45.length)]
    }
    if (pts.length > 1) traces.push({ pts, len })
  }
  let paths = '', pads = '', packets = ''
  traces.forEach((t, i) => {
    const d = 'M' + t.pts.map(([x, y]) => `${x} ${y}`).join('L')
    paths += d
    const [ex, ey] = t.pts[t.pts.length - 1]
    pads += `<circle cx="${ex}" cy="${ey}" r="5"/>`
    if (i % 2 === 0) {
      const dur = f1((3 + (t.len / 260) + r() * 2) / spd)
      packets += `<path class="pk" pathLength="100" d="${d}" style="animation-duration:${dur}s;animation-delay:${f1(-r() * 6)}s"/>`
    }
  })
  // chips in the corners
  const chip = (cx, cy, w, hh) => {
    let pins = ''
    for (let k = 10; k < w; k += 14) pins += `M${cx + k} ${cy}v-10M${cx + k} ${cy + hh}v10`
    for (let k = 10; k < hh; k += 14) pins += `M${cx} ${cy + k}h-10M${cx + w} ${cy + k}h10`
    return `<rect x="${cx}" y="${cy}" width="${w}" height="${hh}" rx="4" fill="${p.bg0}" stroke="${B}" stroke-opacity=".7" stroke-width="1.5"/><path d="${pins}" stroke="${B}" stroke-opacity=".6" stroke-width="2"/><circle class="led" cx="${cx + 12}" cy="${cy + 12}" r="3" fill="${A}"/>`
  }
  const chips = chip(110, 110, 120, 80) + chip(1340, 140, 140, 96) + chip(150, 780, 96, 96) + chip(1330, 800, 130, 70)
  const css = `
.pk{fill:none;stroke:${A};stroke-width:3;stroke-linecap:round;stroke-dasharray:5 100;stroke-dashoffset:6;animation:run linear infinite}
@keyframes run{from{stroke-dashoffset:6}to{stroke-dashoffset:-100}}
.led{animation:led ${f1(2.6 / spd)}s ease-in-out infinite}
@keyframes led{0%,100%{opacity:.25}50%{opacity:1}}`
  const body = `<path d="${paths}" fill="none" stroke="${B}" stroke-opacity=".38" stroke-width="2" stroke-linejoin="round"/>
<g fill="${p.bg0}" stroke="${B}" stroke-opacity=".6" stroke-width="2">${pads}</g>
${chips}
${packets}`
  return frame(p, body, css, opts)
}

// ---------- 4. HUD Radar ----------
function radar(p, opts) {
  const { A, B, spd } = p
  const CX = 1250, CY = 740, T = f1(7 / spd)
  let rings = ''
  for (let rr = 110; rr <= 770; rr += 110) rings += `<circle r="${rr}"/>`
  let ticks = ''
  for (let a = 0; a < 360; a += 5) {
    const rad = (a * Math.PI) / 180, l = a % 30 === 0 ? 22 : 10
    ticks += `M${f1(Math.cos(rad) * 440)} ${f1(Math.sin(rad) * 440)}L${f1(Math.cos(rad) * (440 - l))} ${f1(Math.sin(rad) * (440 - l))}`
  }
  const W = 55, R = 780
  const ex = f1(Math.cos((-W * Math.PI) / 180) * R), ey = f1(Math.sin((-W * Math.PI) / 180) * R)
  const sweep = `<g class="sw"><path d="M0 0L${R} 0A${R} ${R} 0 0 0 ${ex} ${ey}Z" fill="url(#swg)"/><path d="M0 0H${R}" stroke="${A}" stroke-opacity=".55" stroke-width="2"/></g>`
  const r = rng(5)
  let blips = ''
  for (let i = 0; i < 11; i++) {
    const a = 160 + r() * 200 // degrees, cw from +x; keeps blips on the visible side
    const d = 120 + r() * 560
    const rad = (a * Math.PI) / 180
    const x = f1(Math.cos(rad) * d), y = f1(Math.sin(rad) * d)
    const delay = f1(((a % 360) / 360 - 1) * T)
    blips += `<circle class="bl" cx="${x}" cy="${y}" r="5" style="animation-delay:${delay}s;transform-origin:${x}px ${y}px"/>`
  }
  // corner telemetry
  const bars = (x, y) => {
    let s = ''
    for (let i = 0; i < 6; i++) {
      s += `<rect class="br" x="${x}" y="${y + i * 16}" width="${120 + ((i * 37) % 80)}" height="6" style="animation-delay:${f1(-i * 0.9)}s;transform-origin:${x}px 0"/>`
    }
    return s
  }
  let spec = ''
  for (let i = 0; i < 16; i++) {
    spec += `<rect class="sp" x="${60 + i * 12}" y="830" width="7" height="90" style="animation-duration:${f1((1.6 + (i % 5) * 0.35) / spd)}s;animation-delay:${f1(-i * 0.37)}s;transform-origin:0 920px"/>`
  }
  let spark = 'M0 40'
  const rs = rng(9)
  for (let x = 0; x <= 480; x += 12) spark += `L${x} ${f1(20 + rs() * 40)}`
  const corners = `<path d="M40 40h60M40 40v60M1560 40h-60M1560 40v60M40 960h60M40 960v-60M1560 960h-60M1560 960v-60" stroke="${A}" stroke-opacity=".6" stroke-width="2" fill="none"/>`
  p.defs = `<linearGradient id="swg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${ey}"><stop offset="0" stop-color="${A}" stop-opacity=".16"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></linearGradient>
<clipPath id="spc"><rect x="70" y="120" width="240" height="70"/></clipPath>`
  const css = `
.sw{animation:rot ${T}s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.bl{fill:${A};opacity:.15;animation:bl ${T}s linear infinite}
@keyframes bl{0%{opacity:1;transform:scale(1.6)}25%{opacity:.35;transform:scale(1)}100%{opacity:.12;transform:scale(1)}}
.br{fill:${B};opacity:.5;animation:br ${f1(5 / spd)}s ease-in-out infinite}
@keyframes br{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.55)}}
.sp{fill:${A};opacity:.45;animation:sp ease-in-out infinite}
@keyframes sp{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.sk{animation:sk ${f1(10 / spd)}s linear infinite}
@keyframes sk{to{transform:translateX(-240px)}}
.cur{animation:cur ${f1(2 / spd)}s steps(1,end) infinite}
@keyframes cur{50%{opacity:0}}`
  const body = `<g transform="translate(${CX} ${CY})"><g fill="none" stroke="${A}" stroke-opacity=".22" stroke-width="1.4">${rings}</g>
<path d="M-800 0H800M0 -800V800" stroke="${A}" stroke-opacity=".14" stroke-width="1"/>
<path d="${ticks}" stroke="${A}" stroke-opacity=".4" stroke-width="1.5"/>
${sweep}${blips}<circle r="5" fill="${A}"/></g>
${corners}
<g opacity=".85"><path fill="${A}" fill-opacity=".7" d="${glyphs('3F7A', 70, 70, 1)}"/><rect class="cur" x="140" y="70" width="10" height="22" fill="${A}"/>
<g clip-path="url(#spc)"><path class="sk" transform="translate(70 120)" d="${spark}" fill="none" stroke="${A}" stroke-opacity=".6" stroke-width="1.5"/></g>
${bars(70, 210)}</g>
<g opacity=".8">${spec}</g>
<path fill="${B}" fill-opacity=".6" d="${glyphs('0D2C', 1400, 920, 0.9)}"/>`
  return frame(p, body, css, { ...opts, showPct: opts && opts.showPct !== false })
}

// ---------- 5. Plasma Core ----------
function plasma(p, opts) {
  const { A, B, spd } = p
  const CX = 800, CY = 480
  const r = rng(31)
  let parts = ''
  for (let i = 0; i < 46; i++) {
    const rad = 330 + r() * 380
    const a = r() * 360
    const dur = f1((30 + r() * 50) / spd)
    const size = f1(1 + r() * 2.2)
    const col = i % 3 === 0 ? B : A
    parts += `<g class="orb" style="animation-duration:${dur}s;animation-delay:${f1(-r() * 60)}s${i % 2 ? ';animation-direction:reverse' : ''}"><circle cx="${f1(Math.cos(a) * rad)}" cy="${f1(Math.sin(a) * rad)}" r="${size}" fill="${col}" opacity="${f1(0.3 + r() * 0.5)}"/></g>`
  }
  p.defs = `<radialGradient id="core" cx=".5" cy=".5" r=".5"><stop offset=".52" stop-color="${A}" stop-opacity="0"/><stop offset=".7" stop-color="${A}" stop-opacity=".55"/><stop offset=".8" stop-color="${B}" stop-opacity=".3"/><stop offset="1" stop-color="${B}" stop-opacity="0"/></radialGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${B}" stop-opacity=".18"/><stop offset="1" stop-color="${B}" stop-opacity="0"/></radialGradient>`
  const css = `
.br{animation:breath ${f1(6 / spd)}s ease-in-out infinite;transform-origin:0 0}
@keyframes breath{0%,100%{transform:scale(.96);opacity:.65}50%{transform:scale(1.04);opacity:1}}
.r1{animation:rot ${f1(80 / spd)}s linear infinite}
.r2{animation:rot ${f1(120 / spd)}s linear infinite reverse}
.r3{animation:rot ${f1(55 / spd)}s linear infinite}
.orb{animation:rot linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.arc{animation:arc ${f1(9 / spd)}s ease-in-out infinite}
@keyframes arc{0%,100%{opacity:.15}50%{opacity:.6}}`
  const body = `<ellipse cx="${CX}" cy="${CY}" rx="1000" ry="760" fill="url(#halo)"/>
<g transform="translate(${CX} ${CY}) scale(1 .62)">
<g class="br"><circle r="560" fill="url(#core)"/></g>
<g fill="none" stroke-width="2">
<g class="r1"><circle r="420" stroke="${A}" stroke-opacity=".5" stroke-dasharray="2 14 40 14"/></g>
<g class="r2"><circle r="470" stroke="${B}" stroke-opacity=".45" stroke-dasharray="120 30 8 30"/></g>
<g class="r3"><circle r="525" stroke="${A}" stroke-opacity=".3" stroke-dasharray="1 9"/></g>
<circle r="600" stroke="${B}" stroke-opacity=".18"/>
<path class="arc" d="M-440 -40Q-480 -260 -300 -360M420 100Q500 300 280 380" stroke="${mix(A, '#ffffff', 0.4)}" stroke-width="2.5"/>
</g>
${parts}
</g>`
  return frame(p, body, css, opts)
}

// ---------- 6. Event Horizon (black hole fed by the context) ----------
// Shadow radius tracks context %, so the hole visibly grows as the window fills.
export const holeRadius = pct => 50 + 150 * Math.pow(clamp((pct ?? 0) / 100), 1.1)

// A tiny stroke font on a 4x6 grid (scenes may not use fonts). Absolute M/L/H/V/Z only.
const FONT = {
  A: 'M0 6V2L2 0L4 2V6M0 3H4', B: 'M0 0H3L4 1V2L3 3H0M3 3L4 4V5L3 6H0V0', C: 'M4 0H0V6H4', D: 'M0 0H3L4 1V5L3 6H0Z',
  E: 'M4 0H0V6H4M0 3H3', F: 'M4 0H0V6M0 3H3', G: 'M4 0H0V6H4V3H2', H: 'M0 0V6M4 0V6M0 3H4', I: 'M1 0H3M2 0V6M1 6H3',
  J: 'M4 0V6H0V4', K: 'M0 0V6M4 0L0 3L4 6', L: 'M0 0V6H4', M: 'M0 6V0L2 3L4 0V6', N: 'M0 6V0L4 6V0', O: 'M0 0H4V6H0Z',
  P: 'M0 6V0H4V3H0', Q: 'M0 0H4V6H0ZM2 4L4 6', R: 'M0 6V0H4V3H0M2 3L4 6', S: 'M4 0H0V3H4V6H0', T: 'M0 0H4M2 0V6',
  U: 'M0 0V6H4V0', V: 'M0 0L2 6L4 0', W: 'M0 0L1 6L2 3L3 6L4 0', X: 'M0 0L4 6M4 0L0 6', Y: 'M0 0L2 3L4 0M2 3V6', Z: 'M0 0H4L0 6H4',
  0: 'M0 0H4V6H0ZM4 0L0 6', 1: 'M1 1L2 0V6M1 6H3', 2: 'M0 0H4V3H0V6H4', 3: 'M0 0H4V6H0M1 3H4', 4: 'M0 0V3H4M4 0V6',
  5: 'M4 0H0V3H4V6H0', 6: 'M4 0H0V6H4V3H0', 7: 'M0 0H4L1 6', 8: 'M0 0H4V6H0ZM0 3H4', 9: 'M4 3H0V0H4V6H0',
  '.': 'M2 5.4V6', '-': 'M1 3H3', _: 'M0 6H4', '/': 'M4 0L0 6', ':': 'M2 1.4V2M2 4.4V5', '?': 'M0 0H4V3H2V4.4M2 5.4V6',
  '!': 'M2 0V4.4M2 5.4V6', ',': 'M2 5L1.4 6.4', "'": 'M2 0V1.6', '(': 'M3 0L2 1V5L3 6', ')': 'M1 0L2 1V5L1 6', '+': 'M2 1.5V4.5M0.5 3H3.5',
  '#': 'M1 0V6M3 0V6M0 2H4M0 4H4', '%': 'M4 0L0 6M0.5 0.5V1.5M3.5 4.5V5.5', '@': 'M3 4V2H1V4H4V0H0V6H4', '&': 'M4 6L1 2V0H3V2L0 4V6H3L4 4',
  '=': 'M0.5 2H3.5M0.5 4H3.5', '>': 'M1 0L4 3L1 6', '<': 'M3 0L0 3L3 6', '*': 'M2 1V5M0.5 2L3.5 4M3.5 2L0.5 4',
}
export const FONT_CHARS = Object.keys(FONT).join('')

// One line of text as a path d, glyph cells `size` wide (6/4 that tall).
export function vtext(str, x, y, size = 4) {
  const s = size / 4, adv = size * 1.35
  let d = ''
  ;[...String(str).toUpperCase()].forEach((ch, i) => {
    const g = FONT[ch]
    if (!g) return
    const ox = x + i * adv
    d += g.replace(/([MLHVZ])([^MLHVZ]*)/g, (_, c, args) => {
      const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : []
      if (c === 'H') return 'H' + f1(ox + n[0] * s)
      if (c === 'V') return 'V' + f1(y + n[0] * s)
      if (c === 'Z') return 'Z'
      const out = []
      for (let k = 0; k < n.length; k += 2) out.push(`${f1(ox + n[k] * s)} ${f1(y + n[k + 1] * s)}`)
      return c + out.join('L')
    })
  })
  return d
}
export const textWidth = (str, size = 4) => String(str).length * size * 1.35

// What each kind of context looks like as a card, and its tint.
const KIND_TINT = { user: '#ffd9a8', chat: '#ffe9c9', code: '#9cc0ff', doc: '#d2b4ff', tool: '#8ff0cf' }

// Fallback when the real items aren't known yet (and for the preview page).
export function feedFromPercent(pct) {
  const n = Math.round(clamp((pct ?? 0) / 100) * 34) + 3
  return [
    { kind: 'chat', n: Math.round(n * 0.58) },
    { kind: 'tool', n: Math.round(n * 0.18) },
    { kind: 'code', n: Math.round(n * 0.14) },
    { kind: 'doc', n: Math.max(1, Math.round(n * 0.1)) },
  ]
}

// Example thumbnails for the preview page: a plausible session, oldest first.
export function sampleThumbs(pct) {
  const r = rng(77)
  const pool = [
    { kind: 'doc', label: 'CLAUDE.MD' }, { kind: 'code', label: 'SYSTEM PROMPT' }, { kind: 'tool', label: 'TOOLS' },
    { kind: 'user', label: 'FIX THE REFUND' }, { kind: 'tool', label: 'GREP' }, { kind: 'tool', label: 'READ CONFIG.TS' },
    { kind: 'chat', label: 'THE REFUND PATH' }, { kind: 'code', label: 'FUNCTION TOTAL' }, { kind: 'tool', label: 'BASH NPM TEST' },
    { kind: 'user', label: 'ADD A TEST' }, { kind: 'tool', label: 'EDIT TESTS' }, { kind: 'chat', label: 'DONE. THE TEST' },
    { kind: 'user', label: 'NOW THE EXPORT' }, { kind: 'tool', label: 'READ EXPORT.PHP' }, { kind: 'code', label: 'SELECT SUM' },
    { kind: 'chat', label: 'THE CSV COLUMN' }, { kind: 'tool', label: 'WRITE PLAN.MD' }, { kind: 'doc', label: 'NOTES.MD' },
  ]
  const n = Math.round(clamp((pct ?? 0) / 100) * 34) + 4
  const out = []
  for (let i = 0; i < n; i++) {
    const t = pool[i % pool.length]
    const lines = []
    const L = 2 + Math.floor(r() * 4)
    for (let k = 0; k < L; k++) lines.push(f1(0.35 + r() * 0.65))
    out.push({ ...t, lines, indents: t.kind === 'code' ? lines.map((_, k) => (k % 3) + (k ? 1 : 0)) : undefined })
  }
  return out
}

// One thumbnail, centred on 0,0. Lines are fractions of the card's text width.
function thumbCard(t, col, panel) {
  const W = 74
  const lines = (t.lines || [0.8, 0.6]).slice(0, 6)
  const hasLabel = !!t.label
  const H = 12 + (hasLabel ? 9 : 0) + lines.length * 5.4
  const x0 = -W / 2, y0 = -H / 2
  const bar = (x, y, w, c = col, o = 0.6) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(3, w))}" height="2.4" rx="1.2" fill="${c}" opacity="${o}"/>`
  let shell = '', bodyX = x0 + 6, textW = W - 12, y = y0 + 6
  if (t.kind === 'doc') {
    shell = `<path d="M${x0} ${y0}H${W / 2 - 8}L${W / 2} ${y0 + 8}V${-y0}H${x0}Z" fill="${panel}" fill-opacity=".88" stroke="${col}" stroke-opacity=".85" stroke-width="1.1"/><path d="M${W / 2 - 8} ${y0}V${y0 + 8}H${W / 2}" fill="none" stroke="${col}" stroke-opacity=".85" stroke-width="1.1"/>`
  } else if (t.kind === 'user') {
    shell = `<path d="M${x0 + 5} ${y0}H${W / 2 - 5}Q${W / 2} ${y0} ${W / 2} ${y0 + 5}V${-y0 + 5}L${W / 2 - 7} ${-y0}H${x0 + 5}Q${x0} ${-y0} ${x0} ${-y0 - 5}V${y0 + 5}Q${x0} ${y0} ${x0 + 5} ${y0}Z" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-opacity=".9" stroke-width="1.1"/>`
  } else {
    shell = `<rect x="${x0}" y="${y0}" width="${W}" height="${f1(H)}" rx="4" fill="${panel}" fill-opacity=".88" stroke="${col}" stroke-opacity=".85" stroke-width="1.1"/>`
    if (t.kind === 'code') {
      shell += `<rect x="${x0}" y="${y0}" width="${W}" height="5" rx="2.5" fill="${col}" opacity=".3"/><circle cx="${x0 + 4}" cy="${y0 + 2.5}" r="1" fill="${col}"/><circle cx="${x0 + 7.5}" cy="${y0 + 2.5}" r="1" fill="${col}"/>`
      y += 2
    }
    if (t.kind === 'tool') {
      shell += `<path d="M${x0 + 5} ${y0 + 4.5}l3 2.2-3 2.2" fill="none" stroke="${col}" stroke-width="1.3"/>`
    }
  }
  let label = ''
  if (hasLabel) {
    const lx = t.kind === 'tool' ? bodyX + 6 : bodyX
    const maxChars = Math.floor((W - 12 - (lx - bodyX)) / (3.4 * 1.35))
    label = `<path d="${vtext(t.label.slice(0, maxChars), lx, y, 3.4)}" fill="none" stroke="${col}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`
    y += 9
  }
  let body = ''
  lines.forEach((w, k) => {
    const ind = t.indents ? Math.min(4, t.indents[k] || 0) * 4 : 0
    const c = t.kind === 'code' && k % 2 ? '#ffd08a' : col
    body += bar(bodyX + ind, y + k * 5.4, (textW - ind) * w, c, k === 0 && !hasLabel ? 0.9 : 0.55)
  })
  return shell + label + body
}

// Real constellations, roughly to shape, in a unit box (y down). [x, y, magnitude-ish size]
const CONSTELLATIONS = [
  { name: 'URSA MAJOR', box: [70, 70, 300, 150], stars: [[0, 0.32, 1.6], [0.17, 0.18, 1.9], [0.3, 0.13, 1.9], [0.46, 0.2, 1.3], [0.52, 0.48, 1.7], [0.82, 0.52, 1.8], [0.78, 0.18, 2.1]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: 'CASSIOPEIA', box: [1270, 70, 250, 110], stars: [[0, 0.25, 1.7], [0.24, 0.72, 1.9], [0.47, 0.38, 2.1], [0.7, 0.8, 1.7], [0.95, 0.15, 1.6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'ORION', box: [80, 560, 210, 290], stars: [[0.12, 0.12, 2.4], [0.74, 0.16, 1.9], [0.38, 0.5, 1.6], [0.48, 0.47, 1.7], [0.58, 0.44, 1.6], [0.24, 0.9, 1.7], [0.82, 0.86, 2.4], [0.44, 0, 1.2]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]] },
  { name: 'CYGNUS', box: [1330, 520, 220, 270], stars: [[0.5, 0, 2.2], [0.5, 0.36, 1.8], [0.5, 0.96, 1.6], [0.08, 0.48, 1.6], [0.92, 0.24, 1.6], [0.5, 0.64, 1.2]], lines: [[0, 1], [1, 5], [5, 2], [3, 1], [1, 4]] },
]

function constellations(p, r) {
  const { A, B, spd } = p
  let out = ''
  CONSTELLATIONS.forEach((c, ci) => {
    const [bx, by, bw, bh] = c.box
    const pts = c.stars.map(([x, y, m]) => [f1(bx + x * bw), f1(by + y * bh), m])
    const lines = c.lines.map(([a, b]) => `M${pts[a][0]} ${pts[a][1]}L${pts[b][0]} ${pts[b][1]}`).join('')
    out += `<path class="cl" d="${lines}" fill="none" stroke="${B}" stroke-width="1" stroke-dasharray="2 4" style="animation-delay:${f1(-ci * 2.3)}s"/>`
    pts.forEach(([x, y, m], k) => {
      const d = f1(-r() * 6)
      out += `<circle class="ch" cx="${x}" cy="${y}" r="${f1(m * 4)}" fill="${B}" style="animation-delay:${d}s;transform-origin:${x}px ${y}px"/><circle cx="${x}" cy="${y}" r="${f1(m * 0.95)}" fill="${k % 3 ? '#ffffff' : mix(B, '#ffffff', 0.5)}"/>`
    })
    out += `<path d="${vtext(c.name, bx, by + bh + 16, 4.4)}" fill="none" stroke="${B}" stroke-opacity=".45" stroke-width=".9"/>`
  })
  return out
}

// Rare events: one comet and a few shooting stars, each on its own long cycle.
function skyEvents(p, seed, opts = {}) {
  const r = rng(seed)
  const { A, B } = p
  // comet: crosses the upper sky during the first ~13% of a long cycle
  const cx = 1700, cy = -60 + r() * 220, ang = f1(160 + r() * 14) // heading left and slightly down
  const comet = `<g transform="translate(${cx} ${f1(cy)}) rotate(${ang})"><g class="comet" style="animation-delay:${opts.cometDelay != null ? f1(opts.cometDelay) : f1(-r() * 40)}s">
<path d="M0 -5C-70 -14 -260 -40 -470 -30C-280 -6 -80 4 0 5Z" fill="url(#cdust)"/>
<path d="M0 -2.2L-520 -4L-520 4L0 2.2Z" fill="url(#cion)"/>
<path d="M0 -1L-380 -2" stroke="#d6b3ff" stroke-opacity=".45" stroke-width="1"/>
<circle r="30" fill="url(#ccoma)"/><circle r="2.8" fill="#ffffff"/></g></g>`
  let meteors = ''
  for (let i = 0; i < 3; i++) {
    const mx = f1(200 + r() * 1300), my = f1(30 + r() * 300), a = f1(140 + r() * 30)
    meteors += `<g transform="translate(${mx} ${my}) rotate(${a})"><g class="met" style="animation-duration:${[37, 53, 71][i]}s;animation-delay:${f1(-r() * 30)}s"><path d="M0 0L-150 0" stroke="url(#mtail)" stroke-width="1.6" stroke-linecap="round"/><circle r="1.6" fill="#ffffff"/></g></g>`
  }
  const defs = `<linearGradient id="cdust" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a3d" stop-opacity="0"/><stop offset=".45" stop-color="#ffb347" stop-opacity=".25"/><stop offset=".85" stop-color="#ffe2a8" stop-opacity=".6"/><stop offset="1" stop-color="#fff6e0" stop-opacity=".9"/></linearGradient>
<linearGradient id="cion" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5cff" stop-opacity="0"/><stop offset=".4" stop-color="#6f7dff" stop-opacity=".35"/><stop offset=".8" stop-color="#4fd2ff" stop-opacity=".75"/><stop offset="1" stop-color="#c8f6ff" stop-opacity=".95"/></linearGradient>
<radialGradient id="ccoma" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".18" stop-color="#d9fff0" stop-opacity=".85"/><stop offset=".45" stop-color="#5dffc0" stop-opacity=".4"/><stop offset=".75" stop-color="#3ab8ff" stop-opacity=".15"/><stop offset="1" stop-color="#3ab8ff" stop-opacity="0"/></radialGradient>
<linearGradient id="mtail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-150" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></linearGradient>`
  // Timings stay slow: the comet takes ~12s to cross, a meteor ~1s, and each is alone in its cycle.
  const css = `
.comet{opacity:0;animation:comet 95s linear infinite}
@keyframes comet{0%{transform:translateX(0);opacity:0}1.2%{opacity:1}12%{opacity:1}13%{transform:translateX(2400px);opacity:0}100%{transform:translateX(2400px);opacity:0}}
.met{opacity:0;animation:met linear infinite}
@keyframes met{0%{transform:translateX(0);opacity:0}0.4%{opacity:.9}1.8%{transform:translateX(520px);opacity:0}100%{transform:translateX(520px);opacity:0}}`
  return { svg: comet + meteors, defs, css }
}

function space(p, opts) {
  const { A, B, spd, h } = p
  const pct = opts.pct ?? 0
  const R = holeRadius(pct)
  const CX = 800, CY = 480
  const core = mix(A, '#ffffff', 0.62)
  p.veil = 0.3
  const r = rng(42)

  // stars
  let stars = '', tw = ''
  for (let i = 0; i < 200; i++) {
    const x = f1(r() * 1600), y = f1(r() * 1000)
    const s = f1(0.5 + Math.pow(r(), 3) * 1.6)
    const c = r() < 0.3 ? B : r() < 0.15 ? A : '#ffffff'
    const o = f1(0.25 + r() * 0.65)
    if (i % 7 === 0) tw += `<circle class="tw" cx="${x}" cy="${y}" r="${s}" fill="${c}" opacity="${o}" style="animation-delay:${f1(-r() * 7)}s"/>`
    else stars += `<circle cx="${x}" cy="${y}" r="${s}" fill="${c}" opacity="${o}"/>`
  }
  const dust = `<ellipse cx="260" cy="180" rx="420" ry="160" fill="url(#neb)" transform="rotate(-18 260 180)"/><ellipse cx="1380" cy="860" rx="460" ry="150" fill="url(#neb)" transform="rotate(-12 1380 860)"/>`
  const sky = constellations(p, r)
  const ev = skyEvents(p, 1000 + Math.round(opts.seed ?? pct * 7), opts)

  // halo of lensed far-side disk: offset upward so the top arc is fat, the bottom thin
  const HY = f1(-0.24 * R)
  const haloR = f1(1.72 * R)
  let haloStreaks = ''
  ;[[1.14, '12 8 3 2', 0.5, 30], [1.3, '20 5', 0.32, 44], [1.48, '6 4', 0.22, 60], [1.62, '9 16', 0.18, 80]].forEach(([k, dash, o, dur], i) => {
    haloStreaks += `<circle class="hs" cx="0" cy="${HY}" r="${f1(k * R)}" pathLength="100" fill="none" stroke="${core}" stroke-opacity="${o}" stroke-width="${f1(Math.max(1, R * 0.035))}" stroke-dasharray="${dash}" style="animation-duration:${f1(dur / spd)}s${i % 2 ? ';animation-direction:reverse' : ''}"/>`
  })

  // front of the accretion disk: thin and bright, crossing in front of the shadow
  const D = f1(4.4 * R)
  let diskStreaks = ''
  ;[[0.95, 0.07, '14 6', 0.55, 22], [0.75, 0.055, '8 2', 0.5, 16], [0.55, 0.04, '20 5', 0.6, 11], [0.38, 0.03, '6 4', 0.7, 8]].forEach(([k, ky, dash, o, dur]) => {
    diskStreaks += `<ellipse class="ds" rx="${f1(k * 4.4 * R)}" ry="${f1(ky * 4.4 * R)}" pathLength="100" fill="none" stroke="${core}" stroke-opacity="${o}" stroke-width="${f1(Math.max(0.8, R * 0.018))}" stroke-dasharray="${dash}" style="animation-duration:${f1(dur / spd)}s"/>`
  })

  // Context thumbnails, oldest first. Each one's place in the fall is set by its age, so the
  // oldest sit nearest the horizon and go first; all share one fall time so the order holds.
  const thumbs = opts.thumbs ?? sampleThumbs(pct)
  const bands = [3.7, 3.95, 4.2, 4.45]
  // a quarter of the first size: specks of context rather than readable cards
  const cs = Math.round(((1.2 + R / 450) / 4) * 100) / 100
  const panel = mix(p.bg1, '#000000', 0.2)
  const T = f1(220 / spd)
  let cardCss = ''
  bands.forEach((k, b) => {
    const rx = f1(k * R), ry = f1(k * R * 0.3)
    cardCss += `@keyframes ox${b}{from{transform:translateX(-${rx}px)}to{transform:translateX(${rx}px)}}
@keyframes oy${b}{from{transform:translateY(-${ry}px);opacity:.3}to{transform:translateY(${ry}px);opacity:1}}
@keyframes fa${b}{0%{transform:scale(1);opacity:0}3%{opacity:1}86%{opacity:.9}100%{transform:scale(${f1((1.0 / k) * 100) / 100});opacity:0}}
`
  })
  const N = thumbs.length
  const cardStrs = thumbs.map((t, i) => {
    const b = i % bands.length
    const k = bands[b]
    const P = f1((2.4 * Math.pow(k, 1.5)) / spd) // half-orbit seconds
    const prog = N > 1 ? 0.9 - 0.86 * (i / (N - 1)) : 0.2
    const ph = f1(-r() * 2 * P)
    const tilt = f1((r() - 0.5) * 18)
    const sc = Math.round(cs * (0.85 + r() * 0.3) * 100) / 100
    const tint = mix(KIND_TINT[t.kind] || KIND_TINT.chat, A, h * 0.55)
    return `<g style="animation:fa${b} ${T}s linear ${f1(-prog * T)}s infinite"><g style="animation:ox${b} ${P}s ease-in-out ${ph}s infinite alternate"><g style="animation:oy${b} ${P}s ease-in-out ${f1(ph - P / 2)}s infinite alternate"><g transform="rotate(${tilt}) scale(${sc})">${thumbCard(t, tint, panel)}</g></g></g></g>`
  })
  // keep the scene under the size limit: the oldest thumbnails go first
  let budget = 112000 - (stars.length + tw.length + sky.length + ev.svg.length + 16000)
  const kept = []
  for (let i = cardStrs.length - 1; i >= 0; i--) {
    if (budget - cardStrs[i].length < 0) break
    budget -= cardStrs[i].length
    kept.unshift(cardStrs[i])
  }
  const cards = kept.join('')

  p.defs = `<radialGradient id="bloom" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${A}" stop-opacity=".34"/><stop offset=".35" stop-color="${A}" stop-opacity=".1"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset=".49" stop-color="${core}" stop-opacity="0"/><stop offset=".56" stop-color="${core}" stop-opacity=".95"/><stop offset=".64" stop-color="${A}" stop-opacity=".8"/><stop offset=".8" stop-color="${A}" stop-opacity=".3"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient>
<linearGradient id="disk" gradientUnits="userSpaceOnUse" x1="-${D}" y1="0" x2="${D}" y2="0"><stop offset="0" stop-color="${A}" stop-opacity="0"/><stop offset=".26" stop-color="${A}" stop-opacity=".55"/><stop offset=".42" stop-color="${core}" stop-opacity="1"/><stop offset=".5" stop-color="#ffffff" stop-opacity="1"/><stop offset=".6" stop-color="${core}" stop-opacity=".9"/><stop offset=".76" stop-color="${A}" stop-opacity=".45"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></linearGradient>
<radialGradient id="neb" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${B}" stop-opacity=".09"/><stop offset="1" stop-color="${B}" stop-opacity="0"/></radialGradient>
${ev.defs}`

  const css = `
.tw{animation:tw 7s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.25}50%{opacity:.9}}
.ch{opacity:.12;animation:ch 5.5s ease-in-out infinite}
@keyframes ch{0%,100%{opacity:.06;transform:scale(.6)}50%{opacity:.3;transform:scale(1.15)}}
.cl{opacity:.28;animation:cl 9s ease-in-out infinite}
@keyframes cl{0%,100%{opacity:.16}50%{opacity:.4}}
.bl{animation:bl ${f1(8 / spd)}s ease-in-out infinite}
@keyframes bl{0%,100%{opacity:.75;transform:scale(.97)}50%{opacity:1;transform:scale(1.03)}}
.hs{animation:spin linear infinite}
.ds{animation:spin linear infinite reverse}
@keyframes spin{from{stroke-dashoffset:0}to{stroke-dashoffset:100}}
${ev.css}
${cardCss}`

  const body = `${dust}${stars}${tw}${sky}${ev.svg}
<g transform="translate(${CX} ${CY})">
<g class="bl"><circle r="${f1(5.2 * R)}" fill="url(#bloom)"/></g>
<ellipse cx="0" cy="${HY}" rx="${haloR}" ry="${haloR}" fill="url(#halo)"/>
${haloStreaks}
<circle r="${f1(R)}" fill="#000000"/>
<circle r="${f1(R * 1.02)}" fill="none" stroke="${core}" stroke-opacity=".9" stroke-width="${f1(Math.max(1.2, R * 0.022))}"/>
<ellipse rx="${D}" ry="${f1(0.3 * R)}" fill="url(#disk)" opacity=".22"/>
<ellipse rx="${D}" ry="${f1(0.11 * R)}" fill="url(#disk)"/>
${diskStreaks}
${cards}
</g>`
  return frame(p, body, css, opts)
}

const BUILDERS = { grid, rain, circuit, radar, plasma, space }

// opts: { pct, showPct, thumbs, seed }
export function buildScene(kind, heat = 0, opts = {}) {
  return BUILDERS[kind](palette(kind, clamp(heat)), opts)
}
