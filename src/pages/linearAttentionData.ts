// 第 13 章实测数。来自 phase4-efficiency/runs/cuda 的 json，页面只读这些数。

export const COL: Record<string, string> = {
  "attn": "#3a63c0",
  "linear": "#8C8A83",
  "delta": "#a87b1f",
  "gdn": "#3f7d63",
  "hybrid": "#D97757"
}

export const LM_ORDER = ["attn","linear","delta","gdn","hybrid"] as const
export const LM = {
  "attn": {
    "name": "全注意力",
    "short": "attn",
    "layers": "attn ×4",
    "params": 742849,
    "secs": 493,
    "val": 1.5357,
    "train": 1.2859,
    "byLen": {
      "64": 1.5391,
      "128": 1.941,
      "256": 2.8545,
      "512": 3.5171
    },
    "kv": 512,
    "state": 0,
    "S": null
  },
  "linear": {
    "name": "全 linear",
    "short": "linear",
    "layers": "linear ×4",
    "params": 880193,
    "secs": 1150,
    "val": 1.5722,
    "train": 1.2969,
    "byLen": {
      "64": 1.5756,
      "128": 1.5853,
      "256": 1.6057,
      "512": 1.673
    },
    "kv": 0,
    "state": 16384,
    "S": [
      [
        7.551,
        5.895,
        3.211,
        -1.944,
        19.059,
        -0.04,
        14.285,
        2.84
      ],
      [
        -1.856,
        15.524,
        0.063,
        9.746,
        18.455,
        11.128,
        -33.411,
        3.328
      ],
      [
        -15.507,
        21.472,
        23.635,
        22.635,
        10.721,
        88.579,
        -100.897,
        54.76
      ],
      [
        -14.76,
        -6.433,
        1.388,
        -1.364,
        -5.394,
        -21.526,
        -46.081,
        -13.431
      ],
      [
        -28.484,
        9.46,
        5.62,
        10.277,
        8.616,
        19.155,
        -95.891,
        3.031
      ],
      [
        -17.859,
        23.773,
        12.168,
        16.695,
        30.931,
        21.072,
        -109.798,
        -1.894
      ],
      [
        80.321,
        27.857,
        23.304,
        31.552,
        40.513,
        23.031,
        215.598,
        24.947
      ],
      [
        0.847,
        6.565,
        3.625,
        19.73,
        -1.674,
        3.404,
        -7.456,
        -4.905
      ]
    ]
  },
  "delta": {
    "name": "全 delta",
    "short": "delta",
    "layers": "delta ×4",
    "params": 882257,
    "secs": 1475,
    "val": 1.5651,
    "train": 1.2459,
    "byLen": {
      "64": 1.5661,
      "128": 1.5447,
      "256": 1.5791,
      "512": 1.629
    },
    "kv": 0,
    "state": 16384,
    "S": [
      [
        0.119,
        0.129,
        0.157,
        0.056,
        -0.009,
        -0.154,
        0.225,
        0.223
      ],
      [
        0.226,
        0.059,
        -0.015,
        -0.044,
        0.437,
        -0.03,
        -0.194,
        0.048
      ],
      [
        -0.403,
        0.02,
        0.005,
        -0.142,
        0.11,
        -0.058,
        -0.018,
        0.195
      ],
      [
        0.038,
        0.458,
        -0.054,
        0.266,
        0.083,
        -0.01,
        -0.063,
        -0.09
      ],
      [
        -0.051,
        0.055,
        0.19,
        0.109,
        -0.076,
        -0.016,
        -0.093,
        -0.175
      ],
      [
        -0.331,
        0.005,
        0.285,
        0.072,
        0.199,
        -0.089,
        0.072,
        -0.109
      ],
      [
        -0.232,
        0.271,
        0.071,
        0.518,
        -0.188,
        -0.055,
        -0.225,
        -0.039
      ],
      [
        -0.115,
        0.056,
        0.002,
        0.099,
        -0.172,
        0.254,
        -0.013,
        -0.165
      ]
    ]
  },
  "gdn": {
    "name": "全 GDN",
    "short": "gdn",
    "layers": "gdn ×4",
    "params": 884321,
    "secs": 1603,
    "val": 1.5646,
    "train": 1.207,
    "byLen": {
      "64": 1.5689,
      "128": 1.5463,
      "256": 1.5172,
      "512": 1.532
    },
    "kv": 0,
    "state": 16384,
    "S": [
      [
        -0.023,
        0.004,
        0.007,
        -0.043,
        0.017,
        -0.014,
        0.035,
        -0.009
      ],
      [
        0.002,
        0.017,
        -0.002,
        0.004,
        0,
        0.002,
        0,
        0.01
      ],
      [
        -0.005,
        -0.039,
        0.008,
        -0.014,
        0.005,
        -0.007,
        0.004,
        -0.025
      ],
      [
        -0.004,
        -0.054,
        0.013,
        -0.008,
        0.007,
        -0.006,
        0.001,
        -0.024
      ],
      [
        -0.003,
        -0.044,
        0.027,
        -0.013,
        0.017,
        -0.011,
        0.014,
        -0.012
      ],
      [
        0.002,
        -0.007,
        0.016,
        -0.002,
        0.01,
        -0.004,
        0.008,
        0.006
      ],
      [
        -0.001,
        0.064,
        -0.011,
        -0.004,
        -0.004,
        0.003,
        0.009,
        0.027
      ],
      [
        0.033,
        0.121,
        -0.011,
        0.052,
        -0.017,
        0.021,
        -0.02,
        0.078
      ]
    ]
  },
  "hybrid": {
    "name": "3:1 混合",
    "short": "hybrid",
    "layers": "gdn, gdn, gdn, attn",
    "params": 848953,
    "secs": 1405,
    "val": 1.5446,
    "train": 1.2197,
    "byLen": {
      "64": 1.5515,
      "128": 1.5141,
      "256": 1.5372,
      "512": 1.5361
    },
    "kv": 128,
    "state": 12288,
    "S": [
      [
        -0.039,
        0.214,
        0.211,
        -0.106,
        -0.102,
        -0.031,
        -0.057,
        -0.127
      ],
      [
        0.003,
        -0.019,
        -0.043,
        0.009,
        0.016,
        0.003,
        0.002,
        0.019
      ],
      [
        0.009,
        -0.077,
        -0.044,
        0.036,
        0.034,
        0.011,
        0.019,
        0.049
      ],
      [
        -0.004,
        0.018,
        0.109,
        -0.019,
        -0.003,
        -0.002,
        -0.005,
        0.001
      ],
      [
        -0.011,
        -0.019,
        0.189,
        -0.006,
        0.001,
        0.004,
        0.007,
        0.015
      ],
      [
        -0.011,
        -0.022,
        0.111,
        0.003,
        -0.003,
        0.004,
        0.007,
        0.01
      ],
      [
        -0.03,
        0.213,
        0.211,
        -0.109,
        -0.093,
        -0.031,
        -0.055,
        -0.123
      ],
      [
        0.016,
        -0.018,
        0.025,
        0.004,
        0.01,
        0.003,
        0.01,
        0.005
      ]
    ]
  }
}

