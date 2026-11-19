/** 第 14 章常量与读数公式。数字来自 12_sparse_attn.py 的训练记录。 */

export const BLOCK_SIZE = 256
export const BLOCK_LEN = 8
export const TOP_N = 4
export const WINDOW = 32
export const NB = BLOCK_SIZE / BLOCK_LEN

export const STEPS = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 3999]

export interface GateLayer {
  cmp: number
  sel: number
  win?: number
}

export interface LmRun {
  name: string
  branches: string
  params: number
  read_last: number
  read_avg: number
  sec: number
  train: number
  val: number
  curve: number[]
  gates?: GateLayer[]
  gate_last?: GateLayer
}

export interface RcRun {
  name: string
  params: number
  sec: number
  acc: number
  val: number
  gates?: GateLayer[]
  gate_last?: GateLayer
}

export const LM: Record<'full' | 'win' | 'cmpsel' | 'nsa', LmRun> = {
  full: {
    name: '全注意力', branches: 'full', params: 742849, read_last: 256, read_avg: 128.5, sec: 801,
    train: 1.2011, val: 1.5038, curve: [4.268, 1.7186, 1.5985, 1.5445, 1.5269, 1.5273, 1.4946, 1.4998, 1.5038],
  },
  win: {
    name: '只滑窗', branches: 'win', params: 749041, read_last: 32, read_avg: 30.1, sec: 920,
    train: 1.2034, val: 1.5052, curve: [4.3647, 1.7004, 1.6105, 1.5462, 1.54, 1.5216, 1.5133, 1.5184, 1.5052],
  },
  cmpsel: {
    name: '压缩+挑选', branches: 'cmp+sel', params: 881649, read_last: 65, read_avg: 46.7, sec: 1315,
    train: 1.2674, val: 1.5321, curve: [4.38, 1.8396, 1.7423, 1.669, 1.6048, 1.5655, 1.543, 1.5439, 1.5321],
    gates: [{ cmp: 0.235, sel: 0.252 }, { cmp: 0.07, sel: 0.574 }, { cmp: 0.122, sel: 0.536 }, { cmp: 0.196, sel: 0.515 }],
    gate_last: { cmp: 0.191, sel: 0.538 },
  },
  nsa: {
    name: 'NSA 三支路', branches: 'cmp+sel+win', params: 947185, read_last: 97, read_avg: 76.8, sec: 2756,
    train: 1.1921, val: 1.4825, curve: [4.3673, 1.7087, 1.5858, 1.5357, 1.5297, 1.5032, 1.482, 1.497, 1.4825],
    gates: [
      { cmp: 0.076, sel: 0.149, win: 0.424 },
      { cmp: 0.057, sel: 0.134, win: 0.516 },
      { cmp: 0.127, sel: 0.207, win: 0.598 },
      { cmp: 0.14, sel: 0.255, win: 0.637 },
    ],
    gate_last: { cmp: 0.145, sel: 0.232, win: 0.652 },
  },
}

export const LM_ORDER = ['full', 'win', 'cmpsel', 'nsa'] as const
export type LmKey = typeof LM_ORDER[number]

export const LM_PROBES = [15, 31, 47, 63, 79, 95, 111, 127, 143, 159, 175, 191, 207, 223, 239, 255]
export const LM_CHOSEN = [
  [0, 1], [0, 1, 2, 3], [1, 2, 3, 5], [1, 2, 3, 7], [5, 6, 7, 9], [0, 1, 5, 11], [5, 10, 12, 13], [10, 11, 12, 15],
  [11, 12, 14, 17], [5, 11, 12, 19], [9, 11, 12, 21], [5, 14, 17, 23], [11, 12, 14, 25], [5, 20, 24, 27], [9, 11, 12, 29], [9, 12, 30, 31],
]
export const LM_TEXT = "e!\nDid I not bid thee meet me in the park,\nAnd bring along these rascal knaves with thee?\n\nGRUMIO:\nNathaniel's coat, sir, was not fully made,\nAnd Gabriel's pumps were all unpink'd i' the heel;\nThere was no link to colour Peter's hat,\nAnd Walter's dagger wa"

