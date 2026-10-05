/* =========================================================
   电学大冒险 · ELECTRIC QUEST · 人教版
   零基础学电学 · 湖南考试必备
   ========================================================= */

/* ---------- 兼容性：CanvasRenderingContext2D.roundRect polyfill（旧版浏览器） ---------- */
if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    if(typeof r==='number')r={tl:r,tr:r,br:r,bl:r};
    r=r||{tl:0,tr:0,br:0,bl:0};
    this.moveTo(x+r.tl,y);
    this.arcTo(x+w,y,x+w,y+h,r.tr);
    this.arcTo(x+w,y+h,x,y+h,r.br);
    this.arcTo(x,y+h,x,y,r.bl);
    this.arcTo(x,y,x+w,y,r.tl);
    this.closePath();
  };
}

/* ---------- 安全：HTML 转义（仅用于 innerHTML 模板中拼接的不可信/存档数据；textContent 无需转义） ---------- */
const _ESCAPE_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;'};
function esc(v){return String(v??'').replace(/[&<>"'/]/g,c=>_ESCAPE_MAP[c]);}

/* ---------- 音效 ---------- */
const Sfx = (() => {
  let ctx = null, on = localStorage.getItem('eq_sound')!=='off';
  const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); return ctx; };
  const beep = (f, d = 0.12, type = 'sine', vol = 0.15) => {
    if (!on) return;
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = vol;
      o.connect(g); g.connect(c.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.stop(c.currentTime + d);
    } catch (e) {}
  };
  return {
    toggle() { on = !on; try{localStorage.setItem('eq_sound',on?'on':'off');}catch(e){} return on; }, isOn() { return on; },
    click() { beep(660, 0.06, 'square', 0.08); },
    correct() { beep(880, 0.1); setTimeout(() => beep(1320, 0.12), 90); },
    wrong() { beep(200, 0.2, 'sawtooth', 0.12); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 100)); },
    star() { beep(1200, 0.1, 'triangle', 0.12); }
  };
})();

/* ---------- 背景动画（性能优化版：电气风暴） ---------- */
(() => {
  const cv = document.getElementById('bgCanvas'), ctx = cv.getContext('2d');
  let W, H, particles = [], arcs = [], sparks = [];
  const CELL = 120; // 空间分区格子大小 = 连线距离
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  resize();
  let rszT=null;
  addEventListener('resize', ()=>{resize();clearTimeout(rszT);rszT=setTimeout(spawn,200);});
  const COLORS = ['#00e5ff', '#7c4dff', '#ff3d81', '#ffd60a', '#39ff14'];
  const COL_RGB = ['0,229,255', '124,77,255', '255,61,129'];

  // 自适应粒子数量（低性能设备减少）
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const maxParticles = isLowEnd ? 50 : 80;

  const spawn = () => {
    particles = [];
    const n = Math.min(maxParticles, Math.floor(W * H / 22000));
    for (let i = 0; i < n; i++) particles.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.8 + 0.4, c: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse: Math.random() * Math.PI * 2
    });
  };
  spawn();
  const makeArc = () => {
    if (arcs.length > 4) return;
    let cx = Math.random() * W, cy = Math.random() * H;
    const pts = [{ x: cx, y: cy }];
    const segs = 6 + Math.floor(Math.random() * 6), len = 100 + Math.random() * 200;
    const ang = Math.random() * Math.PI * 2;
    for (let i = 0; i < segs; i++) {
      cx += Math.cos(ang + (Math.random() - 0.5) * 0.8) * (len / segs);
      cy += Math.sin(ang + (Math.random() - 0.5) * 0.8) * (len / segs);
      pts.push({ x: cx, y: cy });
    }
    arcs.push({ pts, life: 1, c: COLORS[Math.floor(Math.random() * COLORS.length)] });
  };
  const makeSpark = () => {
    if (sparks.length > 12) return;
    const x = Math.random() * W, y = Math.random() * H;
    const count = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const sp = 1 + Math.random() * 3;
      sparks.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, c: COLORS[Math.floor(Math.random() * COLORS.length)],
        r: Math.random() * 1.5 + 0.5
      });
    }
  };
  let frame = 0;
  let mouseX = W / 2, mouseY = H / 2, mouseActive = false;
  addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; mouseActive = true; });
  addEventListener('mouseleave', () => { mouseActive = false; });

  (function draw() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    // ===== 粒子更新（不使用 shadowBlur，用低开销绘制） =====
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.pulse += 0.05;
      if (mouseActive) {
        const dx = mouseX - p.x, dy = mouseY - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 22500) { // 150^2
          p.x += dx * 0.0008; p.y += dy * 0.0008;
        }
      }
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
    }

    // ===== 粒子绘制（合并同色减少状态切换） =====
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();
    }

    // ===== 粒子连线：空间分区（隔帧绘制降低开销） =====
    if (frame % 2 === 0) {
      const cols = Math.ceil(W / CELL) + 1;
      const grid = new Map();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
        const key = cy * cols + cx;
        let cell = grid.get(key);
        if (!cell) { cell = []; grid.set(key, cell); }
        cell.push(i);
      }
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            const cell = grid.get(gy * cols + gx);
            if (!cell) continue;
            for (let k = 0; k < cell.length; k++) {
              const j = cell[k];
              if (j <= i) continue;
              const q = particles[j];
              const dx = p.x - q.x, dy = p.y - q.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 14400) { // 120^2
                const d = Math.sqrt(d2);
                const mix = (i + j) % 3;
                ctx.strokeStyle = `rgba(${COL_RGB[mix]},${0.1 * (1 - d / 120)})`;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    }

    // ===== 电弧 =====
    if (frame % 30 === 0 && Math.random() > 0.3) makeArc();
    if (frame % 70 === 0 && Math.random() > 0.5) makeSpark();
    arcs = arcs.filter(a => a.life > 0);
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i];
      ctx.globalAlpha = a.life * 0.8;
      ctx.strokeStyle = a.c;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = a.c; ctx.shadowBlur = 10;
      ctx.beginPath();
      const pts = a.pts;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
      a.life -= 0.025;
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // ===== 火花 =====
    sparks = sparks.filter(s => s.life > 0);
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vx *= 0.96; s.vy *= 0.96; s.life -= 0.025;
      const rad = s.r * s.life;
      if (rad < 0.01 || s.life <= 0) continue;
      ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = s.c; ctx.shadowColor = s.c; ctx.shadowBlur = 6 * s.life; ctx.fill();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  })();
})();

/* =========================================================
   关卡数据（人教版 · 20关）
   每关含：teach（知识讲解步骤）+ mode（玩法）+ rounds
   ========================================================= */
const LEVELS = [
  // ========== 初中 ==========
  { id:1, stage:'junior', icon:'🧲', title:'电荷与起电', diff:1,
    desc:'认识电荷，理解摩擦起电的本质与电荷间的相互作用。',
    know:['两种电荷：正电荷与负电荷','同种电荷相斥，异种电荷相吸','摩擦起电本质是电子转移','验电器工作原理'],
    mode:'lab', labId:'static', rounds:1,
    teach:[
      {title:'电是什么？', html:`<p class="concept">在我们身边，电无处不在。电灯发光、手机充电、闪电劈空——这些都是<b class="key">电</b>的表现。</p>
        <div class="life-ex"><b>💡 生活实例：</b>冬天脱毛衣时听到"噼啪"声、梳头时头发飘起来、触摸门把手时被电一下——这些都是<b>静电</b>现象。</div>`},
      {title:'两种电荷', html:`<p class="concept">自然界只有<b class="key">两种电荷</b>：用丝绸摩擦过的玻璃棒带<b class="key">正电荷</b>（+），用毛皮摩擦过的橡胶棒带<b class="key">负电荷</b>（-）。</p>
        <div class="key-points"><ul><li>正电荷：失去电子的物体带正电</li><li>负电荷：得到电子的物体带负电</li><li>同种电荷相互<b>排斥</b>，异种电荷相互<b>吸引</b></li></ul></div>`},
      {title:'摩擦起电的本质', html:`<p class="concept">摩擦起电并不是"创造"了电荷，而是<b class="key">电子从一个物体转移到另一个物体</b>。</p>
        <div class="analogy"><b>🌊 类比理解：</b>就像两个人传球，一个人失去球（带正电），另一个人得到球（带负电），球的总数不变。</div>
        <div class="formula-box">电子转移：A − e⁻ → A⁺ ，B + e⁻ → B⁻</div>`},
      {title:'验电器', html:`<p class="concept"><b class="key">验电器</b>利用同种电荷相互排斥的原理检测物体是否带电。</p>
        <div class="key-points"><ul><li>带电体接触金属球，电荷传到两片金属箔上</li><li>两片金属箔带同种电荷，相互排斥而张开</li><li>张开角度越大，带电量越多</li></ul></div>`}
    ]},
  { id:2, stage:'junior', icon:'🔋', title:'电流与电路', diff:1,
    desc:'理解电流的形成，掌握电路的组成与电路图。',
    know:['电流：电荷的定向移动','电流方向：正电荷移动方向','电路四要素：电源、用电器、开关、导线','电路图符号'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'电流的形成', html:`<p class="concept">电荷的<b class="key">定向移动</b>形成电流。金属导体中是自由电子定向移动形成电流。</p>
        <div class="analogy"><b>🌊 水流类比：</b>水管中的水定向流动形成水流；导线中的电荷定向移动形成电流。</div>`},
      {title:'电流方向', html:`<p class="concept">物理学规定：<b class="key">正电荷定向移动的方向</b>为电流方向。</p>
        <div class="key-points"><ul><li>电路中电流方向：电源正极 → 用电器 → 负极</li><li>金属中电子移动方向与电流方向<b>相反</b></li></ul></div>`},
      {title:'电路的组成', html:`<p class="concept">一个完整电路由<b class="key">电源、用电器、开关、导线</b>四部分组成。</p>
        <div class="life-ex"><b>💡 手电筒电路：</b>电池（电源）→ 导线 → 灯泡（用电器）→ 开关 → 回到电池。</div>`},
      {title:'三种电路状态', html:`<div class="key-points"><ul><li><b>通路：</b>电路接通，有电流，用电器工作</li><li><b>断路：</b>电路某处断开，无电流</li><li><b>短路：</b>导线直接接电源两极，电流过大，危险！</li></ul></div>`}
    ]},
  { id:3, stage:'junior', icon:'🔗', title:'串联与并联', diff:2,
    desc:'掌握串联、并联电路的连接方式与电流、电压特点。',
    know:['串联：电流只有一条路径','并联：电流有多条路径','串联电流处处相等','并联各支路电压相等'],
    mode:'lab', labId:'circuit', rounds:1,
    teach:[
      {title:'串联电路', html:`<p class="concept">电路元件<b class="key">逐个顺次连接</b>，电流只有一条路径。</p>
        <div class="analogy"><b>🚂 火车类比：</b>串联像火车车厢一节接一节，乘客（电流）只能沿着一条路走。</div>
        <div class="formula-box">串联：I = I₁ = I₂ ， U = U₁ + U₂</div>`},
      {title:'并联电路', html:`<p class="concept">电路元件<b class="key">并列连接</b>在两点之间，电流有多条路径。</p>
        <div class="analogy"><b>🛣️ 马路类比：</b>并联像多条平行马路，车辆（电流）可以走不同的路。</div>
        <div class="formula-box">并联：I = I₁ + I₂ ， U = U₁ = U₂</div>`},
      {title:'生活中的串并联', html:`<div class="life-ex"><b>💡 家庭电路：</b>家中所有用电器都是<b>并联</b>的，这样每个用电器两端电压都是220V，互不影响。</div>
        <div class="key-points"><ul><li>串联：一个用电器坏了，全部停止工作</li><li>并联：一个用电器坏了，其他照常工作</li></ul></div>`}
    ]},
  { id:4, stage:'junior', icon:'⚡', title:'电压', diff:2,
    desc:'理解电压的概念，掌握串并联电路中电压的规律。',
    know:['电压是形成电流的原因','单位：伏特(V)','串联U=U₁+U₂','并联U=U₁=U₂'],
    mode:'calc', rounds:5,
    teach:[
      {title:'电压是什么？', html:`<p class="concept"><b class="key">电压</b>是电路中形成电流的原因，电源是提供电压的装置。</p>
        <div class="analogy"><b>💧 水压类比：</b>水塔越高，水压越大，水流越急；电源电压越高，电流越大。电压就像"电的压力"。</div>`},
      {title:'电压的单位', html:`<div class="key-points"><ul><li>单位：<b>伏特</b>，简称伏，符号 V</li><li>常用单位：kV、mV、μV</li><li>1 kV = 10³ V，1 V = 10³ mV</li><li>一节干电池：1.5 V；家庭电路：220 V</li></ul></div>`},
      {title:'串并联电压规律', html:`<div class="formula-box">串联：U = U₁ + U₂ + ... + Uₙ<br>并联：U = U₁ = U₂ = ... = Uₙ</div>
        <div class="key-points"><ul><li>串联电路总电压等于各部分电压之和</li><li>并联电路各支路电压相等，都等于电源电压</li></ul></div>`}
    ]},
  { id:5, stage:'junior', icon:'🧱', title:'电阻与变阻器', diff:2,
    desc:'理解电阻概念，掌握滑动变阻器的原理与使用。',
    know:['电阻表示导体对电流的阻碍作用','单位：欧姆(Ω)','决定电阻大小的因素','滑动变阻器原理：改变电阻线长度'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'电阻', html:`<p class="concept"><b class="key">电阻</b>表示导体对电流的阻碍作用，符号 R，单位<b>欧姆</b>（Ω）。</p>
        <div class="analogy"><b>🚰 水管类比：</b>粗水管阻力小水流大，细水管阻力大水流小。导体越粗越短，电阻越小。</div>`},
      {title:'电阻大小的决定因素', html:`<div class="key-points"><ul><li><b>材料：</b>不同材料导电能力不同</li><li><b>长度：</b>导体越长，电阻越大</li><li><b>横截面积：</b>导体越粗，电阻越小</li><li><b>温度：</b>金属温度越高，电阻越大</li></ul></div>
        <div class="formula-box">R = ρL / S （ρ为电阻率）</div>`},
      {title:'滑动变阻器', html:`<p class="concept">通过改变接入电路中<b class="key">电阻线的长度</b>来改变电阻，从而改变电流。</p>
        <div class="key-points"><ul><li>接法："一上一下"</li><li>闭合开关前，滑片应置于最大阻值处（保护电路）</li></ul></div>`}
    ]},
  { id:6, stage:'junior', icon:'📐', title:'欧姆定律', diff:3,
    desc:'掌握欧姆定律 I=U/R，学会伏安法测电阻。',
    know:['欧姆定律：I=U/R','变形：U=IR, R=U/I','伏安法测电阻','串并联电路中欧姆定律的应用'],
    mode:'lab', labId:'ohm', rounds:1,
    teach:[
      {title:'欧姆定律', html:`<p class="concept">导体中的电流，跟导体两端的电压成<b class="key">正比</b>，跟导体的电阻成<b class="key">反比</b>。</p>
        <div class="formula-box">I = U / R</div>
        <div class="key-points"><ul><li>U — 电压，单位伏特(V)</li><li>R — 电阻，单位欧姆(Ω)</li><li>I — 电流，单位安培(A)</li></ul></div>`},
      {title:'公式变形', html:`<div class="formula-box">U = I × R &nbsp;&nbsp; R = U / I</div>
        <p class="concept">注意：R=U/I 只是计算式，<b class="key">电阻是导体本身的性质</b>，不随电压电流变化。</p>`},
      {title:'伏安法测电阻', html:`<p class="concept">用<b class="key">电压表测电压</b>、<b class="key">电流表测电流</b>，再用 R=U/I 算出电阻。</p>
        <div class="key-points"><ul><li>滑动变阻器作用：改变电阻两端电压，多次测量求平均值</li><li>连接电路时开关应断开</li><li>闭合开关前滑片在最大阻值处</li></ul></div>`}
    ]},
  { id:7, stage:'junior', icon:'💡', title:'电功与电功率', diff:3,
    desc:'理解电功和电功率，掌握相关计算。',
    know:['W=UIt','P=UI=W/t','额定功率与实际功率','单位：焦耳(J)、瓦特(W)'],
    mode:'calc', rounds:6,
    teach:[
      {title:'电功', html:`<p class="concept">电流做功的过程就是电能转化为其他形式能的过程。电流做了多少功，就消耗了多少电能。</p>
        <div class="formula-box">W = U I t</div>
        <div class="key-points"><ul><li>W — 电功，单位焦耳(J)</li><li>1 度 = 1 kW·h = 3.6×10⁶ J</li></ul></div>`},
      {title:'电功率', html:`<p class="concept"><b class="key">电功率</b>表示电流做功的快慢，等于电功与时间之比。</p>
        <div class="formula-box">P = W / t = U I</div>
        <div class="key-points"><ul><li>P — 电功率，单位瓦特(W)</li><li>1 kW = 1000 W</li></ul></div>`},
      {title:'额定功率与实际功率', html:`<div class="key-points"><ul><li><b>额定电压：</b>用电器正常工作时的电压</li><li><b>额定功率：</b>用电器在额定电压下的功率</li><li>实际电压 ≠ 额定电压时，实际功率 ≠ 额定功率</li></ul></div>
        <div class="life-ex"><b>💡 灯泡亮度：</b>由实际功率决定，实际功率越大越亮。</div>`}
    ]},
  { id:8, stage:'junior', icon:'🔥', title:'焦耳定律', diff:3,
    desc:'理解电流的热效应，掌握 Q=I²Rt。',
    know:['Q=I²Rt','纯电阻电路Q=W','电热器原理','焦耳定律应用'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'电流的热效应', html:`<p class="concept">电流通过导体时电能转化为热能，这种现象叫<b class="key">电流的热效应</b>。</p>
        <div class="life-ex"><b>💡 生活实例：</b>电热水器、电饭锅、电熨斗、电炉子都是利用电流热效应工作的。</div>`},
      {title:'焦耳定律', html:`<p class="concept">电流通过导体产生的热量，跟电流的平方、导体的电阻和通电时间成正比。</p>
        <div class="formula-box">Q = I² R t</div>
        <div class="key-points"><ul><li>Q — 热量，单位焦耳(J)</li><li>热量与电流<b>平方</b>成正比</li></ul></div>`},
      {title:'纯电阻电路', html:`<p class="concept">在纯电阻电路中，电流做的功全部转化为热量，所以<b class="key">Q = W</b>。</p>
        <div class="formula-box">Q = W = UIt = U²t/R = I²Rt</div>
        <p class="concept">非纯电阻电路（如电动机）：W > Q，电能大部分转化为机械能。</p>`}
    ]},
  { id:9, stage:'junior', icon:'🏠', title:'家庭电路与安全用电', diff:2,
    desc:'认识家庭电路组成，掌握安全用电原则。',
    know:['火线、零线、地线','保险丝作用','安全电压≤36V','测电笔使用','触电急救'],
    mode:'lab', labId:'home', rounds:1,
    teach:[
      {title:'家庭电路的组成', html:`<div class="key-points"><ul><li><b>进户线：</b>火线(L)与零线(N)，电压220V</li><li><b>电能表：</b>测量消耗的电能</li><li><b>总开关：</b>控制整个电路</li><li><b>保险丝/空气开关：</b>电流过大时自动切断电路</li><li><b>用电器与插座：</b>并联接入电路</li></ul></div>`},
      {title:'火线与零线', html:`<p class="concept">用<b class="key">测电笔</b>辨别火线和零线：接触火线时氖管发光，接触零线时不发光。</p>
        <div class="analogy"><b>🌊 类比：</b>火线像高水位的水，零线像低水位的水，水位差（电压）推动水流（电流）。</div>`},
      {title:'安全用电', html:`<div class="key-points"><ul><li>安全电压：<b>不高于 36V</b></li><li>保险丝用<b>电阻率大、熔点低</b>的铅锑合金</li><li>保险丝必须接在<b>火线</b>上</li><li>三孔插座：左零右火上地</li><li>金属外壳用电器必须接地</li></ul></div>
        <div class="life-ex"><b>⚠️ 触电急救：</b>先切断电源，再施救，切勿直接用手拉触电者！</div>`}
    ]},
  { id:10, stage:'junior', icon:'🧭', title:'电与磁', diff:3,
    desc:'认识磁场、电生磁、电磁铁、电动机与电磁感应。',
    know:['磁体与磁场','奥斯特实验：电生磁','安培定则','电磁铁','电动机原理','电磁感应'],
    mode:'lab', labId:'magnet', rounds:1,
    teach:[
      {title:'磁体与磁场', html:`<p class="concept">磁体有<b>N极和S极</b>，同名磁极相斥，异名磁极相吸。磁体周围存在<b class="key">磁场</b>。</p>
        <div class="key-points"><ul><li>磁场方向：小磁针N极所指方向</li><li>磁感线：从N极出发回到S极</li><li>地磁场：地球本身是个大磁体</li></ul></div>`},
      {title:'电生磁（奥斯特实验）', html:`<p class="concept">通电导线周围存在磁场，称为<b class="key">电流的磁效应</b>。奥斯特第一个发现电与磁的联系。</p>
        <div class="formula-box">安培定则（右手螺旋定则）：<br>右手握螺线管，四指指向电流方向，大拇指指向N极</div>`},
      {title:'电磁铁与电动机', html:`<div class="key-points"><ul><li><b>电磁铁：</b>插入铁芯的通电螺线管，磁性强弱与电流大小、线圈匝数有关</li><li><b>电磁继电器：</b>用低电压控制高电压的自动开关</li><li><b>电动机：</b>通电线圈在磁场中受力转动，电能→机械能</li></ul></div>`},
      {title:'电磁感应（磁生电）', html:`<p class="concept"><b class="key">法拉第</b>发现：闭合电路的一部分导体在磁场中做切割磁感线运动时，导体中产生感应电流。</p>
        <div class="formula-box">发电机原理：电磁感应<br>机械能 → 电能</div>
        <div class="key-points"><ul><li>感应电流方向与磁场方向、导体运动方向有关</li><li>发电机将机械能转化为电能</li></ul></div>`}
    ]},

  // ========== 高中 ==========
  { id:11, stage:'senior', icon:'⚛️', title:'库仑定律', diff:3,
    desc:'掌握点电荷间的相互作用力 F=kQ₁Q₂/r²。',
    know:['点电荷模型','F=kQ₁Q₂/r²','k=9×10⁹ N·m²/C²','适用条件：真空中点电荷'],
    mode:'calc', rounds:6,
    teach:[
      {title:'点电荷', html:`<p class="concept">当带电体间距离远大于自身大小时，可将带电体看作<b class="key">点电荷</b>，是一种理想化模型。</p>
        <div class="analogy"><b>🌍 类比：</b>研究地球绕太阳运动时，地球可看作质点；研究原子结构时，电子可看作点电荷。</div>`},
      {title:'库仑定律', html:`<p class="concept">真空中两个静止点电荷之间的相互作用力，与它们电荷量的乘积成正比，与距离的平方成反比。</p>
        <div class="formula-box">F = k Q₁Q₂ / r²</div>
        <div class="key-points"><ul><li>k = 9.0×10⁹ N·m²/C²（静电力常量）</li><li>方向：沿两电荷连线，同斥异吸</li><li>适用于<b>真空中的点电荷</b></li></ul></div>`},
      {title:'与万有引力对比', html:`<div class="formula-box">库仑力：F = kQ₁Q₂/r²<br>万有引力：F = Gm₁m₂/r²</div>
        <p class="concept">两者都是<b>平方反比力</b>，但库仑力远大于万有引力，且库仑力可斥可吸，万有引力只吸引。</p>`}
    ]},
  { id:12, stage:'senior', icon:'🌀', title:'电场强度', diff:3,
    desc:'理解电场概念，掌握场强计算与电场线。',
    know:['E=F/q（定义式）','E=kQ/r²（点电荷）','E=U/d（匀强电场）','电场线特点'],
    mode:'sim', rounds:1,
    teach:[
      {title:'电场', html:`<p class="concept">电荷周围存在一种特殊物质——<b class="key">电场</b>。电荷间的相互作用通过电场发生。</p>
        <div class="analogy"><b>🌊 类比：</b>就像磁铁周围有磁场一样，电荷周围有电场。放入电场的电荷会受到电场力。</div>`},
      {title:'电场强度', html:`<p class="concept">放入电场中某点的试探电荷所受电场力 F 与其电荷量 q 的比值叫<b class="key">电场强度</b>。</p>
        <div class="formula-box">E = F / q （定义式，适用于一切电场）</div>
        <div class="key-points"><ul><li>单位：N/C 或 V/m</li><li>方向：正电荷受力方向</li><li>E 由电场本身决定，与试探电荷无关</li></ul></div>`},
      {title:'点电荷的场强', html:`<div class="formula-box">E = k Q / r² （点电荷场强公式）</div>
        <p class="concept">正点电荷的电场线向外辐射，负点电荷的电场线向内汇聚。</p>
        <div class="key-points"><ul><li>匀强电场：E = U / d</li><li>电场线越密处场强越大</li><li>电场线不闭合、不相交</li></ul></div>`}
    ]},
  { id:13, stage:'senior', icon:'⚡', title:'电势能与电势', diff:3,
    desc:'理解电势能、电势、电势差的概念。',
    know:['电势能Ep=qφ','电势差U_AB=φ_A-φ_B','电场力做功W=qU','沿电场线电势降低'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'电势能', html:`<p class="concept">电荷在电场中具有的势能叫<b class="key">电势能</b>，用 Eₚ 表示。</p>
        <div class="analogy"><b>🏔️ 类比：</b>物体在重力场中有重力势能（mgh），电荷在电场中有电势能（qφ）。高度越高重力势能越大，电势越高正电荷电势能越大。</div>`},
      {title:'电势', html:`<div class="formula-box">φ = Eₚ / q</div>
        <div class="key-points"><ul><li>电势是标量，有正负</li><li>沿电场线方向电势<b>逐渐降低</b></li><li>电势的大小与零势点选取有关</li></ul></div>`},
      {title:'电势差与电场力做功', html:`<div class="formula-box">U<sub>AB</sub> = φ<sub>A</sub> − φ<sub>B</sub><br>W<sub>AB</sub> = q U<sub>AB</sub> = q(φ<sub>A</sub> − φ<sub>B</sub>)</div>
        <div class="key-points"><ul><li>电场力做正功，电势能减少</li><li>电场力做负功，电势能增加</li><li>W = −ΔEₚ（与重力做功类似）</li></ul></div>`}
    ]},
  { id:14, stage:'senior', icon:'🔋', title:'电容器', diff:3,
    desc:'掌握电容定义与平行板电容器。',
    know:['C=Q/U','平行板C=εS/(4πkd)','单位法拉(F)','电容器充放电'],
    mode:'matching', rounds:1,
    teach:[
      {title:'电容器', html:`<p class="concept">两个彼此绝缘又互相靠近的导体组成<b class="key">电容器</b>，可以储存电荷和电能。</p>
        <div class="life-ex"><b>💡 应用：</b>照相机闪光灯、电子电路滤波、手机触摸屏都用到电容器。</div>`},
      {title:'电容', html:`<div class="formula-box">C = Q / U</div>
        <div class="key-points"><ul><li>电容表示电容器储存电荷的本领</li><li>单位：法拉(F)，1 F = 1 C/V</li><li>常用：μF(10⁻⁶F)、pF(10⁻¹²F)</li></ul></div>`},
      {title:'平行板电容器', html:`<div class="formula-box">C = εS / (4πkd)</div>
        <div class="key-points"><ul><li>S 越大，C 越大</li><li>d 越大，C 越小</li><li>ε（介电常数）越大，C 越大</li></ul></div>`}
    ]},
  { id:15, stage:'senior', icon:'🔌', title:'闭合电路欧姆定律', diff:4,
    desc:'掌握电源电动势、内阻与路端电压的关系。',
    know:['I=ε/(R+r)','U=ε−Ir','电源输出功率','路端电压随外阻变化'],
    mode:'sim', rounds:1,
    teach:[
      {title:'电动势', html:`<p class="concept"><b class="key">电动势 ε</b>表示电源把其他形式的能转化为电能的本领，等于电源没有接入电路时两极间的电压。</p>
        <div class="analogy"><b>💧 类比：</b>电动势像水泵的"扬程"，把水从低处抽到高处，维持水压。内阻像水管本身的阻力。</div>`},
      {title:'闭合电路欧姆定律', html:`<div class="formula-box">I = ε / (R + r)</div>
        <div class="key-points"><ul><li>R — 外电路总电阻</li><li>r — 电源内阻</li><li>路端电压 U = ε − Ir = IR</li></ul></div>`},
      {title:'路端电压的变化', html:`<p class="concept">外电阻 R 增大时，电流 I 减小，路端电压 U 增大；R 减小时相反。</p>
        <div class="key-points"><ul><li>外电路断路：R→∞，I=0，U=ε</li><li>外电路短路：R=0，I=ε/r，U=0（危险！）</li><li>电源输出功率最大时：R=r</li></ul></div>`}
    ]},
  { id:16, stage:'senior', icon:'🧲', title:'磁场对电流的作用', diff:4,
    desc:'掌握安培力与左手定则。',
    know:['F=BIL（B⊥I）','左手定则','安培力方向判断','电动机原理'],
    mode:'lab', labId:'motor', rounds:1,
    teach:[
      {title:'安培力', html:`<p class="concept">磁场对通电导线的作用力叫<b class="key">安培力</b>。</p>
        <div class="formula-box">F = B I L （B⊥I时）</div>
        <div class="key-points"><ul><li>B — 磁感应强度，单位特斯拉(T)</li><li>I — 电流(A)，L — 导线长度(m)</li><li>B∥I时，F=0</li></ul></div>`},
      {title:'左手定则', html:`<p class="concept">伸开左手，让磁感线穿入手心，四指指向电流方向，大拇指所指方向就是安培力方向。</p>
        <div class="analogy"><b>✋ 记忆：</b>磁感线从手心"进入"，四指指向电流，大拇指指向力的方向——"掌心对磁场，四指对电流，拇指对力"。</div>`},
      {title:'电动机原理', html:`<p class="concept">通电线圈在磁场中受安培力作用发生转动，这就是<b>电动机</b>的原理。</p>
        <div class="key-points"><ul><li>能量转化：电能 → 机械能</li><li>换向器使线圈持续转动</li><li>生活应用：电风扇、洗衣机、电动车</li></ul></div>`}
    ]},
  { id:17, stage:'senior', icon:'🌀', title:'磁场对运动电荷的作用', diff:4,
    desc:'掌握洛伦兹力与带电粒子在磁场中的运动。',
    know:['F=qvB','左手定则判断洛伦兹力','匀速圆周运动半径r=mv/qB','质谱仪与回旋加速器'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'洛伦兹力', html:`<p class="concept">磁场对运动电荷的作用力叫<b class="key">洛伦兹力</b>。</p>
        <div class="formula-box">F = q v B （v⊥B时）</div>
        <div class="key-points"><ul><li>方向用左手定则判断（四指指正电荷运动方向）</li><li>洛伦兹力始终与速度方向垂直</li><li>洛伦兹力不做功，只改变速度方向</li></ul></div>`},
      {title:'带电粒子在匀强磁场中的运动', html:`<div class="formula-box">半径 r = mv / (qB)<br>周期 T = 2πm / (qB)</div>
        <p class="concept">当 v⊥B 时，粒子做<b>匀速圆周运动</b>，洛伦兹力提供向心力。</p>
        <div class="key-points"><ul><li>半径与速度成正比，与磁感应强度成反比</li><li>周期与速度无关！</li></ul></div>`},
      {title:'应用', html:`<div class="key-points"><ul><li><b>质谱仪：</b>测量带电粒子质量</li><li><b>回旋加速器：</b>加速带电粒子</li><li><b>电视机显像管：</b>电子束偏转成像</li></ul></div>`}
    ]},
  { id:18, stage:'senior', icon:'🔄', title:'电磁感应', diff:4,
    desc:'掌握楞次定律与法拉第电磁感应定律。',
    know:['ε=nΔΦ/Δt','Φ=BS⊥','楞次定律：阻碍变化','ε=BLv（动生）'],
    mode:'quiz', rounds:8,
    teach:[
      {title:'磁通量', html:`<div class="formula-box">Φ = B S<sub>⊥</sub></div>
        <div class="key-points"><ul><li>Φ — 磁通量，单位韦伯(Wb)</li><li>S<sub>⊥</sub> — 垂直于磁场的面积</li><li>Φ = BS cosθ</li></ul></div>`},
      {title:'法拉第电磁感应定律', html:`<p class="concept">感应电动势的大小与磁通量的变化率成正比。</p>
        <div class="formula-box">ε = n ΔΦ / Δt</div>
        <div class="key-points"><ul><li>n — 线圈匝数</li><li>ε 与磁通量的变化率成正比，与磁通量大小无关</li><li>动生电动势：ε = BLv（B、L、v两两垂直）</li></ul></div>`},
      {title:'楞次定律', html:`<p class="concept">感应电流的磁场总是<b class="key">阻碍</b>引起感应电流的磁通量的变化。</p>
        <div class="analogy"><b>🪞 "来拒去留"：</b>磁通量增大时，感应磁场"拒绝"它增大；磁通量减小时，感应磁场"挽留"它。</div>
        <div class="key-points"><ul><li>本质：能量守恒定律的体现</li><li>右手定则：判断动生电动势方向</li></ul></div>`}
    ]},
  { id:19, stage:'senior', icon:'📈', title:'交变电流', diff:4,
    desc:'掌握正弦交流电的产生、有效值与变压器。',
    know:['e=Eₘsinωt','有效值E=Eₘ/√2','变压器U₁/U₂=n₁/n₂','远距离输电'],
    mode:'sim', rounds:1,
    teach:[
      {title:'交变电流的产生', html:`<p class="concept">矩形线圈在匀强磁场中匀速转动，产生<b class="key">正弦式交变电流</b>。</p>
        <div class="formula-box">e = Eₘ sin(ωt) &nbsp; (线圈从中性面开始转动)</div>
        <div class="key-points"><ul><li>中性面：线圈平面与磁场垂直，此时磁通量最大，感应电动势为0</li><li>线圈垂直中性面时，磁通量为0，感应电动势最大</li></ul></div>`},
      {title:'有效值', html:`<p class="concept">让交流电和直流电通过相同电阻，相同时间内产生相同热量，该直流电的数值就是交流电的<b class="key">有效值</b>。</p>
        <div class="formula-box">E = Eₘ / √2 ≈ 0.707 Eₘ<br>U = Uₘ / √2 ， I = Iₘ / √2</div>
        <div class="life-ex"><b>💡 我们说的"220V"就是有效值！</b></div>`},
      {title:'变压器', html:`<div class="formula-box">U₁ / U₂ = n₁ / n₂ （电压比=匝数比）</div>
        <div class="key-points"><ul><li>理想变压器：P₁ = P₂</li><li>n₁ > n₂ → 降压变压器</li><li>n₁ < n₂ → 升压变压器</li><li>远距离输电：高压输电减少电能损失</li></ul></div>`}
    ]},
  { id:20, stage:'senior', icon:'👑', title:'电学综合应用', diff:5,
    desc:'综合运用电学知识解决复杂问题。',
    know:['电场力与电势能综合','电路动态分析','电磁感应综合','带电粒子复合场运动'],
    mode:'quiz', rounds:10,
    teach:[
      {title:'电学知识体系', html:`<p class="concept">电学是一个完整的体系：<b>静电场 → 恒定电流 → 磁场 → 电磁感应 → 交变电流</b>。</p>
        <div class="key-points"><ul><li>电场：库仑定律、场强、电势、电容</li><li>电路：欧姆定律、电功率、焦耳定律</li><li>磁场：安培力、洛伦兹力</li><li>电磁感应：楞次定律、法拉第定律</li></ul></div>`},
      {title:'电路动态分析', html:`<p class="concept">电路中某一电阻变化时，分析各部分电流电压的变化。</p>
        <div class="analogy"><b>🔍 分析顺序：</b>局部变化 → 总电阻变化 → 总电流变化 → 路端电压变化 → 各支路变化</div>
        <div class="key-points"><ul><li>滑动变阻器阻值增大 → 总电阻增大 → 总电流减小 → 路端电压增大</li><li>某支路电阻增大 → 该支路电流减小，其他支路电流可能增大</li></ul></div>`},
      {title:'复合场问题', html:`<p class="concept">带电粒子在电场和磁场的复合场中运动，需要综合受力分析。</p>
        <div class="key-points"><ul><li>电场力：F = qE，方向与E相同（正电荷）</li><li>洛伦兹力：F = qvB，方向由左手定则</li><li>重力：视情况考虑（微观粒子常忽略）</li><li>列方程：合力 = 向心力或动能定理</li></ul></div>`}
    ]}
];

