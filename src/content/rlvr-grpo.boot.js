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

/* ================================================================
   REAL-DATA:全部来自 phase5-fullstack/runs/ch21_*.json(RTX 4090)
   命令:cd phase5-fullstack && bash runs/queue_grpo_lr.sh && bash runs/queue_grpo.sh
   w200 / w1000:两个热身起点;base / warm / 三条路的最终评测(500 道评测题)与训练曲线(dev 200 道);
     三条路的数取按 dev 挑中的学习率那一次;lr:每个学习率的 dev / 评测贪心准确率
   groups:GRPO 训练中记下的真实采样组;ablate:G 与 KL 的对照
   ================================================================ */
const D={"w200": {"base": {"pass1": 0.0, "pass1_carry": 0.0, "pass1_nocarry": 0.0, "pass8": 0.0, "sample_acc": 0.0}, "warm": {"pass1": 0.05, "pass1_carry": 0.0335, "pass1_nocarry": 0.0619, "pass8": 0.184, "sample_acc": 0.028, "dev": 0.085}, "arms": {"sft": {"final": {"pass1": 0.664, "pass1_carry": 0.6555, "pass1_nocarry": 0.6701, "pass8": 0.916, "sample_acc": 0.4555, "dev": 0.71}, "curve": [{"step": 32, "loss": 1.1245, "acc": 0.065}, {"step": 64, "loss": 0.946, "acc": 0.11}, {"step": 96, "loss": 0.7704, "acc": 0.185}, {"step": 128, "loss": 0.6311, "acc": 0.355}, {"step": 160, "loss": 0.5175, "acc": 0.405}, {"step": 192, "loss": 0.4644, "acc": 0.34}, {"step": 224, "loss": 0.2995, "acc": 0.545}, {"step": 256, "loss": 0.3385, "acc": 0.71}], "lr": "3e-5"}, "dpo": {"final": {"pass1": 0.054, "pass1_carry": 0.0383, "pass1_nocarry": 0.0653, "pass8": 0.196, "sample_acc": 0.0328, "dev": 0.095}, "curve": [{"step": 32, "loss": 0.6911, "acc": 0.095, "pref_acc": 0.6875}, {"step": 64, "loss": 0.6847, "acc": 0.095, "pref_acc": 0.6875}, {"step": 96, "loss": 0.6775, "acc": 0.1, "pref_acc": 0.5625}, {"step": 128, "loss": 0.692, "acc": 0.105, "pref_acc": 0.5}, {"step": 160, "loss": 0.6892, "acc": 0.11, "pref_acc": 0.6875}, {"step": 192, "loss": 0.6826, "acc": 0.11, "pref_acc": 0.5}, {"step": 224, "loss": 0.6629, "acc": 0.095, "pref_acc": 0.8125}, {"step": 256, "loss": 0.686, "acc": 0.095, "pref_acc": 0.5}], "lr": "1e-7", "n_pairs": 711}, "grpo": {"final": {"pass1": 0.066, "pass1_carry": 0.0287, "pass1_nocarry": 0.0928, "pass8": 0.256, "sample_acc": 0.0512, "dev": 0.125}, "curve": [{"step": 32, "reward": 0.0261, "all_wrong": 0.832, "all_right": 0.0, "kl": 0.01145, "acc": 0.08}, {"step": 64, "reward": 0.0303, "all_wrong": 0.8262, "all_right": 0.0, "kl": 0.0112, "acc": 0.095}, {"step": 96, "reward": 0.0366, "all_wrong": 0.791, "all_right": 0.0, "kl": 0.0309, "acc": 0.1}, {"step": 128, "reward": 0.0383, "all_wrong": 0.7812, "all_right": 0.0, "kl": 0.02735, "acc": 0.09}, {"step": 160, "reward": 0.041, "all_wrong": 0.7891, "all_right": 0.0, "kl": 0.03334, "acc": 0.07}, {"step": 192, "reward": 0.0369, "all_wrong": 0.7949, "all_right": 0.0, "kl": 0.03735, "acc": 0.105}, {"step": 224, "reward": 0.0352, "all_wrong": 0.8086, "all_right": 0.0, "kl": 0.05183, "acc": 0.105}, {"step": 256, "reward": 0.0442, "all_wrong": 0.7754, "all_right": 0.002, "kl": 0.05116, "acc": 0.125}], "lr": "1e-6"}}}, "w1000": {"base": {"pass1": 0.0, "pass1_carry": 0.0, "pass1_nocarry": 0.0, "pass8": 0.0, "sample_acc": 0.0}, "warm": {"pass1": 0.41, "pass1_carry": 0.3349, "pass1_nocarry": 0.4639, "pass8": 0.752, "sample_acc": 0.3015, "dev": 0.455}, "arms": {"sft": {"final": {"pass1": 0.93, "pass1_carry": 0.8708, "pass1_nocarry": 0.9725, "pass8": 0.992, "sample_acc": 0.6412, "dev": 0.935}, "curve": [{"step": 32, "loss": 0.2433, "acc": 0.74}, {"step": 64, "loss": 0.3156, "acc": 0.81}, {"step": 96, "loss": 0.2246, "acc": 0.85}, {"step": 128, "loss": 0.1787, "acc": 0.785}, {"step": 160, "loss": 0.1872, "acc": 0.845}, {"step": 192, "loss": 0.182, "acc": 0.865}, {"step": 224, "loss": 0.1892, "acc": 0.925}, {"step": 256, "loss": 0.1274, "acc": 0.935}], "lr": "3e-6"}, "dpo": {"final": {"pass1": 0.478, "pass1_carry": 0.2871, "pass1_nocarry": 0.6151, "pass8": 0.84, "sample_acc": 0.3663, "dev": 0.51}, "curve": [{"step": 32, "loss": 0.6881, "acc": 0.47, "pref_acc": 0.8125}, {"step": 64, "loss": 0.6864, "acc": 0.475, "pref_acc": 0.625}, {"step": 96, "loss": 0.6854, "acc": 0.475, "pref_acc": 0.75}, {"step": 128, "loss": 0.6937, "acc": 0.505, "pref_acc": 0.5}, {"step": 160, "loss": 0.6668, "acc": 0.505, "pref_acc": 0.625}, {"step": 192, "loss": 0.6759, "acc": 0.49, "pref_acc": 0.625}, {"step": 224, "loss": 0.6661, "acc": 0.5, "pref_acc": 0.875}, {"step": 256, "loss": 0.6827, "acc": 0.51, "pref_acc": 0.5}], "lr": "3e-8", "n_pairs": 2956}, "grpo": {"final": {"pass1": 0.848, "pass1_carry": 0.8038, "pass1_nocarry": 0.8797, "pass8": 0.966, "sample_acc": 0.691, "dev": 0.895}, "curve": [{"step": 32, "reward": 0.3655, "all_wrong": 0.1641, "all_right": 0.0234, "kl": 0.20144, "acc": 0.58}, {"step": 64, "reward": 0.4529, "all_wrong": 0.1016, "all_right": 0.0508, "kl": 0.22467, "acc": 0.66}, {"step": 96, "reward": 0.4333, "all_wrong": 0.1367, "all_right": 0.0684, "kl": 0.27643, "acc": 0.645}, {"step": 128, "reward": 0.5198, "all_wrong": 0.0957, "all_right": 0.0957, "kl": 0.25899, "acc": 0.725}, {"step": 160, "reward": 0.5571, "all_wrong": 0.0645, "all_right": 0.1289, "kl": 0.2753, "acc": 0.805}, {"step": 192, "reward": 0.561, "all_wrong": 0.0859, "all_right": 0.1074, "kl": 0.34027, "acc": 0.64}, {"step": 224, "reward": 0.5859, "all_wrong": 0.0645, "all_right": 0.1602, "kl": 0.35689, "acc": 0.815}, {"step": 256, "reward": 0.6394, "all_wrong": 0.0566, "all_right": 0.1875, "kl": 0.34386, "acc": 0.895}], "lr": "1e-5"}}}, "lr": {"w200": {"sft": [["1e-5", 0.61, 0.688], ["3e-5", 0.71, 0.664], ["1e-4", 0.02, 0.03]], "dpo": [["1e-8", 0.095, 0.054], ["3e-8", 0.095, 0.058], ["1e-7", 0.095, 0.054], ["3e-7", 0.075, 0.054], ["1e-6", 0.075, 0.04], ["3e-6", 0.045, 0.066]], "grpo": [["3e-7", 0.105, 0.046], ["1e-6", 0.125, 0.066], ["3e-6", 0.115, 0.12], ["1e-5", 0.11, 0.064], ["3e-5", 0.06, 0.084]]}, "w1000": {"sft": [["1e-6", 0.855, 0.834], ["3e-6", 0.935, 0.93], ["1e-5", 0.905, 0.904], ["3e-5", 0.7, 0.676], ["1e-4", 0.35, 0.378]], "dpo": [["1e-8", 0.475, 0.458], ["3e-8", 0.51, 0.478], ["1e-7", 0.305, 0.35], ["3e-7", 0.155, 0.194], ["1e-6", 0.195, 0.224]], "grpo": [["1e-6", 0.82, 0.776], ["3e-6", 0.845, 0.802], ["1e-5", 0.895, 0.848], ["3e-5", 0.33, 0.29]]}}, "groups": [{"step": 1, "prompt": "6 0 + 9 2 =", "answer": 152, "samples": [" 1 5 2\n", " 1 6 2\n", " 1 5 2\n", " 1 5 2\n", " 1 5 2\n", " 1 5 2\n", " 1 5 2\n", " 1 5 2\n"], "reward": [1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], "adv": [0.353, -2.474, 0.353, 0.353, 0.353, 0.353, 0.353, 0.353]}, {"step": 2, "prompt": "1 8 + 1 0 =", "answer": 28, "samples": ["3 9\n", " 3 8\n", " 2 8\n", " 2 9\n", " 3 8\n", " 2 8\n", " 2 9\n", " 2 8\n"], "reward": [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0], "adv": [-0.724, -0.724, 1.207, -0.724, -0.724, 1.207, -0.724, 1.207]}, {"step": 3, "prompt": "1 1 + 5 6 =", "answer": 67, "samples": [" 7 7\n", " 7 7\n", " 7 8\n", " 7 7\n", " 7 7\n", " 6 7\n", " 7 7\n", " 7 7\n"], "reward": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0], "adv": [-0.353, -0.353, -0.353, -0.353, -0.353, 2.474, -0.353, -0.353]}, {"step": 64, "prompt": "6 0 + 4 2 =", "answer": 102, "samples": [" 1 0 2\n", " 1 0 2\n", " 1 0 2\n", " 1 0 2\n", " 1 0 2\n", " 9 2\n", " 1 0 2\n", " 1 0 2\n"], "reward": [1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0], "adv": [0.353, 0.353, 0.353, 0.353, 0.353, -2.474, 0.353, 0.353]}, {"step": 128, "prompt": "4 2 + 1 1 =", "answer": 53, "samples": [" 5 3\n", " 5 3\n", " 6 3\n", " 5 3\n", " 6 3\n", " 5 3\n", " 5 3\n", " 5 3\n"], "reward": [1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0], "adv": [0.54, 0.54, -1.62, 0.54, -1.62, 0.54, 0.54, 0.54]}, {"step": 256, "prompt": "7 3 + 5 8 =", "answer": 131, "samples": [" 1 3 1\n", " 1 3 1\n", " 1 3 1\n", " 1 3 1\n", " 1 3 1\n", " 1 3 1\n", " 1 3 1\n", " 1 3 1\n"], "reward": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], "adv": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}], "ablate": {"G": [{"G": 2, "pass1": 0.692, "pass8": 0.91, "dead": 0.6430750000000001}, {"G": 4, "pass1": 0.578, "pass8": 0.864, "dead": 0.327625}, {"G": 8, "pass1": 0.802, "pass8": 0.952, "dead": 0.1379625}, {"G": 16, "pass1": 0.88, "pass8": 0.986, "dead": 0.0412625}], "kl": [{"kl": 0.04, "pass1": 0.802, "pass8": 0.952, "kl_end": 0.26525}, {"kl": 0, "pass1": 0.838, "pass8": 0.962, "kl_end": 0.28393}]}, "dpo_note": "DPO 的偏好对是离线造的:warm 对每道题采 8 次,挑一对一错。热身 200 道的起点只凑出 711 对,热身 1000 道凑出 2956 对。热身 1000 道的起点上,学习率 3e-8 时从 warm 的 41.0% 升到 <b>47.8%</b>;学习率到 1e-7 就降到 35.0%,再大降得更多(见上面的学习率表)。热身 200 道的起点上,1e-8 到 1e-7 的 dev 准确率一样,并列取较大的 1e-7,评测 5.4%,和 warm 的 5.0% 基本持平;再大就往下掉。DPO 的损失只要求 chosen 比 rejected 的对数概率<b>相对</b>拉开,两者可以一起下降;这里 chosen 与 rejected 往往只差一位数字(如 1 5 2 与 1 6 2),学习率稍大,拉开差距最省事的办法之一就是把整段回答的概率一起压低,准确率随之下降。这是本页这一种设置(离线、每题一对、256 步)下的结果,不代表 DPO 在别的任务上的表现。", "grpo_note": "热身 1000 道的起点上,各自按 dev 挑学习率后:SFT <b>93.0%</b>,GRPO <b>84.8%</b>。GRPO 一个标准答案都没用,但这个任务的答案就是完整解,SFT 拿到的信息最多;GRPO 每道题 8 条回答参与更新,算力约是 SFT 的 8 倍。有标准答案时直接 SFT 更划算;RLVR 适合只能验证、拿不到标准解的场合,比如代码能跑测试、数学题只知道最终答案没有解题过程。起点弱时 GRPO 几乎学不到(热身 200 道:SFT 66.4%,GRPO 6.6%)。另一个教训:三条路都用扫描的起始学习率(sft 3e-5、dpo 3e-7、grpo 3e-6)时,热身 1000 道起点上 GRPO 80.2%、SFT 67.6%,看起来 GRPO 更好;按新起点重新挑学习率后顺序反过来。学习率不按起点重新挑,对照就会失真。只跑了一个随机种子。", "ok": ["基座 124M 两位数加法贪心 0.0%;热身 200 道后 5.0%,热身 1000 道后 41.0%", "热身 1000 道起点:GRPO 只用判分器,评测贪心 <b>84.8%</b>;同样 4096 道题的 SFT 93.0%,DPO 47.8%", "热身 200 道起点:GRPO 训练中平均 80.0% 的组全错或全对,只到 6.6%;SFT 66.4%", "组大小 G = 2 / 4 / 8 / 16:评测贪心 69.2% / 57.8% / 80.2% / 88.0%", "去掉 KL 项:83.8%(带 KL 80.2%)", "每个起点上每条路扫 3 到 6 个学习率,按 dev 题挑;500 道评测题不参与挑选"]};

