export const CHARS = ['T', 'o', '␣', 'b', 'e', '␣', 'o', 'r']

export const SHAKE = 'First Citizen: Before we proceed any further, hear me speak. All: Speak, speak. First Citizen: You are all resolved rather to die than to famish? You know Caius Marcius is chief enemy to the people.'
export const BROWS = 5
export const TLEN = 8

export function showChar(c: string) {
  return c === ' ' ? '␣' : c
}

export function batchStarts(seed: number) {
  const max = SHAKE.length - TLEN
  const st: number[] = []
  for (let r = 0; r < BROWS; r++) st.push(((seed * 131 + r * 617 + 7) % max + max) % max)
  return st
}

export function vhash(ch: string, i: number) {
  const x = Math.sin((ch.charCodeAt(0) || 32) * 12.9898 + i * 78.233) * 43758.5453
  return ((x - Math.floor(x)) * 2 - 1).toFixed(2)
}

export const A_ONES = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
export const A_TRIL = [[1, 0, 0], [1, 1, 0], [1, 1, 1]]
export const A_NORM = [[1, 0, 0], [0.5, 0.5, 0], [0.3333, 0.3333, 0.3333]]
export const MB = [[0, 1], [2, 3], [4, 5]]
export const MC = [[0, 1], [1, 2], [2, 3]]

export function f2(v: number) {
  return v === 0 ? '0' : (Number.isInteger(v) ? v.toString() : v.toFixed(2))
}

export function wf(v: number) {
  if (Math.abs(v - 1 / 3) < 0.02) return '⅓'
  if (v === 0.5) return '½'
  if (v === 1) return '1'
  return v.toFixed(2)
}

export const PX = [2, 0, 1, 3]
export const WQ = [[1, 0, -1, 0], [0, 1, 0, 1], [1, 1, 0, -1], [0, -1, 1, 0]]
export const WK = [[0, 1, 1, 0], [1, 0, -1, 1], [-1, 1, 0, 0], [1, 0, 1, -1]]
export const WV = [[1, 1, 0, 1], [0, -1, 1, 0], [1, 0, 1, 1], [0, 1, -1, 0]]

export function matvec(x: number[], W: number[][]) {
  const out: number[] = []
  for (let j = 0; j < 4; j++) {
    let s = 0
    for (let i = 0; i < 4; i++) s += x[i] * W[i][j]
    out.push(s)
  }
  return out
}

const T = 8
export const RAW: number[][] = []
for (let i = 0; i < T; i++) {
  RAW[i] = []
  for (let j = 0; j < T; j++) RAW[i][j] = (Math.sin(i * 1.3 + j * 2.1) * 0.5 + 0.5) * 18 - 2
}
export const DSCALE = Math.sqrt(32)

export function heatColor(v: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)))
  const r = Math.round(240 - 23 * t)
  const g = Math.round(238 - 119 * t)
  const b = Math.round(230 - 143 * t)
  return { bg: `rgb(${r},${g},${b})`, fg: t > 0.55 ? '#fff' : '#6B6B68' }
}

export type HeatCell = { text: string; mask: boolean; bg?: string; fg?: string }

export function heatGrid(n: number): HeatCell[] {
  let data: number[][]
  let opt: 'raw' | 'scaled' | 'prob'
  if (n === 0) {
    data = RAW
    opt = 'raw'
  } else if (n === 1) {
    data = RAW.map((r) => r.map((v) => v / DSCALE))
    opt = 'scaled'
  } else if (n === 2) {
    data = RAW.map((r, i) => r.map((v, j) => (j > i ? -Infinity : v / DSCALE)))
    opt = 'scaled'
  } else {
    opt = 'prob'
    data = []
    for (let i = 0; i < T; i++) {
      const ex: number[] = []
      let sum = 0
      for (let j = 0; j < T; j++) {
        const v = j > i ? -Infinity : RAW[i][j] / DSCALE
        const e = v === -Infinity ? 0 : Math.exp(v)
        ex.push(e)
        sum += e
      }
      data.push(ex.map((e) => e / sum))
    }
  }
  const flat = data.flat().filter((v) => Number.isFinite(v))
  const min = Math.min(...flat)
  const max = Math.max(...flat)
  const cells: HeatCell[] = []
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < T; j++) {
      const v = data[i][j]
      if (v === -Infinity) {
        cells.push({ text: '-∞', mask: true })
        continue
      }
      const col = heatColor(v, min, max)
      const text = opt === 'prob' ? (v < 0.005 ? '' : v.toFixed(2)) : v.toFixed(opt === 'scaled' ? 1 : 0)
      cells.push({ text, mask: false, bg: col.bg, fg: col.fg })
    }
  }
  return cells
}

export const AGG_TOK = ['T', 'o', '␣', 'b']
export const AGG_WEI = [[1, 0, 0, 0], [0.3, 0.7, 0, 0], [0.2, 0.1, 0.7, 0], [0.1, 0.5, 0.1, 0.3]]
export const AGG_V = [[2, 0, 1], [1, 3, 0], [0, 1, 2], [3, 1, 1]]

export function awf(v: number) {
  return v === 0 ? '0' : (Number.isInteger(v) ? String(v) : v.toFixed(2))
}

export function aggRow(i: number) {
  const o = [0, 0, 0]
  for (let j = 0; j <= i; j++) for (let d = 0; d < 3; d++) o[d] += AGG_WEI[i][j] * AGG_V[j][d]
  return o
}

export const TRUTHS = [
  { name: 'token_emb', size: '65×32' },
  { name: 'pos_emb', size: '8×32' },
  { name: 'Wq', size: '32×32' },
  { name: 'Wk', size: '32×32' },
  { name: 'Wv', size: '32×32' },
  { name: 'lm_head', size: '32×65' },
]

export function truthColor(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(247 - 32 * x)},${Math.round(230 - 112 * x)},${Math.round(222 - 143 * x)})`
}

export function truthNoise(a: number) {
  const x = Math.sin(a * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function truthT(trained: boolean, mi: number, i: number, j: number) {
  return trained ? (0.5 + 0.45 * Math.sin(i * 0.9 + j * 1.25 + mi * 1.7)) : truthNoise(mi * 97 + i * 13 + j * 7 + 1)
}

export const L_START = Math.log(65)
export const L_WALL = 2.49
export const L_FLOOR = 2.41
const L_TAU = 380
export const L_SMAX = 5000
const LY_MIN = 2.2
const LY_MAX = 4.3

export function lcX(s: number) { return 44 + s / L_SMAX * 716 }
export function lcY(v: number) { return 16 + (LY_MAX - v) / (LY_MAX - LY_MIN) * 198 }

export function lossAt(s: number) {
  const base = L_FLOOR + (L_START - L_FLOOR) * Math.exp(-s / L_TAU)
  const wob = s > 150 ? 0.012 * Math.sin(s / 120) : 0
  return Math.max(L_FLOOR, base + wob)
}