/* =========================================================
   题库（湖南中考/高考真题风格）
   ========================================================= */
const QUIZ = {
  1: [
    {q:'用丝绸摩擦过的玻璃棒带什么电？',opts:['正电','负电','不带电','不确定'],a:0,ex:'丝绸摩擦玻璃棒，玻璃棒失去电子带正电。'},
    {q:'两个带同种电荷的小球靠近时会：',opts:['相互吸引','相互排斥','无作用','先吸后斥'],a:1,ex:'同种电荷相互排斥。'},
    {q:'摩擦起电的本质是：',opts:['创造电荷','电子转移','质子转移','中子转移'],a:1,ex:'摩擦起电是电子从一个物体转移到另一个物体。'},
    {q:'验电器是根据什么原理制成的？',opts:['异种电荷相吸','同种电荷相斥','电磁感应','电流热效应'],a:1,ex:'验电器利用同种电荷相互排斥原理。'},
    {q:'下列哪种方法不能使物体带电？',opts:['摩擦起电','接触起电','感应起电','加热物体'],a:3,ex:'加热不会使物体带电。'},
    {q:'关于电荷，下列说法正确的是：',opts:['自然界只有两种电荷','电荷可以被创造','电荷可以被消灭','以上都对'],a:0,ex:'电荷守恒：电荷不能被创造或消灭，只能转移。'},
    {q:'A、B、C三个轻质小球，A吸引B，B排斥C，已知C带正电，则A：',opts:['一定带正电','一定带负电','可能带负电或不带电','一定不带电'],a:2,ex:'B排斥C说明B带正电；A吸引B，A可能带负电，也可能不带电（带电体吸引轻小物体）。'},
    {q:'用一个带电体接触验电器金属球，金属箔张开。下列说法正确的是：',opts:['金属箔带同种电荷','金属箔带异种电荷','金属箔不带电','无法判断'],a:0,ex:'验电器金属箔带同种电荷相互排斥而张开。'}
  ],
  2: [
    {q:'电流的方向规定为：',opts:['负电荷定向移动方向','正电荷定向移动方向','电子移动方向','任意方向'],a:1,ex:'物理学规定正电荷定向移动方向为电流方向。'},
    {q:'金属导体中形成电流的是：',opts:['正离子','负离子','自由电子','质子'],a:2,ex:'金属导体中自由电子定向移动形成电流。'},
    {q:'电路中电流方向是：',opts:['负极→正极','正极→用电器→负极','用电器→电源','任意方向'],a:1,ex:'外部电路电流从正极经用电器流向负极。'},
    {q:'下列属于通路的是：',opts:['开关断开','导线断开','开关闭合','电源短路'],a:2,ex:'开关闭合电路接通为通路。'},
    {q:'短路的危害是：',opts:['用电器损坏','电流过大烧坏电源','电流过小','没有危害'],a:1,ex:'短路时电流极大，会烧坏电源甚至引起火灾。'},
    {q:'一个完整电路不包括：',opts:['电源','用电器','开关','电压表'],a:3,ex:'电压表是测量工具，不是电路必需元件。'},
    {q:'关于电流，下列说法正确的是：',opts:['只有正电荷移动才形成电流','只有电子移动才形成电流','电荷定向移动形成电流','电荷无规则运动形成电流'],a:2,ex:'电荷的定向移动形成电流。'},
    {q:'在电源外部，电流的方向是：',opts:['从负极到正极','从正极到负极','没有方向','来回流动'],a:1,ex:'电源外部电流从正极流向负极。'}
  ],
  5: [
    {q:'电阻的国际单位是：',opts:['伏特(V)','安培(A)','欧姆(Ω)','瓦特(W)'],a:2,ex:'电阻单位是欧姆，简称欧，符号Ω。'},
    {q:'关于电阻，下列说法正确的是：',opts:['导体越短电阻越大','导体越粗电阻越小','电阻与温度无关','导体越长电阻越小'],a:1,ex:'电阻与长度成正比、与横截面积成反比，导体越粗电阻越小。'},
    {q:'将一根金属导线均匀拉长为原来的2倍，它的电阻：',opts:['不变','变为2倍','变为4倍','变为一半'],a:2,ex:'拉长2倍，长度×2、横截面积÷2，由R=ρL/S知电阻×4。'},
    {q:'滑动变阻器改变电阻的方法是：',opts:['改变电阻线的材料','改变接入电路的电阻线长度','改变电阻线的横截面积','改变电源电压'],a:1,ex:'滑动变阻器靠滑片改变接入电路的电阻线长度来改变电阻。'},
    {q:'滑动变阻器的正确接法是：',opts:['接上面两个接线柱','接下面两个接线柱','"一上一下"接线','任意接都行'],a:2,ex:'滑动变阻器必须"一上一下"接线；接两上电阻≈0，接两下相当于定值电阻。'},
    {q:'闭合开关前，应将滑动变阻器滑片置于：',opts:['阻值最小处','阻值最大处','中间位置','任意位置'],a:1,ex:'闭合开关前置最大阻值处，使初始电流最小，保护电路和电表。'},
    {q:'灯丝断了再搭上使用，灯泡会：',opts:['变暗','更亮甚至烧坏','亮度不变','不亮'],a:1,ex:'搭上后灯丝变短、电阻变小，由P=U²/R知实际功率变大，灯更亮。'},
    {q:'下列因素中，不影响导体电阻大小的是：',opts:['材料','长度和横截面积','温度','导体两端的电压'],a:3,ex:'电阻是导体本身的性质，由材料、长度、横截面积、温度决定，与电压电流无关。'}
  ],
  6: [
    {q:'欧姆定律的表达式是：',opts:['I=U/R','I=UR','R=UI','U=I/R'],a:0,ex:'欧姆定律：I=U/R。'},
    {q:'一段导体两端电压为6V，通过的电流为0.5A，导体电阻为：',opts:['3Ω','12Ω','0.08Ω','6.5Ω'],a:1,ex:'R=U/I=6/0.5=12Ω。'},
    {q:'关于电阻，下列说法正确的是：',opts:['电阻与电压成正比','电阻与电流成反比','电阻是导体本身性质','电阻与电压电流都有关'],a:2,ex:'电阻由导体材料、长度、横截面积决定，与电压电流无关。'},
    {q:'某导体电阻为10Ω，两端电压为20V，通过的电流为：',opts:['2A','0.5A','200A','10A'],a:0,ex:'I=U/R=20/10=2A。'},
    {q:'伏安法测电阻需要的器材是：',opts:['电流表和电压表','只有电流表','只有电压表','不需要电表'],a:0,ex:'伏安法用电压表测电压、电流表测电流，R=U/I。'},
    {q:'滑动变阻器在伏安法测电阻中的作用是：',opts:['改变电源电压','改变电阻两端电压多次测量','保护电路','B和C都对'],a:3,ex:'滑动变阻器可改变电压多次测量取平均值，也保护电路。'},
    {q:'两个电阻R₁=6Ω，R₂=3Ω并联，总电阻为：',opts:['9Ω','2Ω','3Ω','1Ω'],a:1,ex:'1/R=1/6+1/3=1/2，R=2Ω。'},
    {q:'两个电阻串联，R₁=4Ω，R₂=6Ω，总电压为10V，则R₁两端电压为：',opts:['4V','6V','10V','2V'],a:0,ex:'串联电流相等，I=10/(4+6)=1A，U₁=IR₁=4V。'}
  ],
  8: [
    {q:'焦耳定律的表达式是：',opts:['Q=I²Rt','Q=UIt','Q=U²t/R','以上都对（纯电阻）'],a:3,ex:'Q=I²Rt是普遍式；纯电阻电路中Q=UIt=U²t/R也成立。'},
    {q:'电流通过导体产生的热量与什么成正比？',opts:['电流','电流的平方','电压','电阻的平方'],a:1,ex:'由Q=I²Rt知热量与电流平方成正比。'},
    {q:'电炉丝热得发红而导线不热，因为：',opts:['导线电流小','导线电阻小','导线电压高','导线散热好'],a:1,ex:'串联电流相同，电炉丝电阻远大于导线，Q=I²Rt，电炉丝产热多。'},
    {q:'10Ω电阻通过2A电流10s，产生热量：',opts:['200J','400J','40J','2000J'],a:1,ex:'Q=I²Rt=2²×10×10=400J。'},
    {q:'下列用电器主要利用电流热效应的是：',opts:['电风扇','电热水器','电视机','洗衣机'],a:1,ex:'电热水器利用电流热效应。'},
    {q:'关于纯电阻电路，下列说法正确的是：',opts:['W>Q','W<Q','W=Q','无法确定'],a:2,ex:'纯电阻电路电能全部转化为热能，W=Q。'},
    {q:'电动机工作时，电能主要转化为：',opts:['热能','机械能','光能','化学能'],a:1,ex:'电动机将电能主要转化为机械能，少部分转化为热能。'},
    {q:'两根相同的电阻丝，第一次串联接入电路，第二次并联接入同一电路，哪个产生热量多？',opts:['串联多','并联多','一样多','无法比较'],a:1,ex:'并联总电阻小，由Q=U²t/R知相同电压下并联产热多。'}
  ],
  9: [
    {q:'我国家庭电路电压是：',opts:['110V','220V','380V','36V'],a:1,ex:'我国家庭电路电压220V。'},
    {q:'对人体安全的电压是：',opts:['220V','110V','不高于36V','不高于12V'],a:2,ex:'安全电压不高于36V。'},
    {q:'保险丝应接在哪条线上？',opts:['零线','火线','地线','任意'],a:1,ex:'保险丝接火线，熔断时切断火线确保安全。'},
    {q:'三孔插座中间孔接：',opts:['火线','零线','地线','不接线'],a:2,ex:'三孔插座左零右火上地，中间接地线。'},
    {q:'测电笔接触火线时氖管：',opts:['不发光','发光','闪烁','损坏'],a:1,ex:'测电笔接触火线氖管发光。'},
    {q:'保险丝的材料特点是：',opts:['电阻率大、熔点高','电阻率大、熔点低','电阻率小、熔点低','电阻率小、熔点高'],a:1,ex:'保险丝用电阻率大、熔点低的铅锑合金。'},
    {q:'发现有人触电，首先应该：',opts:['用手拉开','切断电源','大声呼救','拨打120'],a:1,ex:'触电急救首先切断电源，切勿直接手拉触电者。'},
    {q:'家庭电路中各用电器的连接方式是：',opts:['串联','并联','混联','任意'],a:1,ex:'家庭用电器并联，互不影响。'}
  ],
  10: [
    {q:'关于磁感线，下列说法正确的是：',opts:['磁感线真实存在','磁感线从S极到N极','磁感线不相交','磁感线越疏磁场越强'],a:2,ex:'磁感线是假想曲线，不相交，越密磁场越强。'},
    {q:'第一个发现电与磁联系的科学家是：',opts:['法拉第','奥斯特','安培','牛顿'],a:1,ex:'奥斯特发现电流的磁效应。'},
    {q:'通电螺线管的N极判断用：',opts:['左手定则','右手螺旋定则','右手定则','无法判断'],a:1,ex:'安培定则即右手螺旋定则判断螺线管磁极。'},
    {q:'电磁铁磁性强弱与什么无关？',opts:['电流大小','线圈匝数','有无铁芯','电源电压'],a:3,ex:'电磁铁磁性与电流、匝数、铁芯有关，与电源电压无直接关系。'},
    {q:'电动机的工作原理是：',opts:['电磁感应','通电线圈在磁场中受力转动','电流热效应','静电感应'],a:1,ex:'电动机利用通电线圈在磁场中受力转动。'},
    {q:'发电机的工作原理是：',opts:['电磁感应','通电线圈在磁场中受力','电流热效应','安培力'],a:0,ex:'发电机利用电磁感应原理。'},
    {q:'电磁感应现象中，感应电流方向与什么有关？',opts:['磁场方向','导体运动方向','A和B都有关','与A、B都无关'],a:2,ex:'感应电流方向与磁场方向和导体运动方向都有关。'},
    {q:'下列装置中，利用电磁感应的是：',opts:['电磁铁','电动机','发电机','电铃'],a:2,ex:'发电机利用电磁感应。'}
  ],
  13: [
    {q:'沿电场线方向电势：',opts:['升高','降低','不变','先升后降'],a:1,ex:'沿电场线方向电势降低。'},
    {q:'电势差U_AB等于：',opts:['φ_A-φ_B','φ_B-φ_A','φ_A×φ_B','φ_A+φ_B'],a:0,ex:'U_AB=φ_A-φ_B。'},
    {q:'正电荷从高电势移到低电势，电势能：',opts:['增加','减少','不变','为零'],a:1,ex:'正电荷从高到低电势，电场力做正功，电势能减少。'},
    {q:'关于等势面，正确的是：',opts:['等势面与电场线平行','等势面上移动电荷电场力做功','等势面与电场线垂直','等势面可以相交'],a:2,ex:'等势面与电场线垂直，面上移动电荷电场力不做功。'},
    {q:'电势能公式是：',opts:['Eₚ=qφ','Eₚ=qU','Eₚ=Fd','Eₚ=½mv²'],a:0,ex:'电势能Eₚ=qφ。'},
    {q:'电场力做正功时，电势能：',opts:['增加','减少','不变','为零'],a:1,ex:'电场力做正功，电势能减少，W=-ΔEₚ。'},
    {q:'关于电势，下列说法正确的是：',opts:['电势是矢量','电势由试探电荷决定','沿电场线电势降低','电势无正负'],a:2,ex:'电势是标量，由电场决定，沿电场线降低。'},
    {q:'将负电荷从A移到B，电场力做正功，则：',opts:['φ_A>φ_B','φ_A<φ_B','φ_A=φ_B','无法判断'],a:1,ex:'负电荷电场力做正功，说明从低电势到高电势，φ_A<φ_B。'}
  ],
  16: [
    {q:'安培力公式F=BIL适用条件是：',opts:['B∥I','B⊥I','任意角度','I=0'],a:1,ex:'F=BIL适用于B⊥I的情况。'},
    {q:'判断安培力方向用：',opts:['左手定则','右手定则','右手螺旋定则','安培定则'],a:0,ex:'安培力方向用左手定则。'},
    {q:'通电导线与磁场平行时，安培力为：',opts:['BIL','BIL/2','0','无法确定'],a:2,ex:'B∥I时安培力为零。'},
    {q:'电动机工作时能量转化是：',opts:['电能→机械能','机械能→电能','电能→热能','热能→电能'],a:0,ex:'电动机将电能转化为机械能。'},
    {q:'磁感应强度单位是：',opts:['韦伯','特斯拉','安培','伏特'],a:1,ex:'磁感应强度单位特斯拉(T)。'},
    {q:'关于安培力方向，下列说法正确的是：',opts:['与电流方向相同','与磁场方向相同','与电流和磁场都垂直','与电流平行'],a:2,ex:'安培力方向既垂直于电流又垂直于磁场。'},
    {q:'长度为0.5m的导线通2A电流，置于0.4T匀强磁场中，B⊥I，安培力为：',opts:['0.4N','0.8N','0.2N','4N'],a:0,ex:'F=BIL=0.4×2×0.5=0.4N。'},
    {q:'要使通电导线在磁场中受力最大，电流方向应与磁场方向：',opts:['平行','垂直','成45°','成60°'],a:1,ex:'电流与磁场垂直时安培力最大。'}
  ],
  17: [
    {q:'洛伦兹力公式F=qvB适用条件是：',opts:['v∥B','v⊥B','任意角度','v=0'],a:1,ex:'F=qvB适用于v⊥B。'},
    {q:'关于洛伦兹力，正确的是：',opts:['洛伦兹力做正功','洛伦兹力不做功','洛伦兹力做负功','与速度方向相同'],a:1,ex:'洛伦兹力始终与速度垂直，不做功。'},
    {q:'带电粒子垂直射入匀强磁场中，做：',opts:['匀速直线运动','匀加速直线运动','匀速圆周运动','平抛运动'],a:2,ex:'v⊥B时粒子做匀速圆周运动。'},
    {q:'带电粒子在磁场中做圆周运动的半径公式是：',opts:['r=mv/qB','r=qB/mv','r=mvB/q','r=q/mvB'],a:0,ex:'r=mv/(qB)。'},
    {q:'带电粒子在磁场中做圆周运动的周期：',opts:['与速度有关','与速度无关','与半径有关','与磁感应强度无关'],a:1,ex:'T=2πm/(qB)，与速度无关。'},
    {q:'判断洛伦兹力方向用：',opts:['左手定则','右手定则','右手螺旋定则','无法判断'],a:0,ex:'洛伦兹力方向用左手定则，四指正电荷运动方向。'},
    {q:'质子和α粒子以相同速度垂直射入同一匀强磁场，轨道半径之比为：',opts:['1:2','2:1','1:1','1:4'],a:0,ex:'r=mv/qB，r₁:r₂=(m₁/q₁):(m₂/q₂)=(1/1):(4/2)=1:2。'},
    {q:'回旋加速器中，粒子的最大动能取决于：',opts:['加速电压','D形盒半径和磁感应强度','粒子质量','加速次数'],a:1,ex:'最大动能由D形盒半径R和B决定：Eₖ=q²B²R²/(2m)。'}
  ],
  18: [
    {q:'法拉第电磁感应定律表达式是：',opts:['ε=nΔΦ/Δt','ε=BLv','ε=IR','Φ=BS'],a:0,ex:'ε=nΔΦ/Δt。'},
    {q:'楞次定律的核心是：',opts:['促进变化','阻碍变化','无关变化','产生变化'],a:1,ex:'感应电流磁场阻碍引起感应电流的磁通量变化。'},
    {q:'导体棒切割磁感线产生的动生电动势为：',opts:['ε=BLv','ε=B/v','ε=L/(Bv)','ε=Bv/L'],a:0,ex:'B、L、v两两垂直时ε=BLv。'},
    {q:'磁通量单位是：',opts:['特斯拉','韦伯','亨利','伏特'],a:1,ex:'磁通量单位韦伯(Wb)。'},
    {q:'下列哪种情况不能产生感应电流？',opts:['闭合回路磁通量变化','导体切割磁感线','磁场不变回路面积不变','插入磁铁'],a:2,ex:'产生感应电流条件是闭合回路磁通量变化。'},
    {q:'关于感应电动势大小，正确的是：',opts:['与磁通量成正比','与磁通量变化量成正比','与磁通量变化率成正比','与时间成正比'],a:2,ex:'ε与磁通量变化率成正比。'},
    {q:'磁铁插入线圈时，感应电流的磁场方向：',opts:['与磁铁磁场同向','与磁铁磁场反向','为零','无法判断'],a:1,ex:'磁通量增大，感应磁场阻碍其增大，与磁铁磁场反向。'},
    {q:'Φ=BS适用条件是：',opts:['B∥S','B⊥S','任意角度','S=0'],a:1,ex:'Φ=BS⊥=BScosθ，B⊥S时θ=0。'}
  ],
  20: [
    {q:'一带电粒子在匀强电场中由静止加速，电场力做功等于：',opts:['qU','qEd','mv²/2','以上都对'],a:3,ex:'qU=qEd=½mv²。'},
    {q:'电路中滑动变阻器阻值增大，则总电流：',opts:['增大','减小','不变','为零'],a:1,ex:'总电阻增大，总电流减小。'},
    {q:'电路中滑动变阻器阻值增大，路端电压：',opts:['增大','减小','不变','为零'],a:0,ex:'U=ε-Ir，I减小则U增大。'},
    {q:'带电粒子在匀强磁场中做圆周运动，下列说法正确的是：',opts:['速度大小变化','动能变化','速度方向变化','洛伦兹力做功'],a:2,ex:'洛伦兹力不做功，动能不变，速度方向变。'},
    {q:'理想变压器原线圈匝数n₁=1000，副线圈n₂=100，原线圈电压220V，副线圈电压为：',opts:['22V','2200V','220V','10V'],a:0,ex:'U₂=U₁n₂/n₁=220×100/1000=22V。'},
    {q:'远距离输电采用高压输电的目的是：',opts:['增大电流','减小输电线上的电能损失','增大电压降','减小电阻'],a:1,ex:'P损=I²R线，高压输电减小电流从而减小损失。'},
    {q:'一闭合线圈在匀强磁场中匀速转动，产生的感应电动势：',opts:['恒定不变','正弦变化','为零','线性变化'],a:1,ex:'线圈匀速转动产生正弦式交变电流。'},
    {q:'关于电场和磁场，下列说法正确的是：',opts:['电场线闭合','磁感线闭合','电场线和磁感线都闭合','都不闭合'],a:1,ex:'磁感线闭合，电场线不闭合。'},
    {q:'两个点电荷相距r时库仑力为F，距离变为2r时库仑力为：',opts:['2F','F/2','F/4','4F'],a:2,ex:'F∝1/r²，距离加倍力变为1/4。'},
    {q:'一电容器电容为C，充电后电压为U，储存的电荷量为：',opts:['CU','C/U','U/C','CU²'],a:0,ex:'Q=CU。'}
  ]
};

