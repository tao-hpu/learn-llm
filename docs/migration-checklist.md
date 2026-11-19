# 迁移交互清单

下列各项由脚本在 Chrome 里点过。状态只有「已点过」和「有问题」。

## 首页

- 375px 无横向滚动：已点过
- 加载时 #phase-3 滚到对应位置：已点过

## 名词表

- 375px 无横向滚动：已点过
- #softmax 锚点：已点过

## bigram

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 1 个：已点过
- 第 1 步没有可切换的选择：已点过
- 步骤 tab 的 click：已点过
- 上一步 / 下一步的 click：已点过
- flatBtn：摊平：已点过
- resetFlatBtn：复原：已点过
- 第 2 步摊平后离开再回来仍在：已点过
- q-btn：换题：已点过
- softmaxBtn：已点过
- rawBtn：已点过
- 第 3 步题目和 softmax 离开再回来仍在：已点过
- 滑块 input：已点过
- ref-chip click：已点过
- 第 4 步滑块离开再回来仍在：已点过
- loopStepBtn：已点过
- loopAutoBtn：自动循环与暂停：已点过
- loopResetBtn：已点过
- 第 5 步闭环下标离开再回来仍在：已点过
- trainOneBtn：已点过
- trainResetBtn：已点过
- 权重表 [data-r] click：已点过
- 第 5 步选中行离开再回来仍在：已点过
- trainCurveBtn：已点过
- curveResetBtn：已点过
- hashchange：#step-4 直达：已点过
- hashchange：#step-99 夹到第 5 步：已点过
- hashchange：#step-0 夹到第 1 步：已点过
- hashchange：非法 hash 改写成 #step-1：已点过
- 名词 mouseenter：已点过
- 名词 mouseleave：已点过
- 名词 click：已点过
- 气泡 mouseenter 期间不收起：已点过
- 气泡 mouseleave：已点过
- document click 收起气泡：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#batch
- 最后一步完成庆祝：已点过 🎉 第 1 章 · bigram 通关!
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror
- 375px 触屏点开名词气泡：已点过
- 375px 触屏下无横向滚动：已点过

## pretraining

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 3 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#fineweb
- 最后一步完成庆祝：已点过 🎉 真训练 · 跑通了!
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## posttraining

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块：这一页没有 range 滑块
- replaceState 保留 history.state：已点过
- 第 1 步选择保留，条形动画不重播：已点过
- 第 2 步阶段和折叠保留：已点过
- 第 3 步格子选择保留：已点过
- 第 4 步遮罩选择保留：已点过
- 第 5 步路线选择保留：已点过
- 第 6 步高亮格子边框是 accent，选择保留：已点过
- 第 7 步折叠保留：已点过
- #step-99 夹到第 7 步并改写 hash：已点过
- #step-0 夹到第 1 步并改写 hash：已点过
- 非法 hash 改写成 #step-1：已点过
- 每次点完成都滚到横幅：已点过
- 点「中期训练」不切换阶段：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#post-training
- 最后一步完成庆祝：已点过 🎉 Phase 2 地图已对齐
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror
- 375px 触屏点「中期训练」弹出气泡且不切换阶段：已点过

## sft

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块：这一页没有 range 滑块
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#cross-entropy
- 最后一步完成庆祝：已点过 🎉 SFT · 监督微调 · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## lora

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 1 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#full-finetune
- 最后一步完成庆祝：已点过 🎉 手搓 LoRA · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## dpo

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 2 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#preference-alignment
- 最后一步完成庆祝：已点过 🎉 手搓 DPO · 通关 · Phase 2 手搓三关全部拿下
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## moe

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 4 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#moe
- 最后一步完成庆祝：已点过 🎉 手搓 MoE · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## llama

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 8 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#rope
- 最后一步完成庆祝：已点过 🎉 把 GPT-2 升级成 LLaMA · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## ngram-memory

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 1 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#ngram-memory
- 最后一步完成庆祝：已点过 🎉 N-gram 查表 · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## quantization

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 3 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#quantization
- 最后一步完成庆祝：已点过 🎉 量化 · 通关 · Phase 4 收尾
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## bpe

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块 1 个：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#byte-level-bpe
- 最后一步完成庆祝：已点过 🎉 手写 BPE · 通关
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror

## rlvr-grpo

- 步骤 tab 切换且只有一个 active：已点过
- 上一步 / 下一步：已点过
- 滑块：这一页没有 range 滑块
- grp 按钮：已点过
- 第 1 步选题离开再回来仍在：已点过
- 样本 click：脱离预设：已点过
- preset 按钮：已点过
- 第 2 步预设离开再回来仍在：已点过
- start 按钮：已点过
- 第 3 步起点离开再回来仍在：已点过
- cmp 按钮：对照表：已点过
- cmp 按钮：学习率表：已点过
- 第 4 步起点离开再回来仍在：已点过
- abl 按钮：已点过
- 第 5 步消融离开再回来仍在：已点过
- hashchange：#step-3 直达：已点过
- hashchange：#step-99 夹到第 5 步：已点过
- hashchange：#step-0 夹到第 1 步：已点过
- hashchange：非法 hash 改写成 #step-1：已点过
- 名词 mouseenter：已点过
- 名词 mouseleave：已点过
- 名词 click：已点过
- 气泡 mouseenter 期间不收起：已点过
- 气泡 mouseleave：已点过
- document click 收起气泡：已点过
- 各步按钮：已点过
- 名词气泡：已点过
- 气泡链到名词表：已点过 /glossary#rlvr
- 最后一步完成庆祝：已点过 🎉 RLVR 与 GRPO · 通关 · Phase 5 收尾
- 375px 无横向滚动：已点过
- 页面异常：已点过，没有 pageerror
- 375px 触屏点开名词气泡：已点过
- 375px 触屏下无横向滚动：已点过

## 构建检查

- 扫描 src 下的 ts、tsx、js、jsx、mjs、json、css；旧章节文件名只允许出现在 catalog 的 file 字段。出现 >{[ 或 <>{[ 时构建失败。范围见 docs/source-checks.md：已点过

## 名词表正文

- 普通 JSX。def 与正文去标签后一致，白名单为空，见 docs/migration-notes.md：已点过