export const ALPHA_INIT = 0.9525741268224334
export const ALPHA: Record<string, number[]> = {
  "gdn": [
    0.6005,
    0.6639,
    0.6462,
    0.5837
  ],
  "hybrid": [
    0.5825,
    0.6496,
    0.658,
    0.5523
  ]
}

export const RC_ORDER = ["attn","linear","gdn","hybrid"] as const
export const RECALL_NS = [8,16,24,32]
export const N_VALS = 64
export const RECALL = {
  "attn": {
    "name": "全注意力",
    "params": 759040,
    "secs": 469,
    "acc": {
      "8": 0.9998,
      "16": 0.9999,
      "24": 1,
      "32": 1
    },
    "curve": [
      [
        0,
        5.0194,
        5.0192
      ],
      [
        500,
        3.3278,
        3.3252
      ],
      [
        1000,
        2.8552,
        2.8569
      ],
      [
        1500,
        2.6702,
        2.6698
      ],
      [
        2000,
        2.5974,
        2.5969
      ],
      [
        2500,
        0.331,
        0.3318
      ],
      [
        3000,
        0.0472,
        0.049
      ],
      [
        3500,
        0.0092,
        0.009
      ],
      [
        4000,
        0.0018,
        0.0017
      ],
      [
        4500,
        0.0002,
        0.0002
      ],
      [
        5000,
        0.0003,
        0.0002
      ],
      [
        5500,
        0.0002,
        0.0002
      ],
      [
        5999,
        0.0002,
        0.0001
      ]
    ]
  },
  "linear": {
    "name": "全 linear",
    "params": 896384,
    "secs": 2193,
    "acc": {
      "8": 0.0724,
      "16": 0.0626,
      "24": 0.0608,
      "32": 0.1656
    },
    "curve": [
      [
        0,
        5.0282,
        5.0277
      ],
      [
        500,
        3.3617,
        3.3631
      ],
      [
        1000,
        2.832,
        2.8297
      ],
      [
        1500,
        2.6591,
        2.6625
      ],
      [
        2000,
        2.5994,
        2.601
      ],
      [
        2500,
        2.5515,
        2.5494
      ],
      [
        3000,
        2.5304,
        2.5326
      ],
      [
        3500,
        2.5104,
        2.51
      ],
      [
        4000,
        2.5115,
        2.5098
      ],
      [
        4500,
        2.5078,
        2.5098
      ],
      [
        5000,
        2.483,
        2.4821
      ],
      [
        5500,
        2.4994,
        2.5011
      ],
      [
        5999,
        2.4702,
        2.4709
      ]
    ]
  },
  "gdn": {
    "name": "全 GDN",
    "params": 900512,
    "secs": 2573,
    "acc": {
      "8": 0.9982,
      "16": 0.9911,
      "24": 0.9915,
      "32": 0.9987
    },
    "curve": [
      [
        0,
        5.0232,
        5.021
      ],
      [
        500,
        3.0456,
        3.047
      ],
      [
        1000,
        2.1577,
        2.159
      ],
      [
        1500,
        1.7661,
        1.7653
      ],
      [
        2000,
        0.8046,
        0.8003
      ],
      [
        2500,
        0.0718,
        0.0727
      ],
      [
        3000,
        0.025,
        0.0262
      ],
      [
        3500,
        0.0137,
        0.0132
      ],
      [
        4000,
        0.011,
        0.0106
      ],
      [
        4500,
        0.0064,
        0.0064
      ],
      [
        5000,
        0.0044,
        0.0042
      ],
      [
        5500,
        0.0062,
        0.0058
      ],
      [
        5999,
        0.0042,
        0.0039
      ]
    ]
  },
  "hybrid": {
    "name": "3:1 混合",
    "params": 865144,
    "secs": 2338,
    "acc": {
      "8": 0.9259,
      "16": 0.8829,
      "24": 0.8839,
      "32": 0.9334
    },
    "curve": [
      [
        0,
        5.0168,
        5.016
      ],
      [
        500,
        3.1044,
        3.1007
      ],
      [
        1000,
        2.6544,
        2.6511
      ],
      [
        1500,
        2.7752,
        2.7757
      ],
      [
        2000,
        2.6728,
        2.6738
      ],
      [
        2500,
        2.6049,
        2.6056
      ],
      [
        3000,
        2.5318,
        2.5292
      ],
      [
        3500,
        2.1437,
        2.1434
      ],
      [
        4000,
        1.9675,
        1.9685
      ],
      [
        4500,
        1.4455,
        1.4468
      ],
      [
        5000,
        1.3527,
        1.3541
      ],
      [
        5500,
        0.6536,
        0.6524
      ],
      [
        5999,
        0.1475,
        0.1462
      ]
    ]
  }
}