/* ---------- 计算题 ---------- */
const CALC = {
  4: [
    {formula:'U = U₁ + U₂', given:'串联电路U₁=3V，U₂=5V', ask:'总电压U', unit:'V', ans:8, tol:0.1, ex:'U=U₁+U₂=3+5=8V'},
    {formula:'U = U₁ = U₂', given:'并联电路U₁=6V', ask:'U₂', unit:'V', ans:6, tol:0.1, ex:'并联各支路电压相等，U₂=U₁=6V'},
    {formula:'U = U₁ + U₂', given:'串联U₁=2.5V，U₂=3.5V', ask:'U', unit:'V', ans:6, tol:0.1, ex:'U=2.5+3.5=6V'},
    {formula:'U = U₁ = U₂', given:'并联U₂=12V', ask:'U₁', unit:'V', ans:12, tol:0.1, ex:'并联U₁=U₂=12V'},
    {formula:'U = U₁ + U₂ + U₃', given:'串联U₁=2V,U₂=3V,U₃=4V', ask:'U', unit:'V', ans:9, tol:0.1, ex:'U=2+3+4=9V'}
  ],
  6: [
    {formula:'I = U/R', given:'U=6V，R=3Ω', ask:'I', unit:'A', ans:2, tol:0.01, ex:'I=U/R=6/3=2A'},
    {formula:'U=IR', given:'I=0.5A，R=20Ω', ask:'U', unit:'V', ans:10, tol:0.1, ex:'U=IR=0.5×20=10V'},
    {formula:'R=U/I', given:'U=12V，I=2A', ask:'R', unit:'Ω', ans:6, tol:0.01, ex:'R=U/I=12/2=6Ω'},
    {formula:'I=U/R', given:'U=220V，R=44Ω', ask:'I', unit:'A', ans:5, tol:0.1, ex:'I=220/44=5A'},
    {formula:'R=U/I', given:'U=9V，I=0.3A', ask:'R', unit:'Ω', ans:30, tol:0.1, ex:'R=9/0.3=30Ω'},
    {formula:'U=IR', given:'I=0.2A，R=50Ω', ask:'U', unit:'V', ans:10, tol:0.1, ex:'U=0.2×50=10V'}
  ],
  7: [
    {formula:'W=UIt', given:'U=220V，I=0.5A，t=60s', ask:'W', unit:'J', ans:6600, tol:1, ex:'W=220×0.5×60=6600J'},
    {formula:'P=UI', given:'U=220V，I=2A', ask:'P', unit:'W', ans:440, tol:1, ex:'P=220×2=440W'},
    {formula:'P=W/t', given:'W=36000J，t=60s', ask:'P', unit:'W', ans:600, tol:1, ex:'P=36000/60=600W'},
    {formula:'W=Pt', given:'P=100W，t=3600s', ask:'W', unit:'J', ans:360000, tol:10, ex:'W=100×3600=360000J'},
    {formula:'I=P/U', given:'P=40W，U=220V', ask:'I', unit:'A', ans:0.18, tol:0.02, ex:'I=P/U=40/220≈0.18A'},
    {formula:'P=U²/R', given:'U=220V，R=484Ω', ask:'P', unit:'W', ans:100, tol:1, ex:'P=U²/R=220²/484=100W'}
  ],
  11: [
    {formula:'F=kQ₁Q₂/r²', given:'Q₁=2×10⁻⁶C，Q₂=3×10⁻⁶C，r=0.3m', ask:'F(×10⁻³)', unit:'N', ans:0.6, tol:0.02, ex:'F=9e9×2e-6×3e-6/0.09=0.6N'},
    {formula:'F=kQ₁Q₂/r²', given:'Q₁=Q₂=1×10⁻⁶C，r=0.1m', ask:'F', unit:'N', ans:0.9, tol:0.01, ex:'F=9e9×(1e-6)²/0.01=0.9N'},
    {formula:'r=√(kQ₁Q₂/F)', given:'Q₁=Q₂=1×10⁻⁶C，F=0.09N', ask:'r', unit:'m', ans:1, tol:0.01, ex:'r=√(9e9×1e-12/0.09)=1m'},
    {formula:'F=kQ₁Q₂/r²', given:'Q₁=4×10⁻⁶C，Q₂=5×10⁻⁶C，r=0.6m', ask:'F', unit:'N', ans:0.5, tol:0.01, ex:'F=9e9×4e-6×5e-6/0.36=0.5N'},
    {formula:'F=kQ₁Q₂/r²', given:'Q₁=2×10⁻⁸C，Q₂=3×10⁻⁸C，r=0.1m', ask:'F(×10⁻⁴)', unit:'N', ans:5.4, tol:0.1, ex:'F=9e9×2e-8×3e-8/0.01=5.4×10⁻⁴N'},
    {formula:'F=kQ₁Q₂/r²', given:'Q₁=1×10⁻⁶C，Q₂=2×10⁻⁶C，r=0.3m', ask:'F(×10⁻¹)', unit:'N', ans:2, tol:0.05, ex:'F=9e9×1e-6×2e-6/0.09=0.2N'}
  ]
};

/* ---------- 配对题 ---------- */
const MATCH = {
  2: {left:['电流I','电压U','电阻R','电功W','电功率P'],right:['伏特(V)','安培(A)','瓦特(W)','欧姆(Ω)','焦耳(J)'],pairs:{'电流I':'安培(A)','电压U':'伏特(V)','电阻R':'欧姆(Ω)','电功W':'焦耳(J)','电功率P':'瓦特(W)'}},
  14: {left:['电容C','电荷量Q','电压U','极板面积S','极板间距d'],right:['法拉(F)','库仑(C)','伏特(V)','米²(m²)','米(m)'],pairs:{'电容C':'法拉(F)','电荷量Q':'库仑(C)','电压U':'伏特(V)','极板面积S':'米²(m²)','极板间距d':'米(m)'}}
};

/* ---------- 电路连线任务 ---------- */
const CIRCUITS = {
  3: [
    {task:'将两个电阻 R₁、R₂ 串联接入电路', type:'series'},
    {task:'将两个电阻 R₁、R₂ 并联接入电路', type:'parallel'},
    {task:'把灯泡 L 与开关 S 串联后接入电源', type:'bulb'}
  ]
};

/* ---------- 成就 ---------- */
const ACHIEVEMENTS = [
  {id:'first',icon:'⚡',name:'初露锋芒',desc:'完成第一关'},
  {id:'junior',icon:'🎓',name:'初中大师',desc:'通关全部初中关卡'},
  {id:'senior',icon:'🏆',name:'高中王者',desc:'通关全部高中关卡'},
  {id:'perfect',icon:'💯',name:'完美主义',desc:'任意关卡获得三星'},
  {id:'star20',icon:'⭐',name:'星星收集者',desc:'累计获得20颗星'},
  {id:'star50',icon:'🌟',name:'星光闪耀',desc:'累计获得50颗星'},
  {id:'all',icon:'👑',name:'电学全通',desc:'通关全部20关'},
  {id:'quick',icon:'🚀',name:'闪电手',desc:'30秒内完成一个计算关卡'},
  {id:'exam',icon:'📝',name:'考试达人',desc:'完成一次模拟考试'},
  {id:'wrong10',icon:'📒',name:'错题达人',desc:'累计收集10道错题'},
  {id:'teach',icon:'📖',name:'勤学不辍',desc:'完成5个知识讲解'},
  {id:'hunan',icon:'🌶️',name:'湘才辈出',desc:'综合考试得分80以上'}
];

/* ---------- 存档 ---------- */
const Save = {
  key:'electric_quest_save_v2',
  data:{xp:0,level:1,gems:0,stars:{},ach:{},bestScores:{},wrong:[],teachDone:{},examScores:{}},
  load(){try{const s=localStorage.getItem(this.key);if(s)Object.assign(this.data,JSON.parse(s));}catch(e){}
    this.data.ach=(this.data.ach&&typeof this.data.ach==='object')?this.data.ach:{};
    this.data.teachDone=(this.data.teachDone&&typeof this.data.teachDone==='object')?this.data.teachDone:{};
    // 规范化错题本：仅保留结构合法的条目，字段统一转字符串（渲染时再做 HTML 转义）
    this.data.wrong=Array.isArray(this.data.wrong)?this.data.wrong
      .filter(w=>w&&typeof w==='object')
      .map(w=>({q:String(w.q??''),your:String(w.your??''),right:String(w.right??''),ex:String(w.ex??''),level:typeof w.level==='number'?w.level:String(w.level??'')})):[];
  },
  save(){try{localStorage.setItem(this.key,JSON.stringify(this.data));}catch(e){}},
  totalStars(){return Object.values(this.data.stars).reduce((a,b)=>a+b,0);},
  doneCount(){return Object.keys(this.data.stars).filter(k=>this.data.stars[k]>0).length;},
  levelUnlocked(id){if(id===1)return true;return !!(this.data.stars[id-1]&&this.data.stars[id-1]>0);},
  addWrong(item){if(!this.data.wrong.some(w=>w.q===item.q)){this.data.wrong.push(item);this.save();}}
};
Save.load();

function xpForLevel(lv){return 100+(lv-1)*80;}
function levelFromXp(xp){let lv=1,need=100;while(xp>=need){xp-=need;lv++;need=100+(lv-1)*80;}return lv;}

/* ---------- UI ---------- */
const $=id=>document.getElementById(id);
const screens={home:$('screen-home'),levels:$('screen-levels'),intro:$('screen-intro'),teach:$('screen-teach'),game:$('screen-game'),result:$('screen-result'),ach:$('screen-ach'),wrong:$('screen-wrong'),exam:$('screen-exam'),lab:$('screen-lab'),labdetail:$('screen-labdetail')};
function show(name){Object.values(screens).forEach(s=>s.classList.remove('active'));screens[name].classList.add('active');$('hud').classList.remove('hidden');Sfx.click();}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.add('hidden'),2200);}

/* 自定义确认弹窗 */
function confirmDialog(msg){
  return new Promise(resolve=>{
    const modal=$('confirmModal');
    $('confirmMsg').textContent=msg;
    modal.classList.remove('hidden');
    const ok=()=>{modal.classList.add('hidden');cleanup();resolve(true);};
    const cancel=()=>{modal.classList.add('hidden');cleanup();resolve(false);};
    function cleanup(){
      $('confirmOk').onclick=null;$('confirmCancel').onclick=null;
      document.onkeydown=null;
    }
    $('confirmOk').onclick=ok;
    $('confirmCancel').onclick=cancel;
    document.onkeydown=e=>{if(e.key==='Enter')ok();else if(e.key==='Escape')cancel();};
  });
}
function updateHud(){
  const s=Save.data,lv=levelFromXp(s.xp),need=100+(lv-1)*80;
  let cur=s.xp;for(let i=1;i<lv;i++)cur-=(100+(i-1)*80);
  $('xpFill').style.width=Math.min(100,(cur/need)*100)+'%';
  $('starCount').textContent=Save.totalStars();
  $('gemCount').textContent=s.gems;
  $('hsLevel').textContent='Lv.'+lv;
  $('hsStars').textContent=Save.totalStars();
  $('hsDone').textContent=Save.doneCount()+'/20';
}
function checkAchievements(){
  const s=Save.data,got=[];
  const tA=(id,cond)=>{if(cond&&!s.ach[id]){s.ach[id]=true;got.push(ACHIEVEMENTS.find(a=>a.id===id));}};
  tA('first',Save.doneCount()>=1);
  tA('junior',LEVELS.filter(l=>l.stage==='junior').every(l=>s.stars[l.id]>0));
  tA('senior',LEVELS.filter(l=>l.stage==='senior').every(l=>s.stars[l.id]>0));
  tA('perfect',Object.values(s.stars).some(v=>v>=3));
  tA('star20',Save.totalStars()>=20);
  tA('star50',Save.totalStars()>=50);
  tA('all',Save.doneCount()>=20);
  tA('quick',!!s.fastCalc);
  tA('wrong10',s.wrong.length>=10);
  tA('teach',Object.keys(s.teachDone).length>=5);
  if(got.length){Save.save();got.forEach((a,i)=>setTimeout(()=>toast(`🏆 成就解锁：${a.name}`),i*1500));}
}

/* ---------- 关卡选择 ---------- */
function renderLevels(stage='junior'){
  const grid=$('levelGrid');grid.innerHTML='';
  LEVELS.filter(l=>l.stage===stage).forEach(lv=>{
    const unlocked=Save.levelUnlocked(lv.id),stars=Save.data.stars[lv.id]||0;
    const card=document.createElement('div');
    card.className='level-card'+(unlocked?'':' locked');
    const sh=[1,2,3].map(i=>`<span class="${i<=stars?'':'off'}">★</span>`).join('');
    card.innerHTML=`<div class="lc-num">${String(lv.id).padStart(2,'0')}</div><div class="lc-title">${lv.icon} ${lv.title}</div><span class="lc-tag ${lv.stage}">${lv.stage==='junior'?'初中':'高中'}</span><div class="lc-stars">${sh}</div>`;
    if(unlocked)card.onclick=()=>openIntro(lv.id);
    grid.appendChild(card);
  });
}

/* ---------- 关卡简介 ---------- */
let currentLevel=null;
function openIntro(id){
  const lv=LEVELS.find(l=>l.id===id);currentLevel=lv;
  $('introIcon').textContent=lv.icon;
  $('introTitle').textContent=lv.title;
  $('introDiff').textContent='★'.repeat(lv.diff)+'☆'.repeat(3-lv.diff);
  $('introDesc').textContent=lv.desc;
  $('introKnow').innerHTML=lv.know.map(k=>`<li>${k}</li>`).join('');
  $('stageLabel').textContent=`关卡 ${lv.id} · ${lv.title}`;
  show('intro');
}

/* ---------- 知识讲解 ---------- */
let teachIdx=0;
function startTeach(lv){
  currentLevel=lv;teachIdx=0;
  renderTeachStep();
  show('teach');
}
function renderTeachStep(){
  const lv=currentLevel,step=lv.teach[teachIdx];
  $('teachStepInfo').textContent=`第 ${teachIdx+1} / ${lv.teach.length} 步`;
  const dots=$('teachDots');dots.innerHTML='';
  lv.teach.forEach((_,i)=>{
    const d=document.createElement('span');
    d.className='teach-dot'+(i===teachIdx?' active':i<teachIdx?' done':'');
    dots.appendChild(d);
  });
  $('teachContent').innerHTML=`<h2>${step.title}</h2>${step.html}`;
  $('teachPrev').style.visibility=teachIdx===0?'hidden':'visible';
  $('teachNextBtn').textContent=teachIdx===lv.teach.length-1?'开始实验 →':'下一步 →';
}
function nextTeach(){
  if(teachIdx<currentLevel.teach.length-1){teachIdx++;renderTeachStep();Sfx.click();}
  else{
    Save.data.teachDone[currentLevel.id]=true;Save.save();checkAchievements();
    startGame(currentLevel);
  }
}
function prevTeach(){if(teachIdx>0){teachIdx--;renderTeachStep();Sfx.click();}}

/* ---------- 游戏主流程 ---------- */
let Game={level:null,mode:null,round:0,total:0,score:0,correct:0,wrong:0,startTime:0,timer:null,timeLeft:0,totalTime:0,phase:'test',locked:false,exam:false};
function startGame(lv){
  Game.level=lv;Game.mode=lv.mode;Game.round=0;Game.score=0;Game.correct=0;Game.wrong=0;Game.startTime=Date.now();Game.total=lv.rounds;Game.locked=false;Game.exam=false;Game._finished=false;
  show('game');
  $('phaseTag').textContent='闯关测试';
  $('quitBtn').onclick=async()=>{if(await confirmDialog('确定退出本关？进度将丢失')){stopTimer();stopCircuitAnim();stopLabAnim();show('levels');renderLevels(Game.level.stage);}};
  nextRound();
}
function nextRound(){
  Game.round++;
  if(Game.round>Game.total){ Game.exam?finishExam():finishGame(); return; }
  Game.locked=false;
  $('roundLabel').textContent=`第 ${Game.round} / ${Game.total} 题`;
  $('scoreNow').textContent=Game.score;
  clearFeedback();
  const area=$('gameArea');area.innerHTML='';
  if(Game.mode==='quiz')renderQuiz();
  else if(Game.mode==='calc')renderCalc();
  else if(Game.mode==='matching')renderMatching();
  else if(Game.mode==='circuit')renderCircuit();
  else if(Game.mode==='sim')renderSim();
  else if(Game.mode==='lab')renderLevelLab();
  startRoundTimer();
}
function startRoundTimer(){
  if(Game.exam)return; // 考试由总计时器统一管理
  stopTimer();
  if(Game.mode==='lab'||Game.mode==='sim'){ $('timerBar').style.width='100%'; return; }
  const dur=Game.mode==='quiz'?25:Game.mode==='calc'?35:999;
  Game.timeLeft=dur;$('timerBar').style.width='100%';
  Game.timer=setInterval(()=>{
    Game.timeLeft-=0.1;$('timerBar').style.width=Math.max(0,(Game.timeLeft/dur)*100)+'%';
    if(Game.timeLeft<=0){stopTimer();onAnswer(false);}
  },100);
}
function stopTimer(){if(Game.timer){clearInterval(Game.timer);Game.timer=null;}}
function showFeedback(ok,msg){const f=$('feedback');f.textContent=msg;f.className='feedback show '+(ok?'ok':'bad');clearTimeout(f._t);f._t=setTimeout(()=>{f.className='feedback '+(ok?'ok':'bad');},1500);if(ok)Sfx.correct();else Sfx.wrong();}
function clearFeedback(){$('feedback').className='feedback';}
function onAnswer(ok,points=10){
  if(Game.locked)return;
  Game.locked=true;
  if(!Game.exam)stopTimer();
  if(ok){Game.correct++;Game.score+=points;showFeedback(true,`✓ 正确！+${points}分`);}
  else{Game.wrong++;showFeedback(false,'✗ 再接再厉');}
  setTimeout(nextRound,1400);
}

