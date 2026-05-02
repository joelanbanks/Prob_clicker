// ══════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════

const SLOPE_STEPS = 10;

// Gen N config: interval in ms, multiplier vs Gen1 output, costs
const GEN_CONFIG = [
  null, // 1-indexed
  {
    baseInterval:    1000,
    minInterval:     100,
    multiplier:      1,
    gen_unlockCost:  0,
    mult_unlockCost: 10,
    slopeCostBase:   0.8,
    speedCostBase:   3.0,
    multAlphaCostBase: 4.0,
  },
  {
    baseInterval:    3000,
    minInterval:     300,
    multiplier:      5,
    gen_unlockCost:  10,
    mult_unlockCost: 100,
    slopeCostBase:   5.0,
    speedCostBase:   18.0,
    multAlphaCostBase: 24.0,
  },
  {
    baseInterval:    10000,
    minInterval:     1000,
    multiplier:      25,
    gen_unlockCost:  100,
    mult_unlockCost: 1000,
    slopeCostBase:   50.0,
    speedCostBase:   180.0,
    multAlphaCostBase: 240.0,
  },
  {
    baseInterval:    30000,
    minInterval:     3000,
    multiplier:      125,
    gen_unlockCost:  1000,
    mult_unlockCost: 10000,
    slopeCostBase:   500.0,
    speedCostBase:   1800.0,
    multAlphaCostBase: 2400.0,
  },
];

// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════

function makeGen(n) {
  return { n, unlocked: n === 1, slopeStep: 0, interval: GEN_CONFIG[n].baseInterval, speedCount: 0, ascensionLevel: 0 };
}
function makeMult(n) {
  return { n, unlocked: false, alpha: 2.0, beta: 2.0, alphaCount: 0 };
}

const GENS  = [null, makeGen(1), makeGen(2), makeGen(3), makeGen(4)];
const MULTS = [null, makeMult(1), makeMult(2), makeMult(3), makeMult(4)];
let score = 0;

// ══════════════════════════════════════════════════════
//  COSTS
// ══════════════════════════════════════════════════════

function slopeCost(n, step)      { return round2(Math.pow(1.6, step) * GEN_CONFIG[n].slopeCostBase); }
function speedCost(n, count)     { return round2(Math.pow(1.8, count) * GEN_CONFIG[n].speedCostBase); }
function multAlphaCost(n, count) { return round2(Math.pow(1.5, count) * GEN_CONFIG[n].multAlphaCostBase); }
function round2(x) { return Math.round(x * 100) / 100; }

// ══════════════════════════════════════════════════════
//  PDF FAMILIES
//
//  t = slopeStep / SLOPE_STEPS  (0 = bad start, 1 = good end)
//
//  Gen 1: support [0,1]
//    t=0: f(x)=2(1-x)   EV=1/3
//    t=1: f(x)=2x        EV=2/3
//
//  Gen 2: support [0,1]
//    t=0: f(x)=2-4x on [0,.5], 0 elsewhere    EV=1/6
//    t=.5: uniform                              EV=1/2
//    t=1: f(x)=4x-2 on [.5,1], 0 elsewhere    EV=5/6
//
//  Gen 3: support [0,1]
//    t=0: f(x)=4-16x on [0,.25], 0 elsewhere  EV=1/12
//    t=.5: uniform                              EV=1/2
//    t=1: f(x)=16x-12 on [.75,1], 0 elsewhere EV=11/12
//
//  Gen 4: support [0,1]
//    t=0: f(x)=8-64x on [0,.125], 0 elsewhere EV=1/24
//    t=.5: uniform                              EV=1/2
//    t=1: f(x)=64x-56 on [.875,1], 0 elsewhere EV=23/24
// ══════════════════════════════════════════════════════

function slopeT(slopeStep) { return slopeStep / SLOPE_STEPS; }

