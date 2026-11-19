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

/* =====================================================================
   全局小例子数据:字符串 "To be or" → B=2, T=3
   x:每个序列的输入字符;y:右移一位的目标字符
   ===================================================================== */
// "To be or" 共 8 个字符: T o ␣ b e ␣ o r
// 取前 7 个字符,做成两条 (x,y) 错位序列,每条 T=3
// 序列0: x = T o ␣   y = o ␣ b
// 序列1: x = b e ␣   y = e ␣ o
const SEQ = [
  { x:['T','o','␣'], y:['o','␣','b'] },
  { x:['b','e','␣'], y:['e','␣','o'] }
];
const B = 2, T = 3, C = 65;

// 6 个示意字符的小词表(真实是 65 个)
const VOCAB = ['o','␣','b','e','r','t'];

/* 把 (b,t) 展开成 6 道题的元信息:索引 + 当前输入字符 + 正确答案字符 */
const QUESTIONS = [];
for(let b=0;b<B;b++){
  for(let t=0;t<T;t++){
    QUESTIONS.push({ b, t, flat:b*T+t, inCh:SEQ[b].x[t], target:SEQ[b].y[t] });
  }
}

/* 为每道题造一组"示意 logits"(6 个数),并让正确答案类的分数偏高一点,
   这样 softmax 后看起来更像一个学到点东西的模型。纯展示用。 */
function makeLogits(q){
  // 用确定性伪随机,保证每次打开数值一致
  let seed = (q.flat+1)*97;
  const rnd = ()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return (seed/0x7fffffff); };
  const logits = VOCAB.map(()=> (rnd()*3-1.5));
  // 找到正确答案在示意词表里的位置(若不在词表,落到第0类做示意)
  let ci = VOCAB.indexOf(q.target);
  if(ci<0) ci = 0;
  q.correctIdx = ci;
  // 给正确类加一点优势,但不至于压倒一切,保留教学对比
  logits[ci] += 1.6;
  return logits;
}
QUESTIONS.forEach(q=> q.logits = makeLogits(q));

function softmax(arr){
  const m = Math.max(...arr);
  const ex = arr.map(v=>Math.exp(v-m));
  const s = ex.reduce((a,b)=>a+b,0);
  return ex.map(v=>v/s);
}

/* 每道题正确类的概率 p,用于 Step4 的平均演示 */
QUESTIONS.forEach(q=>{
  q.probs = softmax(q.logits);
  q.pCorrect = q.probs[q.correctIdx];
});

/* =====================================================================
   步骤切换逻辑
   ===================================================================== */
let cur = 0;
const LAST = 4;
const tabs = document.querySelectorAll('.step-tab');
const panels = [0,1,2,3,4].map(i=>document.getElementById('panel'+i));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