/* ---------- 问答 ---------- */
function renderQuiz(){
  const qs=Game.exam?examQuestions:QUIZ[Game.level.id],q=qs[Game.round-1];
  const card=document.createElement('div');card.className='quiz-card';
  card.innerHTML=`<div class="quiz-q">${q.q}</div><div class="options">${q.opts.map((o,i)=>`<div class="opt" data-i="${i}"><span class="opt-key">${String.fromCharCode(65+i)}</span><span>${o}</span></div>`).join('')}</div>`;
  $('gameArea').appendChild(card);
  card.querySelectorAll('.opt').forEach(el=>{
    el.onclick=()=>{
      if(card.dataset.done)return;card.dataset.done='1';if(!Game.exam)stopTimer();
      const i=+el.dataset.i;
      card.querySelectorAll('.opt').forEach(o=>{if(+o.dataset.i===q.a)o.classList.add('correct');else if(o===el)o.classList.add('wrong');o.classList.add('disabled');});
      const ok=i===q.a;
      if(!ok)Save.addWrong({q:q.q,your:q.opts[i],right:q.opts[q.a],ex:q.ex,level:Game.exam?'模拟考试':Game.level.id});
      const ex=document.createElement('div');ex.className='explain';ex.innerHTML=`<b>解析：</b>${q.ex}`;card.appendChild(ex);
      onAnswer(ok);
    };
  });
}

/* ---------- 计算 ---------- */
function renderCalc(){
  const data=CALC[Game.level.id],q=data[Game.round-1];
  const card=document.createElement('div');card.className='calc-card';
  card.innerHTML=`<div class="calc-formula">${q.formula}</div><div class="calc-given">已知：<span class="gv">${q.given}</span></div><div class="calc-given">求：<span class="gv">${q.ask}</span></div><div class="calc-input-row"><input type="number" class="calc-input" id="calcIn" step="any" placeholder="输入数值" autofocus/><span class="calc-unit">${q.unit}</span><button class="btn-check" id="calcCheck">确认</button></div><div class="calc-hint">💡 注意单位换算，结果保留合理位数</div>`;
  $('gameArea').appendChild(card);$('calcIn').focus();
  const submit=()=>{
    if(card.dataset.done)return;
    const val=parseFloat($('calcIn').value);
    if(isNaN(val)){toast('请输入数值');return;}
    card.dataset.done='1';stopTimer();
    const ok=Math.abs(val-q.ans)<=q.tol+Math.abs(q.ans)*0.005;
    if(!ok)Save.addWrong({q:`${q.ask}（${q.given}）`,your:val+q.unit,right:q.ans+q.unit,ex:q.ex,level:Game.level.id});
    const ex=document.createElement('div');ex.className='explain';ex.innerHTML=`<b>解析：</b>${q.ex} = ${q.ans} ${q.unit}`;card.appendChild(ex);
    onAnswer(ok,15);
  };
  $('calcCheck').onclick=submit;
  $('calcIn').onkeydown=e=>{if(e.key==='Enter')submit();};
}

/* ---------- 配对 ---------- */
function renderMatching(){
  Game.total=1;
  const data=MATCH[Game.level.id],left=[...data.left],right=[...data.right];
  for(let i=right.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[right[i],right[j]]=[right[j],right[i]];}
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="match-hint">点击左侧概念，再点击右侧对应的单位</div><div class="match-wrap"><div class="match-col" id="mcL"></div><div class="match-col" id="mcR"></div></div>`;
  $('gameArea').appendChild(wrap);
  const mcL=$('mcL'),mcR=$('mcR');
  left.forEach(t=>{const el=document.createElement('div');el.className='match-item';el.textContent=t;mcL.appendChild(el);});
  right.forEach(t=>{const el=document.createElement('div');el.className='match-item';el.textContent=t;mcR.appendChild(el);});
  let selL=null,matched=0,total=left.length;
  Game.total=total;$('roundLabel').textContent=`配对 ${matched}/${total}`;
  mcL.querySelectorAll('.match-item').forEach(el=>{el.onclick=()=>{if(el.classList.contains('matched'))return;mcL.querySelectorAll('.match-item').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');selL=el;};});
  mcR.querySelectorAll('.match-item').forEach(el=>{
    el.onclick=()=>{
      if(!selL||el.classList.contains('matched'))return;
      const pair=data.pairs[selL.textContent];
      if(pair===el.textContent){
        selL.classList.add('matched');el.classList.add('matched');matched++;
        $('roundLabel').textContent=`配对 ${matched}/${total}`;Sfx.correct();
        if(matched===total){stopTimer();Game.correct=total;Game.score=total*15;showFeedback(true,'全部配对正确！');setTimeout(finishGame,1200);}
      }else{
        el.classList.add('wrong-flash');Sfx.wrong();Game.wrong++;
        setTimeout(()=>el.classList.remove('wrong-flash'),400);
      }
      mcL.querySelectorAll('.match-item').forEach(e=>e.classList.remove('selected'));selL=null;
    };
  });
}

/* ---------- 电路连线 ---------- */
function renderCircuit(){
  const task=CIRCUITS[Game.level.id][Game.round-1];
  const wrap=document.createElement('div');wrap.className='circuit-wrap';
  wrap.innerHTML=`<div class="quiz-q">任务：${task.task}</div><div class="circuit-canvas-wrap"><canvas id="circuitCanvas"></canvas></div><div class="circuit-info" id="circInfo">拖拽下方元件到画布，构建电路</div><div class="circuit-parts" id="circParts"></div><button class="btn-check" id="circCheck" style="margin-top:14px">检查电路</button>`;
  $('gameArea').appendChild(wrap);
  const cv=$('circuitCanvas'),ctx=cv.getContext('2d');
  cv.width=cv.clientWidth;cv.height=280;
  let placed=[];
  const parts=task.type==='series'?['电池','电阻R₁','电阻R₂']:task.type==='parallel'?['电池','电阻R₁','电阻R₂']:['电池','开关S','灯泡L'];
  const pb=$('circParts');
  parts.forEach(p=>{const el=document.createElement('div');el.className='part';el.textContent=p;pb.appendChild(el);el.draggable=true;el.ondragstart=e=>{e.dataTransfer.setData('part',p);};});
  cv.ondragover=e=>e.preventDefault();
  cv.ondrop=e=>{e.preventDefault();const r=cv.getBoundingClientRect();placed.push({type:e.dataTransfer.getData('part'),x:e.clientX-r.left,y:e.clientY-r.top});drawCircuit();};
  function drawCircuit(){
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.strokeStyle='rgba(0,229,255,0.08)';ctx.lineWidth=1;
    for(let i=0;i<cv.width;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,cv.height);ctx.stroke();}
    for(let i=0;i<cv.height;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(cv.width,i);ctx.stroke();}
    placed.forEach(p=>drawPart(ctx,p));
  }
  drawCircuit();
  $('circCheck').onclick=()=>{
    const types=placed.map(p=>p.type),hasAll=parts.every(p=>types.includes(p)),ok=hasAll&&placed.length>=3;
    stopTimer();
    if(ok)drawWires();
    $('circInfo').textContent=ok?'✓ 电路构建正确！':'✗ 元件不完整，请检查';
    if(!ok)Save.addWrong({q:task.task,your:'电路不完整',right:parts.join(' + '),ex:'需要放置所有必需元件',level:Game.level.id});
    onAnswer(ok,12);
  };
  function drawWires(){
    if(placed.length<2)return;
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=2.5;ctx.shadowColor='#00e5ff';ctx.shadowBlur=10;
    ctx.beginPath();placed.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.stroke();
    let t=0;const anim=setInterval(()=>{
      t+=0.05;drawCircuit();
      ctx.strokeStyle='#00e5ff';ctx.lineWidth=2.5;ctx.shadowColor='#00e5ff';ctx.shadowBlur=10;
      ctx.beginPath();placed.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.stroke();
      for(let k=0;k<placed.length-1;k++){
        const a=placed[k],b=placed[k+1];
        const px=a.x+(b.x-a.x)*((t+k*0.3)%1),py=a.y+(b.y-a.y)*((t+k*0.3)%1);
        ctx.fillStyle='#ffd60a';ctx.shadowColor='#ffd60a';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;if(t>5)clearInterval(anim);
    },50);
  }
}
function drawPart(ctx,p){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='rgba(0,229,255,0.1)';ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;ctx.shadowColor='#00e5ff';ctx.shadowBlur=8;
  if(p.type==='电池'){ctx.fillRect(-26,-14,52,28);ctx.strokeRect(-26,-14,52,28);ctx.fillStyle='#ffd60a';ctx.fillRect(-6,-10,4,20);ctx.fillRect(10,-6,4,12);}
  else if(p.type.startsWith('电阻')){ctx.fillRect(-26,-10,52,20);ctx.strokeRect(-26,-10,52,20);ctx.strokeStyle='#ffd60a';ctx.lineWidth=1.5;for(let i=-22;i<22;i+=8){ctx.beginPath();ctx.moveTo(i,-6);ctx.lineTo(i+4,6);ctx.stroke();}}
  else if(p.type==='灯泡L'){ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#ffd60a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,-10);ctx.lineTo(10,10);ctx.moveTo(10,-10);ctx.lineTo(-10,10);ctx.stroke();}
  else if(p.type==='开关S'){ctx.fillRect(-26,-10,52,20);ctx.strokeRect(-26,-10,52,20);ctx.strokeStyle='#ffd60a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-16,0);ctx.lineTo(16,-10);ctx.stroke();}
  ctx.shadowBlur=0;ctx.fillStyle='#eaf2ff';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(p.type,0,30);ctx.restore();
}

/* ---------- 模拟实验 ---------- */
function renderSim(){
  Game.total=1;const lv=Game.level;
  const wrap=document.createElement('div');wrap.className='sim-wrap';
  $('gameArea').appendChild(wrap);
  if(lv.id===12){renderFieldSim(wrap);}
  else if(lv.id===15){renderCircuitSim(wrap);}
  else if(lv.id===19){renderACSim(wrap);}
}
function renderFieldSim(wrap){
  wrap.innerHTML=`<div class="quiz-q">⚡ 电场模拟器 — 调节点电荷，观察电场强度</div><canvas class="sim-canvas" id="simCv"></canvas><div class="sim-controls"><div class="sim-ctrl"><label>点电荷 Q (×10⁻⁶ C)</label><input type="range" id="sQ" min="1" max="10" value="5"><div class="val" id="sQv">5</div></div><div class="sim-ctrl"><label>距离 r (m)</label><input type="range" id="sR" min="0.1" max="2" step="0.1" value="1"><div class="val" id="sRv">1.0</div></div></div><div class="sim-readouts"><div class="sim-readout"><div class="lbl">场强 E</div><div class="num" id="sE">0</div></div><div class="sim-readout"><div class="lbl">公式</div><div class="num" style="font-size:14px">E=kQ/r²</div></div></div><button class="btn-check" id="simDone" style="margin-top:14px">我理解了，完成实验</button>`;
  const cv=$('simCv'),c=cv.getContext('2d');cv.width=cv.clientWidth;cv.height=240;
  const upd=()=>{const Q=+$('sQ').value,r=+$('sR').value;$('sQv').textContent=Q;$('sRv').textContent=r.toFixed(1);const E=9e9*Q*1e-6/(r*r);$('sE').textContent=E.toExponential(2)+' N/C';drawField(c,Q,r);};
  $('sQ').oninput=upd;$('sR').oninput=upd;
  $('simDone').onclick=()=>{stopTimer();onAnswer(true,20);};
  upd();
}
function drawField(ctx,Q,r){
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  const cx=ctx.canvas.width/2,cy=ctx.canvas.height/2;
  ctx.strokeStyle='rgba(0,229,255,0.08)';ctx.lineWidth=1;
  for(let i=0;i<ctx.canvas.width;i+=30){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,ctx.canvas.height);ctx.stroke();}
  for(let i=0;i<ctx.canvas.height;i+=30){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(ctx.canvas.width,i);ctx.stroke();}
  ctx.fillStyle='#ffd60a';ctx.shadowColor='#ffd60a';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(cx,cy,16,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#001018';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('+',cx,cy);
  const E=9e9*Q*1e-6/(r*r),al=Math.min(120,20+E/1e5);
  for(let a=0;a<Math.PI*2;a+=Math.PI/8){
    const x=cx+Math.cos(a)*40,y=cy+Math.sin(a)*40,x2=cx+Math.cos(a)*(40+al),y2=cy+Math.sin(a)*(40+al);
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;ctx.shadowColor='#00e5ff';ctx.shadowBlur=6;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(a-0.4)*10,y2-Math.sin(a-0.4)*10);ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(a+0.4)*10,y2-Math.sin(a+0.4)*10);ctx.stroke();
  }
  ctx.shadowBlur=0;ctx.fillStyle='#39ff14';ctx.font='14px Orbitron,sans-serif';ctx.fillText(`r=${r.toFixed(1)}m`,cx+50,cy-40);
}
function renderCircuitSim(wrap){
  wrap.innerHTML=`<div class="quiz-q">🔌 闭合电路 — 调节外阻，观察路端电压变化</div><canvas class="sim-canvas" id="simCv"></canvas><div class="sim-controls"><div class="sim-ctrl"><label>外电阻 R (Ω)</label><input type="range" id="sR" min="1" max="20" value="5"><div class="val" id="sRv">5</div></div><div class="sim-ctrl"><label>电源内阻 r (Ω)</label><input type="range" id="sr" min="0.5" max="5" step="0.5" value="1"><div class="val" id="srv">1.0</div></div></div><div class="sim-readouts"><div class="sim-readout"><div class="lbl">电流 I</div><div class="num" id="sI">0</div></div><div class="sim-readout"><div class="lbl">路端电压 U</div><div class="num" id="sU">0</div></div><div class="sim-readout"><div class="lbl">电动势 ε</div><div class="num" id="sE">6 V</div></div></div><button class="btn-check" id="simDone" style="margin-top:14px">我理解了，完成实验</button>`;
  const cv=$('simCv'),c=cv.getContext('2d');cv.width=cv.clientWidth||600;cv.height=240;
  const P={R:5,r:1,eps:6,I:0,U:0};
  const upd=()=>{P.R=+$('sR').value;P.r=+$('sr').value;$('sRv').textContent=P.R;$('srv').textContent=P.r.toFixed(1);P.I=P.eps/(P.R+P.r);P.U=P.eps-P.I*P.r;$('sI').textContent=P.I.toFixed(2)+' A';$('sU').textContent=P.U.toFixed(2)+' V';};
  stopCircuitAnim();
  const loop=()=>{drawCircuitFrame(c,P);circuitRaf=requestAnimationFrame(loop);};
  $('sR').oninput=upd;$('sr').oninput=upd;
  $('simDone').onclick=()=>{stopCircuitAnim();onAnswer(true,20);};
  upd();loop();
}
let circuitRaf=null;
function stopCircuitAnim(){if(circuitRaf){cancelAnimationFrame(circuitRaf);circuitRaf=null;}}
function drawCircuitFrame(ctx,P){
  const {R,r,I,U,eps}=P;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  const w=ctx.canvas.width,h=ctx.canvas.height,x1=60,y1=50,x2=w-60,y2=h-50;
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.shadowColor='#00e5ff';ctx.shadowBlur=8;ctx.strokeRect(x1,y1,x2-x1,y2-y1);
  const bx=(x1+x2)/2,by=y1;
  ctx.fillStyle='#0a1230';ctx.fillRect(bx-30,by-20,60,40);ctx.fillStyle='#ffd60a';ctx.fillRect(bx-8,by-14,4,28);ctx.fillRect(bx+6,by-8,4,16);
  ctx.fillStyle='#eaf2ff';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(`ε=${eps}V r=${r.toFixed(1)}Ω`,bx,by+38);
  const rx=x2,ry=(y1+y2)/2;
  ctx.fillStyle='rgba(0,229,255,0.1)';ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;ctx.fillRect(rx-10,ry-30,20,60);ctx.strokeRect(rx-10,ry-30,20,60);
  ctx.strokeStyle='#ffd60a';for(let i=-22;i<22;i+=8){ctx.beginPath();ctx.moveTo(rx-6,ry+i);ctx.lineTo(rx+6,ry+i+6);ctx.stroke();}
  ctx.fillStyle='#eaf2ff';ctx.fillText(`R=${R}Ω`,rx+50,ry);
  const t=(Date.now()/300)%1;ctx.fillStyle='#ffd60a';ctx.shadowColor='#ffd60a';ctx.shadowBlur=8;
  for(let k=0;k<3;k++){const frac=(t+k/3)%1;let px,py;if(frac<0.5){px=bx+(x2-10-bx)*(frac*2);py=y1-10;}else{px=x2-10-(x2-10-bx)*((frac-0.5)*2);py=y2+10;}ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();}
  ctx.shadowBlur=0;ctx.fillStyle='#39ff14';ctx.font='13px Orbitron,sans-serif';ctx.fillText(`I=${I.toFixed(2)}A  U=${U.toFixed(2)}V`,bx,y2+60);
}
function renderACSim(wrap){
  wrap.innerHTML=`<div class="quiz-q">🔄 交变电流 — 观察正弦交流电波形</div><canvas class="sim-canvas" id="simCv"></canvas><div class="sim-controls"><div class="sim-ctrl"><label>峰值 Eₘ (V)</label><input type="range" id="sEm" min="10" max="311" value="220"><div class="val" id="sEmv">220</div></div><div class="sim-ctrl"><label>频率 f (Hz)</label><input type="range" id="sf" min="1" max="10" value="2"><div class="val" id="sfv">2</div></div></div><div class="sim-readouts"><div class="sim-readout"><div class="lbl">峰值 Eₘ</div><div class="num" id="sEmm">220 V</div></div><div class="sim-readout"><div class="lbl">有效值 E</div><div class="num" id="sEf">0</div></div><div class="sim-readout"><div class="lbl">周期 T</div><div class="num" id="sT">0</div></div></div><button class="btn-check" id="simDone" style="margin-top:14px">我理解了，完成实验</button>`;
  const cv=$('simCv'),c=cv.getContext('2d');cv.width=cv.clientWidth||600;cv.height=240;
  const P={Em:220,f:2,t0:0};
  const upd=()=>{P.Em=+$('sEm').value;P.f=+$('sf').value;$('sEmv').textContent=P.Em;$('sfv').textContent=P.f;$('sEmm').textContent=P.Em+' V';$('sEf').textContent=(P.Em/Math.sqrt(2)).toFixed(1)+' V';$('sT').textContent=(1/P.f).toFixed(2)+' s';};
  stopCircuitAnim();
  const draw=()=>{
    P.t0+=0.03;c.clearRect(0,0,cv.width,cv.height);
    c.strokeStyle='rgba(0,229,255,0.1)';c.lineWidth=1;
    for(let i=0;i<cv.width;i+=40){c.beginPath();c.moveTo(i,0);c.lineTo(i,cv.height);c.stroke();}
    for(let i=0;i<c.height;i+=30){c.beginPath();c.moveTo(0,i);c.lineTo(cv.width,i);c.stroke();}
    c.strokeStyle='rgba(255,255,255,0.3)';c.beginPath();c.moveTo(0,cv.height/2);c.lineTo(cv.width,cv.height/2);c.stroke();
    c.strokeStyle='#00e5ff';c.lineWidth=2.5;c.shadowColor='#00e5ff';c.shadowBlur=10;c.beginPath();
    for(let x=0;x<cv.width;x++){const tt=(x/cv.width)*(4/P.f)+P.t0;const e=P.Em*Math.sin(2*Math.PI*P.f*tt);const y=cv.height/2-(e/350)*(cv.height/2-10);x===0?c.moveTo(x,y):c.lineTo(x,y);}
    c.stroke();
    c.strokeStyle='#ffd60a';c.setLineDash([6,6]);c.lineWidth=1;c.beginPath();c.moveTo(0,cv.height/2-(P.Em/350)*(cv.height/2-10));c.lineTo(cv.width,cv.height/2-(P.Em/350)*(cv.height/2-10));c.stroke();c.setLineDash([]);c.shadowBlur=0;
    circuitRaf=requestAnimationFrame(draw);
  };
  $('sEm').oninput=upd;$('sf').oninput=upd;
  $('simDone').onclick=()=>{stopCircuitAnim();onAnswer(true,20);};
  upd();draw();
}

/* ---------- 结算 ---------- */
function finishGame(){
  if(Game._finished)return;Game._finished=true;
  stopTimer();stopCircuitAnim();stopLabAnim();
  const s=Save.data,lv=Game.level;
  const acc=Game.total>0?Math.round((Game.correct/Game.total)*100):0;
  const stars=acc>=90?3:acc>=60?2:acc>0?1:0;
  const timeUsed=Math.round((Date.now()-Game.startTime)/1000);
  const prevStars=s.stars[lv.id]||0;s.stars[lv.id]=Math.max(prevStars,stars);
  const xpGain=stars*20+Game.score;s.xp+=xpGain;
  const gemGain=stars*5;s.gems+=gemGain;
  if(lv.mode==='calc'&&timeUsed<30*lv.rounds)s.fastCalc=true;
  if(!s.bestScores[lv.id]||Game.score>s.bestScores[lv.id])s.bestScores[lv.id]=Game.score;
  Save.save();checkAchievements();
  $('resultCrown').textContent=stars>=3?'👑':stars>=2?'🎉':stars>=1?'👍':'💪';
  $('resultTitle').textContent=stars>=2?'关卡完成！':'继续加油！';
  const sr=$('starsRow');sr.innerHTML='';
  for(let i=0;i<3;i++){const sp=document.createElement('span');sp.className='star '+(i<stars?'on':'off');sp.textContent='★';sp.style.animationDelay=(i*0.2)+'s';sr.appendChild(sp);if(i<stars)setTimeout(()=>Sfx.star(),400+i*200);}
  $('rScore').textContent=Game.score;$('rAcc').textContent=acc+'%';$('rTime').textContent=timeUsed+'s';
  $('rXp').textContent=xpGain;$('rGem').textContent=gemGain;
  const nextLv=LEVELS.find(l=>l.id===lv.id+1);
  $('nextBtn').style.display=nextLv?'':'none';
  $('nextBtn').onclick=()=>nextLv&&openIntro(nextLv.id);
  $('retryBtn').onclick=()=>startGame(lv);
  Sfx.win();show('result');updateHud();
}

/* ---------- 成就 ---------- */
function renderAch(){
  const grid=$('achGrid');grid.innerHTML='';
  ACHIEVEMENTS.forEach(a=>{const unlocked=Save.data.ach[a.id];const el=document.createElement('div');el.className='ach-card '+(unlocked?'unlocked':'locked');el.innerHTML=`<div class="ach-icon">${a.icon}</div><div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;grid.appendChild(el);});
}

/* ---------- 错题本 ---------- */
function renderWrong(){
  const ws=Save.data.wrong;
  $('wrongStats').innerHTML=`<div class="wrong-stat"><b>${ws.length}</b><span>错题总数</span></div><div class="wrong-stat"><b>${new Set(ws.map(w=>w.level)).size}</b><span>涉及关卡</span></div>${ws.length?'<button class="btn-ghost wrong-clear" id="wrongClear">🗑️ 清空错题</button>':''}`;
  const list=$('wrongList');
  if(ws.length===0){list.innerHTML='<div class="wrong-empty">🎉 暂无错题，继续加油！</div>';return;}
  list.innerHTML=ws.map(w=>`<div class="wrong-item"><div class="wrong-q">${esc(w.q)}</div><div class="wrong-meta">${typeof w.level==='number'?'关卡 '+w.level:esc(w.level)}</div><div class="wrong-ans">你的答案：<span class="your">${esc(w.your)}</span> ｜ 正确答案：<span class="right">${esc(w.right)}</span></div><div class="wrong-ex">💡 ${esc(w.ex)}</div></div>`).join('');
  const wc=$('wrongClear');
  if(wc)wc.onclick=async()=>{if(await confirmDialog('确定清空全部错题吗？此操作不可恢复')){Save.data.wrong=[];Save.save();checkAchievements();renderWrong();toast('错题本已清空');}};
}

/* ---------- 考试模式 ---------- */
let examMode='all';
let examQuestions=null;
function startExam(){
  const count=examMode==='all'?20:10;
  let pool=[];
  LEVELS.forEach(lv=>{
    if(lv.mode!=='quiz')return;
    if(examMode==='junior'&&lv.stage!=='junior')return;
    if(examMode==='senior'&&lv.stage!=='senior')return;
    (QUIZ[lv.id]||[]).forEach(q=>pool.push({...q,level:lv.id}));
  });
  pool.sort(()=>Math.random()-0.5);
  examQuestions=pool.slice(0,count);
  if(examQuestions.length<count){toast('题库题目不足，请选择其他组别');return;}
  Game.level={id:0,title:'模拟考试',rounds:examQuestions.length,mode:'quiz'};
  Game.mode='quiz';Game.round=0;Game.total=examQuestions.length;Game.score=0;Game.correct=0;Game.wrong=0;Game.startTime=Date.now();Game.locked=false;Game.exam=true;Game.examDone=false;
  show('game');
  $('phaseTag').textContent='📝 模拟考试';
  $('quitBtn').onclick=async()=>{if(await confirmDialog('确定交卷？交卷后无法修改')){stopTimer();finishExam();}};
  nextRound();
  /* 总倒计时：综合组15分钟，单科组8分钟 */
  const dur=examMode==='all'?900:480;
  Game.timeLeft=dur;
  stopTimer();
  $('timerBar').style.width='100%';
  Game.timer=setInterval(()=>{
    Game.timeLeft-=0.1;
    $('timerBar').style.width=Math.max(0,(Game.timeLeft/dur)*100)+'%';
    const m=Math.floor(Game.timeLeft/60),s=Math.floor(Game.timeLeft%60);
    $('phaseTag').textContent=`📝 模拟考试 · 剩余 ${m}:${String(s).padStart(2,'0')}`;
    if(Game.timeLeft<=0){stopTimer();toast('时间到，自动交卷！');setTimeout(finishExam,800);}
  },100);
}
function finishExam(){
  if(Game.examDone)return;Game.examDone=true;
  stopTimer();
  const acc=Game.total>0?Math.round((Game.correct/Game.total)*100):0;
  const timeUsed=Math.round((Date.now()-Game.startTime)/1000);
  Save.data.examScores[examMode]=Math.max(Save.data.examScores[examMode]||0,acc);
  Save.save();
  if(acc>=80&&!Save.data.ach.hunan){Save.data.ach.hunan=true;Save.save();setTimeout(()=>toast('🏆 成就解锁：湘才辈出'),600);}
  if(!Save.data.ach.exam){Save.data.ach.exam=true;Save.save();setTimeout(()=>toast('🏆 成就解锁：考试达人'),1800);}
  $('resultCrown').textContent=acc>=90?'👑':acc>=60?'🎉':'💪';
  $('resultTitle').textContent='考试结束';
  const sr=$('starsRow');sr.innerHTML='';
  const stars=acc>=90?3:acc>=60?2:acc>0?1:0;
  for(let i=0;i<3;i++){const sp=document.createElement('span');sp.className='star '+(i<stars?'on':'off');sp.textContent='★';sp.style.animationDelay=(i*0.2)+'s';sr.appendChild(sp);}
  $('rScore').textContent=`${Game.correct} / ${Game.total} 题`;
  $('rAcc').textContent=acc+'%';
  $('rTime').textContent=timeUsed+'s';
  $('rXp').textContent=Game.correct*5;
  $('rGem').textContent=stars*5;
  Save.data.xp+=Game.correct*5;Save.data.gems+=stars*5;Save.save();checkAchievements();updateHud();
  $('nextBtn').style.display='none';
  $('retryBtn').onclick=()=>show('exam');
  Sfx.win();show('result');
}