const $=id=>document.getElementById(id);
function setActiveBtn(containerId,n){
  document.querySelectorAll('#'+containerId+' .btn').forEach((b,i)=>b.classList.toggle('primary',i===n));
}
const pct=v=>(v*100).toFixed(1)+'%';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ============ 步骤切换 ============ */
const NSTEP=5;
const tabs=document.querySelectorAll('.step-tab');
const panels=[];for(let i=0;i<NSTEP;i++)panels.push($('panel'+i));
let cur=0;
function goto(i){
  cur=Math.max(0,Math.min(NSTEP-1,i));
  tabs.forEach(t=>t.classList.toggle('active',+t.dataset.step===cur));
  panels.forEach((p,idx)=>p.classList.toggle('active',idx===cur));
  $('prevBtn').disabled = cur===0;
  $('nextBtn').textContent = cur===NSTEP-1 ? '完成 🎉' : '下一步 →';
  const hash='#step-'+(cur+1);
  if(location.hash!==hash) history.replaceState(null,'',hash);
  window.scrollTo({top:0,behavior:'smooth'});
}
tabs.forEach(t=>t.addEventListener('click',()=>goto(+t.dataset.step)));
$('prevBtn').addEventListener('click',()=>goto(cur-1));
$('nextBtn').addEventListener('click',()=>{ if(cur===NSTEP-1) celebrate(); else goto(cur+1); });

