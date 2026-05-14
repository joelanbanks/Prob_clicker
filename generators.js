// Generators use a blended power distribution on [0, 1].
// At n=0: fully left-skewed,  PDF = p * (1-x)^(p-1), EV = 1/(p+1)
// At n=10: fully right-skewed, PDF = p * x^(p-1),     EV = p/(p+1)
// Blend weight w = n/10 interpolates between the two.
//
// Gen 1: p=2, EV: 1/3 -> 2/3
// Gen 2: p=3, EV: 1/4 -> 3/4
// Gen 3: p=4, EV: 1/5 -> 4/5
// Gen 4: p=5, EV: 1/6 -> 5/6

function drawFromGen(n, p) {
  const w = n / 10;
  const u = Math.random();
  if (Math.random() < w) {
    return Math.pow(u, 1 / p);       // right-skewed draw
  } else {
    return 1 - Math.pow(u, 1 / p);   // left-skewed draw
  }
}

function genPDF(x, n, p) {
  if (x < 0 || x > 1) return 0;
  const w = n / 10;
  const left  = p * Math.pow(1 - x, p - 1);
  const right = p * Math.pow(x, p - 1);
  return (1 - w) * left + w * right;
}

function genEV(n, p) {
  const w = n / 10;
  return (1 - w) * (1 / (p + 1)) + w * (p / (p + 1));
}

function drawFromGen1(n) { return drawFromGen(n, 2); }
function drawFromGen2(n) { return drawFromGen(n, 3); }
function drawFromGen3(n) { return drawFromGen(n, 4); }
function drawFromGen4(n) { return drawFromGen(n, 5); }

function gen1PDF(x, n) { return genPDF(x, n, 2); }
function gen2PDF(x, n) { return genPDF(x, n, 3); }
function gen3PDF(x, n) { return genPDF(x, n, 4); }
function gen4PDF(x, n) { return genPDF(x, n, 5); }

function updateGen1Footer(n, tickspeed, mult) {
  const ev = genEV(n, 2);
  const evPerSec = (ev * mult) / tickspeed;
  document.getElementById('gen-1-ev').textContent = `EV: ${fmt_num(ev)}`;
  document.getElementById('gen-1-tickspeed').textContent = `Tick: ${fmt_num(tickspeed)}s`;
  document.getElementById('gen-1-mult').textContent = `Mult: x${fmt_num(mult)}`;
  document.getElementById('gen-1-ev-per-sec').textContent = `EV/s: ${fmt_num(evPerSec)}`;
}

function updateGen2Footer(n, tickspeed, mult) {
  const ev = genEV(n, 3);
  const evPerSec = (ev * mult) / tickspeed;
  document.getElementById('gen-2-ev').textContent = `EV: ${fmt_num(ev)}`;
  document.getElementById('gen-2-tickspeed').textContent = `Tick: ${fmt_num(tickspeed)}s`;
  document.getElementById('gen-2-mult').textContent = `Mult: x${fmt_num(mult)}`;
  document.getElementById('gen-2-ev-per-sec').textContent = `EV/s: ${fmt_num(evPerSec)}`;
}

function updateGen3Footer(n, tickspeed, mult) {
  const ev = genEV(n, 4);
  const evPerSec = (ev * mult) / tickspeed;
  document.getElementById('gen-3-ev').textContent = `EV: ${fmt_num(ev)}`;
  document.getElementById('gen-3-tickspeed').textContent = `Tick: ${fmt_num(tickspeed)}s`;
  document.getElementById('gen-3-mult').textContent = `Mult: x${fmt_num(mult)}`;
  document.getElementById('gen-3-ev-per-sec').textContent = `EV/s: ${fmt_num(evPerSec)}`;
}

function updateGen4Footer(n, tickspeed, mult) {
  const ev = genEV(n, 5);
  const evPerSec = (ev * mult) / tickspeed;
  document.getElementById('gen-4-ev').textContent = `EV: ${fmt_num(ev)}`;
  document.getElementById('gen-4-tickspeed').textContent = `Tick: ${fmt_num(tickspeed)}s`;
  document.getElementById('gen-4-mult').textContent = `Mult: x${fmt_num(mult)}`;
  document.getElementById('gen-4-ev-per-sec').textContent = `EV/s: ${fmt_num(evPerSec)}`;
}