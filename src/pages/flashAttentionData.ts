/* 第 19 章实测数字，与旧页脚本里的 D 相同。 */

export type BenchImpl = { ms: number; mem_MB: number; tflops: number }

export type FlashBench = {
  T: number
  S_MB: number
  qkvo_MB: number
  naive: BenchImpl | null
  sdpa: BenchImpl
  triton: BenchImpl
}

export const flashData = {
  gpu: 'NVIDIA GeForce RTX 4090',
  online_softmax: {
    x: [1.0, 3.0, 0.5, 2.0, 6.0, 1.5, 4.0, 0.0],
    block: 2,
    max_err: 0.0,
  },
  check: {
    '256': {
      naive: 0.010351181030273438,
      blocked: 0.0077631473541259766,
      triton: 0.0077631473541259766,
      sdpa: 0.0077631473541259766,
    },
    '1000': {
      naive: 0.013013601303100586,
      blocked: 0.007642269134521484,
      triton: 0.008311748504638672,
      sdpa: 0.008311748504638672,
    },
  } as Record<string, Record<string, number>>,
  bench: [
    { T: 512, S_MB: 24.0, qkvo_MB: 12.0, naive: { ms: 0.293, mem_MB: 120.0, tflops: 5.5 }, sdpa: { ms: 0.039, mem_MB: 3.1, tflops: 41.3 }, triton: { ms: 0.041, mem_MB: 3.0, tflops: 39.3 } },
    { T: 1024, S_MB: 96.0, qkvo_MB: 24.0, naive: { ms: 2.056, mem_MB: 480.0, tflops: 3.1 }, sdpa: { ms: 0.085, mem_MB: 6.2, tflops: 75.8 }, triton: { ms: 0.084, mem_MB: 6.0, tflops: 76.7 } },
    { T: 2048, S_MB: 384.0, qkvo_MB: 48.0, naive: { ms: 8.277, mem_MB: 1920.0, tflops: 3.1 }, sdpa: { ms: 0.241, mem_MB: 12.4, tflops: 106.9 }, triton: { ms: 0.242, mem_MB: 12.0, tflops: 106.5 } },
    { T: 4096, S_MB: 1536.0, qkvo_MB: 96.0, naive: { ms: 31.763, mem_MB: 7680.0, tflops: 3.2 }, sdpa: { ms: 0.761, mem_MB: 24.8, tflops: 135.5 }, triton: { ms: 0.768, mem_MB: 24.0, tflops: 134.2 } },
    { T: 8192, S_MB: 6144.0, qkvo_MB: 192.0, naive: null, sdpa: { ms: 2.717, mem_MB: 49.5, tflops: 151.8 }, triton: { ms: 2.843, mem_MB: 48.0, tflops: 145.0 } },
    { T: 16384, S_MB: 24576.0, qkvo_MB: 384.0, naive: null, sdpa: { ms: 10.333, mem_MB: 99.0, tflops: 159.6 }, triton: { ms: 10.925, mem_MB: 96.0, tflops: 151.0 } },
  ] as FlashBench[],
  model_loss: {
    tokens: 65536,
    loss: { sdpa: 3.01783, naive: 3.01801, triton: 3.01764 },
  },
}
