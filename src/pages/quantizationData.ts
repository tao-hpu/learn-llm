// 15_quant.py 对第 6 章 step 19072 的评测结果。
export const N_Q = 84934656
export const N_ALL = 124475904
export const N_EMB = 38633472
export const MAT_N = 3072 * 768

export const ROWS = [
  {
    "name": "fp32",
    "label": "32 位浮点(原始)",
    "bits_per_weight": 32,
    "model_mb": 497.9,
    "val_loss": 3.0213,
    "delta": 0,
    "sample": " is a fascinating one. The Romans were the first to build the great city of Rome, and they were the first to build the great city of the world."
  },
  {
    "name": "fp16",
    "label": "16 位浮点",
    "bits_per_weight": 16,
    "model_mb": 249,
    "val_loss": 3.0213,
    "delta": 0,
    "sample": " is a fascinating one. The Romans were the first to build the great city of Rome, and they were the first to build the great city of the world."
  },
  {
    "name": "int8_tensor",
    "label": "int8 · 整个矩阵一个 scale",
    "bits_per_weight": 8,
    "model_mb": 164,
    "val_loss": 3.03,
    "delta": 0.0087,
    "sample": " is a fascinating one. The Romans were the first to build the great city of Rome, and they were the first to build the great city of the world."
  },
  {
    "name": "int8_row",
    "label": "int8 · 每行一个 scale",
    "bits_per_weight": 8.016,
    "model_mb": 164.2,
    "val_loss": 3.0219,
    "delta": 0.0006,
    "sample": " is a fascinating one. The Romans were the first to build the great city of Rome, and they were the first to build the great city of the world."
  },
  {
    "name": "int4_tensor",
    "label": "int4 · 整个矩阵一个 scale",
    "bits_per_weight": 4,
    "model_mb": 121.5,
    "val_loss": 9.9342,
    "delta": 6.913,
    "sample": ".\n, and other for the\n, and other for the, and other, and other, and, and, and, and,,,,,"
  },
  {
    "name": "int4_tensor_outlier",
    "label": "int4 · 整矩阵 scale + 留 0.1% 离群值",
    "bits_per_weight": 4.048,
    "model_mb": 122.1,
    "val_loss": 3.2633,
    "delta": 0.242,
    "sample": " is a fascinating one. The Romans were the first to conquer the world, and they were the first to rule the earth. They were the first to rule the"
  },
  {
    "name": "int4_row",
    "label": "int4 · 每行一个 scale",
    "bits_per_weight": 4.016,
    "model_mb": 121.7,
    "val_loss": 3.2456,
    "delta": 0.2243,
    "sample": " is a fascinating one. It is a fascinating story of the Roman past, and the great achievements of the Roman Empire.\nThe Romans were the first people to"
  },
  {
    "name": "int4_g128",
    "label": "int4 · 每 128 个一个 scale",
    "bits_per_weight": 4.125,
    "model_mb": 122.9,
    "val_loss": 3.136,
    "delta": 0.1147,
    "sample": " is a fascinating one. It is a fascinating story of the Roman Empire, the Roman Empire, and the Roman Empire.\nThe Romans were the first people to"
  },
  {
    "name": "int4_g32",
    "label": "int4 · 每 32 个一个 scale",
    "bits_per_weight": 4.5,
    "model_mb": 126.9,
    "val_loss": 3.0949,
    "delta": 0.0736,
    "sample": " is a fascinating one.\nThe Romans were a very different people. They were very different from the Greeks and Romans. They were very different from the Greeks and"
  },
  {
    "name": "q4_k",
    "label": "Q4_K 式 · 超块 256 / 子块 32 / 非对称",
    "bits_per_weight": 4.5,
    "model_mb": 126.9,
    "val_loss": 3.0656,
    "delta": 0.0443,
    "sample": " is a fascinating one. The Romans were the first to conquer the world, and they were the first to conquer the world. They were the first to conquer the"
  },
  {
    "name": "nvfp4",
    "label": "NVFP4 · E2M1 + 每 16 个一个 E4M3 scale",
    "bits_per_weight": 4.5,
    "model_mb": 126.9,
    "val_loss": 3.0638,
    "delta": 0.0425,
    "sample": " is a fascinating one. The Romans were the first to conquer the world. They were the first to conquer the world. They were the first to conquer the world"
  },
  {
    "name": "mxfp4",
    "label": "MXFP4 · E2M1 + 每 32 个一个 2 的幂 scale",
    "bits_per_weight": 4.25,
    "model_mb": 124.2,
    "val_loss": 3.103,
    "delta": 0.0817,
    "sample": " is a fascinating one. The Romans were the first to conquer the world. They were the first to conquer the world. They were the first to conquer the world"
  },
  {
    "name": "int3_g32",
    "label": "int3 · 每 32 个一个 scale",
    "bits_per_weight": 3.5,
    "model_mb": 116.2,
    "val_loss": 3.5533,
    "delta": 0.532,
    "sample": " is a fascinating mix of history and mythology.\nThe Roman Empire was a great time to be a Roman citizen, and the Romans were a great time to be"
  },
  {
    "name": "int2_g32",
    "label": "int2 · 每 32 个一个 scale",
    "bits_per_weight": 2.5,
    "model_mb": 105.6,
    "val_loss": 9.2414,
    "delta": 6.2202,
    "sample": "...\n.\n\n\n\n:\n\n:\n:\n\n:\n: and\n\n –\n –\n –\n – � –"
  },
  {
    "name": "int4_g32_with_emb",
    "label": "int4 · 每 32 个一个 scale · 连词嵌入一起",
    "bits_per_weight": 4.5,
    "model_mb": 71.3,
    "val_loss": 3.1126,
    "delta": 0.0914,
    "sample": " is a fascinating one.\nThe Romans were a very different people. They were very different from the Greeks and Romans. They were very different from the Greeks and"
  }
]