/* =========================================================
   自由实验室系统 · 6 个交互实验 + 真实物理后果
   ========================================================= */
const LAB_DEFS = [
  { id:'static', icon:'🧲', title:'摩擦起电与验电器', stage:'junior', desc:'选择材料摩擦起电，观察电子转移与验电器金属箔张开。感应起电 vs 接触起电。', level:1 },
  { id:'circuit', icon:'💡', title:'串并联电路与短路', stage:'junior', desc:'切换串并联、开关与短路导线，观察电流流动与灯泡亮度。短路会有真实后果！', level:3 },
  { id:'ohm', icon:'📐', title:'欧姆定律·伏安法测电阻', stage:'junior', desc:'拖动滑动变阻器，观察电压表电流表实时变化，计算电阻。当心短路！', level:6 },
  { id:'home', icon:'🏠', title:'家庭电路与安全用电', stage:'junior', desc:'插拔用电器、用测电笔检测火零地线。过载会熔断保险丝，湿手触电危险！', level:9 },
  { id:'magnet', icon:'🧲', title:'电磁铁', stage:'junior', desc:'调节电流、匝数、铁芯，观察磁性强弱与磁场线。电流过大会烧毁线圈！', level:10 },
  { id:'motor', icon:'⚙️', title:'电动机原理', stage:'senior', desc:'通电线圈在磁场中转动，切换电流/磁场方向，观察换向器的作用。', level:16 }
];
let labRaf = null;
let labLevelMode = false;
function stopLabAnim(){ if(labRaf){cancelAnimationFrame(labRaf);labRaf=null;} }
function labDone(){
  if(labLevelMode){ stopLabAnim(); onAnswer(true, 20); }
  else { stopLabAnim(); labFeedback('实验完成！','ok'); setTimeout(()=>{show('lab');renderLabHall();},800); }
}
function labFeedback(msg, type='info'){
  const f=$('labFeedback'); f.textContent=msg; f.className='feedback show '+(type==='danger'?'bad':type==='warn'?'':'ok');
  clearTimeout(f._t); f._t=setTimeout(()=>{f.className='feedback';},2600);
  if(type==='danger') Sfx.wrong(); else if(type==='ok') Sfx.correct();
}

/* =========================================================
   实验知识库（依据人教版教材与课标必做实验编写）
   ========================================================= */