/* ============ STEP 1:真实采样组 ============ */
const GR=D.groups;
$('grpBtns').innerHTML=GR.map(g=>`<button class="btn">${esc(g.prompt)}</button>`).join('');
function showSample(t){ return esc(t.replace(/\n$/,'')).replace(/^ /,'␣'); }
function renderGroup(i){
  setActiveBtn('grpBtns',i);
  const g=GR[i];
  $('probTxt').innerHTML=`${esc(g.prompt)} <span class="ans">正确答案 ${g.answer}</span>`;
  $('smpBox').innerHTML=g.samples.map((s,j)=>`<div class="smp ${g.reward[j]?'ok':'no'}"><div class="st">${showSample(s)}</div><div class="sr">${g.reward[j]?'✓ 奖励 1':'✗ 奖励 0'}</div></div>`).join('');
  const ok=g.reward.filter(x=>x).length;
  $('s1Ok').textContent=`${ok} / ${g.reward.length}`;
  $('s1Mean').textContent=(ok/g.reward.length).toFixed(3);
  $('s1Step').textContent=g.step;
  $('s1Note').innerHTML=`判分器只输出 0 / 1,不告诉模型正确答案是多少。`+(ok===0?'这一组全错。':(ok===g.reward.length?'这一组全对。':`这一组 ${ok} 对 ${g.reward.length-ok} 错,对错混在一起,下一步就从这种组里算出更新方向。`))
    +` 这些组来自热身 1000 道的起点(第 ${g.step} 步是训练中途采的)。`;
}
document.querySelectorAll('#grpBtns .btn').forEach((b,i)=>b.addEventListener('click',()=>renderGroup(i)));
renderGroup(0);
$('baseAcc').textContent=pct(D.w200.base.pass1); $('baseP8').textContent=pct(D.w200.base.pass8);
$('w200Acc').textContent=pct(D.w200.warm.pass1); $('w1000Acc').textContent=pct(D.w1000.warm.pass1);

