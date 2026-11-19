// 第 12 章的常数和公式。数字与旧页脚本同一套。

export const HS = 32
export const INV = Array.from({ length: HS / 2 }, (_, i) => 1 / Math.pow(10000, (2 * i) / HS))

function seeded(n: number, seed: number) {
  const a: number[] = []
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    a.push((s / 0x7fffffff) * 2 - 1)
  }
  return a
}

export const QV = seeded(HS, 7)
export const KV = seeded(HS, 23)

export function rope(vec: number[], pos: number) {
  const out = new Array<number>(HS)
  for (let i = 0; i < HS / 2; i++) {
    const ang = pos * INV[i]
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const x1 = vec[2 * i]
    const x2 = vec[2 * i + 1]
    out[2 * i] = x1 * c - x2 * s
    out[2 * i + 1] = x1 * s + x2 * c
  }
  return out
}

export function dot(a: number[], b: number[]) {
  return a.reduce((t, v, i) => t + v * b[i], 0)
}

export const NVEC = [2.4, -1.1, 0.3, 3.2, -0.8, 1.6]

export function normOf(isRMS: boolean) {
  const mean = NVEC.reduce((a, b) => a + b, 0) / NVEC.length
  const centered = NVEC.map((v) => v - mean)
  const std = Math.sqrt(centered.reduce((a, b) => a + b * b, 0) / NVEC.length)
  const rms = Math.sqrt(NVEC.reduce((a, b) => a + b * b, 0) / NVEC.length)
  const out = isRMS ? NVEC.map((v) => v / rms) : centered.map((v) => v / std)
  return { mean, std, rms, out }
}

export function silu(x: number) {
  return x / (1 + Math.exp(-x))
}

export function gluAt(x: number) {
  const relu = Math.max(0, x)
  const gate = silu(x)
  const up = x * 0.9 + 0.4
  return { relu, gate, up, glu: gate * up }
}

export function gluParams() {
  const d = 128
  const relu = 2 * d * 4 * d
  const h = Math.ceil((8 * d) / 3 / 8) * 8
  const swi = 3 * d * h
  const pct = Math.abs((100 * (swi - relu)) / relu).toFixed(0)
  return { relu, h, swi, pct }
}

export const QCOL = ['#b8512f', '#3a63c0', '#3f7d63', '#a3548c']

export function gqaAt(nkv: number) {
  const rep = 4 / nkv
  const per = 2 * 4 * nkv * 32
  const mha = 2 * 4 * 4 * 32
  const save = (100 * (1 - per / mha)).toFixed(0)
  const name = nkv === 4 ? 'MHA(第 3 章)' : nkv === 1 ? 'MQA(最省)' : 'GQA'
  return { rep, per, save, name }
}

export const KVC_PRESETS = [
  {
    layers: 4,
    kv: 2,
    hd: 32,
    desc: '4 层 · 4 个 query 头 · n_kv_head=2 · head_size=32。和上面账本同一套配置;它训练时的 block_size 只有 64,这里借它的层数和头数放大来比。',
  },
  {
    layers: 32,
    kv: 32,
    hd: 128,
    desc: '32 层 · 32 个 query 头 · 32 份 K/V(MHA,每个 query 头独占一份)· head_dim=128。',
  },
  {
    layers: 32,
    kv: 8,
    hd: 128,
    desc: '32 层 · 32 个 query 头 · 8 份 K/V(GQA,每 4 个 query 头共用一份)· head_dim=128。',
  },
  {
    layers: 12,
    kv: 2,
    hd: 256,
    desc: '48 层里只有 12 层是注意力(16 个 query 头 · 2 份 K/V · head_dim=256),公式只算这 12 层。另外 36 层是线性注意力,每条请求只存一份固定大小的状态,不随上下文长度增长,不计入下面的账,第 13 章讲。',
  },
]

export const KVC_CTX_LBL = ['1K', '2K', '4K', '8K', '16K', '32K', '64K', '128K', '256K', '512K', '1M']

const KVC_GIB = 1024 ** 3
const KVC_MIB = 1024 ** 2

export function en(v: number) {
  return v.toLocaleString('en-US')
}

export function kvcNum(x: number, d: number) {
  let s = x.toFixed(d)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

export function kvcFmt(b: number) {
  if (b >= KVC_GIB) {
    const g = b / KVC_GIB
    const body = g >= 1000 ? Math.round(g).toLocaleString('en-US') : kvcNum(g, g >= 100 ? 0 : g >= 10 ? 1 : 2)
    return body + ' GiB'
  }
  if (b >= KVC_MIB) {
    const m = b / KVC_MIB
    return kvcNum(m, m >= 100 ? 0 : m >= 10 ? 1 : 2) + ' MiB'
  }
  if (b >= 1024) {
    const k = b / 1024
    return kvcNum(k, k >= 100 ? 0 : k >= 10 ? 1 : 2) + ' KiB'
  }
  return b + ' 字节'
}

export function kvcAt(pIndex: number, ce: number, conc: number, bytes: number, memG: number) {
  const p = KVC_PRESETS[pIndex]
  const ctx = 2 ** ce
  const mem = memG * KVC_GIB
  const per = 2 * p.layers * p.kv * p.hd * bytes
  const req = per * ctx
  const all = req * conc
  const cap = Math.floor(mem / per)
  const fit = Math.floor(cap / ctx)
  const need = ctx * conc
  const mibStr = kvcNum(Number((per / KVC_MIB).toPrecision(4)), 7)
  const scale = Math.max(all, mem)
  return { p, ctx, mem, per, req, all, cap, fit, need, mibStr, scale }
}

export type AbRow = {
  key: string
  name: string
  desc: string
  val: number
  params: number
  kv: number
}

export const AB: AbRow[] = [
  { key: 'gpt2', name: '老架构基线(第 3 章)', desc: '位置表 + LayerNorm + ReLU FFN + MHA,四件全不开', val: 1.5779, params: 816000, kv: 1024 },
  { key: 'rope', name: '只开 RoPE', desc: '位置表换成旋转位置编码,其余保持老架构', val: 1.5626, params: 808000, kv: 1024 },
  { key: 'rmsnorm', name: '只开 RMSNorm', desc: 'LayerNorm 换成 RMSNorm,其余保持老架构', val: 1.577, params: 815000, kv: 1024 },
  { key: 'swiglu', name: '只开 SwiGLU', desc: 'ReLU FFN 换成门控 FFN,其余保持老架构', val: 1.5389, params: 818000, kv: 1024 },
  { key: 'gqa', name: '只开 GQA', desc: 'K/V 头数 4 → 2,其余保持老架构', val: 1.573, params: 751000, kv: 512 },
  { key: 'llama', name: '四件齐上(LLaMA)', desc: 'RoPE + RMSNorm + SwiGLU + GQA,一次全开', val: 1.5235, params: 743000, kv: 512 },
]

export const AB_COLORS: Record<string, string> = {
  gpt2: '#8C8A83',
  rope: '#3a63c0',
  rmsnorm: '#3f7d63',
  swiglu: '#a3548c',
  gqa: '#b8512f',
  llama: 'var(--accent)',
}

export type AbMetric = 'val' | 'params' | 'kv'

export function abView(metric: AbMetric) {
  const vals = AB.map((r) => r[metric])
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const width = (v: number) => (metric === 'val' ? 22 + (78 * (max - v)) / Math.max(max - min, 1e-9) : 12 + 88 * (v / max))
  const fmt = (v: number) => (metric === 'val' ? v.toFixed(4) : metric === 'params' ? (v / 1e6).toFixed(3) + ' M' : v + ' 个数')
  return { width, fmt }
}