const LAB_KB = {
  static:{
    principle:`<h4>📖 实验原理</h4>摩擦起电的实质是<b>电子的转移</b>：不同材料的原子核束缚电子的本领不同，摩擦时电子从束缚弱的物体转移到束缚强的物体。<ul><li>玻璃棒+丝绸 → 玻璃棒<span class="kb-ok">失去电子带正电</span></li><li>橡胶棒+毛皮 → 橡胶棒<span class="kb-warn">得到电子带负电</span></li></ul>各种材料按得失电子本领排成<b>摩擦起电序列</b>：毛皮 → 玻璃 → 丝绸 → 棉 → 橡胶 → PVC。<b>带正电还是负电，取决于和哪种材料摩擦</b>——玻璃棒与毛皮摩擦时，毛皮更易失去电子，玻璃棒反而得到电子带微弱负电；两种材料在序列中越接近，起电越弱。验电器原理：<b>同种电荷相互排斥</b>，金属箔张角越大带电量越多。`,
    apparatus:['🥢 玻璃棒','🟤 橡胶棒','🔵 PVC管','🎀 丝绸','🧶 毛皮','🧻 棉布','⚗️ 验电器','🔌 接地导线'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① 用丝绸用力摩擦玻璃棒（或毛皮摩擦橡胶棒）</li><li>② 将带电棒<b>靠近</b>验电器金属球 → 观察<b>静电感应</b>（箔片张开，电荷未转移）</li><li>③ 将带电棒<b>接触</b>金属球 → 观察<b>接触起电</b>（电荷转移，箔片持续张开）</li><li>④ 手触摸金属球或接地 → 电荷导入大地，箔片合拢</li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li>电荷量过大时会产生<span class="kb-warn">火花放电</span>（如冬天脱毛衣的噼啪声）</li><li>感应起电：棒移开后箔片会合拢；接触起电：电荷真正转移，移开后仍张开</li><li>潮湿空气会让电荷很快流失，实验效果变差</li><li>验电器金属箔很脆弱，张角过大会损坏</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li>自然界只有<b>两种电荷</b>：正电荷和负电荷</li><li><b>同种电荷相互排斥，异种电荷相互吸引</b></li><li>摩擦起电不是"创造"电荷，而是电子从一个物体转移到另一个物体</li><li>金属是导体，电荷可通过金属杆传导到金属箔</li></ul>`
  },
  circuit:{
    principle:`<h4>📖 实验原理</h4><ul><li><b>串联电路</b>：电流只有一条路径，<span class="kb-formula">I = I₁ = I₂</span>，总电压 <span class="kb-formula">U = U₁ + U₂</span></li><li><b>并联电路</b>：电流有多条支路，<span class="kb-formula">I = I₁ + I₂</span>，各支路电压 <span class="kb-formula">U = U₁ = U₂</span></li><li>灯泡亮度由<b>实际功率</b> <span class="kb-formula">P = UI</span> 决定</li></ul>`,
    apparatus:['🔋 电池盒','💡 小灯泡+灯座','🔘 闸刀开关','🧵 导线','📟 电流表'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① <b>断开开关</b>，按电路图连接电路（连接电路时开关必须断开！）</li><li>② 电流表<b>串联</b>接入，电流"正进负出"，先试触选量程</li><li>③ 闭合开关，观察灯泡亮度并读取电流表示数</li><li>④ 换接串联/并联，对比电流规律与亮度差异</li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li class="kb-warn">绝对禁止用导线直接连接电源两极（短路）！电流急剧增大，导线发热烧毁，甚至损坏电源</li><li class="kb-warn">电流表内阻极小，不能直接并在电源或用电器两端</li><li>一个灯泡损坏：串联全灭，并联其他支路不受影响</li><li>导线接头要拧紧，接触不良会造成"断路"假象</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li>串联：电流处处相等；总电压等于各用电器电压之和；用电器互相影响</li><li>并联：干路电流等于各支路电流之和；各支路电压相等；用电器互不影响</li><li>短路的危害：电阻≈0 → 电流极大 → 导线急剧发热引发火灾</li></ul>`
  },
  ohm:{
    principle:`<h4>📖 实验原理</h4>伏安法测电阻：根据欧姆定律变形式 <span class="kb-formula">R = U / I</span>，用电压表测待测电阻两端电压 U，用电流表测通过它的电流 I，间接算出电阻。<br>滑动变阻器作用：<b>① 保护电路 ② 改变电压实现多次测量取平均值，减小误差</b>`,
    apparatus:['🔋 学生电源','📟 电流表','🔋 电压表','🎚️ 滑动变阻器','⬛ 待测电阻','🔘 开关','🧵 导线'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① 按电路图连接实物，<b>开关断开</b>，滑动变阻器"一上一下"接线，滑片移到<b>最大阻值处</b></li><li>② 闭合开关，缓慢移动滑片，使电压表示数为某一整数值，记录 U、I</li><li>③ 改变滑片位置，再测 2~3 组数据填入记录表</li><li>④ 计算每组 R=U/I，<b>求平均值减小误差</b></li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li class="kb-warn">闭合开关前滑片未移到最大阻值处 → 电流过大可能烧毁电表！</li><li class="kb-warn">电表正负接线柱接反 → 指针反偏打弯</li><li class="kb-warn">量程选太小 → 超量程打满损坏电表；选太大 → 读数误差大</li><li class="kb-warn">变阻器接"两上"接线柱 → 电阻≈0 相当于短路；接"两下" → 变成定值电阻，滑片不起作用</li><li>读数时视线要正对刻度盘，减小读数误差</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li><span class="kb-formula">R = U / I</span>，电阻是导体本身的性质，与 U、I 无关</li><li>多次测量取平均值可以减小测量误差</li><li>若测小灯泡电阻：灯丝电阻随温度升高而增大，不能求平均</li></ul>`
  },
  home:{
    principle:`<h4>📖 实验原理</h4>家庭电路电压 <span class="kb-formula">U = 220 V</span>，各用电器<b>并联</b>。总功率 <span class="kb-formula">P总 = P₁+P₂+…</span>，总电流 <span class="kb-formula">I = P总 / U</span>。电流超过保险丝额定电流时，保险丝熔断切断电路。<br>测电笔：接触火线时氖管发光（电流经人体入地），接触零线/地线不发光。`,
    apparatus:['⚡ 电能表','🔘 总开关','🧷 保险丝','🔌 三孔插座','💡 用电器','🖊️ 测电笔'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① 观察家庭电路组成：进户线→电能表→总开关→保险丝→用电器</li><li>② 用测电笔分别接触三条导线，辨别火线/零线/地线</li><li>③ 逐个接入用电器，观察总功率、总电流与电能表转盘变化</li><li>④ 同时接入大功率用电器，观察过载后果</li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li class="kb-warn">湿手电阻从约10kΩ降到约1kΩ，触电电流增大10倍——绝不湿手碰电器！</li><li class="kb-warn">有金属外壳的用电器必须接地线，外壳漏电时电流经地线入地</li><li>保险丝不能用铜丝代替（铜熔点太高，起不到保护作用）</li><li>总功率不要超过线路允许的最大值 P=UI</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li>用电器并联，互不影响；功率越大电流越大</li><li>过载或短路 → 电流过大 → 保险丝熔断保护电路</li><li>安全用电原则：不接触低压带电体，不靠近高压带电体</li></ul>`
  },
  magnet:{
    principle:`<h4>📖 实验原理</h4>电流的磁效应：通电导线周围存在磁场（奥斯特实验）。通电螺线管外部磁场与条形磁铁相似，磁极方向用<b>右手螺旋定则（安培定则）</b>判断：右手握住螺线管，四指指向电流方向，拇指所指即 N 极。<br>磁性强弱：<span class="kb-formula">B ∝ n·I</span>（匝数×电流），插入铁芯后磁性大大增强。`,
    apparatus:['🔋 电源','🌀 螺线管','🧭 小磁针','🎚️ 滑动变阻器','⬜ 铁芯','📎 回形针','🔘 开关'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① 用滑动变阻器控制电流（闭合前滑片置最大阻值）</li><li>② 闭合开关，观察小磁针指向，用右手螺旋定则判断磁极</li><li>③ 改变电流大小/线圈匝数/有无铁芯，对比吸引回形针数量</li><li>④ 调换电流方向，观察小磁针偏转方向变化</li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li class="kb-warn">线圈电阻很小，电流过大会发热烧毁线圈——通电时间不宜过长</li><li>小磁针要远离其他磁铁放置，避免干扰</li><li>铁芯要用软铁（断电后磁性消失），不能用钢（有剩磁）</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li>电磁铁磁性强弱与<b>电流大小、线圈匝数</b>成正比，与<b>有无铁芯</b>有关</li><li>磁极方向由电流方向决定（右手螺旋定则）</li><li>电磁铁优点：磁性有无、强弱、磁极都可以控制（应用：电磁起重机、电铃、继电器）</li></ul>`
  },
  motor:{
    principle:`<h4>📖 实验原理</h4>通电导体在磁场中受到力的作用（安培力），力的方向与<b>电流方向</b>和<b>磁场方向</b>有关。<br>电动机 = 通电线圈在磁场中受力转动，<b>电能 → 机械能</b>。<br><b>换向器</b>：两个半圆铜环，线圈转过平衡位置时自动改变电流方向，使线圈持续转动。`,
    apparatus:['🧲 蹄形磁铁','🌀 线圈','➗ 换向器','🖌️ 电刷','🔋 电源','🔘 开关'],
    steps:`<h4>📋 实验步骤</h4><ul><li>① 组装模型：蹄形磁铁提供磁场，线圈通过电刷、换向器接电源</li><li>② 闭合开关，观察线圈转动方向</li><li>③ 分别改变电流方向、磁场方向，对比转向变化</li><li>④ 去掉换向器，观察线圈在平衡位置附近摆动的现象</li></ul>`,
    notes:`<h4>⚠️ 注意事项</h4><ul><li>只改变电流方向或只改变磁场方向 → 转向改变；两者同时改变 → 转向不变</li><li>平衡位置：线圈平面与磁感线垂直时受力平衡，无换向器就停在这里</li><li class="kb-warn">启动时若线圈恰在平衡位置，需要轻推一下才能启动</li></ul>`,
    conclusion:`<h4>💡 实验结论</h4><ul><li>通电导体在磁场中受力，力的大小与电流大小、磁场强弱有关</li><li>换向器是直流电动机的关键部件，保证线圈持续单向转动</li><li>应用：电风扇、洗衣机、电动车、电动玩具</li></ul>`
  }
};
/* 知识面板渲染 */
function labKbHTML(id){
  const k=LAB_KB[id];
  return `<div class="lab-shelf">${k.apparatus.map(a=>{
    const parts=a.split(' ');
    return `<div class="apparatus"><span class="a-icon">${parts[0]}</span><span class="a-name">${parts.slice(1).join(' ')||parts[0]}</span></div>`;
  }).join('')}</div>
  <div class="lab-kb">
    <div class="lab-kb-tabs">
      <button class="lab-kb-tab on" data-t="principle">📖 原理</button>
      <button class="lab-kb-tab" data-t="steps">📋 步骤</button>
      <button class="lab-kb-tab" data-t="notes">⚠️ 注意事项</button>
      <button class="lab-kb-tab" data-t="conclusion">💡 结论</button>
    </div>
    <div class="lab-kb-body">${k.principle}</div>
  </div>`;
}
function bindLabKb(wrap,id){
  const k=LAB_KB[id];
  wrap.querySelectorAll('.lab-kb-tab').forEach(btn=>{
    btn.onclick=()=>{
      wrap.querySelectorAll('.lab-kb-tab').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      wrap.querySelector('.lab-kb-body').innerHTML=k[btn.dataset.t];
      Sfx.click();
    };
  });
}

/* =========================================================
   真实实验器材绘制函数库（Canvas）
   ========================================================= */
/* 电池盒：深色外壳+正负极柱 */
function drawBatteryBox(ctx,x,y,v,flip){
  const w=64,h=40;
  ctx.fillStyle='#101d3a';ctx.strokeStyle='#3a5a9a';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,6);ctx.fill();ctx.stroke();
  // 极柱
  const px=flip?-1:1;
  ctx.fillStyle='#ff5555';ctx.beginPath();ctx.arc(x+px*(w/2+4),y-10,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#222';ctx.strokeStyle='#888';ctx.beginPath();ctx.arc(x-px*(w/2+4),y-10,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ff5555';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('+',x+px*(w/2+4),y+16);
  ctx.fillStyle='#aaa';ctx.fillText('−',x-px*(w/2+4),y+16);
  ctx.fillStyle='#ffd60a';ctx.font='bold 13px Orbitron,sans-serif';ctx.fillText(v+'V',x,y+5);
}
/* 闸刀开关：底座+闸刀片 */
function drawKnifeSwitch(ctx,x,y,closed){
  ctx.fillStyle='#2a2418';ctx.strokeStyle='#8a7a4a';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x-34,y-12,68,24,4);ctx.fill();ctx.stroke();
  ctx.fillStyle='#c0c8d0';ctx.beginPath();ctx.arc(x-22,y,4.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+22,y,4.5,0,Math.PI*2);ctx.fill();
  // 闸刀片
  ctx.save();ctx.translate(x-22,y);
  ctx.rotate(closed?0:-0.5);
  ctx.fillStyle=closed?'#ffd60a':'#c0a050';ctx.shadowColor=closed?'#ffd60a':'transparent';ctx.shadowBlur=closed?8:0;
  ctx.fillRect(0,-4,44,8);ctx.shadowBlur=0;
  ctx.fillStyle='#8a5a2a';ctx.fillRect(40,-7,9,14); // 手柄
  ctx.restore();
  ctx.fillStyle='#888';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(closed?'闭合':'断开',x,y+26);
}
/* 小灯泡+灯座：玻璃泡+灯丝+螺旋灯头 */
function drawLampReal(ctx,x,y,on,brightness){
  const br=on?Math.max(0.15,brightness):0;
  // 光晕
  if(br>0){const g=ctx.createRadialGradient(x,y-14,4,x,y-14,60*br+14);g.addColorStop(0,`rgba(255,220,80,${0.5*br})`);g.addColorStop(1,'rgba(255,220,80,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y-14,60*br+14,0,Math.PI*2);ctx.fill();}
  // 玻璃泡
  ctx.fillStyle=br>0?`rgba(255,214,90,${0.25+br*0.55})`:'rgba(160,190,220,0.12)';
  ctx.strokeStyle='rgba(200,220,255,0.55)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y-14,16,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 灯丝
  ctx.strokeStyle=br>0?'#ffe082':'#8a94a0';ctx.lineWidth=1.6;
  ctx.shadowColor='#ffd60a';ctx.shadowBlur=br*14;
  ctx.beginPath();ctx.moveTo(x-7,y-8);ctx.lineTo(x-7,y-18);
  for(let i=0;i<4;i++){ctx.lineTo(x-7+i*4.5+2,y-20+(i%2)*4);}
  ctx.lineTo(x+7,y-18);ctx.lineTo(x+7,y-8);ctx.stroke();ctx.shadowBlur=0;
  // 螺旋灯头
  ctx.fillStyle='#b8c2cc';ctx.fillRect(x-7,y+2,14,10);
  ctx.strokeStyle='#78828c';ctx.lineWidth=1;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-7,y+4+i*3);ctx.lineTo(x+7,y+4+i*3);ctx.stroke();}
  // 灯座
  ctx.fillStyle='#1a2a4a';ctx.strokeStyle='#3a5a8a';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x-20,y+12,40,12,3);ctx.fill();ctx.stroke();
  ctx.fillStyle='#c0c8d0';ctx.beginPath();ctx.arc(x-16,y+18,3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+16,y+18,3,0,Math.PI*2);ctx.fill();
}
/* 指针式电表：刻度盘+指针+量程。frac:0~1，over:超量程打弯，rev:反偏 */
function drawAnalogMeter(ctx,x,y,r,frac,label,unit,rangeTxt,over,rev){
  // 外壳
  ctx.fillStyle='#eef2f6';ctx.strokeStyle='#9aa6b2';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#dfe6ec';ctx.beginPath();ctx.arc(x,y,r-5,0,Math.PI*2);ctx.fill();
  // 刻度弧线与刻度
  const a0=Math.PI*0.8, a1=Math.PI*2.2;
  ctx.strokeStyle='#333';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y,r-13,a0,a1);ctx.stroke();
  ctx.fillStyle='#333';ctx.font='8px sans-serif';ctx.textAlign='center';
  for(let i=0;i<=5;i++){
    const a=a0+(a1-a0)*i/5;
    const x1=x+Math.cos(a)*(r-13),y1=y+Math.sin(a)*(r-13);
    const x2=x+Math.cos(a)*(r-19),y2=y+Math.sin(a)*(r-19);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  }
  // 红区（量程后段）
  ctx.strokeStyle='#d33';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(x,y,r-13,a0+(a1-a0)*0.8,a1);ctx.stroke();
  // 指针
  let f=Math.max(-0.06,Math.min(1,frac));
  if(rev)f=-0.06;
  if(over)f=1.04;
  const a=a0+(a1-a0)*f;
  ctx.strokeStyle='#d33';ctx.lineWidth=2;
  if(over){ // 打弯的指针
    const bx=x+Math.cos(a)*(r-10),by=y+Math.sin(a)*(r-10);
    ctx.beginPath();ctx.moveTo(x,y+6);ctx.lineTo(bx,by);ctx.lineTo(bx+7,by+5);ctx.stroke();
  } else {
    ctx.beginPath();ctx.moveTo(x,y+6);ctx.lineTo(x+Math.cos(a)*(r-10),y+Math.sin(a)*(r-10));ctx.stroke();
  }
  ctx.fillStyle='#666';ctx.beginPath();ctx.arc(x,y+4,3.5,0,Math.PI*2);ctx.fill();
  // 标识
  ctx.fillStyle='#222';ctx.font='bold 13px sans-serif';ctx.textAlign='center';
  ctx.fillText(label,x,y-r*0.32);
  ctx.font='9px sans-serif';ctx.fillStyle='#556';
  ctx.fillText(rangeTxt,x,y+r*0.42);
  ctx.fillText(unit,x,y+r*0.62);
  if(over){ctx.fillStyle='#d33';ctx.font='bold 9px sans-serif';ctx.fillText('超量程!',x,y-r*0.55);}
  if(rev){ctx.fillStyle='#d33';ctx.font='bold 9px sans-serif';ctx.fillText('反偏!',x,y-r*0.55);}
}
/* 滑动变阻器：瓷筒+电阻丝+金属杆+滑片+4接线柱 */
function drawRheostatReal(ctx,x,y,w,frac,mode,hot){
  const h=30, rodY=y-26;
  // 瓷筒
  ctx.fillStyle=hot?'#4a2a20':'#e8e4da';ctx.strokeStyle='#9a948a';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,6);ctx.fill();ctx.stroke();
  // 电阻丝（螺旋线）
  ctx.strokeStyle=hot?'#ff6a3a':'#8a7f70';ctx.lineWidth=1.4;
  ctx.shadowColor=hot?'#ff5a2a':'transparent';ctx.shadowBlur=hot?10:0;
  ctx.beginPath();
  for(let i=0;i<=40;i++){
    const px=x-w/2+6+(w-12)*i/40, py=y+Math.sin(i*1.5)*h*0.28;
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.stroke();ctx.shadowBlur=0;
  // 有效电阻高亮（取决于接法）
  if(mode==='correct'){
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.globalAlpha=0.8;
    ctx.beginPath();
    const effEnd=x-w/2+6+(w-12)*frac;
    for(let i=0;i<=Math.round(40*frac);i++){
      const px=x-w/2+6+(w-12)*i/40, py=y+Math.sin(i*1.5)*h*0.28;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.stroke();ctx.globalAlpha=1;
  }
  // 金属杆
  ctx.strokeStyle='#c8d0d8';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(x-w/2,rodY);ctx.lineTo(x+w/2,rodY);ctx.stroke();
  // 滑片
  const sliderX=x-w/2+frac*w;
  ctx.fillStyle='#3a4a6a';ctx.strokeStyle='#7c9aff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(sliderX-8,rodY-6,16,h/2+18,3);ctx.fill();ctx.stroke();
  ctx.fillStyle='#7c9aff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('P',sliderX,rodY-10);
  // 4 个接线柱 A(左下) B(右下) C(左上) D(右上)
  const posts=[[x-w/2-6,y,'A'],[x+w/2+6,y,'B'],[x-w/2-6,rodY,'C'],[x+w/2+6,rodY,'D']];
  posts.forEach(p=>{
    const used=(mode==='correct'&&(p[2]==='A'||p[2]==='C'))||(mode==='top'&&(p[2]==='C'||p[2]==='D'))||(mode==='bottom'&&(p[2]==='A'||p[2]==='B'));
    ctx.fillStyle=used?'#ffd60a':'#c0c8d0';
    ctx.beginPath();ctx.arc(p[0],p[1],4.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#888';ctx.font='9px sans-serif';ctx.fillText(p[2],p[0],p[1]+18);
  });
}
/* 定值电阻：瓷管+色环 */
function drawResistorReal(ctx,x,y,label,hot){
  ctx.fillStyle=hot?'#6a4a30':'#d8c8a8';ctx.strokeStyle='#8a7a5a';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x-26,y-9,52,18,6);ctx.fill();ctx.stroke();
  const bands=['#6a3a9a','#222','#8a5a2a'];
  bands.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(x-14+i*10,y-9,4,18);});
  ctx.strokeStyle='#c0c8d0';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x-40,y);ctx.lineTo(x-26,y);ctx.moveTo(x+26,y);ctx.lineTo(x+40,y);ctx.stroke();
  ctx.fillStyle='#eaf2ff';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(label,x,y-16);
}
/* 接线端子点 */
function drawTerminal(ctx,x,y,color){
  ctx.fillStyle=color||'#c0c8d0';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
}
/* 小磁针：菱形磁针，angle 为指向角 */
function drawCompassNeedle(ctx,x,y,angle){
  ctx.save();ctx.translate(x,y);
  // 玻璃罩
  ctx.fillStyle='rgba(180,220,255,0.1)';ctx.strokeStyle='rgba(150,200,255,0.4)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 刻度
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*16,Math.sin(a)*16);ctx.lineTo(Math.cos(a)*19,Math.sin(a)*19);ctx.stroke();}
  // 磁针
  ctx.rotate(angle);
  ctx.fillStyle='#ff5555';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(2,-4);ctx.lineTo(2,4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#eef2f6';ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-2,-4);ctx.lineTo(-2,4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#666';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.fillStyle='#ff5555';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('N',x+13*Math.cos(angle)+0,y+13*Math.sin(angle)+3);
}
/* 电能表：转盘转动 */
function drawElectricMeter(ctx,x,y,power,t){
  ctx.fillStyle='#10301a';ctx.strokeStyle='#3a8a5a';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x-44,y-30,88,60,6);ctx.fill();ctx.stroke();
  ctx.fillStyle='#dfffe8';ctx.font='bold 10px Orbitron,sans-serif';ctx.textAlign='center';
  ctx.fillText('kW·h',x,y-18);
  // 读数窗
  ctx.fillStyle='#0a1a10';ctx.fillRect(x-30,y-14,60,14);
  ctx.fillStyle='#39ff14';ctx.font='bold 11px Orbitron,sans-serif';
  ctx.fillText((1234.5+t*power*0.00001).toFixed(1),x,y-3);
  // 转盘
  const ry=y+16;
  ctx.strokeStyle='#8aa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,ry,9,0,Math.PI*2);ctx.stroke();
  const spin=t*(0.5+power/500);
  ctx.strokeStyle='#ff5555';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x+Math.cos(spin)*9,ry);ctx.lineTo(x-Math.cos(spin)*9,ry);ctx.stroke();
  ctx.fillStyle='#8aa';ctx.font='9px sans-serif';ctx.fillText('电能表',x,y+42);
}


/* ---------- 实验室大厅 ---------- */
function renderLabHall(){
  const grid=$('labGrid'); grid.innerHTML='';
  LAB_DEFS.forEach(l=>{
    const card=document.createElement('div'); card.className='lab-card';
    card.innerHTML=`<span class="lab-icon">${l.icon}</span><h3>${l.title}</h3><p>${l.desc}</p><span class="lab-tag ${l.stage}">${l.stage==='junior'?'初中':'高中'} · 第${l.level}关</span>`;
    card.onclick=()=>openLab(l.id);
    grid.appendChild(card);
  });
}
function openLab(id){
  const def=LAB_DEFS.find(l=>l.id===id);
  $('labTitle').textContent=def.title;
  $('labFeedback').className='feedback';
  const area=$('labArea'); area.innerHTML='';
  const wrap=document.createElement('div'); wrap.className='lab-wrap';
  area.appendChild(wrap);
  stopLabAnim();
  labLevelMode = false;
  show('labdetail');
  if(id==='static') labStatic(wrap);
  else if(id==='circuit') labCircuit(wrap);
  else if(id==='ohm') labOhm(wrap);
  else if(id==='home') labHome(wrap);
  else if(id==='magnet') labMagnet(wrap);
  else if(id==='motor') labMotor(wrap);
}

/* ---------- 关卡内实验室 ---------- */
function renderLevelLab(){
  labLevelMode = true;
  Game.total = 1;
  $('roundLabel').textContent = '互动实验';
  $('phaseTag').textContent = '🧪 互动实验';
  const area = $('gameArea'); area.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'lab-wrap';
  area.appendChild(wrap);
  stopLabAnim();
  const id = Game.level.labId;
  if(id==='static') labStatic(wrap);
  else if(id==='circuit') labCircuit(wrap);
  else if(id==='ohm') labOhm(wrap);
  else if(id==='home') labHome(wrap);
  else if(id==='magnet') labMagnet(wrap);
  else if(id==='motor') labMotor(wrap);
  // 实验模式不需要倒计时
  stopTimer();
}

/* ---------- 工具：绘制火花/烟雾粒子 ---------- */
function makeSpark(ctx,x,y,color){
  return {x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6-2,life:1,r:Math.random()*2+1,c:color};
}
function makeSmoke(ctx,x,y){
  return {x,y,vx:(Math.random()-0.5)*1,vy:-Math.random()*2-1,life:1,r:Math.random()*14+8};
}

/* =========================================================
   自由实验台引擎：拖器材 → 拉线连接 → 节点电压法实时求解
   ========================================================= */
/* 高斯消元（带部分主元） */
function gaussSolve(A,b,n){
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
    if(Math.abs(A[p][c])<1e-11)continue;
    if(p!==c){const t=A[c];A[c]=A[p];A[p]=t;const tb=b[c];b[c]=b[p];b[p]=tb;}
    for(let r=c+1;r<n;r++){
      const f=A[r][c]/A[c][c];if(!f)continue;
      for(let k=c;k<n;k++)A[r][k]-=f*A[c][k];
      b[r]-=f*b[c];
    }
  }
  const x=new Float64Array(n);
  for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=Math.abs(A[i][i])<1e-11?0:s/A[i][i];}
  return x;
}

/* ---------- 器材定义库 ---------- */
const FL_DEFS={
  battery:{name:'电池盒',icon:'🔋',hitR:{w:46,h:30},
    terms:[{id:'+',dx:36,dy:-10,c:'#ff5555'},{id:'-',dx:-36,dy:-10,c:'#8aa0c8'}],
    srcs:c=>[{a:'+',b:'-',V:c.state.flip?-6:6}],
    onClick:c=>{c.state.flip=!c.state.flip;},
    draw(c,ctx,S){drawBatteryBox(ctx,c.x,c.y,6,c.state.flip);
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText('点击翻转正负极',c.x,c.y+34);}},
  switch:{name:'闸刀开关',icon:'🔘',hitR:{w:42,h:26},
    terms:[{id:'a',dx:-22,dy:0,c:'#c0c8d0'},{id:'b',dx:22,dy:0,c:'#c0c8d0'}],
    elems:c=>[{a:'a',b:'b',R:c.state.on?0.01:1e9}],
    onClick:c=>{c.state.on=!c.state.on;Sfx.click();},
    init:()=>({on:false}),
    draw(c,ctx){drawKnifeSwitch(ctx,c.x,c.y,c.state.on);}},
  lamp:{name:'小灯泡',icon:'💡',hitR:{w:30,h:42},
    terms:[{id:'a',dx:-16,dy:18,c:'#c0c8d0'},{id:'b',dx:16,dy:18,c:'#c0c8d0'}],
    elems:c=>[{a:'a',b:'b',R:c.state.burn?1e9:5}],
    onSolve(c,io,S){const e=io.el[0];if(!c.state.burn&&e.P>10){c.state.burn=true;S.smokes.push(makeSmoke(S.ctx,c.x,c.y-20));labFeedback('💡 灯泡功率过大，灯丝烧断了！','danger');}},
    draw(c,ctx){const e=c.io&&c.io.el[0];const P=e?e.P:0;
      drawLampReal(ctx,c.x,c.y,!c.state.burn&&P>0.15,Math.min(1,P/6));
      if(c.state.burn){ctx.fillStyle='#ff5555';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('灯丝烧断',c.x,c.y-40);}}},
  ammeter:{name:'电流表',icon:'Ⓐ',hitR:{w:46,h:42},
    terms:[{id:'com',dx:0,dy:28,c:'#333'},{id:'lo',dx:-24,dy:16,c:'#ff5555'},{id:'hi',dx:24,dy:16,c:'#ff5555'}],
    elems:c=>[{a:'com',b:'lo',R:c.state.burn?1e9:0.05},{a:'com',b:'hi',R:c.state.burn?1e9:0.02}],
    onSolve(c,io,S){
      const w=wiredSet(c,S);let I=0,range=3;
      if(w.has('lo')&&Math.abs(io.el[0].I)>1e-6){I=io.el[0].I;range=0.6;}
      if(w.has('hi')&&Math.abs(io.el[1].I)>1e-6){I+=io.el[1].I;range=3;}
      io.range=range;io.rev=I>0.0005;io.reading=Math.abs(I);
      io.over=!c.state.burn&&io.reading>range*1.05;
      if(!c.state.burn&&io.reading>range*1.5){c.state.burn=true;S.sparks.push(makeSpark(S.ctx,c.x,c.y-10,'#ff5555'));labFeedback('💥 电流远超量程，电流表烧毁！','danger');}
      if(io.rev&&io.reading>0.01&&!c._revMsg){c._revMsg=true;labFeedback('⚠️ 电流表正负接线柱接反，指针反偏！','danger');}
    },
    draw(c,ctx){const io=c.io||{};const rng=io.range||3;
      drawAnalogMeter(ctx,c.x,c.y-6,34,c.state.burn?0:Math.min(1,(io.reading||0)/rng),'A','A',c.state.burn?'已烧毁':'0-'+rng+'A',io.over,io.rev);
      ctx.fillStyle=io.rev?'#ff3d81':'#8aa0c8';ctx.font='11px sans-serif';ctx.textAlign='center';
      ctx.fillText(c.state.burn?'💥 换一块表吧':(io.reading!=null?((io.rev?'反偏 ':'')+io.reading.toFixed(2)+' A'):'串入电路测电流'),c.x,c.y-50);
      ctx.fillStyle='#667';ctx.font='9px sans-serif';ctx.fillText('− 0.6 3',c.x,c.y+38);}},
  voltmeter:{name:'电压表',icon:'Ⓥ',hitR:{w:46,h:42},
    terms:[{id:'com',dx:0,dy:28,c:'#333'},{id:'v3',dx:-24,dy:16,c:'#ff5555'},{id:'v15',dx:24,dy:16,c:'#ff5555'}],
    elems:c=>[{a:'com',b:'v3',R:c.state.burn?1e9:3000},{a:'com',b:'v15',R:c.state.burn?1e9:15000}],
    onSolve(c,io,S){
      const w=wiredSet(c,S);let V=0,range=15;
      if(w.has('v3')){V=-io.el[0].V;range=3;}
      if(w.has('v15')){V=-io.el[1].V;range=15;}
      io.range=range;io.rev=V<-0.005;io.reading=Math.abs(V);
      io.over=!c.state.burn&&io.reading>range*1.05;
      if(!c.state.burn&&io.reading>range*1.5){c.state.burn=true;S.sparks.push(makeSpark(S.ctx,c.x,c.y-10,'#ff5555'));labFeedback('💥 电压远超量程，电压表烧毁！','danger');}
      if(io.rev&&io.reading>0.05&&!c._revMsg){c._revMsg=true;labFeedback('⚠️ 电压表正负接线柱接反，指针反偏！','danger');}
    },
    draw(c,ctx){const io=c.io||{};const rng=io.range||15;
      drawAnalogMeter(ctx,c.x,c.y-6,34,c.state.burn?0:Math.min(1,(io.reading||0)/rng),'V','V',c.state.burn?'已烧毁':'0-'+rng+'V',io.over,io.rev);
      ctx.fillStyle=io.rev?'#ff3d81':'#8aa0c8';ctx.font='11px sans-serif';ctx.textAlign='center';
      ctx.fillText(c.state.burn?'💥 换一块表吧':(io.reading!=null?((io.rev?'反偏 ':'')+io.reading.toFixed(2)+' V'):'并联测电压'),c.x,c.y-50);
      ctx.fillStyle='#667';ctx.font='9px sans-serif';ctx.fillText('− 3 15',c.x,c.y+38);}},
  rheostat:{name:'滑动变阻器',icon:'🎚️',hitR:{w:70,h:44},
    terms:[{id:'A',dx:-56,dy:0,c:'#c0c8d0'},{id:'B',dx:56,dy:0,c:'#c0c8d0'},{id:'C',dx:-56,dy:-26,c:'#c0c8d0'},{id:'D',dx:56,dy:-26,c:'#c0c8d0'}],
    init:()=>({slide:100,temp:25}),
    elems:c=>{const s=c.state.slide/100,bad=c.state.burn?1e9:1;
      return [{a:'A',b:'~P',R:(20*s+0.01)*bad},{a:'B',b:'~P',R:(20*(1-s)+0.01)*bad},{a:'C',b:'~P',R:0.01*bad},{a:'D',b:'~P',R:0.01*bad}];},
    actions:[{dx:0,dy:-26,r:18,drag:true,label:'滑片',
      onDrag(c,p){c.state.slide=Math.max(0,Math.min(100,Math.round((p.x-(c.x-50))/100*100)));}}],
    onSolve(c,io,S){
      const Ip=Math.abs(io.el[2].I)+Math.abs(io.el[3].I);
      if(Ip>1.5)c.state.temp=Math.min(600,c.state.temp+Ip*2);else c.state.temp=Math.max(25,c.state.temp-1.5);
      c.state.hot=c.state.temp>150;
      if(c.state.temp>320&&!c.state.burn){c.state.burn=true;S.smokes.push(makeSmoke(S.ctx,c.x,c.y));labFeedback('🔥 变阻器电流过大，电阻丝烧断！','danger');}
      const w=wiredSet(c,S);
      if((w.has('C')||w.has('D'))&&!(w.has('A')||w.has('B'))&&Ip>0.3&&!c._topMsg){c._topMsg=true;labFeedback('⚠️ 变阻器接了"两上"接线柱，电阻≈0，相当于导线！','warn');}
      if(w.has('A')&&w.has('B')&&!w.has('C')&&!w.has('D')&&!c._botMsg){c._botMsg=true;labFeedback('ℹ️ 接了"两下"接线柱，变成20Ω定值电阻，滑片失效','warn');}
    },
    draw(c,ctx,S){
      const w=wiredSet(c,S);
      const mode=(w.has('C')||w.has('D'))?(w.has('A')||w.has('B')?'correct':'top'):(w.has('A')||w.has('B')?'bottom':'');
      drawRheostatReal(ctx,c.x,c.y,100,c.state.slide/100,mode,c.state.hot);
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText(c.state.burn?'💥 已烧断':'拖动滑片 P 改变电阻',c.x,c.y+30);}},
  resistor:{name:'定值电阻',icon:'⬛',hitR:{w:46,h:20},
    terms:[{id:'a',dx:-40,dy:0,c:'#c0c8d0'},{id:'b',dx:40,dy:0,c:'#c0c8d0'}],
    elems:c=>[{a:'a',b:'b',R:5}],
    draw(c,ctx){const e=c.io&&c.io.el[0];drawResistorReal(ctx,c.x,c.y,'5Ω',e&&e.P>4);}},
  coil:{name:'线圈(螺线管)',icon:'🌀',hitR:{w:74,h:40},
    terms:[{id:'a',dx:-62,dy:26,c:'#c0c8d0'},{id:'b',dx:62,dy:26,c:'#c0c8d0'}],
    init:()=>({core:true,turns:200,temp:25}),
    elems:c=>[{a:'a',b:'b',R:c.state.burn?1e9:2}],
    actions:[
      {dx:-34,dy:52,r:12,label:'芯',onClick:c=>{c.state.core=!c.state.core;Sfx.click();}},
      {dx:34,dy:52,r:12,label:'匝',onClick:c=>{c.state.turns=c.state.turns>=300?100:c.state.turns+100;Sfx.click();}}],
    onSolve(c,io,S){
      const I=Math.abs(io.el[0].I);
      if(I>2.5)c.state.temp=Math.min(600,c.state.temp+I*2);else c.state.temp=Math.max(25,c.state.temp-1.5);
      if(c.state.temp>320&&!c.state.burn){c.state.burn=true;S.smokes.push(makeSmoke(S.ctx,c.x,c.y));labFeedback('🔥 线圈过热烧毁！','danger');}
      c.io.B=I*c.state.turns*(c.state.core?0.0012:0.00012);
    },
    draw(c,ctx){
      ctx.strokeStyle=c.state.burn?'#443':(c.state.temp>150?'#ff8a50':'#e8a33d');ctx.lineWidth=3;
      for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(c.x-48+i*24,c.y,10,20,0,0,Math.PI*2);ctx.stroke();}
      if(c.state.core){ctx.fillStyle='#8a94a0';ctx.fillRect(c.x-58,c.y-8,116,16);
        ctx.fillStyle='#c8d0d8';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('铁芯',c.x,c.y+3);}
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText(c.state.burn?'💥 烧毁':`${c.state.turns}匝 ${c.state.core?'有':'无'}铁芯`,c.x,c.y-30);}},
  mcoil:{name:'转子线圈',icon:'🎡',hitR:{w:40,h:40},
    terms:[{id:'a',dx:-16,dy:38,c:'#c0c8d0'},{id:'b',dx:16,dy:38,c:'#c0c8d0'}],
    init:()=>({com:true}),
    elems:c=>[{a:'a',b:'b',R:c.state.burn?1e9:3}],
    actions:[{dx:0,dy:56,r:12,label:'换',onClick:c=>{c.state.com=!c.state.com;Sfx.click();}}],
    onSolve(c,io){c.io.I=io.el[0].I;
      if(Math.abs(io.el[0].I)>3&&!c.state.burn){c.state.burn=true;labFeedback('🔥 线圈电流过大烧毁！','danger');}},
    draw(c,ctx,S){
      const ang=(S.custom.ang||0);
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(ang);
      ctx.strokeStyle='#e8a33d';ctx.lineWidth=3;ctx.strokeRect(-26,-18,52,36);
      ctx.fillStyle='#ffd60a';ctx.font='9px sans-serif';ctx.textAlign='center';
      ctx.fillText('i',-26,-6);ctx.fillText('i',26,8);
      ctx.restore();
      // 换向器/滑环 + 电刷
      ctx.strokeStyle='#c0c8d0';ctx.lineWidth=2;
      if(c.state.com){ctx.beginPath();ctx.arc(c.x-6,c.y+28,6,Math.PI/2,Math.PI*1.5);ctx.stroke();
        ctx.beginPath();ctx.arc(c.x+6,c.y+28,6,-Math.PI/2,Math.PI/2);ctx.stroke();}
      else{ctx.beginPath();ctx.arc(c.x-6,c.y+28,6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(c.x+6,c.y+28,6,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle='#666';ctx.fillRect(c.x-18,c.y+34,8,6);ctx.fillRect(c.x+10,c.y+34,8,6);
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText(c.state.com?'换向器(半环)':'滑环(整环)',c.x,c.y+72);}},
  mains:{name:'进户线',icon:'⚡',hitR:{w:56,h:30},
    terms:[{id:'L',dx:44,dy:-8,c:'#ff5555'},{id:'N',dx:-44,dy:-8,c:'#4aa3ff'}],
    srcs:()=>[{a:'L',b:'N',V:220}],
    draw(c,ctx){
      ctx.fillStyle='#1a2a12';ctx.strokeStyle='#4a6a3a';ctx.lineWidth=2;
      ctx.beginPath();ctx.roundRect(c.x-56,c.y-22,112,44,6);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffd60a';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('~220V',c.x,c.y+5);
      ctx.fillStyle='#ff5555';ctx.beginPath();ctx.arc(c.x+44,c.y-8,4,0,Math.PI*2);ctx.fill();ctx.fillText('火',c.x+44,c.y+14);
      ctx.fillStyle='#4aa3ff';ctx.beginPath();ctx.arc(c.x-44,c.y-8,4,0,Math.PI*2);ctx.fill();ctx.fillText('零',c.x-44,c.y+14);}},
  kmeter:{name:'电能表',icon:'🔌',hitR:{w:50,h:36},
    terms:[{id:'Lin',dx:-48,dy:0,c:'#c0c8d0'},{id:'Lout',dx:48,dy:0,c:'#c0c8d0'}],
    elems:()=>[{a:'Lin',b:'Lout',R:0.02}],
    draw(c,ctx,S){const I=c.io&&c.io.el[0]?Math.abs(c.io.el[0].I):0;
      drawElectricMeter(ctx,c.x,c.y,220*I,S.t);}},
  fuse:{name:'保险丝',icon:'🧷',hitR:{w:36,h:18},
    terms:[{id:'a',dx:-25,dy:0,c:'#c0c8d0'},{id:'b',dx:25,dy:0,c:'#c0c8d0'}],
    elems:c=>[{a:'a',b:'b',R:c.state.burn?1e9:0.02}],
    onSolve(c,io,S){if(!c.state.burn&&Math.abs(io.el[0].I)>6){c.state.burn=true;S.sparks.push(makeSpark(S.ctx,c.x,c.y,'#ffd60a'));labFeedback('💥 电流过大，保险丝熔断！电路断开','danger');}},
    draw(c,ctx){
      ctx.strokeStyle='#8a94a0';ctx.lineWidth=2;ctx.strokeRect(c.x-25,c.y-8,50,16);
      ctx.strokeStyle=c.state.burn?'#333':'#ffd60a';ctx.lineWidth=2.5;
      if(c.state.burn){ctx.beginPath();ctx.moveTo(c.x-25,c.y);ctx.lineTo(c.x-4,c.y);ctx.moveTo(c.x+4,c.y);ctx.lineTo(c.x+25,c.y);ctx.stroke();
        ctx.fillStyle='#ff5555';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('已熔断',c.x,c.y-14);}
      else{ctx.beginPath();ctx.moveTo(c.x-25,c.y);ctx.lineTo(c.x+25,c.y);ctx.stroke();
        ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('保险丝 6A',c.x,c.y-14);}}},
  hlamp:{name:'电灯',icon:'💡',hitR:{w:30,h:42},
    terms:[{id:'a',dx:-16,dy:18,c:'#c0c8d0'},{id:'b',dx:16,dy:18,c:'#c0c8d0'}],
    elems:c=>[{a:'a',b:'b',R:c.state.burn?1e9:1210}],
    onSolve(c,io,S){if(!c.state.burn&&io.el[0].P>80){c.state.burn=true;labFeedback('💡 电灯烧坏！','danger');}},
    draw(c,ctx){const P=c.io&&c.io.el[0]?c.io.el[0].P:0;
      drawLampReal(ctx,c.x,c.y,!c.state.burn&&P>10,Math.min(1,P/40));
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('220V 40W',c.x,c.y+36);}},
  heater:{name:'电炉',icon:'♨️',hitR:{w:46,h:24},
    terms:[{id:'a',dx:-40,dy:0,c:'#c0c8d0'},{id:'b',dx:40,dy:0,c:'#c0c8d0'}],
    elems:()=>[{a:'a',b:'b',R:60}],
    draw(c,ctx){const P=c.io&&c.io.el[0]?c.io.el[0].P:0;const hot=P>200;
      ctx.fillStyle='#2a2f3a';ctx.strokeStyle='#556';ctx.lineWidth=2;
      ctx.beginPath();ctx.roundRect(c.x-44,c.y-14,88,28,6);ctx.fill();ctx.stroke();
      ctx.strokeStyle=hot?'#ff6a3a':'#7a6a5a';ctx.lineWidth=2.5;ctx.shadowColor=hot?'#ff5a2a':'transparent';ctx.shadowBlur=hot?10:0;
      ctx.beginPath();for(let i=0;i<6;i++){const px=c.x-30+i*12;ctx.moveTo(px,c.y-6);ctx.lineTo(px+6,c.y+6);}ctx.stroke();ctx.shadowBlur=0;
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('电炉 800W',c.x,c.y+28);}}
};
function wiredSet(c,S){
  const s=new Set();
  S.wires.forEach(w=>{if(w.burn)return;
    if(w.a.c===c.id)s.add(w.a.t);if(w.b.c===c.id)s.add(w.b.t);});
  return s;
}

/* ---------- 自由实验台引擎 ---------- */
function createFreeLab(wrap,cfg){
  wrap.innerHTML=`<div class="quiz-q">${cfg.title}</div>
  <div class="fl-toolbar" id="flTools"></div>
  <canvas class="lab-canvas fl-canvas" id="flCv" style="touch-action:none"></canvas>
  <div class="fl-tasks" id="flTasks"></div>
  <div class="lab-btn-row">
    ${cfg.demo?'<button class="btn-ghost" id="flDemo">✨ 示例电路</button>':''}
    <button class="btn-ghost" id="flClear">🗑️ 清空</button>
    ${cfg.probe?'<button class="btn-ghost" id="flPen">🖊️ 测电笔</button><button class="btn-ghost" id="flHand">💦 湿手摸</button>':''}
    <button class="btn-primary" id="flDone" style="flex:1">完成实验 ✓</button>
  </div>${labKbHTML(cfg.kbId)}`;
  bindLabKb(wrap,cfg.kbId);
  const cv=$('flCv'),ctx=cv.getContext('2d');
  cv.width=cv.clientWidth||600;cv.height=cfg.h||440;
  const S={comps:[],wires:[],nid:1,drag:null,wiring:null,actDrag:null,probeMode:'',shortFlag:false,
    tasksDone:{},allDone:false,t:0,custom:{},sparks:[],smokes:[],ctx,cv,cfg};
  /* 器材架 */
  const tb=$('flTools');
  cfg.tools.forEach(tool=>{
    const b=document.createElement('button');b.className='fl-tool';
    b.innerHTML=`${FL_DEFS[tool.t].icon} ${FL_DEFS[tool.t].name}`;
    b.onclick=()=>{
      const n=S.comps.filter(c=>c.type===tool.t).length;
      if(n>=(tool.max||3))return labFeedback('这种器材数量用完啦','warn');
      spawnComp(tool.t,cv.width/2+(Math.random()*120-60),80+Math.random()*60);
      Sfx.click();
    };
    tb.appendChild(b);
  });
  function spawnComp(type,x,y){
    const def=FL_DEFS[type];
    const c={id:'e'+(S.nid++),type,def,x:Math.max(60,Math.min(cv.width-60,x)),y:Math.max(50,Math.min(cv.height-70,y)),
      state:def.init?def.init():{},io:null};
    S.comps.push(c);return c;
  }
  function addWire(c1,t1,c2,t2){
    if(c1===c2&&t1===t2)return;
    const dup=S.wires.some(w=>!w.burn&&((w.a.c===c1&&w.a.t===t1&&w.b.c===c2&&w.b.t===t2)||(w.a.c===c2&&w.a.t===t2&&w.b.c===c1&&w.b.t===t1)));
    if(dup)return;
    S.wires.push({a:{c:c1,t:t1},b:{c:c2,t:t2},hot:0,burn:false});
  }
  function termPos(ref){const c=S.comps.find(x=>x.id===ref.c);const t=c.def.terms.find(t=>t.id===ref.t);
    return {x:c.x+t.dx,y:c.y+t.dy};}
  function hitTerm(p){
    for(const c of S.comps)for(const t of c.def.terms){
      const dx=p.x-(c.x+t.dx),dy=p.y-(c.y+t.dy);
      if(dx*dx+dy*dy<256)return{c:c.id,t:t.id};
    }return null;
  }
  function hitComp(p){
    for(let i=S.comps.length-1;i>=0;i--){const c=S.comps[i];
      if(Math.abs(p.x-c.x)<c.def.hitR.w&&Math.abs(p.y-c.y)<c.def.hitR.h)return c;
    }return null;
  }
  function hitAction(p){
    for(const c of S.comps){if(!c.def.actions)continue;
      for(const a of c.def.actions){const dx=p.x-(c.x+a.dx),dy=p.y-(c.y+a.dy);
        if(dx*dx+dy*dy<a.r*a.r)return{c,a};
      }}return null;
  }
  function wirePoint(w,t){
    const p1=termPos(w.a),p2=termPos(w.b);
    const mx=(p1.x+p2.x)/2,my=Math.max(p1.y,p2.y)+36;
    return {x:(1-t)*(1-t)*p1.x+2*(1-t)*t*mx+t*t*p2.x,y:(1-t)*(1-t)*p1.y+2*(1-t)*t*my+t*t*p2.y};
  }
  function hitWire(p){
    for(const w of S.wires){if(w.burn)continue;
      for(let t=0;t<=1;t+=0.05){const q=wirePoint(w,t);
        if((q.x-p.x)**2+(q.y-p.y)**2<100)return w;
      }}return null;
  }
  /* ---------- 指针交互 ---------- */
  function pos(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
  cv.onpointerdown=e=>{
    e.preventDefault();const p=pos(e);cv.setPointerCapture(e.pointerId);
    if(S.probeMode){probeAt(p);return;}
    const ht=hitTerm(p);
    if(ht){S.wiring={from:ht,x:p.x,y:p.y};return;}
    const ha=hitAction(p);
    if(ha){if(ha.a.drag){S.actDrag=ha;}else{ha.a.onClick(ha.c,S);}return;}
    const hc=hitComp(p);
    if(hc){S.drag={c:hc,dx:p.x-hc.x,dy:p.y-hc.y,moved:false};return;}
    const hw=hitWire(p);
    if(hw){
      if(S.selWire===hw){hw.burn=true;S.selWire=null;labFeedback('已拆除这根导线','ok');}
      else{S.selWire=hw;labFeedback('已选中导线，再点一次拆除','info');}
      return;
    }
    S.selWire=null;
  };
  cv.onpointermove=e=>{
    const p=pos(e);
    if(S.wiring){S.wiring.x=p.x;S.wiring.y=p.y;return;}
    if(S.actDrag){S.actDrag.a.onDrag(S.actDrag.c,p,S);return;}
    if(S.drag){S.drag.c.x=Math.max(30,Math.min(cv.width-30,p.x-S.drag.dx));
      S.drag.c.y=Math.max(30,Math.min(cv.height-30,p.y-S.drag.dy));S.drag.moved=true;}
  };
  cv.onpointerup=e=>{
    const p=pos(e);
    if(S.wiring){
      const ht=hitTerm(p);
      if(ht&&!(ht.c===S.wiring.from.c&&ht.t===S.wiring.from.t)){
        addWire(S.wiring.from.c,S.wiring.from.t,ht.c,ht.t);Sfx.click();
      }
      S.wiring=null;return;
    }
    if(S.actDrag){S.actDrag=null;return;}
    if(S.drag){
      if(!S.drag.moved&&S.drag.c.def.onClick){S.drag.c.def.onClick(S.drag.c,S);
        if(S.drag.c.type==='battery')S.custom.flipped=true;}
      S.drag=null;
    }
  };
  cv.onpointercancel=()=>{S.drag=null;S.wiring=null;S.actDrag=null;};
  /* ---------- 测电笔/湿手 ---------- */
  function probeAt(p){
    let ht=hitTerm(p),nodeRef=null;
    if(ht)nodeRef=ht;
    else{const hw=hitWire(p);if(hw)nodeRef=hw.a;}
    if(!nodeRef){labFeedback('这里没碰到导体哦','info');return;}
    if(!S.nodeV){labFeedback('先接好电路再测','info');return;}
    const V=S.nodeV(nodeRef.c,nodeRef.t);
    if(S.probeMode==='pen'){
      if(V>150){labFeedback('💡 氖管发光！这是火线','ok');S.custom.foundLive=true;}
      else if(V<50)labFeedback('氖管不亮——这是零线（或没接通）','info');
      else labFeedback('氖管微亮？电压异常，检查接线','warn');
    }else if(S.probeMode==='wet'){
      if(V>150){labFeedback('⚡ 触电！湿手电阻小，大电流通过人体，非常危险！','danger');S.custom.shocked=true;Sfx.wrong();}
      else labFeedback('摸到零线，没事——但湿手操作本身就是坏习惯','warn');
    }
  }
  if(cfg.probe){
    $('flPen').onclick=()=>{S.probeMode=S.probeMode==='pen'?'':'pen';
      $('flPen').classList.toggle('active',S.probeMode==='pen');$('flHand').classList.remove('active');
      if(S.probeMode==='pen')labFeedback('测电笔模式：点击导线/接线柱辨别火零线','info');};
    $('flHand').onclick=()=>{S.probeMode=S.probeMode==='wet'?'':'wet';
      $('flHand').classList.toggle('active',S.probeMode==='wet');$('flPen').classList.remove('active');
      if(S.probeMode==='wet')labFeedback('湿手模式：点击带电导体会触电！','warn');};
  }
  /* ---------- 电路求解（节点电压法） ---------- */
  function solve(){
    const parent={};
    const find=k=>{while(parent[k]!==k){parent[k]=parent[parent[k]];k=parent[k];}return k;};
    const uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[a]=b;};
    const elems=[],srcs=[];
    S.comps.forEach(c=>{
      c.def.terms.forEach(t=>{parent[c.id+':'+t.id]=c.id+':'+t.id;});
      (c.def.elems?c.def.elems(c,S):[]).forEach(el=>{
        [el.a,el.b].forEach(t=>{const k=c.id+':'+t;if(!(k in parent))parent[k]=k;});
        elems.push({c,el});});
      (c.def.srcs?c.def.srcs(c,S):[]).forEach(s=>{
        [s.a,s.b].forEach(t=>{const k=c.id+':'+t;if(!(k in parent))parent[k]=k;});
        srcs.push({c,s});});
    });
    S.wires.forEach(w=>{if(!w.burn)uni(w.a.c+':'+w.a.t,w.b.c+':'+w.b.t);});
    const nodeIdx={};let nNodes=0;
    Object.keys(parent).forEach(k=>{const r=find(k);if(!(r in nodeIdx))nodeIdx[r]=nNodes++;});
    const nOf=(cid,t)=>nodeIdx[find(cid+':'+t)];
    let g=0;if(srcs.length)g=nOf(srcs[0].c.id,srcs[0].s.b);
    const uIdx={};let N=0;
    for(let i=0;i<nNodes;i++){if(i===g)continue;uIdx[i]=N++;}
    const M=srcs.length,A=[],b=[];
    for(let i=0;i<N+M;i++){A.push(new Float64Array(N+M));b.push(0);}
    for(let i=0;i<nNodes;i++){if(i!==g)A[uIdx[i]][uIdx[i]]+=1e-6;}
    elems.forEach(({c,el})=>{
      const na=nOf(c.id,el.a),nb=nOf(c.id,el.b),g2=1/Math.max(el.R,1e-6);
      if(na!==g)A[uIdx[na]][uIdx[na]]+=g2;
      if(nb!==g)A[uIdx[nb]][uIdx[nb]]+=g2;
      if(na!==g&&nb!==g){A[uIdx[na]][uIdx[nb]]-=g2;A[uIdx[nb]][uIdx[na]]-=g2;}
    });
    srcs.forEach(({c,s},k)=>{
      const np=nOf(c.id,s.a),nn=nOf(c.id,s.b),row=N+k;
      if(np!==g){A[uIdx[np]][row]+=1;A[row][uIdx[np]]+=1;}
      if(nn!==g){A[uIdx[nn]][row]-=1;A[row][uIdx[nn]]-=1;}
      b[row]=s.V;
    });
    const x=gaussSolve(A,b,N+M);
    const Vn=n=>n===g?0:x[uIdx[n]];
    S.comps.forEach(c=>c.io={el:[]});
    elems.forEach(({c,el})=>{
      const va=Vn(nOf(c.id,el.a)),vb=Vn(nOf(c.id,el.b));
      const I=(va-vb)/Math.max(el.R,1e-6);
      c.io.el.push({a:el.a,b:el.b,I,V:va-vb,P:I*I*el.R});
    });
    srcs.forEach(({c,s},k)=>{c.io.srcI=-x[N+k];});
    S.nodeV=(cid,t)=>{try{return Vn(nOf(cid,t));}catch(e){return 0;}};
    S.comps.forEach(c=>{if(c.def.onSolve)c.def.onSolve(c,c.io,S);});
    /* 短路后果 */
    srcs.forEach(({c})=>{
      const lim=c.type==='mains'?25:8;
      if(Math.abs(c.io.srcI)>lim){
        S.shortFlag=true;
        if(!S._sm||S.t-S._sm>90){S._sm=S.t;labFeedback('⚡ 短路！电流剧增，导线急剧发热！','danger');}
        S.sparks.push(makeSpark(ctx,c.x,c.y-20,'#ffd60a'));
        S.wires.forEach(w=>{if(!w.burn)w.hot=Math.min(600,w.hot+Math.abs(c.io.srcI)*1.5);});
        const w=S.wires.find(w=>!w.burn&&w.hot>320);
        if(w){w.burn=true;S.smokes.push(makeSmoke(ctx,(termPos(w.a).x+termPos(w.b).x)/2,(termPos(w.a).y+termPos(w.b).y)/2));labFeedback('🔥 导线烧断了！电路断路','danger');}
      }
    });
    S.wires.forEach(w=>{if(!S.shortFlag||Math.random()<0.5)w.hot=Math.max(0,w.hot-2);});
  }
  /* ---------- 任务卡 ---------- */
  function renderTasks(){
    $('flTasks').innerHTML=cfg.tasks.map((t,i)=>
      `<div class="fl-task${S.tasksDone[i]?' done':''}" id="flTask${i}">${S.tasksDone[i]?'✅':'⬜'} 任务${i+1}：${t.text}</div>`).join('');
  }
  renderTasks();
  function evalTasks(){
    cfg.tasks.forEach((t,i)=>{
      if(S.tasksDone[i])return;
      let ok=false;try{ok=t.check(S);}catch(e){}
      if(ok){S.tasksDone[i]=true;renderTasks();Sfx.correct();labFeedback('✅ 任务完成：'+t.text,'ok');}
    });
    if(!S.allDone&&cfg.tasks.every((t,i)=>S.tasksDone[i])){
      S.allDone=true;Sfx.win();labFeedback('🎉 全部任务完成！点击「完成实验」过关','ok');
    }
  }
  /* ---------- 按钮 ---------- */
  if(cfg.demo)$('flDemo').onclick=()=>{S.comps=[];S.wires=[];S.shortFlag=false;cfg.demo(S,spawnComp,addWire);labFeedback('已摆出示例电路，观察后可以自己动手改','ok');};
  $('flClear').onclick=()=>{S.comps=[];S.wires=[];S.shortFlag=false;S.custom={};labFeedback('台面已清空，自由搭建吧','ok');};
  $('flDone').onclick=()=>labDone();
  /* ---------- 主循环 ---------- */
  function draw(){
    if(!cv.isConnected)return;
    S.t++;
    ctx.clearRect(0,0,cv.width,cv.height);
    try{solve();}catch(e){console.error('solve error',e);}
    /* 导线 */
    S.wires.forEach(w=>{
      const p1=termPos(w.a),p2=termPos(w.b);
      const mx=(p1.x+p2.x)/2,my=Math.max(p1.y,p2.y)+36;
      if(w.burn){
        ctx.strokeStyle='#333';ctx.lineWidth=2.5;ctx.setLineDash([5,5]);
        ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.quadraticCurveTo(mx,my,p2.x,p2.y);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#ff5555';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('✕',mx,my+4);
        return;
      }
      const hot=w.hot>150;
      ctx.strokeStyle=w===S.selWire?'#ffd60a':hot?`rgb(255,${Math.max(60,200-w.hot*0.4)},0)`:'#00e5ff';
      ctx.lineWidth=w===S.selWire?4:2.5;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=hot?10:5;
      ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.quadraticCurveTo(mx,my,p2.x,p2.y);ctx.stroke();ctx.shadowBlur=0;
    });
    /* 器材 */
    S.comps.forEach(c=>{c.def.draw(c,ctx,S);});
    /* 接线柱 */
    S.comps.forEach(c=>c.def.terms.forEach(t=>{
      const x=c.x+t.dx,y=c.y+t.dy;
      let glow=false;
      if(S.wiring){const dx=x-S.wiring.x,dy=y-S.wiring.y;glow=dx*dx+dy*dy<256&&!(S.wiring.from.c===c.id&&S.wiring.from.t===t.id);}
      ctx.fillStyle=glow?'#39ff14':(t.c||'#c0c8d0');
      ctx.shadowColor=glow?'#39ff14':'transparent';ctx.shadowBlur=glow?10:0;
      ctx.beginPath();ctx.arc(x,y,glow?6:3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }));
    /* 拉线预览 */
    if(S.wiring){
      const p1=termPos(S.wiring.from);
      ctx.strokeStyle='rgba(57,255,20,0.8)';ctx.lineWidth=2.5;ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(S.wiring.x,S.wiring.y);ctx.stroke();ctx.setLineDash([]);
    }
    /* 操作按钮（滑片等） */
    S.comps.forEach(c=>{(c.def.actions||[]).forEach(a=>{
      ctx.fillStyle='rgba(0,229,255,0.15)';ctx.strokeStyle='rgba(0,229,255,0.5)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(c.x+a.dx,c.y+a.dy,a.r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#00e5ff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(a.label,c.x+a.dx,c.y+a.dy+3);
    });});
    /* 粒子 */
    S.sparks=S.sparks.filter(p=>p.life>0);S.smokes=S.smokes.filter(p=>p.life>0);
    S.sparks.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.03;
      ctx.strokeStyle=p.c;ctx.globalAlpha=p.life;ctx.lineWidth=p.r;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*2,p.y-p.vy*2);ctx.stroke();ctx.globalAlpha=1;});
    S.smokes.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.008;p.r+=0.3;
      ctx.fillStyle=`rgba(120,120,120,${p.life*0.3})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});
    /* 额外绘制（磁场/磁铁等） */
    if(cfg.drawExtra)cfg.drawExtra(ctx,S);
    if(S.t%12===0)evalTasks();
    labRaf=requestAnimationFrame(draw);
  }
  draw();
}

/* ============ 实验2：串并联电路（自由搭建） ============ */
function labCircuit(wrap){
  createFreeLab(wrap,{
    kbId:'circuit',
    title:'💡 串并联电路 · 自由搭建 — 拖器材、拉导线，接出你的电路',
    tools:[{t:'battery',max:1},{t:'switch',max:2},{t:'lamp',max:3},{t:'ammeter',max:1}],
    tasks:[
      {text:'让小灯泡发光（电源+开关+灯泡接成闭合回路）',check:S=>S.comps.some(c=>c.type==='lamp'&&c.io&&c.io.el[0]&&c.io.el[0].P>0.5)},
      {text:'让两个灯泡串联都发光（电流只有一条路）',check:S=>{const L=S.comps.filter(c=>c.type==='lamp'&&c.io&&c.io.el[0]);
        return L.length>=2&&L.every(l=>l.io.el[0].P>0.3&&l.io.el[0].P<3)&&Math.abs(L[0].io.el[0].I-L[1].io.el[0].I)<0.02&&L[0].io.el[0].I>0.15;}},
      {text:'改成并联，两灯都亮且各自更亮（互不影响）',check:S=>{const L=S.comps.filter(c=>c.type==='lamp'&&c.io&&c.io.el[0]);
        return L.length>=2&&L.every(l=>Math.abs(l.io.el[0].V)>4.2&&l.io.el[0].P>3);}},
      {text:'用电流表测出电流（串入电路，正进负出）',check:S=>S.comps.some(c=>c.type==='ammeter'&&c.io&&c.io.reading>0.05&&!c.io.rev)},
      {text:'制造一次短路，观察真实后果（别怕，可以清空重来）',check:S=>S.shortFlag}
    ],
    demo(S,sp,aw){
      const W=S.cv.width;
      const bat=sp('battery',W*0.15,120),sw=sp('switch',W*0.38,70),l1=sp('lamp',W*0.62,70),l2=sp('lamp',W*0.62,300);
      sw.state.on=true;
      aw(bat.id,'+',sw.id,'a');aw(sw.id,'b',l1.id,'a');aw(l1.id,'b',l2.id,'a');aw(l2.id,'b',bat.id,'-');
      labFeedback('这是串联示例：电流依次经过两灯。试试改成并联！','info');
    }
  });
}

/* ============ 实验3：伏安法测电阻（自由搭建） ============ */
function labOhm(wrap){
  createFreeLab(wrap,{
    kbId:'ohm',
    title:'📐 伏安法测电阻 · 自由搭建 — 注意电表极性、量程与变阻器接法',
    tools:[{t:'battery',max:1},{t:'switch',max:1},{t:'rheostat',max:1},{t:'resistor',max:1},{t:'ammeter',max:1},{t:'voltmeter',max:1}],
    tasks:[
      {text:'接出测量电路：电流表串联、电压表并在电阻两端',check:S=>{
        const A=S.comps.find(c=>c.type==='ammeter'),V=S.comps.find(c=>c.type==='voltmeter'),R=S.comps.find(c=>c.type==='resistor');
        if(!A||!V||!R||!A.io||!V.io||!R.io)return false;
        return A.io.reading>0.05&&V.io.reading>0.2&&Math.abs(Math.abs(R.io.el[0].V)-V.io.reading)<0.8;}},
      {text:'电表都正向偏转（正进负出，没接反）',check:S=>{
        const A=S.comps.find(c=>c.type==='ammeter'),V=S.comps.find(c=>c.type==='voltmeter');
        return A&&V&&A.io&&V.io&&A.io.reading>0.05&&!A.io.rev&&V.io.reading>0.2&&!V.io.rev;}},
      {text:'用变阻器改变电流（接"一上一下"，拖滑片）',check:S=>{
        const R=S.comps.find(c=>c.type==='rheostat');if(!R||!R.io)return false;
        const w=wiredSet(R,S);const Ip=Math.abs(R.io.el[2].I)+Math.abs(R.io.el[3].I);
        return (w.has('A')||w.has('B'))&&(w.has('C')||w.has('D'))&&R.state.slide<100&&Ip>0.05;}},
      {text:'体验一次指针反偏（把某个电表接反看看）',check:S=>S.comps.some(c=>(c.type==='ammeter'||c.type==='voltmeter')&&c.io&&c.io.rev&&c.io.reading>0.02)},
      {text:'制造一次"两上"接法或超量程的后果',check:S=>{const R=S.comps.find(c=>c.type==='rheostat');
        return (R&&(R._topMsg||R.state.burn))||S.comps.some(c=>(c.type==='ammeter'||c.type==='voltmeter')&&(c.io&&c.io.over||c.state.burn));}}
    ],
    demo(S,sp,aw){
      const W=S.cv.width;
      const bat=sp('battery',W*0.12,120),sw=sp('switch',W*0.28,70),am=sp('ammeter',W*0.48,70),rh=sp('rheostat',W*0.75,110),rs=sp('resistor',W*0.48,300),vm=sp('voltmeter',W*0.48,185);
      sw.state.on=true;
      aw(bat.id,'+',sw.id,'a');aw(sw.id,'b',am.id,'hi');aw(am.id,'com',rh.id,'A');aw(rh.id,'C',rs.id,'a');aw(rs.id,'b',bat.id,'-');
      aw(vm.id,'v3',rs.id,'a');aw(vm.id,'com',rs.id,'b');
      labFeedback('标准伏安法电路：电流表串联、电压表并联、变阻器一上一下','ok');
    }
  });
}

/* ============ 实验4：家庭电路（自由搭建） ============ */
function labHome(wrap){
  createFreeLab(wrap,{
    kbId:'home',probe:true,
    title:'🏠 家庭电路 · 自由布线 — 火线要经过电能表、总开关、保险丝',
    tools:[{t:'mains',max:1},{t:'kmeter',max:1},{t:'switch',max:1},{t:'fuse',max:2},{t:'hlamp',max:2},{t:'heater',max:1}],
    tasks:[
      {text:'让电灯亮起来，且电流经过电能表和保险丝',check:S=>{
        const L=S.comps.find(c=>c.type==='hlamp'),K=S.comps.find(c=>c.type==='kmeter'),F=S.comps.find(c=>c.type==='fuse');
        return L&&K&&F&&L.io&&K.io&&F.io&&L.io.el[0].P>20&&Math.abs(K.io.el[0].I)>0.08&&Math.abs(F.io.el[0].I)>0.08;}},
      {text:'再并入电炉，看电能表转盘明显变快（用电器并联）',check:S=>{
        const H=S.comps.find(c=>c.type==='heater');return H&&H.io&&H.io.el[0].P>300;}},
      {text:'用测电笔找出火线（点🖊️测电笔，再点导线）',check:S=>S.custom.foundLive},
      {text:'体验保险丝熔断（短接或用电器过载）',check:S=>S.comps.some(c=>c.type==='fuse'&&c.state.burn)}
    ],
    demo(S,sp,aw){
      const W=S.cv.width;
      const m=sp('mains',W*0.13,110),k=sp('kmeter',W*0.35,80),sw=sp('switch',W*0.58,80),f=sp('fuse',W*0.78,80),L=sp('hlamp',W*0.5,280);
      sw.state.on=true;
      aw(m.id,'L',k.id,'Lin');aw(k.id,'Lout',sw.id,'a');aw(sw.id,'b',f.id,'a');aw(f.id,'b',L.id,'a');aw(L.id,'b',m.id,'N');
      labFeedback('标准接法：火线→电能表→总开关→保险丝→用电器','ok');
    }
  });
}

/* ============ 实验5：电磁铁（自由搭建） ============ */
function labMagnet(wrap){
  createFreeLab(wrap,{
    kbId:'magnet',
    title:'🧲 电磁铁 · 自由搭建 — 通电生磁，探究磁性强弱的影响因素',
    tools:[{t:'battery',max:1},{t:'switch',max:1},{t:'rheostat',max:1},{t:'coil',max:1}],
    tasks:[
      {text:'接通电路让线圈通电（小磁针偏转）',check:S=>{const c=S.comps.find(x=>x.type==='coil');return c&&c.io&&Math.abs(c.io.el[0].I)>0.2;}},
      {text:'拖滑片改变电流，观察磁性随之变化',check:S=>{const c=S.comps.find(x=>x.type==='coil'),r=S.comps.find(x=>x.type==='rheostat');
        return c&&r&&c.io&&r.state.slide<95&&Math.abs(c.io.el[0].I)>0.2;}},
      {text:'点线圈的「芯」按钮插入铁芯，回形针被大量吸起',check:S=>{const c=S.comps.find(x=>x.type==='coil');return c&&c.io&&c.state.core&&c.io.B>0.15;}},
      {text:'点电池盒翻转正负极，看小磁针反向偏转',check:S=>{const c=S.comps.find(x=>x.type==='coil');return S.custom.flipped&&c&&c.io&&Math.abs(c.io.el[0].I)>0.1;}}
    ],
    demo(S,sp,aw){
      const W=S.cv.width;
      const bat=sp('battery',W*0.13,120),sw=sp('switch',W*0.32,70),rh=sp('rheostat',W*0.6,80),co=sp('coil',W*0.42,300);
      sw.state.on=true;
      aw(bat.id,'+',sw.id,'a');aw(sw.id,'b',rh.id,'A');aw(rh.id,'C',co.id,'a');aw(co.id,'b',bat.id,'-');
    },
    drawExtra(ctx,S){
      const W=S.cv.width,c=S.comps.find(x=>x.type==='coil');
      const I=c&&c.io?c.io.el[0].I:0,B=c&&c.io?c.io.B:0;
      /* 小磁针 */
      const cxp=W*0.8,cyp=110;
      const ang=Math.abs(I)>0.05?(I>0?0:Math.PI):Math.PI/4;
      drawCompassNeedle(ctx,cxp,cyp,ang);
      ctx.fillStyle='#8aa0c8';ctx.font='10px sans-serif';ctx.textAlign='center';
      ctx.fillText('小磁针',cxp,cyp+36);
      /* 磁场线 */
      if(c&&Math.abs(I)>0.05){
        ctx.strokeStyle=`rgba(0,229,255,${Math.min(0.6,Math.abs(I)*0.25)})`;ctx.lineWidth=1.5;
        for(let i=-1;i<=1;i++){
          ctx.beginPath();ctx.ellipse(c.x,c.y,90+i*16,44+i*14,0,0,Math.PI*2);ctx.stroke();
          const dir=I>0?1:-1,ax=c.x+dir*(90+i*16);
          ctx.fillStyle=ctx.strokeStyle;
          ctx.beginPath();ctx.moveTo(ax,c.y);ctx.lineTo(ax-dir*8,c.y-4);ctx.lineTo(ax-dir*8,c.y+4);ctx.closePath();ctx.fill();
        }
        /* 回形针 */
        const n=Math.min(8,Math.floor(B/0.06));
        for(let i=0;i<n;i++){
          ctx.strokeStyle='#c0c8d0';ctx.lineWidth=2;
          const px=c.x-40+i*12,py=c.y+34+(i%2)*6;
          ctx.strokeRect(px,py,7,11);
        }
        if(n>0){ctx.fillStyle='#39ff14';ctx.font='11px sans-serif';ctx.textAlign='center';
          ctx.fillText(`吸起 ${n} 枚回形针`,c.x,c.y+64);}
      }
    }
  });
}

/* ============ 实验6：电动机（自由搭建） ============ */
function labMotor(wrap){
  createFreeLab(wrap,{
    kbId:'motor',h:460,
    title:'⚙️ 电动机 · 自由搭建 — 让磁场中的线圈转起来',
    tools:[{t:'battery',max:1},{t:'switch',max:1},{t:'mcoil',max:1}],
    tasks:[
      {text:'把线圈放进磁场并接通电路，让它持续转起来',check:S=>S.custom.spinning},
      {text:'点电池盒翻转电流方向，观察转向改变',check:S=>S.custom.flipped&&S.custom.spinning},
      {text:'点线圈「换」按钮切成滑环（无换向器），看线圈卡住',check:S=>{const c=S.comps.find(x=>x.type==='mcoil');return c&&!c.state.com&&S.custom.stuck;}}
    ],
    demo(S,sp,aw){
      const W=S.cv.width,H=S.cv.height;
      const bat=sp('battery',W*0.14,110),sw=sp('switch',W*0.36,70);
      const co=sp('mcoil',W*0.68,H*0.42);
      sw.state.on=true;
      aw(bat.id,'+',sw.id,'a');aw(sw.id,'b',co.id,'a');aw(co.id,'b',bat.id,'-');
    },
    drawExtra(ctx,S){
      const W=S.cv.width,H=S.cv.height;
      const mx=W*0.68,my=H*0.42;
      /* 蹄形磁铁 */
      ctx.fillStyle='#c0392b';ctx.fillRect(mx-70,my-64,26,52);
      ctx.fillStyle='#2980b9';ctx.fillRect(mx+44,my-64,26,52);
      ctx.fillStyle='#7f8c8d';ctx.fillRect(mx-70,my-80,140,20);
      ctx.fillStyle='#fff';ctx.font='bold 13px sans-serif';ctx.textAlign='center';
      ctx.fillText('N',mx-57,my-34);ctx.fillText('S',mx+57,my-34);
      /* 磁感线 */
      ctx.strokeStyle='rgba(255,214,10,0.5)';ctx.lineWidth=1.5;
      for(let i=0;i<4;i++){const ly=my-24+i*16;
        ctx.beginPath();ctx.moveTo(mx-44,ly);ctx.lineTo(mx+44,ly);ctx.stroke();
        ctx.fillStyle='rgba(255,214,10,0.7)';
        ctx.beginPath();ctx.moveTo(mx+10,ly);ctx.lineTo(mx+3,ly-3);ctx.lineTo(mx+3,ly+3);ctx.closePath();ctx.fill();}
      /* 转动物理 */
      const co=S.comps.find(x=>x.type==='mcoil');
      if(!co)return;
      const I=co.io?co.io.I:0;
      const near=Math.abs(co.x-mx)<90&&Math.abs(co.y-my)<70;
      const cst=S.custom;
      cst.ang=cst.ang||0;cst.vel=cst.vel||0;
      if(Math.abs(I)>0.05&&near&&!co.state.burn){
        const k=0.0016*Math.abs(I)*(co.state.flip?-1:1)*(I>0?1:-1);
        if(co.state.com){cst.vel+=Math.abs(k*Math.cos(cst.ang))*Math.sign(cst.vel||k);}
        else{cst.vel+=k*Math.cos(cst.ang);}
      }
      cst.vel*=0.985;cst.ang+=cst.vel;
      cst.spinning=Math.abs(cst.vel)>0.03;
      if(!co.state.com&&Math.abs(I)>0.05&&near&&Math.abs(cst.vel)<0.005){
        if(Math.abs(Math.cos(cst.ang))<0.15){cst.stuck=true;}
      }else cst.stuck=false;
      if(Math.abs(I)>0.05&&!near&&!cst._farMsg){cst._farMsg=true;labFeedback('线圈不在磁场中，不受磁力——把它拖到磁铁两极之间','warn');}
      if(Math.abs(I)<0.05)cst._farMsg=false;
      ctx.fillStyle='#8aa0c8';ctx.font='11px sans-serif';ctx.textAlign='center';
      ctx.fillText(cst.spinning?'⚙️ 持续转动中':(cst.stuck?'⚡ 停在平衡位置（无换向器）':''),mx,my+110);
    }
  });
}

/* ============ 实验1：摩擦起电（自由拖拽·无导线） ============ */
function labStatic(wrap){
  wrap.innerHTML=`<div class="quiz-q">🧲 静电实验室 · 自由拖拽 — 用丝绸摩擦玻璃棒、毛皮摩擦橡胶棒，试试不同配对结果一样吗？</div>
  <canvas class="lab-canvas fl-canvas" id="flCv" style="touch-action:none"></canvas>
  <div class="fl-tasks" id="flTasks"></div>
  <div class="lab-btn-row"><button class="btn-ghost" id="flReset">🔄 重置</button>
  <button class="btn-primary" id="flDone" style="flex:1">完成实验 ✓</button></div>
  ${labKbHTML('static')}`;
  bindLabKb(wrap,'static');
  const cv=$('flCv'),ctx=cv.getContext('2d');
  cv.width=cv.clientWidth||600;cv.height=440;
  const W=cv.width,H=cv.height;
  /* 摩擦起电序列（triboelectric series）：数值越大越容易失去电子。
     摩擦时电子总是从数值大的材料转移到数值小的材料；
     两者数值越接近起电越弱，数值相同则不起电。
     教材标准配对：玻璃+丝绸→玻璃带正电；毛皮+橡胶→橡胶带负电。 */
  const TRIBO={fur:5,glass:4,silk:1,cotton:0,rubber:-2,pvc:-4};
  const rods=[
    {type:'glass',name:'玻璃棒',x:W*0.16,y:80,charge:0,c:'#ffe4a0'},
    {type:'rubber',name:'橡胶棒',x:W*0.16,y:150,charge:0,c:'#4a3a2a'},
    {type:'pvc',name:'PVC管',x:W*0.16,y:220,charge:0,c:'#3a5a8a'}
  ];
  const cloths=[
    {type:'silk',name:'丝绸',x:W*0.1,y:H-70,c:'#ff99cc',pair:'glass'},
    {type:'fur',name:'毛皮',x:W*0.24,y:H-70,c:'#8B4513',pair:'rubber'},
    {type:'cotton',name:'棉布',x:W*0.38,y:H-70,c:'#dddddd',pair:'pvc'}
  ];
  const esc={x:W*0.7,y:H*0.4};
  const pile={x:W*0.45,y:H*0.82};
  const clip={x:W*0.9,y:H*0.8};
  const papers=[];for(let i=0;i<12;i++)papers.push({x:pile.x+(Math.random()*40-20),y:pile.y+(Math.random()*14-7),stuck:null,seed:Math.random()*6});
  let drag=null,foilQ=0,t=0;
  let rubTip={key:'',t:0}; // 摩擦电子转移提示的节流状态
  const custom={};
  const tasks=[
    {text:'按住棒在布料上快速摩擦，再靠近验电器让箔片张开',check:()=>foilAngle()>8},
    {text:'感应起电：棒靠近箔片张开，移开后会合拢',check:()=>custom.induct},
    {text:'接触起电：棒接触金属球后移开，箔片保持张开',check:()=>custom.contact},
    {text:'用带电棒吸起纸屑',check:()=>papers.some(p=>p.stuck)},
    {text:'拖动接地夹碰金属球，把电荷导入大地',check:()=>custom.grounded}
  ];
  function renderTasks(){$('flTasks').innerHTML=tasks.map((tk,i)=>
    `<div class="fl-task${custom['t'+i]?' done':''}">${custom['t'+i]?'✅':'⬜'} 任务${i+1}：${tk.text}</div>`).join('');}
  renderTasks();
  let wasNear=false,wasTouch=false;
  function foilAngle(){
    let q=Math.abs(foilQ);
    rods.forEach(r=>{const d=Math.hypot(r.x+30-esc.x,r.y-esc.y);
      if(d<70)q+=Math.abs(r.charge);});
    return Math.min(60,q*0.6);
  }
  function pos(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  cv.onpointerdown=e=>{
    e.preventDefault();const p=pos(e);cv.setPointerCapture(e.pointerId);
    for(const r of rods)if(Math.abs(p.x-r.x)<45&&Math.abs(p.y-r.y)<12){drag={o:r,dx:p.x-r.x,dy:p.y-r.y,lx:p.x,ly:p.y};return;}
    if(Math.hypot(p.x-clip.x,p.y-clip.y)<24){drag={o:clip,dx:p.x-clip.x,dy:p.y-clip.y,clip:true,lx:p.x,ly:p.y};return;}
  };
  cv.onpointermove=e=>{
    if(!drag)return;const p=pos(e);
    const o=drag.o;o.x=Math.max(30,Math.min(W-50,p.x-drag.dx));o.y=Math.max(20,Math.min(H-20,p.y-drag.dy));
    const mdx=p.x-drag.lx,mdy=p.y-drag.ly;drag.lx=p.x;drag.ly=p.y;
    if(!drag.clip){
      // 取距离最近的一块布（三块布的感应区边缘有重叠，避免一帧同时算两块）
      let nearCloth=null,nearD=55;
      for(const cl of cloths){const d=Math.hypot(o.x-cl.x,o.y-cl.y);if(d<nearD){nearD=d;nearCloth=cl;}}
      if(nearCloth&&Math.abs(mdx)>0.5){
        // 只有真正"来回蹭"（水平方向反转，构成一个摩擦行程）才转移电子；
        // 单向滑过布料（例如拿棒去验电器途中经过）不算摩擦，不起电
        const dir=Math.sign(mdx);
        drag.stroke=(drag.stroke||0)+Math.hypot(mdx,mdy);
        if(drag.lastDir!=null&&dir!==drag.lastDir){
          const stroke=drag.stroke;drag.stroke=0;
          // 电荷方向与强弱只由两种材料在摩擦起电序列中的相对位置决定
          const diff=TRIBO[o.type]-TRIBO[nearCloth.type]; // >0：棒比布易失电子→棒带正电
          if(diff!==0){                           // 得失电子本领相同→不起电
            o.charge=Math.max(-100,Math.min(100,o.charge+(diff>0?1:-1)*0.07*Math.abs(diff)*stroke));
            const key=o.type+'@'+nearCloth.type,now=performance.now();
            if(rubTip.key!==key||now-rubTip.t>1500){
              rubTip.key=key;rubTip.t=now;
              if(Math.abs(diff)<=1)labFeedback(`🔎 ${nearCloth.name}和${o.name}得失电子的本领很接近，摩擦只能起很弱的电`,'warn');
              else if(diff>0)labFeedback(`电子从${o.name}转移到${nearCloth.name} → ${o.name}失去电子，带正电(+)`,'ok');
              else labFeedback(`电子从${nearCloth.name}转移到${o.name} → ${o.name}得到电子，带负电(−)`,'ok');
            }
          }
        }
        if(dir!==0)drag.lastDir=dir;
      }else if(!nearCloth){
        // 离开布料后重新计数，防止"进入布料瞬间"被误判成一次反转
        drag.lastDir=null;drag.stroke=0;
      }
    }
  };
  cv.onpointerup=()=>{drag=null;};
  cv.onpointercancel=()=>{drag=null;};
  $('flReset').onclick=()=>{rods.forEach(r=>r.charge=0);foilQ=0;papers.forEach(p=>p.stuck=null);labFeedback('已重置','ok');};
  $('flDone').onclick=()=>labDone();
  function draw(){
    if(!cv.isConnected)return;t++;
    ctx.clearRect(0,0,W,H);
    const ang=foilAngle();
    /* 验电器状态判定（感应/接触/移开） */
    let near=false,touch=false;
    rods.forEach(r=>{
      const d=Math.hypot(r.x+30-esc.x,r.y-esc.y);
      if(d<70&&Math.abs(r.charge)>10)near=true;
      if(d<24&&Math.abs(r.charge)>5){touch=true;
        if(!wasTouch){foilQ+=r.charge*0.6;r.charge*=0.5;labFeedback('⚡ 接触起电：电荷转移到验电器上','ok');}}
    });
    if(wasNear&&!near&&Math.abs(foilQ)<3&&!custom.induct){custom.induct=true;custom.t1=true;labFeedback('✅ 感应起电：棒移开后箔片合拢（电荷未转移）','ok');renderTasks();}
    if(wasTouch&&!touch&&Math.abs(foilQ)>3&&!custom.contact){custom.contact=true;custom.t2=true;labFeedback('✅ 接触起电：移开后箔片仍张开（电荷已转移）','ok');renderTasks();}
    wasNear=near;wasTouch=touch;
    if(ang>8&&!custom.t0){custom.t0=true;renderTasks();}
    /* 接地 */
    if(Math.hypot(clip.x-esc.x,clip.y-esc.y)<30){
      if(Math.abs(foilQ)>2&&!custom.grounded){custom.grounded=true;custom.t4=true;labFeedback('✅ 电荷经接地导入大地，箔片合拢','ok');renderTasks();}
      foilQ*=0.8;rods.forEach(r=>{if(Math.hypot(r.x+30-esc.x,r.y-esc.y)<40)r.charge*=0.8;});
    }
    /* 纸屑 */
    papers.forEach(p=>{
      if(!p.stuck){
        for(const r of rods){
          if(Math.abs(r.charge)>25&&Math.hypot(r.x+30-p.x,r.y-p.y)<50){p.stuck=r;
            if(!custom.t3){custom.t3=true;labFeedback('✅ 带电体吸引轻小物体！','ok');renderTasks();}
            break;}
        }
      }
    });
    /* --- 绘制 --- */
    /* 布料 */
    cloths.forEach(cl=>{
      ctx.fillStyle=cl.c;ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.roundRect(cl.x-42,cl.y-16,84,32,6);ctx.fill();ctx.globalAlpha=1;
      ctx.fillStyle='#222';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(cl.name,cl.x,cl.y+4);
      ctx.fillStyle='rgba(140,220,255,0.75)';ctx.font='10px sans-serif';
      ctx.fillText('↔'+(rods.find(r=>r.type===cl.pair)?.name||''),cl.x,cl.y+30);
    });
    /* 验电器 */
    ctx.strokeStyle='#8a94a0';ctx.lineWidth=2;ctx.fillStyle='rgba(180,220,255,0.08)';
    ctx.beginPath();ctx.roundRect(esc.x-45,esc.y-10,90,120,8);ctx.fill();ctx.stroke();
    const g=ctx.createRadialGradient(esc.x-4,esc.y-24,2,esc.x,esc.y-20,14);
    g.addColorStop(0,'#fff');g.addColorStop(1,'#c0a040');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(esc.x,esc.y-20,12,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c0a040';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(esc.x,esc.y-8);ctx.lineTo(esc.x,esc.y+60);ctx.stroke();
    ctx.save();ctx.translate(esc.x,esc.y+60);
    ctx.strokeStyle='#ffd60a';ctx.lineWidth=2;ctx.shadowColor='#ffd60a';ctx.shadowBlur=ang>5?6:0;
    const a=ang*Math.PI/180;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-Math.sin(a)*34,Math.cos(a)*34);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(a)*34,Math.cos(a)*34);ctx.stroke();
    ctx.restore();ctx.shadowBlur=0;
    ctx.fillStyle='#8aa0c8';ctx.font='11px sans-serif';ctx.textAlign='center';
    ctx.fillText(`验电器 张角 ${ang.toFixed(0)}°`,esc.x,esc.y+130);
    /* 接地符号 */
    ctx.strokeStyle='#39ff14';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(clip.x,clip.y);ctx.lineTo(clip.x,clip.y+16);ctx.moveTo(clip.x-10,clip.y+16);ctx.lineTo(clip.x+10,clip.y+16);
    ctx.moveTo(clip.x-6,clip.y+21);ctx.lineTo(clip.x+6,clip.y+21);ctx.stroke();
    ctx.fillStyle='#39ff14';ctx.beginPath();ctx.arc(clip.x,clip.y,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8aa0c8';ctx.fillText('接地夹（拖到金属球上放电）',clip.x,clip.y+40);
    /* 纸屑堆 */
    papers.forEach(p=>{
      const px=p.stuck?p.stuck.x+30+(p.seed*7%20-10):p.x,py=p.stuck?p.stuck.y+8+(p.seed*5%14):p.y;
      ctx.fillStyle=p.stuck?'#ffd60a':'#dfe6ec';
      ctx.save();ctx.translate(px,py);ctx.rotate(p.seed);ctx.fillRect(-3,-2,6,4);ctx.restore();
    });
    ctx.fillStyle='#8aa0c8';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('纸屑堆',pile.x,pile.y+26);
    /* 棒子 */
    rods.forEach(r=>{
      const chg=Math.abs(r.charge);
      if(chg>5){ctx.shadowColor=r.charge>0?'#ff9a5a':'#5ab0ff';ctx.shadowBlur=chg/6;}
      ctx.fillStyle=r.c;ctx.beginPath();ctx.roundRect(r.x-40,r.y-8,80,16,8);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#eaf2ff';ctx.font='11px sans-serif';ctx.textAlign='center';
      ctx.fillText(`${r.name}${chg>5?(r.charge>0?' 带正电+':' 带负电−')+chg.toFixed(0):''}`,r.x,r.y-14);
    });
    ctx.fillStyle='rgba(234,242,255,0.5)';ctx.font='12px sans-serif';ctx.textAlign='center';
    ctx.fillText('💡 只有"摩擦起电序列"中位置不同的材料才会起电：丝绸↔玻璃棒(+)、毛皮↔橡胶棒(−)，拖到验电器观察',W/2,H-8);
    if(t%15===0){tasks.forEach((tk,i)=>{if(!custom['t'+i]&&tk.check()){custom['t'+i]=true;renderTasks();Sfx.correct();}});
      if(tasks.every((tk,i)=>custom['t'+i])&&!custom.all){custom.all=true;Sfx.win();labFeedback('🎉 全部任务完成！','ok');}}
    labRaf=requestAnimationFrame(draw);
  }
  draw();
}

/* ---------- 事件绑定 ---------- */
$('startBtn').onclick=()=>{show('levels');renderLevels('junior');};
$('homeBtn').onclick=()=>show('home');
$('achBtn').onclick=()=>{renderAch();show('ach');};
$('achBack').onclick=()=>show('home');
$('wrongBtn').onclick=()=>{renderWrong();show('wrong');};
$('wrongBack').onclick=()=>show('home');
$('examBtn').onclick=()=>show('exam');
$('examBack').onclick=()=>show('home');
$('labBtn').onclick=()=>{renderLabHall();show('lab');};
$('labBack').onclick=()=>show('home');
$('labDetailBack').onclick=()=>{stopLabAnim();show('lab');renderLabHall();};
document.querySelectorAll('.exam-mode-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.exam-mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');examMode=b.dataset.mode;const d=$('examDesc');if(d)d.textContent=examMode==='all'?'湖南省电学综合测试 · 限时 15 分钟 · 20 道题':'湖南省'+(examMode==='junior'?'初中':'高中')+'电学测试 · 限时 8 分钟 · 10 道题';});
$('examStart').onclick=()=>startExam();
$('introBack').onclick=()=>{show('levels');renderLevels(currentLevel.stage);};
$('beginBtn').onclick=()=>startTeach(currentLevel);
$('teachBack').onclick=()=>{show('levels');renderLevels(currentLevel.stage);};
$('teachNext').onclick=nextTeach;
$('teachNextBtn').onclick=nextTeach;
$('teachPrev').onclick=prevTeach;
$('teachSkip').onclick=()=>{startGame(currentLevel);};
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderLevels(t.dataset.tab);});
$('soundBtn').onclick=()=>{const on=Sfx.toggle();$('soundBtn').textContent=on?'🔊':'🔇';toast(on?'音效已开启':'音效已关闭');};