/* ============ STEP 2:优势 ============ */
const PRE=[[1,0,0,0,0,0,0,0],[1,1,0,1,0,0,1,0],[1,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1]];
let tog=PRE[1].slice();
function advOf(r){
  const n=r.length, m=r.reduce((a,b)=>a+b,0)/n;
  const sd=Math.sqrt(r.reduce((a,b)=>a+(b-m)*(b-m),0)/(n-1));      // torch.std 默认无偏(除以 n−1)
  return {m,sd,a:r.map(x=>(x-m)/(sd+1e-4))};
}
function renderAdv(){
  $('togBox').innerHTML=tog.map((v,j)=>`<div class="smp click ${v?'ok':'no'}" data-j="${j}"><div class="st">回答 ${j+1}</div><div class="sr">${v?'✓ 对':'✗ 错'}</div></div>`).join('');
  document.querySelectorAll('#togBox .smp').forEach(el=>el.addEventListener('click',()=>{tog[+el.dataset.j]^=1;setActiveBtn('presetBtns',-1);renderAdv();}));
  const {m,sd,a}=advOf(tog), mx=2.8;
  $('advBars').innerHTML=a.map(v=>{
    const h=Math.min(1,Math.abs(v)/mx)*50;
    const top=v>=0?50-h:50;
    return `<div class="advcol"><div class="ax"></div><div class="ab" style="top:${top}%;height:${Math.max(h,0.6)}%;background:${v>0?'var(--good)':(v<0?'var(--bad)':'#B9B5AA')}"></div><div class="av" style="top:${v>=0?Math.max(0,top-12):Math.min(88,top+h+1)}%">${v.toFixed(2)}</div></div>`;
  }).join('');
  $('s2Mean').textContent=m.toFixed(3); $('s2Std').textContent=sd.toFixed(3);
  const iOk=tog.indexOf(1), iNo=tog.indexOf(0);
  $('s2Aok').textContent=iOk>=0?a[iOk].toFixed(2):'–'; $('s2Ano').textContent=iNo>=0?a[iNo].toFixed(2):'–';
  const k=tog.filter(x=>x).length;
  $('s2Note').innerHTML=(k===0||k===8)?`${k===0?'全错':'全对'}:每条回答都等于均值,<b>8 条的优势全是 0</b>,这道题对这一步的更新没有贡献。`
    :`${k} 对 ${8-k} 错:答对的每条 A = ${a[iOk].toFixed(2)},答错的每条 A = ${a[iNo].toFixed(2)}。一组的优势加起来是 0,更新只改变"对的和错的之间"的相对概率。`;
}
document.querySelectorAll('#presetBtns .btn').forEach((b,i)=>b.addEventListener('click',()=>{setActiveBtn('presetBtns',i);tog=PRE[i].slice();renderAdv();}));
renderAdv();