// Gen 1: standard triangular blend
function gen1PDF(x, t) {
  return 2 * ((1-t)*(1-x) + t*x);
}
function gen1Sample(t) {
  const u = Math.random();
  const a = 2*t - 1, b = 2*(1-t), c = -u;
  if (Math.abs(a) < 1e-9) return u / Math.max(b, 1e-9);
  const disc = b*b - 4*a*c;
  return Math.max(0, Math.min(1, (-b + Math.sqrt(Math.max(0, disc))) / (2*a)));
}
function gen1EV(t) { return (1-t)/3 + t*2/3; }

// Blended PDF helpers for gens 2-4
function blendedPDF(x, t, lo_pdf, hi_pdf) {
  if (t < 0.5) {
    const s = t * 2;
    return (1-s)*lo_pdf(x) + s*1;
  } else {
    const s = (t - 0.5) * 2;
    return (1-s)*1 + s*hi_pdf(x);
  }
}

function gen2PDF(x, t) {
  return blendedPDF(x, t,
    u => (u <= 0.5) ? Math.max(0, 2 - 4*u) : 0,
    u => (u >= 0.5) ? Math.max(0, 4*u - 2) : 0
  );
}
function gen3PDF(x, t) {
  return blendedPDF(x, t,
    u => (u <= 0.25) ? Math.max(0, 4 - 16*u) : 0,
    u => (u >= 0.75) ? Math.max(0, 16*u - 12) : 0
  );
}
function gen4PDF(x, t) {
  return blendedPDF(x, t,
    u => (u <= 0.125) ? Math.max(0, 8 - 64*u) : 0,
    u => (u >= 0.875) ? Math.max(0, 64*u - 56) : 0
  );
}

function numericalInverseCDF(pdfFn, u, N=600) {
  let cdf = 0;
  for (let i = 0; i < N; i++) {
    const x0 = i / N, x1 = (i+1) / N;
    const xm = (x0+x1)/2;
    const d = pdfFn(xm) / N;
    const prev = cdf;
    cdf += d;
    if (cdf >= u || i === N-1) {
      if (d < 1e-12) return x1;
      return Math.min(1, x0 + (u - prev) / (d * N) / N);
    }
  }
  return 1;
}

function gen2Sample(t) { return numericalInverseCDF(x => gen2PDF(x, t), Math.random()); }
function gen3Sample(t) { return numericalInverseCDF(x => gen3PDF(x, t), Math.random()); }
function gen4Sample(t) { return numericalInverseCDF(x => gen4PDF(x, t), Math.random()); }

function blendEV(t, lo_ev, hi_ev) {
  if (t < 0.5) { const s=t*2; return (1-s)*lo_ev + s*0.5; }
  else          { const s=(t-.5)*2; return (1-s)*0.5 + s*hi_ev; }
}
function gen2EV(t) { return blendEV(t, 1/6, 5/6); }
function gen3EV(t) { return blendEV(t, 1/12, 11/12); }
function gen4EV(t) { return blendEV(t, 1/24, 23/24); }

const GEN_PDF_FNS    = [null, gen1PDF, gen2PDF, gen3PDF, gen4PDF];
const GEN_SAMPLE_FNS = [null, gen1Sample, gen2Sample, gen3Sample, gen4Sample];
const GEN_EV_FNS     = [null, gen1EV, gen2EV, gen3EV, gen4EV];

function applyPower(u, ascLvl) {
  if (ascLvl === 0) return u;
  return Math.pow(Math.max(0, u), 1 + ascLvl * 0.1);
}

function genEV(n, g) {
  const t = slopeT(g.slopeStep);
  const baseEV = GEN_EV_FNS[n](t);
  if (g.ascensionLevel === 0) return baseEV;
  const p = 1 + g.ascensionLevel * 0.1;
  const N = 200;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    sum += Math.pow(u, p) * GEN_PDF_FNS[n](u, t) / N;
  }
  return sum;
}

// ══════════════════════════════════════════════════════
//  MULTIPLIER (Beta)
// ══════════════════════════════════════════════════════

