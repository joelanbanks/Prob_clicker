// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════

const SLOPE_STEPS = 10;

const GEN1 = {
  slopeStep:  0,
  interval:   5000,
  speedCount: 0,
};

const MULT = {
  unlocked:   false,
  alpha:       2.0,   // upgradeable; beta fixed at 2
  beta:        2.0,
  alphaCount:  0,     // number of alpha upgrades purchased
};

let score = 0;

// ══════════════════════════════════════════════════════
//  COSTS
// ══════════════════════════════════════════════════════

function slopeCost(step)      { return round2(Math.pow(2.2, step) * 0.4); }
function speedCost(count)     { return round2(Math.pow(2.5, count) * 2.0); }
function multAlphaCost(count) { return round2(Math.pow(1.8, count) * 3.0); }
const MULT_UNLOCK_COST = 10.0;

function round2(x) { return Math.round(x * 100) / 100; }

// ══════════════════════════════════════════════════════
//  GEN 1 DISTRIBUTION  (linear ramp)
//  a = 1-t, b = t  where t = slopeStep/SLOPE_STEPS
//  PDF: f(u) = 2*(a+(b-a)*u)/(a+b)
//  Inverse CDF via quadratic
// ══════════════════════════════════════════════════════

function gen1AB() {
  const t = GEN1.slopeStep / SLOPE_STEPS;
  return { a: 1 - t, b: t };
}

function gen1Sample() {
  const { a, b } = gen1AB();
  const p = Math.random();
  if (Math.abs(b - a) < 1e-9) return p;
  const A = b - a, B = 2 * a, C = -p * (a + b);
  return Math.max(0, Math.min(1, (-B + Math.sqrt(B*B - 4*A*C)) / (2*A)));
}

function gen1EV() {
  const { a, b } = gen1AB();
  if (a + b < 1e-12) return 0.5;
  return (a + 2*b) / (3*(a+b));
}

function gen1PDF(u) {
  const { a, b } = gen1AB();
  if (a + b < 1e-12) return 1;
  return 2*(a + (b-a)*u) / (a+b);
}

// ══════════════════════════════════════════════════════
//  MULTIPLIER DISTRIBUTION  (Beta(alpha, beta))
//  Roll is doubled → multiplier = roll * 2
//  E[multiplier] = 2 * alpha/(alpha+beta)
//  Sampling via gamma ratio (Marsaglia & Tsang)
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

function multSample() {
  return betaSample(MULT.alpha, MULT.beta) * 2;  // doubled
}

function multEV() {
  return 2 * MULT.alpha / (MULT.alpha + MULT.beta);
}

// Beta PDF for display (on [0,1] unit space, then we show x-axis as 0→2)
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
  // Make it square based on its CSS width
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  const size = rect.width;           // use width as both dimensions
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.height = size + 'px'; // enforce square in CSS too
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, size };
}

const PAD = 14;

function chartArea(size) {
  return { x: PAD, y: PAD, w: size - PAD*2, h: size - PAD*2 };
}

// ══════════════════════════════════════════════════════
//  DRAW — GEN 1
// ══════════════════════════════════════════════════════

const genCanvas = document.getElementById('gen-canvas');
let genCtx, genSize;

function initGenCanvas() {
  ({ ctx: genCtx, size: genSize } = setupCanvas(genCanvas));
}

let gen1HitBin = null, gen1HitAlpha = 0;
const BINS = 100;

