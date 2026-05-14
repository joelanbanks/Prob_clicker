let gen1Slope = 0;
let gen1Slope_initcost = 10;
let gen1Slope_costscale = 1.4;

let gen2Slope = 0;
let gen2unlockcost = 10;
let gen2Slope_initcost = 100;
let gen2Slope_costscale = 1.4;

let gen3Slope = 0;
let gen3unlockcost = 100;
let gen3Slope_initcost = 1000;
let gen3Slope_costscale = 1.4;

let gen4Slope = 0;
let gen4unlockcost = 1000;
let gen4Slope_initcost = 10000;
let gen4Slope_costscale = 1.4;

let gen2Interval, gen3Interval, gen4Interval;

let gen2Unlocked = false;
let gen3Unlocked = false;
let gen4Unlocked = false;
const gen2UnlockBtn = document.getElementById("upg-gen2-unlock");
const gen3UnlockBtn = document.getElementById("upg-gen3-unlock");
const gen4UnlockBtn = document.getElementById("upg-gen4-unlock");

const gen1slopeBtn = document.getElementById("upg-gen1-slope");
const gen1slopeText = document.getElementById("gen-1-level");

const gen2slopeBtn = document.getElementById("upg-gen2-slope");
const gen2slopeText = document.getElementById("gen-2-level");

const gen3slopeBtn = document.getElementById("upg-gen3-slope");
const gen3slopeText = document.getElementById("gen-3-level");

const gen4slopeBtn = document.getElementById("upg-gen4-slope");
const gen4slopeText = document.getElementById("gen-4-level");

let gen1Speed = 1;
let gen1Speed_initcost = 10;
let gen1Speed_costscale = 1.4;

let gen2Speed = 1;
let gen2Speed_initcost = 100;
let gen2Speed_costscale = 1.4;

let gen3Speed = 1;
let gen3Speed_initcost = 1000;
let gen3Speed_costscale = 1.4;

let gen4Speed = 1;
let gen4Speed_initcost = 10000;
let gen4Speed_costscale = 1.4;

let gen1Mult = 1;
let gen2Mult = 5;
let gen3Mult = 25;
let gen4Mult = 125;

const gen1speedBtn = document.getElementById("upg-gen1-speed");
const gen2speedBtn = document.getElementById("upg-gen2-speed");
const gen3speedBtn = document.getElementById("upg-gen3-speed");
const gen4speedBtn = document.getElementById("upg-gen4-speed");

function getGen1SpeedPrice() { return gen1Speed_initcost * (gen1Speed_costscale ** (gen1Speed - 1)); }
function getGen2SpeedPrice() { return gen2Speed_initcost * (gen2Speed_costscale ** (gen2Speed - 1)); }
function getGen3SpeedPrice() { return gen3Speed_initcost * (gen3Speed_costscale ** (gen3Speed - 1)); }
function getGen4SpeedPrice() { return gen4Speed_initcost * (gen4Speed_costscale ** (gen4Speed - 1)); }

function getGen1SlopePrice() {
  return gen1Slope_initcost * ((gen1Slope_costscale) ** gen1Slope);
}

function getGen2SlopePrice() {
  return gen2Slope_initcost * ((gen2Slope_costscale) ** gen2Slope);
}

function getGen3SlopePrice() {
  return gen3Slope_initcost * ((gen3Slope_costscale) ** gen3Slope);
}

function getGen4SlopePrice() {
  return gen4Slope_initcost * ((gen4Slope_costscale) ** gen4Slope);
}

gen1slopeBtn.textContent = `Upgrade Gen 1 Level ${gen1Slope} -> Level ${gen1Slope+1} cost: ${fmt_num(gen1Slope_initcost)}`;
gen2slopeBtn.textContent = `Upgrade Gen 2 Level ${gen2Slope} -> Level ${gen2Slope+1} cost: ${fmt_num(gen2Slope_initcost)}`;
gen3slopeBtn.textContent = `Upgrade Gen 3 Level ${gen3Slope} -> Level ${gen3Slope+1} cost: ${fmt_num(gen3Slope_initcost)}`;
gen4slopeBtn.textContent = `Upgrade Gen 4 Level ${gen4Slope} -> Level ${gen4Slope+1} cost: ${fmt_num(gen4Slope_initcost)}`;