function randn() { return Math.sqrt(-2*Math.log(Math.random())) * Math.cos(2*Math.PI*Math.random()); }
function gammaSample(shape) {
  if (shape < 1) return gammaSample(1 + shape) * Math.pow(Math.random(), 1/shape);
  const d = shape - 1/3, c = 1/Math.sqrt(9*d);
  while (true) {
    let x, v;
    do { x = randn(); v = 1 + c*x; } while (v <= 0);
    v = v*v*v;
    const u = Math.random();
    if (u < 1 - 0.0331*x*x*x*x) return d*v;
    if (Math.log(u) < 0.5*x*x + d*(1 - v + Math.log(v))) return d*v;
  }
}
function betaSample(a, b) { const ga=gammaSample(a), gb=gammaSample(b); return ga/(ga+gb); }
function multEV(mult)  { return 2 * mult.alpha / (mult.alpha + mult.beta); }

function lnGamma(x) {
  const g=7, c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,
    -176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI/Math.sin(Math.PI*x)) - lnGamma(1-x);
  x -= 1; let a=c[0]; const t=x+g+0.5;
  for (let i=1;i<g+2;i++) a+=c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}
function betaPDF(x, a, b) {
  if (x<=0||x>=1) return 0;
  const lnB=lnGamma(a)+lnGamma(b)-lnGamma(a+b);
  return Math.exp((a-1)*Math.log(x)+(b-1)*Math.log(1-x)-lnB);
}

// ══════════════════════════════════════════════════════
//  CANVAS HELPERS
// ══════════════════════════════════════════════════════

function setupCanvas(canvas) {
  const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1, size=rect.width;
  canvas.width=size*dpr; canvas.height=size*dpr; canvas.style.height=size+'px';
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, size};
}
const PAD=1;
function chartArea(size) { return {x:PAD, y:PAD, w:size-PAD*2, h:size-PAD*2}; }

// ══════════════════════════════════════════════════════
//  DRAW — GENERATOR
// ══════════════════════════════════════════════════════

const BINS=100;