function drawGen1() {
  const ar = chartArea(genSize);
  genCtx.clearRect(0, 0, genSize, genSize);

  function uToX(u) { return ar.x + u * ar.w; }
  function dToY(d)  {
    // max density of the ramp is max(a,b)*2/(a+b), cap at 2.5 for headroom
    return ar.y + ar.h - Math.min(d / 2.5, 1) * ar.h;
  }

  // Hit bin
  if (gen1HitBin !== null && gen1HitAlpha > 0) {
    const x0 = uToX(gen1HitBin / BINS);
    const x1 = uToX((gen1HitBin+1) / BINS);
    genCtx.save();
    genCtx.globalAlpha = gen1HitAlpha;
    genCtx.fillStyle = 'rgba(200,240,74,0.22)';
    genCtx.fillRect(x0, ar.y, x1-x0, ar.h);
    const cx = uToX((gen1HitBin+0.5)/BINS);
    genCtx.strokeStyle = '#c8f04a'; genCtx.lineWidth = 1.5;
    genCtx.beginPath(); genCtx.moveTo(cx, ar.y); genCtx.lineTo(cx, ar.y+ar.h); genCtx.stroke();
    genCtx.restore();
  }

  // Filled area
  const yL = dToY(gen1PDF(0)), yR = dToY(gen1PDF(1));
  genCtx.beginPath();
  genCtx.moveTo(uToX(0), yL); genCtx.lineTo(uToX(1), yR);
  genCtx.lineTo(uToX(1), ar.y+ar.h); genCtx.lineTo(uToX(0), ar.y+ar.h);
  genCtx.closePath();
  genCtx.fillStyle = 'rgba(200,240,74,0.05)'; genCtx.fill();

  // PDF line
  genCtx.beginPath();
  genCtx.strokeStyle = '#e8e8e8'; genCtx.lineWidth = 2; genCtx.lineCap = 'round';
  genCtx.moveTo(uToX(0), yL); genCtx.lineTo(uToX(1), yR);
  genCtx.stroke();

  // Baseline
  genCtx.beginPath();
  genCtx.strokeStyle = '#2a2a2a'; genCtx.lineWidth = 1;
  genCtx.moveTo(ar.x, ar.y+ar.h); genCtx.lineTo(ar.x+ar.w, ar.y+ar.h);
  genCtx.stroke();
}

// ══════════════════════════════════════════════════════
//  DRAW — MULTIPLIER
// ══════════════════════════════════════════════════════

const multCanvas = document.getElementById('mult-canvas');
let multCtx, multSize;

function initMultCanvas() {
  ({ ctx: multCtx, size: multSize } = setupCanvas(multCanvas));
}

let multHitBin = null, multHitAlpha = 0;
const MULT_BINS = 100;

function drawMult() {
  if (!MULT.unlocked) return;
  const ar = chartArea(multSize);
  multCtx.clearRect(0, 0, multSize, multSize);

  // Precompute beta PDF values on [0,1], displayed as [0,2] on x-axis
  const vals = Array.from({length: MULT_BINS}, (_, i) => {
    const u = (i+0.5)/MULT_BINS;
    return betaPDF(u, MULT.alpha, MULT.beta);
  });
  const pdfMax = Math.max(...vals, 1e-6);

  function binToX(i) { return ar.x + (i / MULT_BINS) * ar.w; }
  function dToY(d)   { return ar.y + ar.h - (d/pdfMax) * ar.h; }

  // Hit bin
  if (multHitBin !== null && multHitAlpha > 0) {
    const x0 = binToX(multHitBin);
    const x1 = binToX(multHitBin+1);
    multCtx.save();
    multCtx.globalAlpha = multHitAlpha;
    multCtx.fillStyle = 'rgba(74,200,240,0.2)';
    multCtx.fillRect(x0, ar.y, x1-x0, ar.h);
    const cx = binToX(multHitBin+0.5);
    multCtx.strokeStyle = '#4ac8f0'; multCtx.lineWidth = 1.5;
    multCtx.beginPath(); multCtx.moveTo(cx, ar.y); multCtx.lineTo(cx, ar.y+ar.h); multCtx.stroke();
    multCtx.restore();
  }

  // PDF curve (smooth polyline through bin centers)
  multCtx.beginPath();
  multCtx.strokeStyle = '#c8e8f0'; multCtx.lineWidth = 2; multCtx.lineJoin = 'round';
  for (let i = 0; i < MULT_BINS; i++) {
    const x = binToX(i+0.5), y = dToY(vals[i]);
    if (i === 0) multCtx.moveTo(x, y); else multCtx.lineTo(x, y);
  }
  multCtx.stroke();

  // Filled area under curve
  multCtx.beginPath();
  for (let i = 0; i < MULT_BINS; i++) {
    const x = binToX(i+0.5), y = dToY(vals[i]);
    if (i === 0) multCtx.moveTo(x, y); else multCtx.lineTo(x, y);
  }
  multCtx.lineTo(binToX(MULT_BINS), ar.y+ar.h);
  multCtx.lineTo(binToX(0), ar.y+ar.h);
  multCtx.closePath();
  multCtx.fillStyle = 'rgba(74,200,240,0.05)'; multCtx.fill();

  // Midline at x=0.5 (= 1.0× multiplier)
  const midX = ar.x + ar.w/2;
  multCtx.beginPath();
  multCtx.strokeStyle = '#333'; multCtx.lineWidth = 1;
  multCtx.setLineDash([3,3]);
  multCtx.moveTo(midX, ar.y); multCtx.lineTo(midX, ar.y+ar.h);
  multCtx.stroke();
  multCtx.setLineDash([]);

  // Baseline
  multCtx.beginPath();
  multCtx.strokeStyle = '#2a2a2a'; multCtx.lineWidth = 1;
  multCtx.moveTo(ar.x, ar.y+ar.h); multCtx.lineTo(ar.x+ar.w, ar.y+ar.h);
  multCtx.stroke();
}

