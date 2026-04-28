// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════

const SLOPE_STEPS = 10;

const GEN1 = {
  slopeStep:      0,
  interval:       5000,
  speedCount:     0,
  ascensionLevel: 0,   // each ascension adds 0.1 to the exponent
};

const MULT1 = {
  unlocked:   false,
  alpha:       2.0,
  beta:        2.0,
  alphaCount:  0,
};

const GEN2 = {
  unlocked:   false,
  slopeStep:  0,
  interval:   15000,   // 3× Gen1 base
  speedCount: 0,
  ascensionLevel: 0,
};

const MULT2 = {
  unlocked:   false,
  alpha:       2.0,
  beta:        2.0,
  alphaCount:  0,
};

let score = 0;

// ══════════════════════════════════════════════════════
//  COSTS
// ══════════════════════════════════════════════════════

function slopeCost(step)       { return round2(Math.pow(1.5, step) * 0.4); }
function speedCost(count)      { return round2(Math.pow(1.7, count) * 1.5); }
function mult1AlphaCost(count) { return round2(Math.pow(1.4, count) * 2.0); }

// Gen 2 costs — a bit steeper
function slope2Cost(step)      { return round2(Math.pow(1.5, step) * 2.0); }
function speed2Cost(count)     { return round2(Math.pow(1.7, count) * 7.5); }
function mult2AlphaCost(count) { return round2(Math.pow(1.4, count) * 10.0); }

const MULT1_UNLOCK_COST = 10.0;
const GEN2_UNLOCK_COST  = 10.0;
const MULT2_UNLOCK_COST = 100.0;

function round2(x) { return Math.round(x * 100) / 100; }

// ══════════════════════════════════════════════════════
//  GEN DISTRIBUTION  (linear ramp, raised to power p)
//  Raw sample u ∈ [0,1] via inverse-CDF of linear ramp,
//  then result = u^p   where p = 1 + ascensionLevel*0.1
// ══════════════════════════════════════════════════════

function genAB(slopeStep) {
  const t = slopeStep / SLOPE_STEPS;
  return { a: 1 - t, b: t };
}

function genRawSample(slopeStep) {
  const { a, b } = genAB(slopeStep);
  const p = Math.random();
  if (Math.abs(b - a) < 1e-9) return p;
  const A = b - a, B = 2 * a, C = -p * (a + b);
  return Math.max(0, Math.min(1, (-B + Math.sqrt(B*B - 4*A*C)) / (2*A)));
}

// Apply ascension power to a raw [0,1] sample
function applyPower(u, ascLvl) {
  const p = 1 + ascLvl * 0.1;
  return Math.pow(u, p);
}

function genSample(slopeStep, ascLvl) {
  return applyPower(genRawSample(slopeStep), ascLvl);
}

// E[X^p] where X has the linear-ramp distribution
// E[X] = (a+2b)/(3(a+b))  — but after the power transform
// we use numerical integration (100 pts)
function genEV(slopeStep, ascLvl) {
  const { a, b } = genAB(slopeStep);
  const p = 1 + ascLvl * 0.1;
  const N = 200;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const pdf = (a + b < 1e-12) ? 1 : 2*(a + (b-a)*u)/(a+b);
    sum += Math.pow(u, p) * pdf / N;
  }
  return sum;
}

function genPDF(u, slopeStep) {
  const { a, b } = genAB(slopeStep);
  if (a + b < 1e-12) return 1;
  return 2*(a + (b-a)*u) / (a+b);
}

// ══════════════════════════════════════════════════════
//  MULTIPLIER DISTRIBUTION  (Beta(alpha, beta), ×2)
// ══════════════════════════════════════════════════════

function randn() {
  return Math.sqrt(-2*Math.log(Math.random())) * Math.cos(2*Math.PI*Math.random());
}
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
function betaSample(a, b) {
  const ga = gammaSample(a), gb = gammaSample(b);
  return ga / (ga + gb);
}