function goto(i){
  cur = Math.max(0, Math.min(LAST, i));
  tabs.forEach(t=>t.classList.toggle('active', +t.dataset.step===cur));
  panels.forEach((p,idx)=>p.classList.toggle('active', idx===cur));
  prevBtn.disabled = cur===0;
  nextBtn.disabled = false;                         // 最后一步也可点(触发庆祝)
  nextBtn.textContent = cur===LAST ? '完成 🎉' : '下一步 →';
  // 进入某步时初始化
  if(cur===1) resetFlat();
  // 离开 Step5 时停掉自动循环
  if(cur!==4 && typeof stopLoopAuto==='function') stopLoopAuto();
  // 同步 URL hash(用 replaceState 不污染历史记录),便于首页深链 #step-N
  const hash = '#step-' + (cur+1);
  if(location.hash !== hash){
    history.replaceState(null, '', hash);
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

/* 从 URL hash 解析初始步骤:#step-N → 索引 N-1,缺省/非法回退到 Step 1 */
function stepFromHash(){
  const m = /^#step-(\d+)$/.exec(location.hash);
  if(!m) return 0;
  const n = parseInt(m[1],10) - 1;
  return (n>=0 && n<=LAST) ? n : 0;
}
tabs.forEach(t=>t.addEventListener('click',()=>goto(+t.dataset.step)));
prevBtn.addEventListener('click',()=>goto(cur-1));
nextBtn.addEventListener('click',()=>{ if(cur===LAST){ celebrate(); } else { goto(cur+1); } });

/* =====================================================================
   通关庆祝:祝贺横幅 + 手写 canvas confetti(纯 vanilla,无外部库)
   ===================================================================== */
function showCongrats(){
  const old=document.getElementById('congrats'); if(old) old.remove();
  const el=document.createElement('div');
  el.id='congrats'; el.className='congrats';
  el.innerHTML='🎉 第 1 章 · bigram 通关!<span>你已看懂从一个 batch 到训练循环的全过程</span>';
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),500); }, 3400);
}
function launchConfetti(){
  const cv=document.createElement('canvas');
  cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(cv);
  const ctx=cv.getContext('2d');
  cv.width=window.innerWidth; cv.height=window.innerHeight;
  const colors=['#D97757','#E8B04B','#6FAE8F','#5B8DEF','#D98AC0','#1A1A18'];
  const parts=[];
  for(let i=0;i<170;i++){
    parts.push({
      x:Math.random()*cv.width,
      y:-20-Math.random()*cv.height*0.4,
      r:4+Math.random()*5,
      c:colors[i%colors.length],
      vx:(Math.random()-0.5)*3.2,
      vy:2+Math.random()*4,
      rot:Math.random()*Math.PI,
      vr:(Math.random()-0.5)*0.3,
      rect:Math.random()<0.55
    });
  }
  const start=performance.now(), DUR=3800;
  function frame(now){
    const t=now-start;
    ctx.clearRect(0,0,cv.width,cv.height);
    const fade = t>DUR-900 ? Math.max(0,(DUR-t)/900) : 1;
    ctx.globalAlpha=fade;
    parts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.rot+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c;
      if(p.rect) ctx.fillRect(-p.r,-p.r*0.6,p.r*2,p.r*1.2);
      else { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    ctx.globalAlpha=1;
    if(t<DUR) requestAnimationFrame(frame); else cv.remove();
  }
  requestAnimationFrame(frame);
}
function celebrate(){ showCongrats(); launchConfetti(); }

/* =====================================================================
   STEP 1:渲染 x / y 序列(上下对齐 + 箭头)
   ===================================================================== */
function renderSeq(){
  const root = document.getElementById('seqBlock');
  let html = '';
  SEQ.forEach((s,b)=>{
    html += `<div class="seq-title">序列 ${b}  (b=${b})</div>`;
    // x 行
    html += `<div class="seq-row"><span class="tag">x (输入)</span>`;
    s.x.forEach(ch=> html += `<div class="cell x">${ch}</div>`);
    html += `</div>`;
    // 箭头行
    html += `<div class="arrows">`;
    s.x.forEach(()=> html += `<div class="arrow-col">↓</div>`);
    html += `</div>`;
    // y 行
    html += `<div class="seq-row"><span class="tag">y (目标)</span>`;
    s.y.forEach(ch=> html += `<div class="cell y">${ch}</div>`);
    html += `</div>`;
  });
  root.innerHTML = html;
}
renderSeq();

/* =====================================================================
   STEP 2:FLIP 式摊平动画
   用绝对定位 + transform 平移,从 2×3 网格 → 1×6 列
   ===================================================================== */
const stage = document.getElementById('flipStage');
const shapeTag = document.getElementById('shapeTag');
let flatTiles = [];

// 网格布局坐标(2 行 3 列)
const TILE_W = 150, TILE_H = 64, GAP_X = 20, GAP_Y = 22;
function gridPos(b,t){
  return { x: t*(TILE_W+GAP_X), y: b*(TILE_H+GAP_Y) };
}
// 摊平后布局(1 列 6 行)
function colPos(flat){
  return { x: 0, y: flat*(TILE_H+10) };
}

function buildTiles(){
  stage.innerHTML='';
  flatTiles = QUESTIONS.map(q=>{
    const el = document.createElement('div');
    el.className='tile';
    el.innerHTML = `<span class="idx">(b=${q.b}, t=${q.t})</span>`
                 + `<span class="ch">输入 "${q.inCh}"</span>`
                 + `<span class="clen">↳ 65 个打分</span>`;
    const p = gridPos(q.b,q.t);
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    stage.appendChild(el);
    return el;
  });
  stage.style.height = (2*TILE_H + GAP_Y + 8) + 'px';
}

const flatBtn = document.getElementById('flatBtn');
const resetFlatBtn = document.getElementById('resetFlatBtn');

// 纯 active 高亮切换(与 Step 3 题目/Softmax 按钮一致):当前状态的按钮橘色,另一个中性
function updateFlatBtns(flattened){
  flatBtn.classList.toggle('primary', flattened);
  resetFlatBtn.classList.toggle('primary', !flattened);
}

function doFlatten(){
  QUESTIONS.forEach((q,i)=>{
    const p = colPos(q.flat);
    flatTiles[i].style.width = '100%';
    flatTiles[i].style.maxWidth = '420px';
    flatTiles[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
    flatTiles[i].querySelector('.clen').textContent = `第 ${q.flat} 题 · 65 个打分`;
  });
  stage.style.height = (6*(TILE_H+10)) + 'px';
  shapeTag.textContent = '(6, 65)';
  updateFlatBtns(true);
}

function resetFlat(){
  buildTiles();
  shapeTag.textContent = '(2, 3, 65)';
  updateFlatBtns(false);
}
flatBtn.addEventListener('click', doFlatten);
resetFlatBtn.addEventListener('click', resetFlat);
resetFlat();

/* =====================================================================
   STEP 3:单题 cross_entropy 拆解
   ===================================================================== */
let selQ = 0;          // 选中的题
let showProb = false;  // 当前是否显示概率(softmax 后)

function renderPicker(){
  const root = document.getElementById('qPicker');
  root.innerHTML = QUESTIONS.map(q=>
    `<button class="q-btn ${q.flat===selQ?'sel':''}" data-q="${q.flat}">`
    + `第 ${q.flat} 题:看 "${q.inCh}"</button>`
  ).join('');
  root.querySelectorAll('.q-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ selQ=+btn.dataset.q; showProb=false; renderStep3(); });
  });
}

const softmaxBtn = document.getElementById('softmaxBtn');
const rawBtn = document.getElementById('rawBtn');

function renderStep3(){
  renderPicker();
  // 当前所处视图的按钮 = 橘色高亮,另一个 = 中性
  softmaxBtn.classList.toggle('primary', showProb);
  rawBtn.classList.toggle('primary', !showProb);
  const q = QUESTIONS[selQ];
  document.getElementById('q3hint').textContent =
    `第 ${selQ} 题:模型看到 "${q.inCh}",正确的下一个字符是 "${q.target}"(高亮那一类)。`;

  const vals = showProb ? q.probs : q.logits;
  const probs = q.probs;
  // bar 高度归一化(logits 含负数,做线性映射;概率直接 *比例)
  let maxAbs = showProb ? Math.max(...probs) : Math.max(...vals.map(v=>Math.abs(v)));
  const barsRoot = document.getElementById('bars');
  barsRoot.innerHTML = VOCAB.map((ch,i)=>{
    const v = vals[i];
    let h;
    if(showProb){ h = (probs[i]/maxAbs)*100; }
    else { h = ((v+maxAbs)/(2*maxAbs))*100; } // 把含负 logits 平移到 [0,100]
    h = Math.max(4, h);
    const isC = i===q.correctIdx;
    const label = showProb ? probs[i].toFixed(3) : v.toFixed(2);
    return `<div class="bar-col">
        <div class="bar-val">${label}</div>
        <div class="bar ${isC?'correct':''}" style="height:${h}%"></div>
        <div class="bar-label ${isC?'correct':''}">${ch}</div>
      </div>`;
  }).join('');

  // 计算框
  const calc = document.getElementById('calcBox');
  const p = probs[q.correctIdx];
  if(!showProb){
    calc.innerHTML = `当前是 <b>原始 logits</b>(可正可负的打分)。`
      + `点上面的「应用 softmax」把它们变成加起来 = 1 的概率分布。`;
  }else{
    const sum = probs.reduce((a,b)=>a+b,0);
    calc.innerHTML =
      `softmax 后所有概率之和 = <b>${sum.toFixed(3)}</b> ✓<br>`
      + `正确类 "${q.target}" 的概率 &nbsp; p = <b>${p.toFixed(4)}</b><br><br>`
      + `loss = -ln(p) = -ln(${p.toFixed(4)}) = <span class="big">${(-Math.log(p)).toFixed(4)}</span>`;
  }
}

softmaxBtn.addEventListener('click',()=>{ showProb=true; renderStep3(); });
rawBtn.addEventListener('click',()=>{ showProb=false; renderStep3(); });
renderStep3();

/* =====================================================================
   STEP 4:滑块 + SVG 曲线 -ln(p)
   ===================================================================== */
const slider = document.getElementById('pSlider');
const pValEl = document.getElementById('pVal');
const lossValEl = document.getElementById('lossVal');
const svg = document.getElementById('curve');

// SVG 绘图坐标系
const SVG_W=560, SVG_H=280, PAD_L=44, PAD_B=40, PAD_T=16, PAD_R=16;
const plotW = SVG_W-PAD_L-PAD_R, plotH = SVG_H-PAD_T-PAD_B;
const LOSS_MAX = 4.7; // y 轴上限(略高于 ln(65))

function px(p){ return PAD_L + p*plotW; }              // p∈[0,1] → x
function py(loss){ return PAD_T + (1 - loss/LOSS_MAX)*plotH; } // loss → y

function buildCurve(){
  let d='';
  // 从 p=0.005 起画,避免 -ln(0) 爆炸
  for(let i=0;i<=200;i++){
    const p = 0.005 + (1-0.005)*(i/200);
    const loss = Math.min(LOSS_MAX, -Math.log(p));
    d += (i===0?'M':'L') + px(p).toFixed(1) + ',' + py(loss).toFixed(1) + ' ';
  }
  // 坐标轴
  let axes = `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+plotH}" stroke="#ccc7ba"/>`
           + `<line x1="${PAD_L}" y1="${PAD_T+plotH}" x2="${PAD_L+plotW}" y2="${PAD_T+plotH}" stroke="#ccc7ba"/>`;
  // y 轴刻度
  [0,1,2,3,4].forEach(v=>{
    const y=py(v);
    axes += `<line x1="${PAD_L-4}" y1="${y}" x2="${PAD_L}" y2="${y}" stroke="#ccc7ba"/>`
          + `<text x="${PAD_L-8}" y="${y+4}" font-size="10" fill="#6B6B68" text-anchor="end">${v}</text>`;
  });
  // x 轴刻度
  [0,0.25,0.5,0.75,1].forEach(v=>{
    const x=px(v);
    axes += `<line x1="${x}" y1="${PAD_T+plotH}" x2="${x}" y2="${PAD_T+plotH+4}" stroke="#ccc7ba"/>`
          + `<text x="${x}" y="${PAD_T+plotH+18}" font-size="10" fill="#6B6B68" text-anchor="middle">${v}</text>`;
  });
  // 参考虚线:loss=4.17 (随机)
  const yr=py(Math.log(65));
  axes += `<line x1="${PAD_L}" y1="${yr}" x2="${PAD_L+plotW}" y2="${yr}" stroke="#D97757" stroke-dasharray="4 4" opacity="0.5"/>`
        + `<text x="${PAD_L+plotW}" y="${yr-5}" font-size="10" fill="#D97757" text-anchor="end">≈4.17 随机初始</text>`;
  // 轴标题
  axes += `<text x="${PAD_L+plotW/2}" y="${SVG_H-4}" font-size="11" fill="#6B6B68" text-anchor="middle">p (正确类概率)</text>`;

  svg.innerHTML = axes
    + `<path d="${d}" fill="none" stroke="#1A1A18" stroke-width="2"/>`
    + `<circle id="marker" r="7" fill="#D97757" stroke="#fff" stroke-width="2"/>`
    + `<line id="markerV" stroke="#D97757" stroke-dasharray="3 3" opacity="0.5"/>`;
}
buildCurve();

function updateSlider(){
  const p = +slider.value/100; // 1..100 → 0.01..1.0
  const loss = -Math.log(p);
  pValEl.textContent = p.toFixed(p<0.1?3:2);
  lossValEl.textContent = loss.toFixed(2);
  slider.style.setProperty('--fill', (p*100)+'%');
  // 移动标记点
  const x=px(p), y=py(Math.min(LOSS_MAX,loss));
  const m=document.getElementById('marker');
  const mv=document.getElementById('markerV');
  m.setAttribute('cx',x); m.setAttribute('cy',y);
  mv.setAttribute('x1',x); mv.setAttribute('x2',x);
  mv.setAttribute('y1',y); mv.setAttribute('y2',PAD_T+plotH);
}
slider.addEventListener('input',updateSlider);
updateSlider();

// 参考点快捷按钮
document.querySelectorAll('.ref-chip').forEach(c=>{
  c.addEventListener('click',()=>{
    const p=+c.dataset.p;
    slider.value = Math.round(Math.max(1,Math.min(100,p*100)));
    updateSlider();
  });
});

// 6 道题的 -ln(p) 平均演示(用 Step3 那套示意概率)
function renderAvg(){
  const terms = QUESTIONS.map(q=> -Math.log(q.pCorrect));
  const mean = terms.reduce((a,b)=>a+b,0)/terms.length;
  document.getElementById('avgTerms').innerHTML =
    '各题 -ln(p): [ ' + terms.map(t=>t.toFixed(3)).join(',  ') + ' ]';
  document.getElementById('avgResult').innerHTML =
    `平均 = ( ${terms.map(t=>t.toFixed(2)).join(' + ')} ) / 6 = <b>${mean.toFixed(4)}</b>`;
}
renderAvg();

/* =====================================================================
   STEP 5 · (A) 闭环流程图 —— 圆环布局,5 节点沿圆周等角分布,弧形箭头首尾相接
   ===================================================================== */
const LOOP = [
  { title:'取一批样本',       code:'get_batch("train")', desc:'随机抽 32×8 = 256 个 (x → y) 样本对:xb 是输入,yb 是目标。' },
  { title:'forward 猜',       code:'model(xb, yb)',      desc:'凭当前参数为每道题吐出 logits(打分)。第一圈参数是随机的,每个字符≈1/65 均等瞎猜 → 起步 loss≈ln(65)≈4.17。' },
  { title:'cross_entropy 打分', code:'_, loss = ...',     desc:'对照答案,把 256 道题压成一个标量 loss(成绩单)。' },
  { title:'backward 算梯度',   code:'loss.backward()',    desc:'反向传播,算出每个参数(开关)该往哪个方向扭。' },
  { title:'step 扭开关',       code:'optimizer.step()',   desc:'照梯度把参数各扭一小步 → 箭头回到第 1 步,开始下一圈。' },
];
const loopStage = document.getElementById('loopStage');
const loopSvg   = document.getElementById('loopSvg');
const loopDesc  = document.getElementById('loopDesc');
const loopKEl   = document.getElementById('loopK');
const loopCount = document.getElementById('loopCount');

// 圆环几何:viewBox 600×600,5 节点等角分布(从正上方开始,顺时针每 72°)
const VW=600, VH=600, CX=300, CY=300, R=200;
function angDeg(i){ return -90 + i*72; }
function ptAt(deg,r){ const a=deg*Math.PI/180; return { x:CX+r*Math.cos(a), y:CY+r*Math.sin(a) }; }

// 画 5 段弧形箭头(两端留角度间隙,避免压住节点);最后一段 step→get_batch 用橘色虚线 + 标签
function buildLoopArcs(){
  let arcs='';
  for(let i=0;i<5;i++){
    const a0=angDeg(i)+24, a1=angDeg(i+1)-24;
    const p0=ptAt(a0,R), p1=ptAt(a1,R);
    const back=(i===4);
    arcs += `<path d="M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${R},${R} 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}" `
          + `fill="none" stroke="${back?'#D97757':'#c9c3b5'}" stroke-width="${back?2.6:1.8}" `
          + `marker-end="url(#${back?'ahead':'ahead2'})" ${back?'stroke-dasharray="7 5"':''}/>`;
  }
  const lp=ptAt(angDeg(4)+36, R+24);
  arcs += `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" font-size="13" fill="#D97757" text-anchor="middle">闭环·重复</text>`;
  // 用 innerHTML 拼接(在 SVG 上下文中解析,保证命名空间正确并保留已有 defs)
  loopSvg.innerHTML = loopSvg.innerHTML + arcs;
}

// 圆周上放置 5 个节点卡片(用百分比定位,跟随 SVG viewBox)
function buildLoopNodes(){
  LOOP.forEach((n,i)=>{
    const p=ptAt(angDeg(i),R);
    const el=document.createElement('div');
    el.className='lnode'; el.dataset.i=i;
    el.style.left=(p.x/VW*100)+'%';
    el.style.top =(p.y/VH*100)+'%';
    el.innerHTML=`<div class="ln-num">${i+1}</div>`
               + `<div class="ln-title">${n.title}</div>`
               + `<div class="ln-code">${n.code}</div>`;
    loopStage.appendChild(el);
  });
}
buildLoopArcs();
buildLoopNodes();

let loopIdx=-1, loopRound=0, loopTimer=null;
function loopHighlight(i){
  loopStage.querySelectorAll('.lnode').forEach(el=>{
    el.classList.toggle('on', +el.dataset.i===i);
  });
  if(i<0){
    loopKEl.textContent='训练循环';
    loopDesc.textContent='把这 5 步重复 3000 次。每一圈,模型都更聪明一点点。';
    loopCount.textContent='';
  }else{
    const n=LOOP[i];
    loopKEl.textContent=`第 ${i+1} 步 · ${n.code}`;
    loopDesc.textContent=n.desc;
    loopCount.textContent = `已转 ${loopRound} 圈` + (i===4 ? ' · ↩ 之后回到第 1 步' : '');
  }
}
function loopStepFn(){
  loopIdx++;
  if(loopIdx>4){ loopIdx=0; loopRound++; }
  loopHighlight(loopIdx);
}
function startLoopAuto(){
  if(loopTimer) return;
  const b=document.getElementById('loopAutoBtn');
  b.textContent='⏸ 暂停'; b.classList.add('primary');
  loopTimer=setInterval(loopStepFn, 1100);
}
function stopLoopAuto(){
  if(loopTimer){ clearInterval(loopTimer); loopTimer=null; }
  const b=document.getElementById('loopAutoBtn');
  if(b){ b.textContent='▶▶ 自动循环'; b.classList.remove('primary'); }
}
document.getElementById('loopStepBtn').addEventListener('click',()=>{ stopLoopAuto(); loopStepFn(); });
document.getElementById('loopAutoBtn').addEventListener('click',()=>{ loopTimer?stopLoopAuto():startLoopAuto(); });
document.getElementById('loopResetBtn').addEventListener('click',()=>{ stopLoopAuto(); loopIdx=-1; loopRound=0; loopHighlight(-1); });

/* =====================================================================
   STEP 5 · (B) 旋钮(参数) vs 成绩单(loss)
   确定性演示:每轮把旋钮各扭一小步(阻尼递减),loss 朝天花板靠拢
   ===================================================================== */
// 6 个旋钮直接对应 6×6 示意权重表里的 6 个格子(旋钮 = 拟物,表格 = 真身)
// VOCAB = ['o','␣','b','e','r','t'];  [行=当前字符, 列=下一个字符]
const KNOB_CELLS=[[2,3],[0,1],[1,2],[3,1],[5,0],[1,0]]; // b→e, o→␣, ␣→b, e→␣, t→o, ␣→o
const KNOB_NAMES=KNOB_CELLS.map(([r,c])=>`W[${VOCAB[r]}→${VOCAB[c]}]`);
const KNOB_BASE =[-32, 18, -8, 36, 6, -24];   // 初始角度
const KNOB_DIR  =[ +1, +1, +1, +1, +1, +1];   // 这些格子都需要"调高"(确定性)
let knobAngles = KNOB_BASE.slice();
let roundB=0, lossB=4.17;
const KNOB_CEIL=2.50;
const knobRow=document.getElementById('knobRow');
const scoreVal=document.getElementById('scoreVal');
const scoreDelta=document.getElementById('scoreDelta');

function renderKnobs(showGrad){
  knobRow.innerHTML = KNOB_NAMES.map((nm,i)=>{
    const arrow = KNOB_DIR[i]>0 ? '↻ 右扭' : '↺ 左扭';
    return `<div class="knob">
        <div class="knob-dial${roundB>0?' spun':''}" style="transform:rotate(${knobAngles[i].toFixed(1)}deg)"></div>
        <div class="knob-grad${showGrad?' show':''}">${arrow}</div>
        <div class="knob-name">${nm}</div>
      </div>`;
  }).join('');
}
function renderScore(){
  scoreVal.textContent = lossB.toFixed(3);
}
function trainOne(){
  const prev=lossB;
  roundB++;
  const damp=Math.pow(0.72, roundB-1);            // 越往后扭得越小
  knobAngles=knobAngles.map((a,i)=> a + KNOB_DIR[i]*16*damp);
  lossB = KNOB_CEIL + (lossB-KNOB_CEIL)*0.74;      // 朝天花板收敛
  renderKnobs(true);
  renderScore();
  const d=(lossB-prev);
  scoreDelta.textContent = `↓ ${d.toFixed(3)}` + (lossB-KNOB_CEIL<0.02?'(已近天花板 2.5)':'');
  if(typeof wTrainStep==='function') wTrainStep();   // 同步推进权重表
}
function resetKnobs(){
  knobAngles=KNOB_BASE.slice(); roundB=0; lossB=4.17;
  renderKnobs(false); renderScore(); scoreDelta.textContent='';
  if(typeof wReset==='function') wReset();            // 同步复位权重表
}
document.getElementById('trainOneBtn').addEventListener('click', trainOne);
document.getElementById('trainResetBtn').addEventListener('click', resetKnobs);

/* =====================================================================
   STEP 5 · (B2) 6×6 示意权重表:雪花 → 有结构
   形状 = vocab×vocab(真实 65×65),与 batch 的 2×3 无关。确定性演示数据。
   ===================================================================== */
const WV = VOCAB;                                     // ['o','␣','b','e','r','t']
const WT_KNOB = [[2,3],[0,1],[1,2],[3,1],[5,0],[1,0]]; // 与 6 个旋钮一一对应的格子
const wtableEl   = document.getElementById('wtable');
const wpredictEl = document.getElementById('wpredict');
const wtTip      = document.getElementById('wtTip');

// 确定性伪随机:保证每次打开数值一致
let wsd = 20240627;
function wrnd(){ wsd=(wsd*1103515245+12345)&0x7fffffff; return wsd/0x7fffffff; }

// 出生雪花 W0 + 学成目标 WTARGET(符合 bigram 接龙直觉)
const W0=[], WTARGET=[];
for(let r=0;r<6;r++){ W0[r]=[]; WTARGET[r]=[]; for(let c=0;c<6;c++){ W0[r][c]=wrnd()*2-1; WTARGET[r][c]=-0.5+wrnd()*0.6; } }
// [行=当前字符, 列=下一个字符, 高分]:be / o␣ / ␣b / ␣o / e␣ / er / to / r␣
[[2,3,5.0],[0,1,4.6],[1,2,4.3],[1,0,3.9],[3,1,4.5],[3,4,3.7],[5,0,4.2],[4,1,3.3]].forEach(([r,c,v])=>WTARGET[r][c]=v);

let Wcur = W0.map(row=>row.slice());
let wSelRow = 2, wRound = 0;     // 默认看 "b" 行
const cellEls = [];

function isKnobCell(r,c){ return WT_KNOB.some(([a,b])=>a===r && b===c); }
function heat(t){
  t=Math.max(0,Math.min(1,t));
  const lo=[250,249,245], hi=[217,119,87];
  const c=lo.map((x,i)=>Math.round(x+(hi[i]-x)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function buildWTable(){
  let html=`<div class="wt-corner">行=当前<br>列=下一个</div>`;
  WV.forEach(ch=> html+=`<div class="wt-h">${ch}</div>`);
  for(let r=0;r<6;r++){
    html+=`<div class="wt-rh" data-r="${r}">${WV[r]}</div>`;
    for(let c=0;c<6;c++){
      html+=`<div class="wt-cell${isKnobCell(r,c)?' knob':''}" data-r="${r}" data-c="${c}"></div>`;
    }
  }
  wtableEl.innerHTML=html;
  for(let r=0;r<6;r++){ cellEls[r]=[]; for(let c=0;c<6;c++){
    cellEls[r][c]=wtableEl.querySelector(`.wt-cell[data-r="${r}"][data-c="${c}"]`);
  }}
  // 点行头 / 点格子 → 选中该行看预测
  wtableEl.querySelectorAll('[data-r]').forEach(el=>{
    el.addEventListener('click',()=>{ wSelRow=+el.dataset.r; renderWTable(); renderWPredict(); });
  });
}

function renderWTable(){
  let mn=Infinity,mx=-Infinity;
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){ const v=Wcur[r][c]; if(v<mn)mn=v; if(v>mx)mx=v; }
  const rng=(mx-mn)||1;
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){
    const v=Wcur[r][c], t=(v-mn)/rng, el=cellEls[r][c];
    el.textContent=v.toFixed(1);
    el.style.background=heat(t);
    el.style.color = t>0.58 ? '#fff' : '#6B6B68';
    el.classList.toggle('rowsel', r===wSelRow);
  }
  wtableEl.querySelectorAll('.wt-rh').forEach(el=> el.classList.toggle('sel', +el.dataset.r===wSelRow));
}

function renderWPredict(){
  const ps=softmax(Wcur[wSelRow]);            // 复用全局 softmax
  const maxp=Math.max(...ps);
  let bars='';
  for(let c=0;c<6;c++){
    const top = ps[c]===maxp;
    const h=Math.max(4, ps[c]/maxp*100);
    bars+=`<div class="wp-col">`
        + `<div class="wp-val">${(ps[c]*100).toFixed(0)}%</div>`
        + `<div class="wp-bar${top?' top':''}" style="height:${h.toFixed(1)}%"></div>`
        + `<div class="wp-lab${top?' top':''}">${WV[c]}</div></div>`;
  }
  wpredictEl.innerHTML =
    `<div class="wp-title">查表第 "<b>${WV[wSelRow]}</b>" 行 → 6 个 logit 过 softmax = 看到 "${WV[wSelRow]}" 时对下一个字符的概率猜测(和 ≈ 100%):</div>`
    + `<div class="wp-bars">${bars}</div>`;
}

function wTrainStep(){
  wRound++;
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){ Wcur[r][c]+=(WTARGET[r][c]-Wcur[r][c])*0.5; }
  if(wtTip) wtTip.textContent=`已训练 ${wRound} 轮:雪花正在长出结构 —— 少数接龙格子升高变橘,其余压低变浅。`;
  renderWTable(); renderWPredict();
}
function wReset(){
  Wcur=W0.map(row=>row.slice()); wRound=0;
  if(wtTip) wtTip.textContent='出生时:随机雪花表(颜色杂乱无规律)。点上方「执行一轮训练」看它逐渐变出结构。';
  renderWTable(); renderWPredict();
}
buildWTable();
resetKnobs();   // 初始化旋钮 + 权重表(此时 Wcur/WTARGET 已就绪)

/* =====================================================================
   STEP 5 · (C) loss 下降曲线(SVG,手写)
   ===================================================================== */
const lossSvg=document.getElementById('lossCurve');
const curveStepEl=document.getElementById('curveStep');
const curveLossEl=document.getElementById('curveLoss');
const C_W=560,C_H=280,CPL=46,CPB=40,CPT=16,CPR=18;
const cpw=C_W-CPL-CPR, cph=C_H-CPT-CPB;
const STEP_MAX=3000, L_MIN=2.3, L_MAX=4.4, CEIL=2.5, START=Math.log(65);

function cX(step){ return CPL + step/STEP_MAX*cpw; }
function cY(loss){ return CPT + (1-(loss-L_MIN)/(L_MAX-L_MIN))*cph; }
function lossAt(step){
  // 快速指数下降 → 收敛到 ~2.5 的天花板,叠加极小抖动更像真实曲线
  const base = CEIL + (START-CEIL)*Math.exp(-step/240);
  const wob  = step>120 ? 0.018*Math.sin(step/95) : 0;
  return Math.max(2.46, base+wob);
}

function buildLossAxes(){
  let g='';
  g += `<line x1="${CPL}" y1="${CPT}" x2="${CPL}" y2="${CPT+cph}" stroke="#ccc7ba"/>`
     + `<line x1="${CPL}" y1="${CPT+cph}" x2="${CPL+cpw}" y2="${CPT+cph}" stroke="#ccc7ba"/>`;
  // y 轴刻度
  [2.5,3,3.5,4].forEach(v=>{
    const y=cY(v);
    g += `<line x1="${CPL-4}" y1="${y}" x2="${CPL}" y2="${y}" stroke="#ccc7ba"/>`
       + `<text x="${CPL-8}" y="${y+4}" font-size="10" fill="#6B6B68" text-anchor="end">${v}</text>`;
  });
  // x 轴刻度
  [0,1000,2000,3000].forEach(v=>{
    const x=cX(v);
    g += `<line x1="${x}" y1="${CPT+cph}" x2="${x}" y2="${CPT+cph+4}" stroke="#ccc7ba"/>`
       + `<text x="${x}" y="${CPT+cph+18}" font-size="10" fill="#6B6B68" text-anchor="middle">${v}</text>`;
  });
  // 参考线:4.17 随机起点
  const yS=cY(START);
  g += `<line x1="${CPL}" y1="${yS}" x2="${CPL+cpw}" y2="${yS}" stroke="#D97757" stroke-dasharray="4 4" opacity="0.55"/>`
     + `<text x="${CPL+cpw}" y="${yS-5}" font-size="10" fill="#D97757" text-anchor="end">≈4.17 = ln(65) 随机起点</text>`;
  // 参考线:2.5 bigram 天花板
  const yC=cY(CEIL);
  g += `<line x1="${CPL}" y1="${yC}" x2="${CPL+cpw}" y2="${yC}" stroke="#8a8a85" stroke-dasharray="4 4" opacity="0.55"/>`
     + `<text x="${CPL+cpw}" y="${yC-5}" font-size="10" fill="#6B6B68" text-anchor="end">≈2.5 bigram 天花板</text>`;
  // 轴标题
  g += `<text x="${CPL+cpw/2}" y="${C_H-3}" font-size="11" fill="#6B6B68" text-anchor="middle">step(训练迭代次数)</text>`;
  return g;
}

let curveRAF=null;
function drawLossCurve(uptoStep){
  let d='';
  const N=120;
  for(let i=0;i<=N;i++){
    const s=uptoStep*(i/N);
    d += (i===0?'M':'L') + cX(s).toFixed(1) + ',' + cY(lossAt(s)).toFixed(1) + ' ';
  }
  const lastX=cX(uptoStep), lastY=cY(lossAt(uptoStep));
  lossSvg.innerHTML = buildLossAxes()
    + `<path d="${d}" fill="none" stroke="#1A1A18" stroke-width="2"/>`
    + `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5" fill="#D97757" stroke="#fff" stroke-width="2"/>`;
  curveStepEl.textContent = Math.round(uptoStep);
  curveLossEl.textContent = lossAt(uptoStep).toFixed(2);
}
function resetLossCurve(){
  if(curveRAF){ cancelAnimationFrame(curveRAF); curveRAF=null; }
  drawLossCurve(0);
}
function trainCurve(){
  if(curveRAF){ cancelAnimationFrame(curveRAF); curveRAF=null; }
  const DUR=2600, t0=performance.now();
  function frame(now){
    const t=Math.min(1,(now-t0)/DUR);
    // ease-out:前段快、后段慢,贴合真实 loss 曲线
    const e=1-Math.pow(1-t,2);
    drawLossCurve(STEP_MAX*e);
    if(t<1){ curveRAF=requestAnimationFrame(frame); } else { curveRAF=null; }
  }
  curveRAF=requestAnimationFrame(frame);
}
document.getElementById('trainCurveBtn').addEventListener('click', trainCurve);
document.getElementById('curveResetBtn').addEventListener('click', resetLossCurve);
resetLossCurve();

/* 初始化导航状态:优先读 URL hash(支持首页深链 #step-N) */
goto(stepFromHash());
/* 浏览器前进/后退或外部修改 hash 时跟随跳转 */
_hashHandler = ()=>{ goto(stepFromHash()); };
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