export const HEAD_COLORS = ['#3a63c0', '#a3548c', '#3f7d63', '#a87b1f']

export const V2: number[][] = [[0.8, -0.4], [0.2, 0.9], [-0.6, 0.5]]
export const V2_COL = ['#3a63c0', '#a3548c', '#a87b1f']

export const KA = [1, 0]
export const KB = [0, 1]
export const WRITE_SEQ = [
  { k: KA, v: [0.9, 0.3], kn: 'kA', lab: '① 写 A(旧值)' },
  { k: KB, v: [-0.3, 0.8], kn: 'kB', lab: '② 写 B' },
  { k: KA, v: [-0.7, 0.4], kn: 'kA', lab: '③ 写 A(新值)' },
]

export const MODES = ['linear', 'delta', 'gdn'] as const

export type S1Row = { key: string; name: string; per: number; fixed: number }
export type S1Cfg = { desc: string; bytes: boolean; rows: S1Row[] }

export const S1: S1Cfg[] = [
  {
    desc: '4 层 · n_head=4 · head_size=32 · 注意力层 n_kv_head=2。三行数据来自 ch13_lm_attn / gdn / hybrid.json。',
    bytes: false,
    rows: [
      { key: 'attn', name: '全注意力(attn ×4)', per: 512, fixed: 0 },
      { key: 'gdn', name: '全 GDN(gdn ×4)', per: 0, fixed: 16384 },
      { key: 'hybrid', name: '3:1 混合(3 GDN + 1 attn)', per: 128, fixed: 12288 },
    ],
  },
  {
    desc: '48 层 · Gated Attention 2 个 KV 头 × head dim 256 · Gated DeltaNet 32 个 V 头 × head dim 128。按模型卡配置估算,前两行是假想对照。',
    bytes: true,
    rows: [
      { key: 'attn', name: '假想:48 层全是 Gated Attention', per: 2 * 48 * 2 * 256, fixed: 0 },
      { key: 'gdn', name: '假想:48 层全是 Gated DeltaNet', per: 0, fixed: 48 * 32 * 128 * 128 },
      { key: 'hybrid', name: '实际:12 层注意力 + 36 层 GDN', per: 2 * 12 * 2 * 256, fixed: 36 * 32 * 128 * 128 },
    ],
  },
]