function multSample(mult)  { return betaSample(mult.alpha, mult.beta) * 2; }
function multEV(mult)      { return 2 * mult.alpha / (mult.alpha + mult.beta); }

function lnGamma(x) {
  const g = 7;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
             771.32342877765313,-176.61502916214059,12.507343278686905,
             -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI/Math.sin(Math.PI*x)) - lnGamma(1-x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g+2; i++) a += c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI) + (x+0.5)*Math.log(t) - t + Math.log(a);
}
function betaPDF(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  const lnB = lnGamma(a) + lnGamma(b) - lnGamma(a+b);
  return Math.exp((a-1)*Math.log(x) + (b-1)*Math.log(1-x) - lnB);
}

// ══════════════════════════════════════════════════════
//  CANVAS HELPERS
// ══════════════════════════════════════════════════════

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  const size = rect.width;
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, size };
}

const PAD = 1;
function chartArea(size) {
  return { x: PAD, y: PAD, w: size - PAD*2, h: size - PAD*2 };
}

// ══════════════════════════════════════════════════════
//  DRAW — GENERATOR (generic, used for Gen1 + Gen2)
// ══════════════════════════════════════════════════════

const BINS = 100;

function drawGenCanvas(ctx, size, slopeStep, ascLvl, hitBin, hitAlpha, accentColor, accentFill) {
  const ar = chartArea(size);
  ctx.clearRect(0, 0, size, size);

  function uToX(u) { return ar.x + u * ar.w; }
  function dToY(d) { return ar.y + ar.h - (d / 2) * ar.h; }

  // Hit bin highlight
  if (hitBin !== null && hitAlpha > 0) {
    const x0 = uToX(hitBin / BINS);
    const x1 = uToX((hitBin+1) / BINS);
    ctx.save();
    ctx.globalAlpha = hitAlpha;
    ctx.fillStyle = accentFill;
    ctx.fillRect(x0, ar.y, x1-x0, ar.h);
    const cx = uToX((hitBin+0.5)/BINS);
    ctx.strokeStyle = accentColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, ar.y); ctx.lineTo(cx, ar.y+ar.h); ctx.stroke();
    ctx.restore();
  }

  // If ascended, draw the transformed PDF curve (sampled numerically)
  const p = 1 + ascLvl * 0.1;
  if (p !== 1) {
    // Draw the induced PDF of u^p where u has linear-ramp dist
    // f_Y(y) = f_X(y^(1/p)) * (1/p) * y^(1/p - 1)
    const pts = [];
    const N = 120;
    let maxD = 0;
    for (let i = 0; i <= N; i++) {
      const y = i / N;
      if (y <= 0) { pts.push(0); continue; }
      const u = Math.pow(y, 1/p);
      const fx = genPDF(u, slopeStep);
      const fy = fx * (1/p) * Math.pow(y, 1/p - 1);
      pts.push(isFinite(fy) ? fy : 0);
      if (fy > maxD) maxD = fy;
    }
    // Normalize to fixed scale of 3 for display
    const scale = Math.max(maxD, 0.5);
    const yOf = d => ar.y + ar.h - (d / scale) * ar.h;

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = uToX(i / N);
      const y = yOf(pts[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(uToX(1), ar.y+ar.h);
    ctx.lineTo(uToX(0), ar.y+ar.h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,240,74,0.05)'; ctx.fill();

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = uToX(i / N);
      const y = yOf(pts[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    // Linear ramp — draw as straight line
    const yL = dToY(genPDF(0, slopeStep)), yR = dToY(genPDF(1, slopeStep));
    ctx.beginPath();
    ctx.moveTo(uToX(0), yL); ctx.lineTo(uToX(1), yR);
    ctx.lineTo(uToX(1), ar.y+ar.h); ctx.lineTo(uToX(0), ar.y+ar.h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,240,74,0.05)'; ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.moveTo(uToX(0), yL); ctx.lineTo(uToX(1), yR);
    ctx.stroke();
  }

  // Baseline
  ctx.beginPath();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
  ctx.moveTo(ar.x, ar.y+ar.h); ctx.lineTo(ar.x+ar.w, ar.y+ar.h);
  ctx.stroke();
}

// ══════════════════════════════════════════════════════
//  DRAW — MULTIPLIER (generic)
// ══════════════════════════════════════════════════════

const MULT_BINS = 100;

function drawMultCanvas(ctx, size, mult, hitBin, hitAlpha) {
  const ar = chartArea(size);
  ctx.clearRect(0, 0, size, size);

  const vals = Array.from({length: MULT_BINS}, (_, i) => {
    const u = (i+0.5)/MULT_BINS;
    return betaPDF(u, mult.alpha, mult.beta);
  });
  const pdfMax = Math.max(...vals, 1e-6);

  function binToX(i) { return ar.x + (i / MULT_BINS) * ar.w; }
  function dToY(d)   { return ar.y + ar.h - (d/pdfMax) * ar.h; }

  if (hitBin !== null && hitAlpha > 0) {
    const x0 = binToX(hitBin), x1 = binToX(hitBin+1);
    ctx.save();
    ctx.globalAlpha = hitAlpha;
    ctx.fillStyle = 'rgba(74,200,240,0.2)';
    ctx.fillRect(x0, ar.y, x1-x0, ar.h);
    const cx = binToX(hitBin+0.5);
    ctx.strokeStyle = '#4ac8f0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, ar.y); ctx.lineTo(cx, ar.y+ar.h); ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#c8e8f0'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  for (let i = 0; i < MULT_BINS; i++) {
    const x = binToX(i+0.5), y = dToY(vals[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < MULT_BINS; i++) {
    const x = binToX(i+0.5), y = dToY(vals[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(binToX(MULT_BINS), ar.y+ar.h);
  ctx.lineTo(binToX(0), ar.y+ar.h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(74,200,240,0.05)'; ctx.fill();

  const midX = ar.x + ar.w/2;
  ctx.beginPath();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.setLineDash([3,3]);
  ctx.moveTo(midX, ar.y); ctx.lineTo(midX, ar.y+ar.h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
  ctx.moveTo(ar.x, ar.y+ar.h); ctx.lineTo(ar.x+ar.w, ar.y+ar.h);
  ctx.stroke();
}

// ══════════════════════════════════════════════════════
//  CANVAS INSTANCES
// ══════════════════════════════════════════════════════

const gen1Canvas  = document.getElementById('gen-canvas');
const mult1Canvas = document.getElementById('mult-canvas');
const gen2Canvas  = document.getElementById('gen2-canvas');
const mult2Canvas = document.getElementById('mult2-canvas');

let gen1Ctx, gen1Size, mult1Ctx, mult1Size;
let gen2Ctx, gen2Size, mult2Ctx, mult2Size;

function initAllCanvas() {
  ({ ctx: gen1Ctx,  size: gen1Size  } = setupCanvas(gen1Canvas));
  ({ ctx: mult1Ctx, size: mult1Size } = setupCanvas(mult1Canvas));
  if (gen2Canvas.getBoundingClientRect().width > 0) {
    ({ ctx: gen2Ctx,  size: gen2Size  } = setupCanvas(gen2Canvas));
    ({ ctx: mult2Ctx, size: mult2Size } = setupCanvas(mult2Canvas));
  }
}

let gen1HitBin = null, gen1HitAlpha = 0;
let mult1HitBin = null, mult1HitAlpha = 0;
let gen2HitBin = null, gen2HitAlpha = 0;
let mult2HitBin = null, mult2HitAlpha = 0;

function drawGen1()  { drawGenCanvas(gen1Ctx, gen1Size, GEN1.slopeStep, GEN1.ascensionLevel, gen1HitBin, gen1HitAlpha, '#c8f04a', 'rgba(200,240,74,0.22)'); }
function drawMult1() { if (MULT1.unlocked) drawMultCanvas(mult1Ctx, mult1Size, MULT1, mult1HitBin, mult1HitAlpha); }
function drawGen2()  { if (gen2Ctx) drawGenCanvas(gen2Ctx, gen2Size, GEN2.slopeStep, GEN2.ascensionLevel, gen2HitBin, gen2HitAlpha, '#c8f04a', 'rgba(200,240,74,0.22)'); }
function drawMult2() { if (MULT2.unlocked && mult2Ctx) drawMultCanvas(mult2Ctx, mult2Size, MULT2, mult2HitBin, mult2HitAlpha); }

// ══════════════════════════════════════════════════════
//  ROLL
// ══════════════════════════════════════════════════════

let roll1Timer = null, roll1Start = performance.now();
let roll2Timer = null, roll2Start = performance.now();

const GEN2_MULTIPLIER = 5;

function doRoll1() {
  const raw = genRawSample(GEN1.slopeStep);
  const genRoll = applyPower(raw, GEN1.ascensionLevel);
  gen1HitBin   = Math.min(Math.floor(raw * BINS), BINS-1);
  gen1HitAlpha = 1.0;

  let multiplier = 1.0;
  if (MULT1.unlocked) {
    const mRoll = betaSample(MULT1.alpha, MULT1.beta);
    multiplier   = mRoll * 2;
    mult1HitBin  = Math.min(Math.floor(mRoll * MULT_BINS), MULT_BINS-1);
    mult1HitAlpha = 1.0;
  }

  const earned = genRoll * multiplier;
  score += earned;

  document.getElementById('stat-last').textContent = genRoll.toFixed(3);
  if (MULT1.unlocked) document.getElementById('mult-last').textContent = multiplier.toFixed(3) + '×';

  updateScore(); refreshUI();
  roll1Start = performance.now();
  document.getElementById('timer-bar').style.width = '0%';
}

function doRoll2() {
  if (!GEN2.unlocked) return;
  const raw = genRawSample(GEN2.slopeStep);
  const genRoll = applyPower(raw, GEN2.ascensionLevel);
  gen2HitBin   = Math.min(Math.floor(raw * BINS), BINS-1);
  gen2HitAlpha = 1.0;

  let multiplier = 1.0;
  if (MULT2.unlocked) {
    const mRoll = betaSample(MULT2.alpha, MULT2.beta);
    multiplier   = mRoll * 2;
    mult2HitBin  = Math.min(Math.floor(mRoll * MULT_BINS), MULT_BINS-1);
    mult2HitAlpha = 1.0;
  }

  const earned = genRoll * multiplier * GEN2_MULTIPLIER;
  score += earned;

  document.getElementById('stat2-last').textContent = (genRoll * GEN2_MULTIPLIER).toFixed(3);
  if (MULT2.unlocked) document.getElementById('mult2-last').textContent = multiplier.toFixed(3) + '×';

  updateScore(); refreshUI();
  roll2Start = performance.now();
  document.getElementById('timer-bar2').style.width = '0%';
}

function restartRoll1Timer() {
  if (roll1Timer) clearInterval(roll1Timer);
  roll1Timer = setInterval(doRoll1, GEN1.interval);
  roll1Start = performance.now();
}

function restartRoll2Timer() {
  if (roll2Timer) clearInterval(roll2Timer);
  roll2Timer = setInterval(doRoll2, GEN2.interval);
  roll2Start = performance.now();
}

// ══════════════════════════════════════════════════════
//  SCORE
// ══════════════════════════════════════════════════════

function updateScore() {
  const el = document.getElementById('score-val');
  el.textContent = score.toFixed(3);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 150);
}

// ══════════════════════════════════════════════════════
//  UI REFRESH
// ══════════════════════════════════════════════════════

function refreshUI() {
  // ── Gen 1 ──
  const step1 = GEN1.slopeStep;
  const asc1  = GEN1.ascensionLevel;
  const ev1   = genEV(step1, asc1);

  document.getElementById('card-sub').textContent =
    asc1 > 0
      ? `slope ${step1}/${SLOPE_STEPS}  ^${(1+asc1*0.1).toFixed(1)}`
      : `slope ${step1}/${SLOPE_STEPS}`;
  document.getElementById('stat-ev').textContent       = ev1.toFixed(4);
  document.getElementById('stat-interval').textContent = (GEN1.interval/1000).toFixed(2) + 's';

  const evWithMult1 = MULT1.unlocked ? ev1 * multEV(MULT1) : ev1;
  document.getElementById('per-roll-val').textContent  = '~' + evWithMult1.toFixed(3);

  // Slope 1
  const slopeMaxed1 = step1 >= SLOPE_STEPS;
  document.getElementById('upg-slope').classList.toggle('maxed', slopeMaxed1);
  const btnSlope = document.getElementById('btn-slope');
  if (slopeMaxed1) {
    btnSlope.disabled = true;
    document.getElementById('cost-slope').textContent     = 'DONE';
    document.getElementById('upg-slope-step').textContent = 'maxed';
  } else {
    const c = slopeCost(step1);
    btnSlope.disabled = score < c;
    document.getElementById('cost-slope').textContent     = c.toFixed(2);
    document.getElementById('upg-slope-step').textContent = `${step1} → ${step1+1}`;
  }

  const fill1 = document.getElementById('slope-progress-fill');
  if (fill1) fill1.style.width = (step1 / SLOPE_STEPS * 100) + '%';

  // Speed 1
  const speedMaxed1 = GEN1.interval <= 500;
  document.getElementById('upg-speed').classList.toggle('maxed', speedMaxed1);
  const btnSpeed = document.getElementById('btn-speed');
  const sc1 = speedCost(GEN1.speedCount);
  btnSpeed.disabled = speedMaxed1 || score < sc1;
  document.getElementById('cost-speed').textContent     = speedMaxed1 ? 'MAX' : sc1.toFixed(2);
  document.getElementById('upg-speed-step').textContent =
    speedMaxed1 ? '' : `→ ${(GEN1.interval*0.95/1000).toFixed(2)}s`;

  // Ascension 1
  document.getElementById('ascension-wrap').classList.toggle('hidden', !slopeMaxed1);

  // Mult 1 unlock
  const btnUnlock1 = document.getElementById('btn-unlock-mult');
  btnUnlock1.disabled = score < MULT1_UNLOCK_COST;
  if (MULT1.unlocked) {
    document.getElementById('mult-sub').textContent   = `α=${MULT1.alpha.toFixed(1)}, β=2`;
    document.getElementById('mult-alpha').textContent = MULT1.alpha.toFixed(1);
    document.getElementById('mult-ev').textContent    = multEV(MULT1).toFixed(3) + '×';
    const mac1 = mult1AlphaCost(MULT1.alphaCount);
    const btnMA1 = document.getElementById('btn-mult-alpha');
    btnMA1.disabled = score < mac1;
    document.getElementById('cost-mult-alpha').textContent     = mac1.toFixed(2);
    document.getElementById('upg-mult-alpha-step').textContent =
      `α ${MULT1.alpha.toFixed(1)} → ${(MULT1.alpha+0.1).toFixed(1)}`;
  }

  // ── Gen 2 visibility ──
  if (GEN2.unlocked) {

    const step2 = GEN2.slopeStep;
    const asc2  = GEN2.ascensionLevel;
    const ev2   = genEV(step2, asc2) * GEN2_MULTIPLIER;

    document.getElementById('card2-sub').textContent =
      asc2 > 0
        ? `slope ${step2}/${SLOPE_STEPS}  ^${(1+asc2*0.1).toFixed(1)}`
        : `slope ${step2}/${SLOPE_STEPS}`;
    document.getElementById('stat2-ev').textContent       = ev2.toFixed(4);
    document.getElementById('stat2-interval').textContent = (GEN2.interval/1000).toFixed(2) + 's';

    // Slope 2
    const slopeMaxed2 = step2 >= SLOPE_STEPS;
    document.getElementById('upg-slope2').classList.toggle('maxed', slopeMaxed2);
    const btnSlope2 = document.getElementById('btn-slope2');
    if (slopeMaxed2) {
      btnSlope2.disabled = true;
      document.getElementById('cost-slope2').textContent     = 'DONE';
      document.getElementById('upg-slope2-step').textContent = 'maxed';
    } else {
      const c2 = slope2Cost(step2);
      btnSlope2.disabled = score < c2;
      document.getElementById('cost-slope2').textContent     = c2.toFixed(2);
      document.getElementById('upg-slope2-step').textContent = `${step2} → ${step2+1}`;
    }

    const fill2 = document.getElementById('slope2-progress-fill');
    if (fill2) fill2.style.width = (step2 / SLOPE_STEPS * 100) + '%';

    // Speed 2
    const speedMaxed2 = GEN2.interval <= 1500;  // 3× Gen1 min
    document.getElementById('upg-speed2').classList.toggle('maxed', speedMaxed2);
    const btnSpeed2 = document.getElementById('btn-speed2');
    const sc2 = speed2Cost(GEN2.speedCount);
    btnSpeed2.disabled = speedMaxed2 || score < sc2;
    document.getElementById('cost-speed2').textContent     = speedMaxed2 ? 'MAX' : sc2.toFixed(2);
    document.getElementById('upg-speed2-step').textContent =
      speedMaxed2 ? '' : `→ ${(GEN2.interval*0.95/1000).toFixed(2)}s`;

    // Ascension 2
    document.getElementById('ascension2-wrap').classList.toggle('hidden', !slopeMaxed2);

    // Mult 2
    const btnUnlock2 = document.getElementById('btn-unlock-mult2');
    btnUnlock2.disabled = score < MULT2_UNLOCK_COST;
    if (MULT2.unlocked) {
      document.getElementById('mult2-sub').textContent   = `α=${MULT2.alpha.toFixed(1)}, β=2`;
      document.getElementById('mult2-alpha').textContent = MULT2.alpha.toFixed(1);
      document.getElementById('mult2-ev').textContent    = multEV(MULT2).toFixed(3) + '×';
      const mac2 = mult2AlphaCost(MULT2.alphaCount);
      const btnMA2 = document.getElementById('btn-mult-alpha2');
      btnMA2.disabled = score < mac2;
      document.getElementById('cost-mult-alpha2').textContent     = mac2.toFixed(2);
      document.getElementById('upg-mult-alpha2-step').textContent =
        `α ${MULT2.alpha.toFixed(1)} → ${(MULT2.alpha+0.1).toFixed(1)}`;
    }
  } else {
    // Show unlock button cost state
    const btnUnlock2 = document.getElementById('btn-unlock-gen2');
    if (btnUnlock2) btnUnlock2.disabled = score < GEN2_UNLOCK_COST;
  }
}

// ══════════════════════════════════════════════════════
//  BUTTON WIRING
// ══════════════════════════════════════════════════════

// Gen 1 slope
document.getElementById('btn-slope').addEventListener('click', () => {
  if (GEN1.slopeStep >= SLOPE_STEPS) return;
  const cost = slopeCost(GEN1.slopeStep);
  if (score < cost) return;
  score -= cost; GEN1.slopeStep++;
  updateScore(); refreshUI(); drawGen1();
});

// Gen 1 speed
document.getElementById('btn-speed').addEventListener('click', () => {
  if (GEN1.interval <= 500) return;
  const cost = speedCost(GEN1.speedCount);
  if (score < cost) return;
  score -= cost; GEN1.speedCount++;
  GEN1.interval = Math.max(500, Math.round(GEN1.interval * 0.95));
  restartRoll1Timer();
  updateScore(); refreshUI();
});

// Gen 1 ascend
document.getElementById('btn-ascend').addEventListener('click', () => {
  if (GEN1.slopeStep < SLOPE_STEPS) return;
  GEN1.slopeStep = 0;
  GEN1.ascensionLevel++;
  // Flash the card to signal ascension
  const card = document.querySelector('.gen-card');
  card.style.transition = 'box-shadow 0.2s';
  card.style.boxShadow = '0 0 16px 4px rgba(240,200,74,0.5)';
  setTimeout(() => { card.style.boxShadow = ''; }, 600);
  updateScore(); refreshUI(); drawGen1();
});

// Mult 1 unlock
document.getElementById('btn-unlock-mult').addEventListener('click', () => {
  if (score < MULT1_UNLOCK_COST) return;
  score -= MULT1_UNLOCK_COST;
  MULT1.unlocked = true;
  document.getElementById('lock-overlay').classList.add('hidden');
  document.getElementById('mult-upgrades').classList.remove('hidden');
  document.getElementById('mult-sub').textContent = `α=${MULT1.alpha.toFixed(1)}, β=2`;
  updateScore(); refreshUI(); drawMult1();
});

// Mult 1 alpha upgrade
document.getElementById('btn-mult-alpha').addEventListener('click', () => {
  if (!MULT1.unlocked) return;
  const cost = mult1AlphaCost(MULT1.alphaCount);
  if (score < cost) return;
  score -= cost; MULT1.alphaCount++;
  MULT1.alpha = Math.round((MULT1.alpha + 0.1) * 10) / 10;
  updateScore(); refreshUI(); drawMult1();
});

// Gen 2 unlock
document.getElementById('btn-unlock-gen2').addEventListener('click', () => {
  if (score < GEN2_UNLOCK_COST) return;
  score -= GEN2_UNLOCK_COST;
  GEN2.unlocked = true;
  document.getElementById('gen2-lock-panel').classList.add('hidden');
  document.getElementById('gen2-card').classList.remove('hidden');
  document.getElementById('mult2-card').classList.remove('hidden');
  document.getElementById('upgrades2-panel').classList.remove('hidden');
  // Init canvases now that they're visible
  ({ ctx: gen2Ctx,  size: gen2Size  } = setupCanvas(gen2Canvas));
  ({ ctx: mult2Ctx, size: mult2Size } = setupCanvas(mult2Canvas));
  restartRoll2Timer();
  updateScore(); refreshUI(); drawGen2();
});

// Gen 2 slope
document.getElementById('btn-slope2').addEventListener('click', () => {
  if (GEN2.slopeStep >= SLOPE_STEPS) return;
  const cost = slope2Cost(GEN2.slopeStep);
  if (score < cost) return;
  score -= cost; GEN2.slopeStep++;
  updateScore(); refreshUI(); drawGen2();
});

// Gen 2 speed
document.getElementById('btn-speed2').addEventListener('click', () => {
  if (GEN2.interval <= 1500) return;
  const cost = speed2Cost(GEN2.speedCount);
  if (score < cost) return;
  score -= cost; GEN2.speedCount++;
  GEN2.interval = Math.max(1500, Math.round(GEN2.interval * 0.95));
  restartRoll2Timer();
  updateScore(); refreshUI();
});

// Gen 2 ascend
document.getElementById('btn-ascend2').addEventListener('click', () => {
  if (GEN2.slopeStep < SLOPE_STEPS) return;
  GEN2.slopeStep = 0;
  GEN2.ascensionLevel++;
  const cards = document.querySelectorAll('.gen-card');
  const card2 = cards[2]; // third card is gen2
  if (card2) {
    card2.style.transition = 'box-shadow 0.2s';
    card2.style.boxShadow = '0 0 16px 4px rgba(240,200,74,0.5)';
    setTimeout(() => { card2.style.boxShadow = ''; }, 600);
  }
  updateScore(); refreshUI(); drawGen2();
});

// Mult 2 unlock
document.getElementById('btn-unlock-mult2').addEventListener('click', () => {
  if (score < MULT2_UNLOCK_COST) return;
  score -= MULT2_UNLOCK_COST;
  MULT2.unlocked = true;
  document.getElementById('lock-overlay2').classList.add('hidden');
  document.getElementById('mult2-upgrades').classList.remove('hidden');
  document.getElementById('mult2-sub').textContent = `α=${MULT2.alpha.toFixed(1)}, β=2`;
  updateScore(); refreshUI(); drawMult2();
});

// Mult 2 alpha upgrade
document.getElementById('btn-mult-alpha2').addEventListener('click', () => {
  if (!MULT2.unlocked) return;
  const cost = mult2AlphaCost(MULT2.alphaCount);
  if (score < cost) return;
  score -= cost; MULT2.alphaCount++;
  MULT2.alpha = Math.round((MULT2.alpha + 0.1) * 10) / 10;
  updateScore(); refreshUI(); drawMult2();
});

// ══════════════════════════════════════════════════════
//  ANIMATION LOOP
// ══════════════════════════════════════════════════════

function animLoop(ts) {
  // Timer bars
  document.getElementById('timer-bar').style.width =
    Math.min((ts - roll1Start) / GEN1.interval * 100, 100) + '%';
  if (GEN2.unlocked) {
    document.getElementById('timer-bar2').style.width =
      Math.min((ts - roll2Start) / GEN2.interval * 100, 100) + '%';
  }

  // Fade hit highlights
  if (gen1HitAlpha > 0)  { gen1HitAlpha  = Math.max(0, gen1HitAlpha  - 0.012); drawGen1(); }
  if (mult1HitAlpha > 0) { mult1HitAlpha = Math.max(0, mult1HitAlpha - 0.012); drawMult1(); }
  if (gen2HitAlpha > 0)  { gen2HitAlpha  = Math.max(0, gen2HitAlpha  - 0.012); drawGen2(); }
  if (mult2HitAlpha > 0) { mult2HitAlpha = Math.max(0, mult2HitAlpha - 0.012); drawMult2(); }

  requestAnimationFrame(animLoop);
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

// Inject slope progress bars
(function() {
  const row1 = document.getElementById('upg-slope');
  const bar1 = document.createElement('div');
  bar1.className = 'slope-progress';
  bar1.innerHTML = '<div class="slope-progress-fill" id="slope-progress-fill"></div>';
  row1.after(bar1);

  const row2 = document.getElementById('upg-slope2');
  if (row2) {
    const bar2 = document.createElement('div');
    bar2.className = 'slope-progress';
    bar2.innerHTML = '<div class="slope-progress-fill" id="slope2-progress-fill"></div>';
    row2.after(bar2);
  }
})();

function init() {
  initAllCanvas();
  refreshUI();
  drawGen1();
  requestAnimationFrame(animLoop);
  restartRoll1Timer();
}

window.addEventListener('resize', () => {
  ({ ctx: gen1Ctx,  size: gen1Size  } = setupCanvas(gen1Canvas));
  ({ ctx: mult1Ctx, size: mult1Size } = setupCanvas(mult1Canvas));
  drawGen1(); drawMult1();
  if (GEN2.unlocked) {
    ({ ctx: gen2Ctx, size: gen2Size } = setupCanvas(gen2Canvas));
    ({ ctx: mult2Ctx, size: mult2Size } = setupCanvas(mult2Canvas));
    drawGen2(); drawMult2();
  }
});

init();