/* ============ STEP 3:信号 ============ */
function lineChart(el,series,opts){
  const W=620,H=240,L=44,R=14,T=14,B=34;
  const xmax=opts.xmax, xs=v=>L+v/xmax*(W-L-R), ys=v=>T+(1-v)*(H-T-B);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;font-family:ui-monospace,monospace">`;
  for(let v=0;v<=1.0001;v+=0.25){ s+=`<line x1="${L}" x2="${W-R}" y1="${ys(v)}" y2="${ys(v)}" stroke="#E5E2D9"/><text x="${L-6}" y="${ys(v)+4}" font-size="10.5" text-anchor="end" fill="#6B6B68">${Math.round(v*100)}%</text>`; }
  opts.xticks.forEach(v=>{ s+=`<text x="${xs(v)}" y="${H-B+15}" font-size="10.5" text-anchor="middle" fill="#6B6B68">${v}</text>`; });
  s+=`<text x="${(L+W-R)/2}" y="${H-4}" font-size="10.5" text-anchor="middle" fill="#6B6B68">${opts.xlabel}</text>`;
  series.forEach(se=>{
    if(se.hline!==undefined){ s+=`<line x1="${L}" x2="${W-R}" y1="${ys(se.hline)}" y2="${ys(se.hline)}" stroke="${se.col}" stroke-dasharray="4 4" stroke-width="1.5"/>`; return; }
    const pts=se.pts.map(p=>xs(p[0])+','+ys(p[1])).join(' ');
    s+=`<polyline fill="none" stroke="${se.col}" stroke-width="2" ${se.dash?'stroke-dasharray="5 4"':''} points="${pts}"/>`;
    se.pts.forEach(p=>{ s+=`<circle cx="${xs(p[0])}" cy="${ys(p[1])}" r="2.6" fill="${se.col}"/>`; });
  });
  s+='</svg>'; $(el).innerHTML=s;
}
let startK='w200';
function renderSig(){
  const R=D[startK], c=R.arms.grpo.curve;
  lineChart('sigSvg',[
    {pts:c.map(p=>[p.step,p.all_wrong]),col:'#9a3a22'},
    {pts:c.map(p=>[p.step,p.all_right]),col:'#B9B5AA'},
    {pts:c.map(p=>[p.step,p.reward]),col:'#3a63c0',dash:1},
    {pts:c.map(p=>[p.step,p.acc]),col:'#D97757'},
  ],{xmax:256,xticks:[0,64,128,192,256],xlabel:'GRPO 训练步数(每步 16 道题 × 8 次采样)'});
  const dead=c.reduce((a,p)=>a+p.all_wrong+p.all_right,0)/c.length;
  $('s3Warm').textContent=`${pct(R.warm.pass1)} / ${pct(R.warm.pass8)}`;
  $('s3Dead').textContent=pct(dead);
  $('s3Final').textContent=pct(R.arms.grpo.final.pass1);
  $('s3Note').innerHTML=startK==='w200'
    ?`热身 200 道的起点:训练全程平均 <b>${pct(dead)}</b> 的组没有信号(几乎全是全错),GRPO 只把评测贪心准确率从 ${pct(R.warm.pass1)} 提到 ${pct(R.arms.grpo.final.pass1)}。`
    :`热身 1000 道的起点:开头约 ${pct(c[0].all_wrong)} 的组全错,之后降到 ${pct(c[c.length-1].all_wrong)};评测贪心准确率从 ${pct(R.warm.pass1)} 到 <b>${pct(R.arms.grpo.final.pass1)}</b>。`;
}
document.querySelectorAll('#startBtns .btn').forEach((b,i)=>b.addEventListener('click',()=>{setActiveBtn('startBtns',i);startK=i?'w1000':'w200';renderSig();}));
renderSig();
$('p8w200').textContent=pct(D.w200.warm.pass8); $('p8w1000').textContent=pct(D.w1000.warm.pass8);

