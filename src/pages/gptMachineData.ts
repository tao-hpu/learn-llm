/** 旧页三个容器 id 长度都是 8，噪声相位用这个长度。 */
export const HOST_LEN = 8
export const TG = 5

export const PARTS_EMB = [
  { name: 'token_emb', size: '65×128', cls: 'emb' },
  { name: 'pos_emb', size: '64×128', cls: 'emb' },
]
export const PARTS_BLK = [1, 2, 3, 4].flatMap((L) => [
  { name: `L${L}·Wq/Wk/Wv`, size: '128×32 ×4头', cls: 'attn' },
  { name: `L${L}·proj`, size: '128×128', cls: 'attn' },
  { name: `L${L}·FFN①`, size: '128×512', cls: 'ffn' },
  { name: `L${L}·FFN②`, size: '512×128', cls: 'ffn' },
])
export const PARTS_FIN = [
  { name: 'ln_f', size: '128', cls: 'fin' },
  { name: 'lm_head', size: '128×65', cls: 'fin' },
]
export const PART_TOTAL = PARTS_EMB.length + PARTS_BLK.length + PARTS_FIN.length

export const PRESETS = [
  { name: 'ROMEO:', prompt: 'ROMEO:', gen: ' But the' },
  { name: 'To be', prompt: 'To be', gen: ' so so' },
  { name: 'First Ci', prompt: 'First Ci', gen: 'tizen,' },
]
export const PROBS = [0.46, 0.18, 0.14, 0.13, 0.09]

export const TOK = ['R', 'O', 'M', 'E', 'O', ':']
export const ATTN = {
  cell: 40,
  gx: 108,
  gy: 58,
  qx: 432,
  kx: 528,
  ty0: 74,
  tgap: 44,
  nw: 34,
  nh: 26,
}

export const FFN_XI = 150
export const FFN_XH = 480
export const FFN_XO = 810
export const FFN_IN_Y = Array.from({ length: 8 }, (_, i) => 80 + i * 36)
export const FFN_HID_Y = Array.from({ length: 12 }, (_, j) => 70 + j * 23.5)
export const FFN_OUT_Y = Array.from({ length: 8 }, (_, k) => 80 + k * 36)

export function noiseAt(a: number) {
  const x = Math.sin(a * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function structColor(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(247 - 32 * x)},${Math.round(230 - 112 * x)},${Math.round(222 - 143 * x)})`
}

export function embColor(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(229 - 160 * x)},${Math.round(235 - 150 * x)},${Math.round(249 - 70 * x)})`
}

export function showChar(c: string) {
  return c === ' ' ? '␣' : c
}

export function candsOf(ch: string) {
  return [ch, ' ', 'e', 't', 'o', 'h'].filter((c, i, a) => a.indexOf(c) === i).slice(0, 5)
}

export function attnWeights(r: number, l: number) {
  const w: number[] = []
  for (let s = 0; s <= r; s++) {
    let v = Math.exp(-(0.45 + 0.13 * l) * (r - s))
    v *= 0.65 + 0.7 * noiseAt((s + 1) * (l * 2.3 + 1) + (r + 1) * 1.7)
    if (s === 0) v *= 1.3
    if (s === r) v *= 1.45
    w.push(v)
  }
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / sum)
}

export function hmColor(w: number) {
  const t = Math.pow(Math.max(0, Math.min(1, w)), 0.6)
  return `rgb(${Math.round(244 - 27 * t)},${Math.round(242 - 123 * t)},${Math.round(234 - 147 * t)})`
}

export const FFN_DEAD = Array.from({ length: 12 }, (_, j) => noiseAt(j * 17 + 3) < 0.4)

export const FFN_LINES: { side: 1 | 2; j: number; x1: number; y1: number; x2: number; y2: number }[] = []
for (let j = 0; j < 12; j++) {
  const i1 = Math.floor(noiseAt(j * 3 + 1) * 8)
  const i2 = Math.floor(noiseAt(j * 7 + 2) * 8)
  for (const i of [i1, i2]) {
    FFN_LINES.push({
      side: 1,
      j,
      x1: FFN_XI + 13,
      y1: FFN_IN_Y[i],
      x2: FFN_XH - 11,
      y2: FFN_HID_Y[j],
    })
  }
  const k1 = Math.floor(noiseAt(j * 5 + 4) * 8)
  const k2 = Math.floor(noiseAt(j * 9 + 6) * 8)
  for (const k of [k1, k2]) {
    FFN_LINES.push({
      side: 2,
      j,
      x1: FFN_XH + 11,
      y1: FFN_HID_Y[j],
      x2: FFN_XO - 13,
      y2: FFN_OUT_Y[k],
    })
  }
}