export const HIST = {"range":0.27177,"counts":[2,0,0,0,1,0,0,0,0,0,1,0,0,0,3,8,12,18,48,88,191,332,623,1050,1840,3206,5171,8548,13135,20090,29582,41903,57739,77023,98984,122207,146169,166963,183158,192551,191634,183149,168399,147688,124956,101732,79442,59653,43786,30673,21344,13925,9015,5483,3292,2020,1108,638,333,176,96,53,26,11,6,3,3,2,2,0,1,0,0,1,0,0,0,0,0,0]}

export const OUT = {"std":0.03397,"absmax":0.33966,"absmax_over_std":10,"frac_over_6std":0.000002,"frac_over_3std":0.00369}

export const ROW_EX = {"orig":[0.01406,0.00606,0.02916,-0.00255,0.00656,-0.03001,0.0132,-0.0361,-0.01519,0.04369,-0.00056,0.00854,-0.00508,0.05606,-0.01888,0.03784,-0.02896,-0.01524,0.02392,0.01054,-0.01933,0.0251,-0.04103,-0.00159,-0.00488,-0.03542,0.03453,-0.02831,0.01775,0.01579,-0.01148,-0.01333],"int4_tensor":[0,0,0.04852,0,0,-0.04852,0,-0.04852,0,0.04852,0,0,0,0.04852,0,0.04852,-0.04852,0,0,0,0,0.04852,-0.04852,0,0,-0.04852,0.04852,-0.04852,0,0,0,0],"int4_row":[0.01371,0,0.02741,0,0,-0.02741,0.01371,-0.04112,-0.01371,0.04112,0,0.01371,0,0.05482,-0.01371,0.04112,-0.02741,-0.01371,0.02741,0.01371,-0.01371,0.02741,-0.04112,0,0,-0.04112,0.04112,-0.02741,0.01371,0.01371,-0.01371,-0.01371],"int4_g32":[0.01602,0.00801,0.03203,0,0.00801,-0.03203,0.01602,-0.04004,-0.01602,0.04004,0,0.00801,-0.00801,0.05606,-0.01602,0.04004,-0.03203,-0.01602,0.02403,0.00801,-0.01602,0.02403,-0.04004,0,-0.00801,-0.03203,0.03203,-0.03203,0.01602,0.01602,-0.00801,-0.01602],"nvfp4":[0.01371,0.00457,0.02741,-0.00457,0.00457,-0.02741,0.01371,-0.03655,-0.01371,0.03655,0,0.00914,-0.00457,0.05482,-0.01827,0.03655,-0.02741,-0.01371,0.02056,0.01028,-0.02056,0.02741,-0.04112,0,-0.00343,-0.04112,0.04112,-0.02741,0.02056,0.01371,-0.01028,-0.01371]}