/* ============ STEP 4:同台 ============ */
let cmpK='w1000';
const ARM=[['sft','SFT','#3a63c0','标准答案'],['dpo','DPO','#a3548c','判分器挑的偏好对'],['grpo','GRPO','#D97757','判分器当场打分']];
function renderCmp(){
  const R=D[cmpK];
  const row=(name,sup,f,lr,hl)=>`<tr class="${hl?'hl':''}"><td class="l">${name}</td><td class="l" style="color:var(--ink2);font-size:12px">${sup}</td><td>${lr||'–'}</td><td><b>${pct(f.pass1)}</b></td><td>${pct(f.pass1_carry)}</td><td>${pct(f.pass1_nocarry)}</td><td>${pct(f.pass8)}</td></tr>`;
  const best=ARM.reduce((b,a)=>R.arms[a[0]].final.pass1>R.arms[b[0]].final.pass1?a:b);
  $('cmpTable').innerHTML=`<thead><tr><th>模型</th><th style="text-align:left">用了什么</th><th>学习率</th><th>评测贪心</th><th>有进位</th><th>无进位</th><th>pass@8</th></tr></thead><tbody>`+
    row('基座 124M','—',R.base,null)+row('起点 warm',`${cmpK==='w200'?200:1000} 道带答案的题`,R.warm,null)+
    ARM.map(a=>row(a[1],a[3]+(a[0]==='dpo'?`(${R.arms.dpo.n_pairs} 对)`:''),R.arms[a[0]].final,R.arms[a[0]].lr,a===best)).join('')+'</tbody>';
  lineChart('curveSvg',[
    {hline:R.warm.dev,col:'#B9B5AA'},
    ...ARM.map(a=>({pts:[[0,R.warm.dev]].concat(R.arms[a[0]].curve.map(p=>[p.step,p.acc])),col:a[2]}))
  ],{xmax:256,xticks:[0,64,128,192,256],xlabel:'训练步数(每步 16 道题)'});
  const s=R.arms.sft.final.pass1,g=R.arms.grpo.final.pass1,d=R.arms.dpo.final.pass1;
  $('s4Note').innerHTML=cmpK==='w200'
    ?`起点弱(warm 贪心 ${pct(R.warm.pass1)}):有标准答案的 SFT 到 <b>${pct(s)}</b>;GRPO 大部分组全错,只到 ${pct(g)};DPO ${pct(d)}。`
    :`起点能采样出对的答案(warm pass@8 ${pct(R.warm.pass8)}):GRPO 到 <b>${pct(g)}</b>,SFT ${pct(s)},DPO ${pct(d)}。`;
}
document.querySelectorAll('#cmpBtns .btn').forEach((b,i)=>b.addEventListener('click',()=>{setActiveBtn('cmpBtns',i);cmpK=i?'w1000':'w200';renderCmp();}));
renderCmp();
$('dpoDig').innerHTML=D.dpo_note;
function renderLr(){
  const L=D.lr[cmpK], R=D[cmpK];
  $('lrTable').innerHTML=`<table class="tb" style="min-width:420px;margin:4px 0 8px"><thead><tr><th>路</th><th>学习率</th><th>dev 贪心</th><th>评测贪心</th></tr></thead><tbody>`+
    ARM.map(a=>L[a[0]].map(r=>`<tr class="${r[0]===R.arms[a[0]].lr?'hl':''}"><td>${a[1]}</td><td>${r[0]}</td><td>${pct(r[1])}</td><td>${pct(r[2])}</td></tr>`).join('')).join('')+'</tbody></table>';
}
renderLr();
document.querySelectorAll('#cmpBtns .btn').forEach(b=>b.addEventListener('click',renderLr));
$('grpoDig').innerHTML=D.grpo_note;