export type ArchSpec = { rep: number | null; lin: string; att: string; attC: string }

export const ARCH: ArchSpec[] = [
  { rep: 1, lin: 'GDN', att: '注意力', attC: '#3a63c0' },
  { rep: 12, lin: 'Gated DeltaNet', att: 'Gated Attention', attC: '#3a63c0' },
  { rep: 15, lin: 'Gated DeltaNet', att: 'Gated Attention', attC: '#3a63c0' },
  { rep: 12, lin: 'Gated DeltaNet', att: 'QSA', attC: '#a3548c' },
  { rep: null, lin: 'KDA', att: 'MLA', attC: '#a3548c' },
]

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function shuffle(n: number, r: () => number) {
  const a = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const sampleN = 8
const sampleRng = rng(13)
const sampleKeys = shuffle(64, sampleRng).slice(0, sampleN)
const sampleVals = sampleKeys.map(() => Math.floor(sampleRng() * N_VALS))
const sampleOrder = shuffle(sampleN, sampleRng)

export const SAMPLE = { N: sampleN, keys: sampleKeys, vals: sampleVals, order: sampleOrder }

export function en(v: number) {
  return v.toLocaleString('en-US')
}

export function f2(v: number) {
  return (Math.abs(v) < 0.005 ? 0 : v).toFixed(2)
}

export function vec(v: number[]) {
  return '(' + f2(v[0]) + ', ' + f2(v[1]) + ')'
}

export function fmtBytes(b: number) {
  const u: [string, number][] = [['GiB', 1024 ** 3], ['MiB', 1024 ** 2], ['KiB', 1024]]
  for (const [n, v] of u) {
    if (b >= v) {
      const x = b / v
      return (x >= 100 ? String(Math.round(x)) : x.toFixed(x >= 10 ? 1 : 2)) + ' ' + n
    }
  }
  return b + ' 字节'
}

export function fmtCount(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K'
  return en(n)
}

export function ctxLabel(T: number) {
  if (T >= 1048576) return (T / 1048576) + 'M'
  if (T >= 1024) return (T / 1024) + 'K'
  return String(T)
}

export function heatStyle(x: number, mx: number) {
  const t = x / mx
  const a = Math.min(1, Math.abs(t))
  const alpha = (0.08 + 0.92 * a).toFixed(3)
  const background = t >= 0 ? 'rgba(217,119,87,' + alpha + ')' : 'rgba(58,99,192,' + alpha + ')'
  const color = a > 0.55 ? '#fff' : 'var(--ink)'
  return { background, color }
}

export function matMax(M: number[][]) {
  let mx = 0
  for (const row of M) for (const x of row) if (Math.abs(x) > mx) mx = Math.abs(x)
  return mx
}
