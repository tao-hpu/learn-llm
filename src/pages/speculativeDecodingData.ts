// 数字来自 14_mtp.py 在 RTX 4090 上的单种子记录。

export const PARAMS = { main: 742849, mtp: 214528, draft: 54657 }
export const VAL = { main_mtp: 1.5276, main_nomtp: 1.5357, mtp_head: 1.5332, draft: 1.8862 }
export const CAUSAL_MAXDIFF = 0.0
export const GREEDY = {
  prompts: 20,
  prompt_len: 8,
  tokens_each: 48,
  identical: { draft_g1: 20, draft_g4: 20, draft_g8: 20, mtp: 20 },
}

export const SC = {
  context: 'a forward guest\nWithin y',
  top: ['o', 'e', 'i', 'a', 't', 'r', 'v', 'O'],
  p: [0.9901, 0.0062, 0.003, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001],
  q: [0.9373, 0.0489, 0.0085, 0.0022, 0.0, 0.0009, 0.0, 0.0],
  spec: [0.9898, 0.0063, 0.0033, 0.0, 0.0001, 0.0001, 0.0, 0.0001],
  tv_spec_vs_p: 0.0005,
  tv_q_vs_p: 0.053,
  accept_rate: 0.9472,
  alpha_theory: 0.947,
}

export const MS = { main: 0.836, draft: 0.225 }

export type LedgerRow = {
  method: 'plain' | 'draft' | 'mtp'
  gamma: number
  main_forwards: number
  draft_forwards: number
  tokens_per_main: number
  alpha: number | null
  alpha_minpq?: number
  expected_tokens_per_main?: number
  seconds: number
  speedup_wall?: number
}

export const ROWS: LedgerRow[] = [
  { method: 'plain', gamma: 0, main_forwards: 600, draft_forwards: 0, tokens_per_main: 1.0, alpha: null, seconds: 0.53 },
  { method: 'draft', gamma: 1, main_forwards: 360, draft_forwards: 360, tokens_per_main: 1.667, alpha: 0.6667, alpha_minpq: 0.6706, expected_tokens_per_main: 1.667, seconds: 0.46, speedup_wall: 1.158 },
  { method: 'draft', gamma: 2, main_forwards: 261, draft_forwards: 522, tokens_per_main: 2.299, alpha: 0.7451, alpha_minpq: 0.7256, expected_tokens_per_main: 2.3, seconds: 0.43, speedup_wall: 1.238 },
  { method: 'draft', gamma: 3, main_forwards: 255, draft_forwards: 765, tokens_per_main: 2.353, alpha: 0.6699, alpha_minpq: 0.6828, expected_tokens_per_main: 2.419, seconds: 0.49, speedup_wall: 1.076 },
  { method: 'draft', gamma: 4, main_forwards: 219, draft_forwards: 876, tokens_per_main: 2.74, alpha: 0.7167, alpha_minpq: 0.7169, expected_tokens_per_main: 2.862, seconds: 0.51, speedup_wall: 1.041 },
  { method: 'draft', gamma: 6, main_forwards: 194, draft_forwards: 1164, tokens_per_main: 3.093, alpha: 0.7173, alpha_minpq: 0.7053, expected_tokens_per_main: 3.192, seconds: 0.56, speedup_wall: 0.944 },
  { method: 'draft', gamma: 8, main_forwards: 203, draft_forwards: 1624, tokens_per_main: 2.956, alpha: 0.6757, alpha_minpq: 0.7132, expected_tokens_per_main: 2.993, seconds: 0.71, speedup_wall: 0.747 },
  { method: 'mtp', gamma: 1, main_forwards: 317, draft_forwards: 317, tokens_per_main: 1.893, alpha: 0.8987, alpha_minpq: 0.8768, expected_tokens_per_main: 1.899, seconds: 0.42, speedup_wall: 1.27 },
]

export const TRACE = {
  text: "You accusit on, my good force. I am consumbly\nProve well, I have groanted as with a sovereign.\n\nvISABELLA:\nI cannot beheld he did anymon life,\nWith\nClifford's baseness to word on this day\nFall blood\nShall we are letter on all his alon. But,",
  marks: 'mamamamamamrramamamamamamamamamamramamamamramrramamamamamamamamamamamamramamamamamamamamamamamamamamamamamamamamamamamamamamamamamramramamamamramamamamamamamamamamamamamamamamramamamamamamramamamamamamamamamamamamramamramamamamamamamamamama',
}

function sum(a: readonly number[]) {
  return a.reduce((x, y) => x + y, 0)
}

export const P8 = SC.p.map((v) => v / sum(SC.p))
export const Q8 = SC.q.map((v) => v / sum(SC.q))
export const R8 = (() => {
  const raw = P8.map((v, i) => Math.max(0, v - Q8[i]))
  const total = sum(raw)
  return raw.map((v) => v / total)
})()

export const C_MEAS = MS.draft / MS.main
export const C_PRESETS = [Number(C_MEAS.toFixed(2)), 0.05, 0]
export const DRAFT_ROWS = ROWS.filter((r) => r.method === 'draft')
export const MTP_ROW = ROWS.find((r) => r.method === 'mtp') as LedgerRow
export const DRAFT_G1 = ROWS.find((r) => r.method === 'draft' && r.gamma === 1) as LedgerRow

export const S1_CTX = SC.context.slice(-8)
export const S1_DRAFT = 'ou sha'

const DIM = 128
const VOCAB = 65
function swHid(d: number) {
  return Math.floor((Math.floor((8 * d) / 3) + 7) / 8) * 8
}
function blockParams(d: number, nh: number, nkv: number) {
  const hs = d / nh
  return d * d + 2 * d * nkv * hs + d * d + 3 * d * swHid(d) + 2 * d
}

export const P_BLOCK = blockParams(DIM, 4, 2)
export const P_PROJ = 2 * DIM * DIM
export const P_NORMS = 2 * DIM
export const P_MTP_SUM = P_NORMS + P_PROJ + P_BLOCK
export const P_TOK = VOCAB * DIM
export const P_HEAD_SHARED = DIM * VOCAB + VOCAB + DIM

export function expTok(a: number, g: number) {
  return a >= 1 ? g + 1 : (1 - Math.pow(a, g + 1)) / (1 - a)
}

export function wallFac(a: number, g: number, c: number) {
  return expTok(a, g) / (g * c + 1)
}

export type Round = { s: number; n: number; k: 'first' | 'acc' | 'rej' }

export const ROUNDS: Round[] = (() => {
  const m = TRACE.marks
  const out: Round[] = []
  let i = 0
  if (m[0] === 'm') {
    out.push({ s: 0, n: 1, k: 'first' })
    i = 1
  }
  while (i < m.length) {
    if (m[i] === 'a') {
      const n = m[i + 1] === 'm' ? 2 : 1
      out.push({ s: i, n, k: 'acc' })
      i += n
    } else if (m[i] === 'r') {
      out.push({ s: i, n: 1, k: 'rej' })
      i += 1
    } else {
      out.push({ s: i, n: 1, k: 'first' })
      i += 1
    }
  }
  return out
})()

export const MARK_ACCEPT = [...TRACE.marks].filter((c) => c === 'a').length
export const MARK_REJECT = [...TRACE.marks].filter((c) => c === 'r').length