/* ============ STEP 5:消融 ============ */
let ablMode=0;
function renderAbl(){
  setActiveBtn('ablBtns',ablMode);
  const rows=ablMode===0?D.ablate.G.map(r=>[`G = ${r.G}`+(r.G===8?'(默认)':''),r]):D.ablate.kl.map(r=>[r.kl?`β = ${r.kl}(默认)`:'β = 0(去掉 KL)',r]);
  const w=D.w1000.warm.pass1;
  $('ablBars').innerHTML=rows.map(([n,r])=>`<div class="gbar"><span class="gn">${n}</span><span class="gt"><span class="gf" style="display:block;width:${r.pass1*100}%;background:${(ablMode===0?r.G===8:r.kl)?'var(--accent)':'var(--e1)'}"></span><span class="gm" style="left:${w*100}%"></span></span><span class="gv">${pct(r.pass1)} · p@8 ${pct(r.pass8)}</span></div>`).join('')
    +`<div class="mini-h">条长 = 评测贪心准确率;竖线 = 起点 warm ${pct(w)}</div>`;
  $('s5Note').innerHTML=ablMode===0
    ?D.ablate.G.map(r=>`G = ${r.G}:没有信号的组平均 ${pct(r.dead)}`).join(';')+'。G 越大,一组里同时有对有错的机会越大。'
    :`去掉 KL 后评测贪心 ${pct(D.ablate.kl[1].pass1)},带 KL(β = 0.04)${pct(D.ablate.kl[0].pass1)};训练结束时带 KL 那次与起点的逐 token KL 约 ${D.ablate.kl[0].kl_end.toFixed(3)}。`;
}
document.querySelectorAll('#ablBtns .btn').forEach((b,i)=>b.addEventListener('click',()=>{ablMode=i;renderAbl();}));
renderAbl();