export const PER_LAYER = [{"key":"h.0.attn.c_attn.weight","absmax_over_std":9.1},{"key":"h.0.attn.c_proj.weight","absmax_over_std":30.4},{"key":"h.0.mlp.c_fc.weight","absmax_over_std":11.3},{"key":"h.0.mlp.c_proj.weight","absmax_over_std":14},{"key":"h.1.attn.c_attn.weight","absmax_over_std":16.9},{"key":"h.1.attn.c_proj.weight","absmax_over_std":12.4},{"key":"h.1.mlp.c_fc.weight","absmax_over_std":8.2},{"key":"h.1.mlp.c_proj.weight","absmax_over_std":17.5},{"key":"h.2.attn.c_attn.weight","absmax_over_std":15.2},{"key":"h.2.attn.c_proj.weight","absmax_over_std":13.1},{"key":"h.2.mlp.c_fc.weight","absmax_over_std":7.6},{"key":"h.2.mlp.c_proj.weight","absmax_over_std":10.8},{"key":"h.3.attn.c_attn.weight","absmax_over_std":14.9},{"key":"h.3.attn.c_proj.weight","absmax_over_std":10.6},{"key":"h.3.mlp.c_fc.weight","absmax_over_std":10.7},{"key":"h.3.mlp.c_proj.weight","absmax_over_std":19.9},{"key":"h.4.attn.c_attn.weight","absmax_over_std":15.5},{"key":"h.4.attn.c_proj.weight","absmax_over_std":21.2},{"key":"h.4.mlp.c_fc.weight","absmax_over_std":9.3},{"key":"h.4.mlp.c_proj.weight","absmax_over_std":18.2},{"key":"h.5.attn.c_attn.weight","absmax_over_std":20.4},{"key":"h.5.attn.c_proj.weight","absmax_over_std":16.3},{"key":"h.5.mlp.c_fc.weight","absmax_over_std":9.7},{"key":"h.5.mlp.c_proj.weight","absmax_over_std":19.9},{"key":"h.6.attn.c_attn.weight","absmax_over_std":15.2},{"key":"h.6.attn.c_proj.weight","absmax_over_std":5.6},{"key":"h.6.mlp.c_fc.weight","absmax_over_std":10},{"key":"h.6.mlp.c_proj.weight","absmax_over_std":18.2},{"key":"h.7.attn.c_attn.weight","absmax_over_std":15.1},{"key":"h.7.attn.c_proj.weight","absmax_over_std":7.7},{"key":"h.7.mlp.c_fc.weight","absmax_over_std":7},{"key":"h.7.mlp.c_proj.weight","absmax_over_std":29.8},{"key":"h.8.attn.c_attn.weight","absmax_over_std":16.1},{"key":"h.8.attn.c_proj.weight","absmax_over_std":9.5},{"key":"h.8.mlp.c_fc.weight","absmax_over_std":6.4},{"key":"h.8.mlp.c_proj.weight","absmax_over_std":10.8},{"key":"h.9.attn.c_attn.weight","absmax_over_std":16.1},{"key":"h.9.attn.c_proj.weight","absmax_over_std":12.2},{"key":"h.9.mlp.c_fc.weight","absmax_over_std":6.6},{"key":"h.9.mlp.c_proj.weight","absmax_over_std":13.3},{"key":"h.10.attn.c_attn.weight","absmax_over_std":9},{"key":"h.10.attn.c_proj.weight","absmax_over_std":15.4},{"key":"h.10.mlp.c_fc.weight","absmax_over_std":9.2},{"key":"h.10.mlp.c_proj.weight","absmax_over_std":25.3},{"key":"h.11.attn.c_attn.weight","absmax_over_std":10.4},{"key":"h.11.attn.c_proj.weight","absmax_over_std":24.4},{"key":"h.11.mlp.c_fc.weight","absmax_over_std":18.6},{"key":"h.11.mlp.c_proj.weight","absmax_over_std":25.7}]
