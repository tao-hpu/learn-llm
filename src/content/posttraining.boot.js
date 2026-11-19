/* 由 scripts/extract_html.py 从源页面抽出。交互逻辑保持原脚本，只做了三处外壳替换：
   document 查询限定在本章根节点、名词气泡交给全站 TermTip、hashchange 可在卸载时摘掉。 */
export function boot(__root) {
  const realDocument = globalThis.document
  const document = new Proxy(realDocument, {
    get(target, prop) {
      if (prop === 'getElementById') {
        return (id) => __root.querySelector('#' + CSS.escape(id)) || target.getElementById(id)
      }
      if (prop === 'querySelector') {
        return (sel) => __root.querySelector(sel)
      }
      if (prop === 'querySelectorAll') {
        return (sel) => __root.querySelectorAll(sel)
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  let _hashHandler = null
  const __gSI = globalThis.setInterval
  const __gCI = globalThis.clearInterval
  const __gST = globalThis.setTimeout
  const __gCT = globalThis.clearTimeout
  const __gRAF = globalThis.requestAnimationFrame
  const __gCAF = globalThis.cancelAnimationFrame
  const __timers = new Set()
  const __timeouts = new Set()
  const __rafs = new Set()
  const setInterval = (fn, ms, ...rest) => { const id = __gSI(fn, ms, ...rest); __timers.add(id); return id }
  const clearInterval = (id) => { __timers.delete(id); return __gCI(id) }
  const setTimeout = (fn, ms, ...rest) => { const id = __gST(fn, ms, ...rest); __timeouts.add(id); return id }
  const clearTimeout = (id) => { __timeouts.delete(id); return __gCT(id) }
  const requestAnimationFrame = (fn) => { const id = __gRAF(fn); __rafs.add(id); return id }
  const cancelAnimationFrame = (id) => { __rafs.delete(id); return __gCAF(id) }

/* ============ 步骤切换 ============ */
const NSTEP=7;
const tabs=document.querySelectorAll('.step-tab');
const panels=[];for(let i=0;i<NSTEP;i++)panels.push(document.getElementById('panel'+i));
let cur=0;
function goto(i){
  cur=Math.max(0,Math.min(NSTEP-1,i));
  tabs.forEach(t=>t.classList.toggle('active',+t.dataset.step===cur));
  panels.forEach((p,idx)=>p.classList.toggle('active',idx===cur));
  document.getElementById('prevBtn').disabled = cur===0;
  document.getElementById('nextBtn').textContent = cur===NSTEP-1 ? '完成 🎉' : '下一步 →';
  const hash='#step-'+(cur+1);
  if(location.hash!==hash) history.replaceState(null,'',hash);
  window.scrollTo({top:0,behavior:'smooth'});
}
tabs.forEach(t=>t.addEventListener('click',()=>goto(+t.dataset.step)));
document.getElementById('prevBtn').addEventListener('click',()=>goto(cur-1));
document.getElementById('nextBtn').addEventListener('click',()=>{ if(cur===NSTEP-1) celebrate(); else goto(cur+1); });

/* ============ STEP 1:两个轴 ============ */
const MODELS=[
  {nm:'tiny(第1-3章)', p:0.8e6, pl:'0.8M', d:1e6, dl:'~1M 字符'},
  {nm:'你的 124M', p:124e6, pl:'124M', d:10e9, dl:'10B token', me:true},
  {nm:'真实大模型', p:100e9, pl:'数百 B', d:5e12, dl:'数 T token'},
];
function lg(x){return Math.log10(x);}
function buildAx(host,key,cls){
  const el=document.getElementById(host); el.innerHTML='';
  const vals=MODELS.map(m=>lg(m[key])), mn=Math.min(...vals)-0.5, mx=Math.max(...vals)+0.2;
  MODELS.forEach((m,i)=>{
    const w=((lg(m[key])-mn)/(mx-mn))*100;
    const row=document.createElement('div'); row.className='axbar'+(m.me?' sel':'');
    row.innerHTML=`<span class="nm">${m.nm}</span><div class="trk"><div class="fl ${cls}" style="width:0"></div></div><span class="vv ${cls}">${key==='p'?m.pl:m.dl}</span>`;
    el.appendChild(row);
    setTimeout(()=>row.querySelector('.fl').style.width=w+'%',60+i*90);
    row.addEventListener('click',()=>selModel(i));
  });
}
function selModel(i){
  document.querySelectorAll('#axP .axbar, #axD .axbar').forEach((r,idx)=>r.classList.toggle('sel',idx%3===i));
  const m=MODELS[i];
  document.getElementById('ax-note').innerHTML =
    `<b>${m.nm}</b>:参数量 <b style="color:#3a63c0">${m.pl}</b>(脑容量) × 训练数据 <b style="color:#3f7d63">${m.dl}</b>(读过多少书)。`
    + (m.me?' 这就是你练出来的那台 —— 两个数字各管各,不能合成一个。':' 和你的 124M 对比一下:两个轴是独立移动的。');
}
buildAx('axP','p','p'); buildAx('axD','d','d');

/* ============ STEP 2:后训练地图 ============ */
const MAP=[
  {t:'STAGE 1 · 预训练',d:'<b>用什么数据:</b>海量无标注纯文本(本项目 FineWeb-Edu 10B token)。<br><b>把模型改成:</b>会预测下一个 token,也就是"会续写"。知识和语言能力基本都在这一步学到。',
   need:'<b>必需。</b>后面每一段都在它的权重上继续调,没有它就没有可调的模型。',
   ch:'<a href="07_pretraining_viz.html#step-1">第 6 章 · 预训练 124M →</a>(你已经做完)',
   ask:'The history of Rome', out:'The history of Rome, particularly the last one, is quite fascinating…(顺着续写,停不下来)'},
  {t:'STAGE 2 · 中期训练',d:'<b>用什么数据:</b>比预训练更精选的文本:代码、数学、教材、长文档。<br><b>把模型改成:</b>某些领域更强,或能读更长的输入(上下文窗口拉长)。loss 仍是"预测下一个 token"。',
   need:'<b>可选。</b>大厂的模型普遍做,但它解决的是"底座不够强",不是"不会听话"。',
   ch:'本项目不做:124M 的目标是看懂机制,不追底座能力。',
   ask:'一份 3 万 token 的合同 + 一个问题', out:'能把整份合同读进来再答(训练前只读得下开头一段)'},
  {t:'STAGE 3 · SFT 监督微调',d:'<b>用什么数据:</b>「指令 → 理想回答」成对数据 + 对话模板,通常几万到几十万条。<br><b>把模型改成:</b>听懂指令、按助手口吻回答、答完输出 EOS 停下。',
   need:'<b>常规。</b>几乎所有对话模型都做。少数推理模型试过跳过它直接上 RL(见下方折叠)。',
   ch:'<a href="08_sft_viz.html#step-1">第 8 章 · SFT →</a>,省参数版见 <a href="09_lora_viz.html#step-1">第 9 章 · LoRA →</a>',
   ask:'用户:把 “I love cats” 翻成法语', out:'助手:J\'aime les chats.〈EOS〉(听指令、给答案、停)'},
  {t:'STAGE 4 · 偏好优化',d:'<b>用什么数据:</b>同一个问题的两个回答 + 判断"A 比 B 好",判断来自人或另一个模型。<br><b>把模型改成:</b>在"都能答"的基础上,答得更有用、更安全、更合口味。',
   need:'<b>常规。</b>SFT 只能教"照这个答案写",分不出两个都通顺的回答谁更好,这一段补的就是比较。',
   ch:'<a href="10_dpo_viz.html#step-1">第 10 章 · DPO →</a>;RLHF 路线见本章第 5 步',
   ask:'同一问题:回答 A vs 回答 B', out:'学会"多产出 A 这类回答" —— 调的是偏好,不是对错'},
  {t:'STAGE 5 · RLVR',d:'<b>用什么数据:</b>有标准答案的题(数学、代码),外加一个判分程序。<br><b>把模型改成:</b>自己写出推理过程,只要最后答案被判对就得奖励,慢慢学会"多想几步"。',
   need:'<b>推理模型常规,普通对话模型可选。</b>它只适用于能自动判对错的任务。',
   ch:'<a href="21_rlvr_grpo_viz.html#step-1">第 21 章 · RLVR 与 GRPO →</a>',
   ask:'37 + 48 = ?', out:'先写过程再给 85;判分器只看最后的 85 对不对'},
  {t:'STAGE 6 · 安全训练',d:'<b>用什么数据:</b>红队测试找出的危险提问 + 合适的拒答或安全回答。<br><b>把模型改成:</b>遇到有害请求时拒绝或给安全替代,正常请求照常回答。',
   need:'<b>常规,而且贯穿全程。</b>拒答数据混在 SFT 与偏好数据里,上线后还有单独的分类器把关。',
   ch:'本项目不做:124M 没有足够能力产生需要拦截的内容。',
   ask:'教我配一种危险的化学品', out:'拒绝具体步骤,说明风险,给出安全的替代信息'},
];
function selMap(i){
  document.querySelectorAll('#mapPipe .pstage').forEach(s=>s.classList.toggle('on',+s.dataset.st===i));
  const m=MAP[i];
  document.getElementById('mapDetail').innerHTML =
    `<div class="sd-t">${m.t}</div><div style="font-size:13px;color:var(--ink2)">${m.d}<br>${m.need}<br><b>本项目:</b>${m.ch}</div>`
    +`<div class="saybox"><div class="say ask"><div class="sh">输入</div><div class="txt">${m.ask}</div></div>`
    +`<div class="say out"><div class="sh">这一段后,模型会</div><div class="txt">${m.out}</div></div></div>`;
}
document.querySelectorAll('#mapPipe .pstage').forEach(s=>s.addEventListener('click',()=>selMap(+s.dataset.st)));
selMap(0);

/* ============ STEP 3:2×2 ============ */
const CELLS=[
  {t:'全量 SFT',d:'<b>任务=SFT,手段=全量微调。</b>更新模型<b>全部</b>参数去学答题。效果直接,但每个任务都要存一份完整模型,显存/硬盘开销大。→ 脚本 <code>06_sft.py</code>。'},
  {t:'LoRA SFT',d:'<b>任务=SFT,手段=LoRA。</b>冻结主干,只训练旁挂的低秩 A·B 小矩阵去学答题。省显存、一个底座挂多个适配器。→ 脚本 <code>07_lora.py</code>。'},
  {t:'全量 DPO',d:'<b>任务=偏好对齐,手段=全量微调。</b>用全部参数在偏好对上做对齐。注意:DPO 是"任务",全量是"手段",两者正交。→ 脚本 <code>08_dpo.py</code>。'},
  {t:'LoRA DPO',d:'<b>任务=偏好对齐,手段=LoRA。</b>旁路低秩矩阵上做偏好对齐,最省的对齐方式。→ 脚本 <code>08_dpo.py</code> 里一个开关即可。'},
];
function selCell(i){
  document.querySelectorAll('.gcell').forEach(c=>c.classList.toggle('sel',+c.dataset.cell===i));
  document.getElementById('cellDetail').innerHTML=CELLS[i].d;
}
document.querySelectorAll('.gcell').forEach(c=>c.addEventListener('click',()=>selCell(+c.dataset.cell)));
selCell(0);

/* ============ STEP 4:loss mask ============ */
const TOKS=[
  {t:'<|user|>',role:'prompt',sp:1},
  {t:'Translate',role:'prompt'},{t:'to',role:'prompt'},{t:'French:',role:'prompt'},
  {t:'I',role:'prompt'},{t:'love',role:'prompt'},{t:'cats.',role:'prompt'},
  {t:'<|assistant|>',role:'prompt',sp:1},
  {t:"J'aime",role:'resp'},{t:'les',role:'resp'},{t:'chats.',role:'resp'},
  {t:'<EOS>',role:'resp',sp:1},
];
let maskMode='resp';
function renderMask(){
  const r=document.getElementById('maskRibbon'); r.innerHTML='';
  TOKS.forEach(tk=>{
    const counted = (maskMode==='all') ? true : (tk.role==='resp');
    const e=document.createElement('div');
    e.className='tok '+tk.role+(tk.sp?' special':'')+(counted?' counted':' skipped');
    e.innerHTML=tk.t.replace(/</g,'&lt;').replace(/>/g,'&gt;')+`<span class="mk">${counted?'↑':'×'}</span>`;
    r.appendChild(e);
  });
  document.getElementById('maskNote').innerHTML = maskMode==='resp'
    ? '<b>标准做法:</b>只有<b>回答段</b>(橙)算进 loss,指令/模板段(灰)标成 <code>-100</code> 被忽略。模型只学"给定指令该怎么答"。'
    : '<b>对照(不推荐):</b>连指令段也算 loss,模型会分心去学"生成用户的指令",答题质量下降。所以真实 SFT 一定把 prompt 段 mask 掉。';
  document.querySelectorAll('#maskBtns .btn').forEach(b=>b.classList.toggle('primary',b.dataset.mode===maskMode));
}
document.querySelectorAll('#maskBtns .btn').forEach(b=>b.addEventListener('click',()=>{maskMode=b.dataset.mode;renderMask();}));
renderMask();

/* ============ STEP 5:两条路 ============ */
const ROUTES={
  dpo:{
    tag:'<span class="tagrl no">非 RL · 类监督</span>',
    flow:`<div class="flow">
      <div class="fc sup">偏好对<small>chosen 好 / rejected 差</small></div>
      <div class="fa">→</div>
      <div class="fc sup">一个 DPO 损失<small>直接拉高 chosen、压低 rejected</small></div>
      <div class="fa">→</div>
      <div class="fc sup">更新模型<small>无奖励模型 / 无采样</small></div>
    </div>`,
    note:'DPO:把偏好对直接喂进一个<b>类监督损失</b>,一步到位。没有奖励模型、没有在线采样、没有 RL 循环 —— 单机就能跑,实现简单。'
  },
  rlhf:{
    tag:'<span class="tagrl is">真 · 强化学习(PPO)</span>',
    flow:`<div class="flow">
      <div class="fc sup">偏好对</div>
      <div class="fa">→</div>
      <div class="fc rl">训奖励模型<small>给回答打分</small></div>
      <div class="fa">→</div>
      <div class="fc rl">PPO 循环<small>采样 rollout + 价值网络</small></div>
      <div class="fa">→</div>
      <div class="fc rl">更新模型<small>最大化奖励</small></div>
    </div>`,
    note:'RLHF:先用偏好数据训一个<b>奖励模型</b>,再用 <b>PPO</b>(一种强化学习算法)让模型最大化奖励。要在线采样、要价值网络,工程量数倍。'
  }
};
let route='dpo';
function renderRoute(){
  const r=ROUTES[route];
  document.getElementById('routeBody').innerHTML =
    `<div style="margin:8px 0 2px">${r.tag}</div>${r.flow}<div class="note">${r.note}</div>`;
  document.querySelectorAll('#routeTabs .btn').forEach(b=>b.classList.toggle('primary',b.dataset.r===route));
}
document.querySelectorAll('#routeTabs .btn').forEach(b=>b.addEventListener('click',()=>{route=b.dataset.r;renderRoute();}));
renderRoute();

/* ============ STEP 6:方法分类表 ============ */
const METHODS=[
  {d:'<b>RLHF / RLAIF:模型自己生成 + 信号是偏好。</b>先用偏好数据训一个奖励模型;模型现场生成回答,奖励模型打分,PPO 按分数更新。偏好由人给叫 RLHF(InstructGPT、早期 ChatGPT);由另一个模型按一套写好的原则来判叫 RLAIF,Anthropic 的 Constitutional AI(2022)是代表。→ 本章第 5 步',
   dist:'RLAIF 里给回答排好坏的那个模型,就是教师。'},
  {d:'<b>DPO:现成数据 + 信号是偏好。</b>拿事先收集好的(好回答, 差回答)配对直接算损失,不训奖励模型,也不现场生成。优化的目标和 RLHF 相同。→ <a href="10_dpo_viz.html#step-1">第 10 章 · 08_dpo.py</a>',
   dist:'教师当裁判给一批回答排好坏,得到偏好数据再做 DPO(偏好蒸馏)。Hugging Face 的 Zephyr(2023)用教师模型排好序的数据做 DPO,全程没有人工标注。'},
  {d:'<b>RLVR:模型自己生成 + 信号是对错。</b>模型自己解题,判分程序看最后答案对不对给奖励,再用 GRPO 或 PPO 更新。推理模型的长思考主要来自这一格。→ <a href="21_rlvr_grpo_viz.html#step-1">第 21 章 · 19_grpo.py</a>',
   dist:'这一格本身不用教师:判分的是程序。另有一种"在线策略蒸馏",学生自己生成、教师逐 token 给分,形式上也落在左列。'},
  {d:'<b>SFT:现成数据 + 信号是标准答案。</b>照着「指令 → 回答」学,loss 和预训练是同一个交叉熵。→ <a href="08_sft_viz.html#step-1">第 8 章 · 06_sft.py</a>',
   dist:'教师写答案、学生照学(数据蒸馏),是现在最常见的蒸馏。DeepSeek-R1 同时发布的几个小模型只做了这一步,没有跑 RL。'},
];
const LENS={
  none:{cells:[],d:'两个问题定一格:① 训练时模型自己生成回答吗?② 信号是"A 比 B 好"的比较吗?点格子看每一格是什么。'},
  rl:{cells:[0,2],d:'<b>强化学习 = 左列。</b>判据只有一个:训练时模型自己生成回答,再按得到的分数调整。分数来自奖励模型(RLHF)、另一个模型(RLAIF)还是程序(RLVR),都属于强化学习。'},
  pref:{cells:[0,1],d:'<b>偏好优化 = 上行。</b>它说的是信号的形态是"A 比 B 好"的比较,不指某种算法。同一种信号既能走强化学习(RLHF),也能不走(DPO)。'},
  distill:{cells:[0,1,2,3],d:'<b>蒸馏 = 四格都可能出现。</b>它说的是信号来自一个更强的教师模型,跟用哪种方法训无关:'},
};
let lens='none', mSel=-1;
function setActiveBtn(containerId,n){
  document.querySelectorAll('#'+containerId+' .btn').forEach((b,i)=>b.classList.toggle('primary',i===n));
}
function renderMethods(){
  const L=LENS[lens];
  document.querySelectorAll('#methodGrid .mcell').forEach(c=>{
    const i=+c.dataset.m; c.classList.toggle('lit',L.cells.includes(i)); c.classList.toggle('sel',i===mSel);
  });
  setActiveBtn('lensBtns',['none','rl','pref','distill'].indexOf(lens));
  const NAMES=['RLHF / RLAIF','DPO','RLVR','SFT'];
  let h;
  if(mSel>=0){ h=METHODS[mSel].d; if(lens==='distill') h+='<br><b>蒸馏在这一格:</b>'+METHODS[mSel].dist; }
  else if(lens==='distill'){ h=L.d+'<ul>'+[3,1,0,2].map(i=>'<li><b>'+NAMES[i]+':</b>'+METHODS[i].dist+'</li>').join('')+'</ul>'; }
  else h=L.d;
  document.getElementById('methodDetail').innerHTML=h;
}
document.querySelectorAll('#lensBtns .btn').forEach(b=>b.addEventListener('click',()=>{lens=b.dataset.lens;mSel=-1;renderMethods();}));
document.querySelectorAll('#methodGrid .mcell').forEach(c=>c.addEventListener('click',()=>{mSel=+c.dataset.m;renderMethods();}));
renderMethods();




/* ============ 通关庆祝 ============ */
function celebrate(){
  document.getElementById('congrats').classList.add('show');
  const cv=document.getElementById('confetti'); cv.style.display='block';
  const ctx=cv.getContext('2d'); cv.width=innerWidth; cv.height=innerHeight;
  const COL=['#D97757','#E8B04B','#6FAE8F','#5B8DEF','#D98AC0','#1A1A18'];
  const ps=[];for(let i=0;i<140;i++)ps.push({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*0.4,
    vx:(Math.random()-0.5)*3,vy:2+Math.random()*4,s:5+Math.random()*7,c:COL[i%COL.length],a:Math.random()*6.28,va:(Math.random()-0.5)*0.3});
  let t0=null;
  function frame(ts){ if(!t0)t0=ts; const el=ts-t0;
    ctx.clearRect(0,0,cv.width,cv.height);
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.04;p.a+=p.va;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);ctx.restore();});
    if(el<3200) requestAnimationFrame(frame); else { ctx.clearRect(0,0,cv.width,cv.height); cv.style.display='none'; }
  }
  requestAnimationFrame(frame);
  document.getElementById('congrats').scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ============ 初始化 ============ */
const m=/^#step-(\d+)$/.exec(location.hash);
goto(m?parseInt(m[1],10)-1:0);
_hashHandler = ()=>{const mm=/^#step-(\d+)$/.exec(location.hash);goto(mm?parseInt(mm[1],10)-1:0);};
window.addEventListener('hashchange', _hashHandler);

  return function cleanup() {
    if (_hashHandler) realDocument.defaultView.removeEventListener('hashchange', _hashHandler)
    for (const id of __timers) __gCI(id)
    for (const id of __timeouts) __gCT(id)
    for (const id of __rafs) __gCAF(id)
    const banner = realDocument.getElementById('congrats')
    if (banner && !__root.contains(banner)) banner.remove()
    realDocument.querySelectorAll('body > canvas').forEach((cv) => {
      if (!__root.contains(cv)) cv.remove()
    })
  }
}