/* ---------- 初始化 ---------- */
updateHud();
$('soundBtn').textContent=Sfx.isOn()?'🔊':'🔇';
setTimeout(()=>toast('欢迎来到电学大冒险！'),600);

/* ---------- 键盘快捷键 ---------- */
document.addEventListener('keydown', e => {
  // 避免在输入框中触发
  if (e.target.tagName === 'INPUT') return;
  // 选择题：1-4 或 A-D 选择选项
  const opts = document.querySelectorAll('.quiz-card .opt:not(.disabled)');
  if (opts.length > 0) {
    let idx = -1;
    if (e.key >= '1' && e.key <= '4') idx = +e.key - 1;
    else if (e.key.toLowerCase() >= 'a' && e.key.toLowerCase() <= 'd') idx = e.key.toLowerCase().charCodeAt(0) - 97;
    if (idx >= 0 && idx < opts.length) { opts[idx].click(); return; }
  }
  // 结算屏按 Enter 进入下一关（仅在结算屏生效，避免考试/答题中途误触）
  if (e.key === 'Enter' && screens.result.classList.contains('active')) {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
  }
});

/* =========================================================
   视觉特效增强：鼠标光晕、3D倾斜、涟漪、加载屏
   ========================================================= */
// 加载屏隐藏
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (loader) setTimeout(() => { loader.classList.add('hide'); setTimeout(() => loader.remove(), 600); }, 800);
});