gen1speedBtn.textContent = `Speed Gen 1 x0.95 — cost: ${fmt_num(getGen1SpeedPrice())}`;
gen2speedBtn.textContent = `Speed Gen 2 x0.95 — cost: ${fmt_num(getGen2SpeedPrice())}`;
gen3speedBtn.textContent = `Speed Gen 3 x0.95 — cost: ${fmt_num(getGen3SpeedPrice())}`;
gen4speedBtn.textContent = `Speed Gen 4 x0.95 — cost: ${fmt_num(getGen4SpeedPrice())}`;

gen1slopeBtn.addEventListener("click", () => {
  if (score >= getGen1SlopePrice() && gen1Slope < 10) {

    score -= getGen1SlopePrice();
    scoreVal.textContent = fmt_num(score);

    gen1Slope += 1;

    gen1slopeText.textContent = `Level ${gen1Slope}/10`;
    gen1slopeBtn.textContent = `Upgrade Gen 1 Level ${gen1Slope} -> Level ${gen1Slope+1} cost: ${fmt_num(getGen1SlopePrice())}`;

    updateGen1Footer(gen1Slope,gen1CurrentDuration / 1000, gen1Mult);

    if (gen1Slope >= 10) {
        gen1slopeBtn.disabled = true;
        gen1slopeBtn.textContent = "Max Level";
    }
    }
});

gen2slopeBtn.addEventListener("click", () => {
  if (score >= getGen2SlopePrice() && gen2Slope < 10) {

    score -= getGen2SlopePrice();
    scoreVal.textContent = fmt_num(score);

    gen2Slope += 1;

    gen2slopeText.textContent = `Level ${gen2Slope}/10`;
    gen2slopeBtn.textContent = `Upgrade Gen 2 Level ${gen2Slope} -> Level ${gen2Slope+1} cost: ${fmt_num(getGen2SlopePrice())}`;

    updateGen2Footer(gen2Slope,gen2CurrentDuration / 1000, gen2Mult);

    if (gen2Slope >= 10) {
        gen2slopeBtn.disabled = true;
        gen2slopeBtn.textContent = "Max Level";
    }
    }
});

gen3slopeBtn.addEventListener("click", () => {
  if (score >= getGen3SlopePrice() && gen3Slope < 10) {

    score -= getGen3SlopePrice();
    scoreVal.textContent = fmt_num(score);

    gen3Slope += 1;

    gen3slopeText.textContent = `Level ${gen3Slope}/10`;
    gen3slopeBtn.textContent = `Upgrade Gen 3 Level ${gen3Slope} -> Level ${gen3Slope+1} cost: ${fmt_num(getGen3SlopePrice())}`;

    updateGen3Footer(gen3Slope,gen3CurrentDuration / 1000, gen3Mult);

    if (gen3Slope >= 10) {
        gen3slopeBtn.disabled = true;
        gen3slopeBtn.textContent = "Max Level";
    }
    }
});

gen4slopeBtn.addEventListener("click", () => {
  if (score >= getGen4SlopePrice() && gen4Slope < 10) {

    score -= getGen4SlopePrice();
    scoreVal.textContent = fmt_num(score);

    gen4Slope += 1;

    gen4slopeText.textContent = `Level ${gen4Slope}/10`;
    gen4slopeBtn.textContent = `Upgrade Gen 4 Level ${gen4Slope} -> Level ${gen4Slope+1} cost: ${fmt_num(getGen4SlopePrice())}`;

    updateGen4Footer(gen4Slope, gen4CurrentDuration / 1000, gen4Mult);

    if (gen4Slope >= 10) {
        gen4slopeBtn.disabled = true;
        gen4slopeBtn.textContent = "Max Level";
    }
    }
});

gen2UnlockBtn.addEventListener("click", () => {
  if (score >= gen2unlockcost && !gen2Unlocked) {
    score -= gen2unlockcost;
    scoreVal.textContent = fmt_num(score);
    gen2Unlocked = true;
    gen2UnlockBtn.style.display = "none";

    updateGen2Footer(gen2Slope, gen2CurrentDuration / 1000, gen2Mult);

    document.getElementById("upg-gen3-unlock").style.display = "block";
    document.getElementById("gen-2").style.display = "block";
    document.getElementById("upg-gen2-slope").style.display = "block";
    document.getElementById("upg-gen2-speed").style.display = "block";
    gen2Interval = setInterval(() => { runGen2(); resetGen2Bar(); }, gen2CurrentDuration);
    resetGen2Bar();
  }
});