function drawGenCanvas(ctx, size, n, g, hitBin, hitAlpha, accentColor, accentFill) {
  if (!ctx || !size) return;
  const ar=chartArea(size);
  ctx.clearRect(0,0,size,size);

  const t=slopeT(g.slopeStep), p=1+g.ascensionLevel*0.1;
  function uToX(u) { return ar.x+u*ar.w; }

  // Build display curve (with ascension power transform)
  const N=150, pts=[];
  let maxD=0;
  for (let i=0;i<=N;i++) {
    const y=i/N;
    let fy;
    if (p===1||y<=0) { fy=GEN_PDF_FNS[n](y,t); }
    else {
      const u=Math.pow(y,1/p);
      const fx=GEN_PDF_FNS[n](u,t);
      fy=fx*(1/p)*Math.pow(y,1/p-1);
    }
    const val=isFinite(fy)?Math.max(0,fy):0;
    pts.push(val); if(val>maxD) maxD=val;
  }
  const scale=Math.max(maxD,0.5);
  const yOf=d=>ar.y+ar.h-(d/scale)*ar.h;

  // Hit highlight
  if (hitBin!==null && hitAlpha>0) {
    const x0=uToX(hitBin/BINS), x1=uToX((hitBin+1)/BINS);
    ctx.save(); ctx.globalAlpha=hitAlpha;
    ctx.fillStyle=accentFill; ctx.fillRect(x0,ar.y,x1-x0,ar.h);
    const cx=uToX((hitBin+0.5)/BINS);
    ctx.strokeStyle=accentColor; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx,ar.y); ctx.lineTo(cx,ar.y+ar.h); ctx.stroke();
    ctx.restore();
  }

  // Fill + curve
  ctx.beginPath();
  for (let i=0;i<=N;i++) { const x=uToX(i/N),y=yOf(pts[i]); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.lineTo(uToX(1),ar.y+ar.h); ctx.lineTo(uToX(0),ar.y+ar.h); ctx.closePath();
  ctx.fillStyle=accentFill.replace('0.22','0.06'); ctx.fill();

  ctx.beginPath();
  for (let i=0;i<=N;i++) { const x=uToX(i/N),y=yOf(pts[i]); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.strokeStyle='#e8e8e8'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke();

  ctx.beginPath(); ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1;
  ctx.moveTo(ar.x,ar.y+ar.h); ctx.lineTo(ar.x+ar.w,ar.y+ar.h); ctx.stroke();
}

// ══════════════════════════════════════════════════════
//  DRAW — MULTIPLIER
// ══════════════════════════════════════════════════════

const MULT_BINS=100;

function drawMultCanvas(ctx, size, mult, hitBin, hitAlpha) {
  if (!ctx||!size) return;
  const ar=chartArea(size); ctx.clearRect(0,0,size,size);
  const vals=Array.from({length:MULT_BINS},(_,i)=>betaPDF((i+0.5)/MULT_BINS,mult.alpha,mult.beta));
  const pdfMax=Math.max(...vals,1e-6);
  const binToX=i=>ar.x+(i/MULT_BINS)*ar.w;
  const dToY=d=>ar.y+ar.h-(d/pdfMax)*ar.h;

  if (hitBin!==null&&hitAlpha>0) {
    ctx.save(); ctx.globalAlpha=hitAlpha;
    ctx.fillStyle='rgba(74,200,240,0.2)'; ctx.fillRect(binToX(hitBin),ar.y,binToX(hitBin+1)-binToX(hitBin),ar.h);
    const cx=binToX(hitBin+0.5); ctx.strokeStyle='#4ac8f0'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx,ar.y); ctx.lineTo(cx,ar.y+ar.h); ctx.stroke(); ctx.restore();
  }

  ctx.beginPath(); ctx.strokeStyle='#c8e8f0'; ctx.lineWidth=2; ctx.lineJoin='round';
  vals.forEach((v,i)=>{ const x=binToX(i+0.5),y=dToY(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke();

  ctx.beginPath();
  vals.forEach((v,i)=>{ const x=binToX(i+0.5),y=dToY(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.lineTo(binToX(MULT_BINS),ar.y+ar.h); ctx.lineTo(binToX(0),ar.y+ar.h); ctx.closePath();
  ctx.fillStyle='rgba(74,200,240,0.05)'; ctx.fill();

  const midX=ar.x+ar.w/2;
  ctx.beginPath(); ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.moveTo(midX,ar.y); ctx.lineTo(midX,ar.y+ar.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1;
  ctx.moveTo(ar.x,ar.y+ar.h); ctx.lineTo(ar.x+ar.w,ar.y+ar.h); ctx.stroke();
}

// ══════════════════════════════════════════════════════
//  CANVAS INSTANCES
// ══════════════════════════════════════════════════════

const genCanvasEls  = [null,'gen-canvas','gen2-canvas','gen3-canvas','gen4-canvas'].map((id,i)=>i?document.getElementById(id):null);
const multCanvasEls = [null,'mult-canvas','mult2-canvas','mult3-canvas','mult4-canvas'].map((id,i)=>i?document.getElementById(id):null);

const genCtx=[null,null,null,null,null], genSz=[null,null,null,null,null];
const multCtx=[null,null,null,null,null], multSz=[null,null,null,null,null];

function setupGenCanvas(n)  { if(!genCanvasEls[n]) return; const r=setupCanvas(genCanvasEls[n]); genCtx[n]=r.ctx; genSz[n]=r.size; }
function setupMultCanvas(n) { if(!multCanvasEls[n]) return; const r=setupCanvas(multCanvasEls[n]); multCtx[n]=r.ctx; multSz[n]=r.size; }

const GEN_ACCENT      = [null,'#c8f04a','#f07a4a','#b04af0','#f04a9a'];
const GEN_ACCENT_FILL = [null,'rgba(200,240,74,0.22)','rgba(240,122,74,0.22)','rgba(176,74,240,0.22)','rgba(240,74,154,0.22)'];

const genHitBin=[null,null,null,null,null], genHitAlpha=[null,0,0,0,0];
const multHitBin=[null,null,null,null,null], multHitAlpha=[null,0,0,0,0];

function drawGen(n)  { drawGenCanvas(genCtx[n],genSz[n],n,GENS[n],genHitBin[n],genHitAlpha[n],GEN_ACCENT[n],GEN_ACCENT_FILL[n]); }
function drawMult(n) { if(MULTS[n].unlocked) drawMultCanvas(multCtx[n],multSz[n],MULTS[n],multHitBin[n],multHitAlpha[n]); }

// ══════════════════════════════════════════════════════
//  ROLL
// ══════════════════════════════════════════════════════

const rollTimers=[null,null,null,null,null];
const rollStarts=[null,performance.now(),performance.now(),performance.now(),performance.now()];

function idSfx(n) { return n>1?String(n):''; }

function doRoll(n) {
  const g=GENS[n]; if(!g.unlocked) return;
  const t=slopeT(g.slopeStep);
  const raw=GEN_SAMPLE_FNS[n](t);
  const genRoll=applyPower(raw, g.ascensionLevel);
  genHitBin[n]=Math.min(Math.floor(raw*BINS),BINS-1);
  genHitAlpha[n]=1.0;

  let multiplier=1.0;
  const m=MULTS[n];
  if (m.unlocked) {
    const mRoll=betaSample(m.alpha,m.beta);
    multiplier=mRoll*2;
    multHitBin[n]=Math.min(Math.floor(mRoll*MULT_BINS),MULT_BINS-1);
    multHitAlpha[n]=1.0;
  }

  const earned=genRoll*multiplier*GEN_CONFIG[n].multiplier;
  score+=earned;

  const sfx=idSfx(n);
  const sl=document.getElementById(`stat${sfx}-last`); if(sl) sl.textContent=(genRoll*GEN_CONFIG[n].multiplier).toFixed(3);
  const ml=document.getElementById(`mult${sfx}-last`); if(ml&&m.unlocked) ml.textContent=multiplier.toFixed(3)+'×';

  updateScore(); refreshUI();
  rollStarts[n]=performance.now();
  const bar=document.getElementById(`timer-bar${sfx}`); if(bar) bar.style.width='0%';
}

function restartRollTimer(n) {
  if(rollTimers[n]) clearInterval(rollTimers[n]);
  rollTimers[n]=setInterval(()=>doRoll(n),GENS[n].interval);
  rollStarts[n]=performance.now();
}

// ══════════════════════════════════════════════════════
//  SCORE
// ══════════════════════════════════════════════════════

function updateScore() {
  const el=document.getElementById('score-val');
  el.textContent=score.toFixed(3);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(()=>el.classList.remove('bump'),150);
}

// ══════════════════════════════════════════════════════
//  UI REFRESH
// ══════════════════════════════════════════════════════

function refreshUI() {
  let totalEvPerSec=0;

  for (let n=1;n<=4;n++) {
    const g=GENS[n], m=MULTS[n], cfg=GEN_CONFIG[n], sfx=idSfx(n);

    if (!g.unlocked) {
      const btn=document.getElementById(`btn-unlock-gen${n}`);
      if(btn) btn.disabled=score<cfg.gen_unlockCost;
      continue;
    }

    const ev=genEV(n,g)*cfg.multiplier;
    const evWithMult=m.unlocked?ev*multEV(m):ev;
    totalEvPerSec+=evWithMult/(g.interval/1000);

    const cardSub=document.getElementById(`card${sfx}-sub`);
    if(cardSub) cardSub.textContent=g.ascensionLevel>0
      ?`slope ${g.slopeStep}/${SLOPE_STEPS}  ^${(1+g.ascensionLevel*0.1).toFixed(1)}`
      :`slope ${g.slopeStep}/${SLOPE_STEPS}`;
    const sev=document.getElementById(`stat${sfx}-ev`); if(sev) sev.textContent=ev.toFixed(4);
    const sivl=document.getElementById(`stat${sfx}-interval`); if(sivl) sivl.textContent=(g.interval/1000).toFixed(2)+'s';

    // Slope
    const slopeMaxed=g.slopeStep>=SLOPE_STEPS;
    const upgS=document.getElementById(`upg-slope${sfx}`); if(upgS) upgS.classList.toggle('maxed',slopeMaxed);
    const btnSlope=document.getElementById(`btn-slope${sfx}`);
    if(btnSlope) {
      if(slopeMaxed) {
        btnSlope.disabled=true;
        document.getElementById(`cost-slope${sfx}`).textContent='DONE';
        document.getElementById(`upg-slope${sfx}-step`).textContent='maxed';
      } else {
        const c=slopeCost(n,g.slopeStep); btnSlope.disabled=score<c;
        document.getElementById(`cost-slope${sfx}`).textContent=c.toFixed(2);
        document.getElementById(`upg-slope${sfx}-step`).textContent=`${g.slopeStep} → ${g.slopeStep+1}`;
      }
    }
    const fill=document.getElementById(`slope${sfx}-progress-fill`); if(fill) fill.style.width=(g.slopeStep/SLOPE_STEPS*100)+'%';

    // Speed
    const speedMaxed=g.interval<=cfg.minInterval;
    const upgSp=document.getElementById(`upg-speed${sfx}`); if(upgSp) upgSp.classList.toggle('maxed',speedMaxed);
    const btnSpeed=document.getElementById(`btn-speed${sfx}`);
    if(btnSpeed) {
      const sc=speedCost(n,g.speedCount); btnSpeed.disabled=speedMaxed||score<sc;
      document.getElementById(`cost-speed${sfx}`).textContent=speedMaxed?'MAX':sc.toFixed(2);
      document.getElementById(`upg-speed${sfx}-step`).textContent=speedMaxed?'':`→ ${(g.interval*0.95/1000).toFixed(2)}s`;
    }

    // Ascension
    const ascWrap=document.getElementById(`ascension${sfx}-wrap`); if(ascWrap) ascWrap.classList.toggle('hidden',!slopeMaxed);

    // Mult unlock
    const btnUM=document.getElementById(`btn-unlock-mult${sfx}`); if(btnUM) btnUM.disabled=score<cfg.mult_unlockCost;

    if(m.unlocked) {
      const ms=document.getElementById(`mult${sfx}-sub`); if(ms) ms.textContent=`α=${m.alpha.toFixed(1)}, β=2`;
      const ma=document.getElementById(`mult${sfx}-alpha`); if(ma) ma.textContent=m.alpha.toFixed(1);
      const mev=document.getElementById(`mult${sfx}-ev`); if(mev) mev.textContent=multEV(m).toFixed(3)+'×';
      const mac=multAlphaCost(n,m.alphaCount);
      const btnMA=document.getElementById(`btn-mult-alpha${sfx}`); if(btnMA) btnMA.disabled=score<mac;
      const cMA=document.getElementById(`cost-mult-alpha${sfx}`); if(cMA) cMA.textContent=mac.toFixed(2);
      const stMA=document.getElementById(`upg-mult-alpha${sfx}-step`); if(stMA) stMA.textContent=`α ${m.alpha.toFixed(1)} → ${(m.alpha+0.1).toFixed(1)}`;
    }
  }

  document.getElementById('per-roll-val').textContent='~'+totalEvPerSec.toFixed(3)+'/s';
}

// ══════════════════════════════════════════════════════
//  BUTTON WIRING
// ══════════════════════════════════════════════════════

function wireButtons(n) {
  const sfx=idSfx(n), cfg=GEN_CONFIG[n];

  if(n>1) {
    const btn=document.getElementById(`btn-unlock-gen${n}`);
    if(btn) btn.addEventListener('click',()=>{
      if(score<cfg.gen_unlockCost) return;
      score-=cfg.gen_unlockCost; GENS[n].unlocked=true;
      document.getElementById(`gen${n}-lock-panel`).classList.add('hidden');
      document.getElementById(`gen${n}-card`).classList.remove('hidden');
      document.getElementById(`mult${n}-card`).classList.remove('hidden');
      document.getElementById(`upgrades${n}-panel`).classList.remove('hidden');
      setupGenCanvas(n); setupMultCanvas(n);
      restartRollTimer(n); updateScore(); refreshUI(); drawGen(n);
    });
  }

  const btnSlope=document.getElementById(`btn-slope${sfx}`);
  if(btnSlope) btnSlope.addEventListener('click',()=>{
    const g=GENS[n]; if(g.slopeStep>=SLOPE_STEPS) return;
    const cost=slopeCost(n,g.slopeStep); if(score<cost) return;
    score-=cost; g.slopeStep++; updateScore(); refreshUI(); drawGen(n);
  });

  const btnSpeed=document.getElementById(`btn-speed${sfx}`);
  if(btnSpeed) btnSpeed.addEventListener('click',()=>{
    const g=GENS[n]; if(g.interval<=cfg.minInterval) return;
    const cost=speedCost(n,g.speedCount); if(score<cost) return;
    score-=cost; g.speedCount++;
    g.interval=Math.max(cfg.minInterval,Math.round(g.interval*0.95));
    restartRollTimer(n); updateScore(); refreshUI();
  });

  const btnAscend=document.getElementById(`btn-ascend${sfx}`);
  if(btnAscend) btnAscend.addEventListener('click',()=>{
    const g=GENS[n]; if(g.slopeStep<SLOPE_STEPS) return;
    g.slopeStep=0; g.ascensionLevel++;
    updateScore(); refreshUI(); drawGen(n);
  });

  const btnUM=document.getElementById(`btn-unlock-mult${sfx}`);
  if(btnUM) btnUM.addEventListener('click',()=>{
    const m=MULTS[n]; if(score<cfg.mult_unlockCost) return;
    score-=cfg.mult_unlockCost; m.unlocked=true;
    document.getElementById(`lock-overlay${sfx}`).classList.add('hidden');
    document.getElementById(`mult${sfx}-upgrades`).classList.remove('hidden');
    document.getElementById(`mult${sfx}-sub`).textContent=`α=${m.alpha.toFixed(1)}, β=2`;
    updateScore(); refreshUI(); drawMult(n);
  });

  const btnMA=document.getElementById(`btn-mult-alpha${sfx}`);
  if(btnMA) btnMA.addEventListener('click',()=>{
    const m=MULTS[n]; if(!m.unlocked) return;
    const cost=multAlphaCost(n,m.alphaCount); if(score<cost) return;
    score-=cost; m.alphaCount++; m.alpha=Math.round((m.alpha+0.1)*10)/10;
    updateScore(); refreshUI(); drawMult(n);
  });
}

for(let n=1;n<=4;n++) wireButtons(n);

// ══════════════════════════════════════════════════════
//  ANIMATION LOOP
// ══════════════════════════════════════════════════════

function animLoop(ts) {
  for(let n=1;n<=4;n++) {
    if(!GENS[n].unlocked) continue;
    const sfx=idSfx(n);
    const bar=document.getElementById(`timer-bar${sfx}`);
    if(bar) bar.style.width=Math.min((ts-rollStarts[n])/GENS[n].interval*100,100)+'%';
    if(genHitAlpha[n]>0)  { genHitAlpha[n]=Math.max(0,genHitAlpha[n]-0.012); drawGen(n); }
    if(multHitAlpha[n]>0) { multHitAlpha[n]=Math.max(0,multHitAlpha[n]-0.012); drawMult(n); }
  }
  requestAnimationFrame(animLoop);
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

(function injectProgressBars() {
  for(let n=1;n<=4;n++) {
    const sfx=idSfx(n), row=document.getElementById(`upg-slope${sfx}`);
    if(row) {
      const bar=document.createElement('div');
      bar.className='slope-progress';
      bar.innerHTML=`<div class="slope-progress-fill" id="slope${sfx}-progress-fill"></div>`;
      row.after(bar);
    }
  }
})();

function init() {
  setupGenCanvas(1); setupMultCanvas(1);
  refreshUI(); drawGen(1);
  requestAnimationFrame(animLoop);
  restartRollTimer(1);
}

window.addEventListener('resize',()=>{
  for(let n=1;n<=4;n++) {
    if(!GENS[n].unlocked) continue;
    setupGenCanvas(n); setupMultCanvas(n); drawGen(n); drawMult(n);
  }
});

init();