// 全局鼠标位置（共享，减少重复监听）
const Mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false };
addEventListener('mousemove', e => {
  Mouse.x = e.clientX; Mouse.y = e.clientY; Mouse.active = true;
}, { passive: true });
addEventListener('mouseleave', () => { Mouse.active = false; });

// 鼠标光晕（rAF 缓动跟随）
const mouseGlow = document.getElementById('mouseGlow');
if (mouseGlow) {
  let gx = Mouse.x, gy = Mouse.y;
  (function glowLoop() {
    if (Mouse.active) mouseGlow.style.opacity = '1';
    else mouseGlow.style.opacity = '0';
    gx += (Mouse.x - gx) * 0.12;
    gy += (Mouse.y - gy) * 0.12;
    mouseGlow.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate(-50%,-50%)`;
    requestAnimationFrame(glowLoop);
  })();
}

// 3D 倾斜（rAF 节流，避免每帧多次样式写入）
const TILT_SEL = '.level-card:not(.locked), .opt, .match-item, .hstat, .ach-card:not(.locked)';
const RIPPLE_SEL = '.btn-primary, .btn-ghost, .btn-check, .tab, .exam-mode-btn, .icon-btn, .part';
let tiltTarget = null;

document.addEventListener('mouseover', e => {
  const el = e.target.closest(TILT_SEL);
  if (el) tiltTarget = el;
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest(TILT_SEL);
  if (el && !el.contains(e.relatedTarget)) {
    if (tiltTarget === el) tiltTarget = null;
    el.style.transform = '';
  }
});

function tiltLoop() {
  if (tiltTarget && Mouse.active) {
    const r = tiltTarget.getBoundingClientRect();
    const px = (Mouse.x - r.left) / r.width;
    const py = (Mouse.y - r.top) / r.height;
    if (px >= 0 && px <= 1 && py >= 0 && py <= 1) {
      const max = 7;
      const rx = (py - 0.5) * -max * 2;
      const ry = (px - 0.5) * max * 2;
      tiltTarget.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0) translateY(-4px)`;
      tiltTarget.style.setProperty('--gx', (px * 100) + '%');
      tiltTarget.style.setProperty('--gy', (py * 100) + '%');
    }
  }
  requestAnimationFrame(tiltLoop);
}
requestAnimationFrame(tiltLoop);

// 按钮涟漪
document.addEventListener('click', e => {
  const btn = e.target.closest(RIPPLE_SEL);
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - r.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - r.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});