$('okList').innerHTML=D.ok.map(t=>`<li><span class="ck">✓</span><div>${t}</div></li>`).join('');




/* ============ 通关庆祝 ============ */
function celebrate(){
  $('congrats').classList.add('show');
  const cv=$('confetti'); cv.style.display='block';
  const ctx=cv.getContext('2d'); cv.width=innerWidth; cv.height=innerHeight;
  const COL=['#D97757','#E8B04B','#6FAE8F','#5B8DEF','#D98AC0','#1A1A18'];
  const ps=[];for(let i=0;i<150;i++)ps.push({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*0.4,
    vx:(Math.random()-0.5)*3,vy:2+Math.random()*4,s:5+Math.random()*7,c:COL[i%COL.length],a:Math.random()*6.28,va:(Math.random()-0.5)*0.3});
  let t0=null;
  function frame(ts){ if(!t0)t0=ts; const el=ts-t0;
    ctx.clearRect(0,0,cv.width,cv.height);
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.04;p.a+=p.va;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);ctx.restore();});
    if(el<3400) requestAnimationFrame(frame); else { ctx.clearRect(0,0,cv.width,cv.height); cv.style.display='none'; }
  }
  requestAnimationFrame(frame);
  $('congrats').scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ============ 初始化:深链 ============ */
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