export const RC: Record<'full' | 'win' | 'nsa', RcRun> = {
  full: { name: '全注意力', params: 750816, sec: 1041, acc: 1.0, val: 0.0 },
  win: { name: '只滑窗', params: 757008, sec: 1452, acc: 0.0311, val: 3.4671 },
  nsa: {
    name: 'NSA 三支路', params: 955152, sec: 2458, acc: 0.9985, val: 0.0058,
    gates: [
      { cmp: 0.377, sel: 0.294, win: 0.411 },
      { cmp: 0.295, sel: 0.609, win: 0.356 },
      { cmp: 0.254, sel: 0.565, win: 0.38 },
      { cmp: 0.316, sel: 0.458, win: 0.437 },
    ],
    gate_last: { cmp: 0.302, sel: 0.468, win: 0.452 },
  },
}

export const RC_ORDER = ['full', 'win', 'nsa'] as const
export type RcKey = typeof RC_ORDER[number]
export const RC_T = 128
export const RC_PROBES = [97, 99, 101, 103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123, 125, 127]
export const RC_KEYS = [15, 29, 27, 17, 25, 19, 11, 3, 5, 1, 7, 21, 23, 13, 31, 9]
export const RC_CHOSEN = [
  [0, 2, 3, 12], [0, 2, 3, 12], [1, 5, 6, 12], [0, 3, 8, 12], [2, 3, 7, 13], [1, 2, 9, 13], [1, 2, 3, 13], [1, 9, 10, 13],
  [0, 3, 13, 14], [7, 9, 13, 14], [1, 11, 12, 14], [1, 6, 7, 14], [2, 9, 12, 15], [0, 5, 8, 15], [1, 7, 9, 15], [0, 2, 11, 15],
]

export const BR_KEYS = ['cmp', 'sel', 'win'] as const
export type BrKey = typeof BR_KEYS[number]
export const BR_NAME: Record<BrKey, string> = { cmp: '压缩', sel: '挑选', win: '滑窗' }

export type ReadBr = 'full' | Partial<Record<BrKey, boolean>>

export function tokensRead(t: number, br: ReadBr) {
  if (br === 'full') return t + 1
  let n = 0
  if (br.win) n += Math.min(t + 1, WINDOW)
  if (br.sel) n += Math.min(t + 1, TOP_N * BLOCK_LEN)
  if (br.cmp) n += Math.floor((t + 1) / BLOCK_LEN) + 1
  return n
}

export function readAvg(br: ReadBr) {
  let s = 0
  for (let t = 0; t < BLOCK_SIZE; t++) s += tokensRead(t, br)
  return s / BLOCK_SIZE
}

export const COL = {
  full: '#D97757',
  win: '#3f7d63',
  sel: '#3a63c0',
  cmp: '#a87b1f',
  cur: '#a3548c',
  unread: '#E9E6DC',
  future: '#fff',
}

export const SER_COL: Record<LmKey | RcKey, string> = {
  full: '#8C8A83',
  win: '#3f7d63',
  cmpsel: '#3a63c0',
  nsa: '#D97757',
}

export const CTX_LBL: Record<number, string> = {
  13: '8K', 14: '16K', 15: '32K', 16: '64K', 17: '128K', 18: '256K', 19: '512K', 20: '1M',
}

export function showCh(c: string) {
  if (c === ' ') return '·'
  if (c === '\n') return '↵'
  return c
}

export function recallStats() {
  let k = 0
  let v = 0
  let any = 0
  let far = 0
  let farKey = 0
  RC_PROBES.forEach((t, i) => {
    const ch = RC_CHOSEN[i]
    const kb = Math.floor(RC_KEYS[i] / BLOCK_LEN)
    const vb = Math.floor((RC_KEYS[i] + 1) / BLOCK_LEN)
    const cb = Math.floor(t / BLOCK_LEN)
    const hk = ch.includes(kb)
    const hv = ch.includes(vb)
    k += hk ? 1 : 0
    v += hv ? 1 : 0
    any += hk || hv ? 1 : 0
    ch.forEach((b) => {
      if (b !== cb) {
        far += 1
        if (b <= 3) farKey += 1
      }
    })
  })
  return { k, v, any, far, farKey }
}

export const NSA_ON = { cmp: true, sel: true, win: true }