// ══════════════════════════════════════════════════════
//  ROLL
// ══════════════════════════════════════════════════════

let rollTimer = null;
let rollStart = performance.now();

function doRoll() {
  // Gen 1 roll
  const genRoll = gen1Sample();
  gen1HitBin   = Math.min(Math.floor(genRoll * BINS), BINS-1);
  gen1HitAlpha = 1.0;

  // Multiplier roll
  let multiplier = 1.0;
  if (MULT.unlocked) {
    const mRoll = betaSample(MULT.alpha, MULT.beta); // [0,1]
    multiplier  = mRoll * 2;                          // doubled
    multHitBin   = Math.min(Math.floor(mRoll * MULT_BINS), MULT_BINS-1);
    multHitAlpha = 1.0;
  }

  const earned = genRoll * multiplier;
  score += earned;

  updateScore();
  refreshUI();

  // Last roll display
  document.getElementById('stat-last').textContent = genRoll.toFixed(3);
  if (MULT.unlocked) {
    document.getElementById('mult-last').textContent = multiplier.toFixed(3) + '×';
  }

  rollStart = performance.now();
  document.getElementById('timer-bar').style.width = '0%';
}

function restartRollTimer() {
  if (rollTimer) clearInterval(rollTimer);
  rollTimer = setInterval(doRoll, GEN1.interval);
  rollStart = performance.now();
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
  const step = GEN1.slopeStep;
  const ev   = gen1EV();

  // Gen 1 card
  document.getElementById('card-sub').textContent      = `slope ${step} / ${SLOPE_STEPS}`;
  document.getElementById('stat-ev').textContent       = ev.toFixed(4);
  document.getElementById('stat-interval').textContent = (GEN1.interval/1000).toFixed(2) + 's';

  // Per roll — includes expected multiplier if active
  const evWithMult = MULT.unlocked ? ev * multEV() : ev;
  document.getElementById('per-roll-val').textContent  = '~' + evWithMult.toFixed(3);

  // Slope upgrade
  const slopeMaxed = step >= SLOPE_STEPS;
  document.getElementById('upg-slope').classList.toggle('maxed', slopeMaxed);
  const btnSlope = document.getElementById('btn-slope');
  if (slopeMaxed) {
    btnSlope.disabled = true;
    document.getElementById('cost-slope').textContent     = 'DONE';
    document.getElementById('upg-slope-step').textContent = 'maxed';
  } else {
    const c = slopeCost(step);
    btnSlope.disabled = score < c;
    document.getElementById('cost-slope').textContent     = c.toFixed(2);
    document.getElementById('upg-slope-step').textContent = `${step} → ${step+1}`;
  }

  // Slope progress bar
  const fill = document.getElementById('slope-progress-fill');
  if (fill) fill.style.width = (step / SLOPE_STEPS * 100) + '%';

  // Speed upgrade
  const speedMaxed = GEN1.interval <= 500;
  document.getElementById('upg-speed').classList.toggle('maxed', speedMaxed);
  const btnSpeed = document.getElementById('btn-speed');
  const sc = speedCost(GEN1.speedCount);
  btnSpeed.disabled = speedMaxed || score < sc;
  document.getElementById('cost-speed').textContent     = speedMaxed ? 'MAX' : sc.toFixed(2);
  document.getElementById('upg-speed-step').textContent =
    speedMaxed ? '' : `→ ${(GEN1.interval*0.95/1000).toFixed(2)}s`;

  // Ascension
  document.getElementById('ascension-wrap').classList.toggle('hidden', !slopeMaxed);

  // Multiplier unlock button
  const btnUnlock = document.getElementById('btn-unlock-mult');
  btnUnlock.disabled = score < MULT_UNLOCK_COST;

  // Multiplier card stats
  if (MULT.unlocked) {
    document.getElementById('mult-sub').textContent   = `α=${MULT.alpha.toFixed(1)}, β=2`;
    document.getElementById('mult-alpha').textContent = MULT.alpha.toFixed(1);
    document.getElementById('mult-ev').textContent    = multEV().toFixed(3) + '×';
  }

  // Multiplier alpha upgrade
  if (MULT.unlocked) {
    const mac = multAlphaCost(MULT.alphaCount);
    const btnMA = document.getElementById('btn-mult-alpha');
    btnMA.disabled = score < mac;
    document.getElementById('cost-mult-alpha').textContent     = mac.toFixed(2);
    document.getElementById('upg-mult-alpha-step').textContent =
      `α ${MULT.alpha.toFixed(1)} → ${(MULT.alpha+0.1).toFixed(1)}`;
  }
}