gen3UnlockBtn.addEventListener("click", () => {
  if (score >= gen3unlockcost && !gen3Unlocked) {
    score -= gen3unlockcost;
    scoreVal.textContent = fmt_num(score);
    gen3Unlocked = true;
    gen3UnlockBtn.style.display = "none";

    updateGen3Footer(gen3Slope, gen3CurrentDuration / 1000, gen3Mult);

    document.getElementById("upg-gen4-unlock").style.display = "block";
    document.getElementById("gen-3").style.display = "block";
    document.getElementById("upg-gen3-slope").style.display = "block";
    document.getElementById("upg-gen3-speed").style.display = "block";
    gen3Interval = setInterval(() => { runGen3(); resetGen3Bar(); }, gen3CurrentDuration);
    resetGen3Bar();
  }
});

gen4UnlockBtn.addEventListener("click", () => {
  if (score >= gen4unlockcost && !gen4Unlocked) {
    score -= gen4unlockcost;
    scoreVal.textContent = fmt_num(score);
    gen4Unlocked = true;
    gen4UnlockBtn.style.display = "none";

    updateGen4Footer(gen4Slope, gen4CurrentDuration / 1000, gen4Mult);

    document.getElementById("gen-4").style.display = "block";
    document.getElementById("upg-gen4-slope").style.display = "block";
    document.getElementById("upg-gen4-speed").style.display = "block";
    gen4Interval = setInterval(() => { runGen4(); resetGen4Bar(); }, gen4CurrentDuration);
    resetGen4Bar();
  }
});

updateGen1Footer(0, gen1Duration / 1000, gen1Mult);

gen1speedBtn.addEventListener("click", () => {
  if (score >= getGen1SpeedPrice()) {
    score -= getGen1SpeedPrice();
    scoreVal.textContent = fmt_num(score);
    gen1Speed++;
    clearInterval(gen1Interval);
    const newDuration = gen1Duration * Math.pow(0.95, gen1Speed - 1);
    gen1CurrentDuration = newDuration;
    gen1Interval = setInterval(() => { runGen1(); resetGen1Bar(); }, newDuration);
    resetGen1Bar();
    updateGen1Footer(gen1Slope, newDuration / 1000, gen1Mult);
    gen1speedBtn.textContent = `Speed Gen 1 x0.95 — cost: ${fmt_num(getGen1SpeedPrice())}`;
  }
});

gen2speedBtn.addEventListener("click", () => {
  if (score >= getGen2SpeedPrice()) {
    score -= getGen2SpeedPrice();
    scoreVal.textContent = fmt_num(score);
    gen2Speed++;
    clearInterval(gen2Interval);
    const newDuration = gen2Duration * Math.pow(0.95, gen2Speed - 1);
    gen2CurrentDuration = newDuration;
    gen2Interval = setInterval(() => { runGen2(); resetGen2Bar(); }, newDuration);
    resetGen2Bar();
    updateGen2Footer(gen2Slope, newDuration / 1000, gen2Mult);
    gen2speedBtn.textContent = `Speed Gen 2 x0.95 — cost: ${fmt_num(getGen2SpeedPrice())}`;
  }
});

gen3speedBtn.addEventListener("click", () => {
  if (score >= getGen3SpeedPrice()) {
    score -= getGen3SpeedPrice();
    scoreVal.textContent = fmt_num(score);
    gen3Speed++;
    clearInterval(gen3Interval);
    const newDuration = gen3Duration * Math.pow(0.95, gen3Speed - 1);
    gen3CurrentDuration = newDuration;
    gen3Interval = setInterval(() => { runGen3(); resetGen3Bar(); }, newDuration);
    resetGen3Bar();
    updateGen3Footer(gen3Slope, newDuration / 1000, gen3Mult);
    gen3speedBtn.textContent = `Speed Gen 3 x0.95 — cost: ${fmt_num(getGen3SpeedPrice())}`;
  }
});

gen4speedBtn.addEventListener("click", () => {
  if (score >= getGen4SpeedPrice()) {
    score -= getGen4SpeedPrice();
    scoreVal.textContent = fmt_num(score);
    gen4Speed++;
    clearInterval(gen4Interval);
    const newDuration = gen4Duration * Math.pow(0.95, gen4Speed - 1);
    gen4CurrentDuration = newDuration;
    gen4Interval = setInterval(() => { runGen4(); resetGen4Bar(); }, newDuration);
    resetGen4Bar();
    updateGen4Footer(gen4Slope, newDuration / 1000, gen4Mult);
    gen4speedBtn.textContent = `Speed Gen 4 x0.95 — cost: ${fmt_num(getGen4SpeedPrice())}`;
  }
});