// ══════════════════════════════════════════════════════
//  BUTTON WIRING
// ══════════════════════════════════════════════════════

document.getElementById('btn-slope').addEventListener('click', () => {
  if (GEN1.slopeStep >= SLOPE_STEPS) return;
  const cost = slopeCost(GEN1.slopeStep);
  if (score < cost) return;
  score -= cost;
  GEN1.slopeStep++;
  updateScore(); refreshUI(); drawGen1();
});

document.getElementById('btn-speed').addEventListener('click', () => {
  if (GEN1.interval <= 500) return;
  const cost = speedCost(GEN1.speedCount);
  if (score < cost) return;
  score -= cost;
  GEN1.speedCount++;
  GEN1.interval = Math.max(500, Math.round(GEN1.interval * 0.95));
  restartRollTimer();
  updateScore(); refreshUI();
});

document.getElementById('btn-ascend').addEventListener('click', () => {
  alert('Ascension coming in the next version!');
});

document.getElementById('btn-unlock-mult').addEventListener('click', () => {
  if (score < MULT_UNLOCK_COST) return;
  score -= MULT_UNLOCK_COST;
  MULT.unlocked = true;
  document.getElementById('lock-overlay').classList.add('hidden');
  document.getElementById('mult-upgrades').classList.remove('hidden');
  document.getElementById('mult-sub').textContent = `α=${MULT.alpha.toFixed(1)}, β=2`;
  updateScore(); refreshUI(); drawMult();
});

document.getElementById('btn-mult-alpha').addEventListener('click', () => {
  if (!MULT.unlocked) return;
  const cost = multAlphaCost(MULT.alphaCount);
  if (score < cost) return;
  score -= cost;
  MULT.alphaCount++;
  MULT.alpha = Math.round((MULT.alpha + 0.1) * 10) / 10;
  updateScore(); refreshUI(); drawMult();
});

// ══════════════════════════════════════════════════════
//  ANIMATION LOOP
// ══════════════════════════════════════════════════════

function animLoop(ts) {
  document.getElementById('timer-bar').style.width =
    Math.min((ts - rollStart) / GEN1.interval * 100, 100) + '%';

  if (gen1HitAlpha > 0) {
    gen1HitAlpha = Math.max(0, gen1HitAlpha - 0.012);
    drawGen1();
  }
  if (multHitAlpha > 0) {
    multHitAlpha = Math.max(0, multHitAlpha - 0.012);
    drawMult();
  }
  requestAnimationFrame(animLoop);
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

// Inject slope progress bar
(function() {
  const row = document.getElementById('upg-slope');
  const bar = document.createElement('div');
  bar.className = 'slope-progress';
  bar.innerHTML = '<div class="slope-progress-fill" id="slope-progress-fill"></div>';
  row.after(bar);
})();

function init() {
  initGenCanvas();
  initMultCanvas();
  refreshUI();
  drawGen1();
  requestAnimationFrame(animLoop);
  restartRollTimer();
}

window.addEventListener('resize', () => {
  initGenCanvas(); drawGen1();
  initMultCanvas(); drawMult();
});

init();