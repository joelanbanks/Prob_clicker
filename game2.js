let score = 0;
const scoreVal = document.getElementById("score-val");

const gen1ProgressBar = document.getElementById("gen-1-progress");
const gen1Duration = 1000;

const gen2ProgressBar = document.getElementById("gen-2-progress");
const gen2Duration = 1000;

const gen3ProgressBar = document.getElementById("gen-3-progress");
const gen3Duration = 1000;

const gen4ProgressBar = document.getElementById("gen-4-progress");
const gen4Duration = 1000;

function runGen1() {
  const x = drawFromGen1(gen1Slope);

  score += x;
  scoreVal.textContent = fmt_num(score)

//   console.log("drawn x:", x);
}

function runGen2() {
  const x = drawFromGen2(gen2Slope);

  score += x;
  scoreVal.textContent = fmt_num(score)

//   console.log("drawn x:", x);
}

function runGen3() {
  const x = drawFromGen3(gen3Slope);

  score += x;
  scoreVal.textContent = fmt_num(score)

//   console.log("drawn x:", x);
}

function runGen4() {
  const x = drawFromGen4(gen4Slope);

  score += x;
  scoreVal.textContent = fmt_num(score)

//   console.log("drawn x:", x);
}

function fmt_num(num) {
    return num.toFixed(3);
}

function resetGen1Bar() {
  gen1ProgressBar.style.transition = "none";
  gen1ProgressBar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gen1ProgressBar.style.transition = `width ${gen1Duration}ms linear`;
      gen1ProgressBar.style.width = "100%";
    });
  });
}

function resetGen2Bar() {
  gen2ProgressBar.style.transition = "none";
  gen2ProgressBar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gen2ProgressBar.style.transition = `width ${gen2Duration}ms linear`;
      gen2ProgressBar.style.width = "100%";
    });
  });
}

function resetGen3Bar() {
  gen3ProgressBar.style.transition = "none";
  gen3ProgressBar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gen3ProgressBar.style.transition = `width ${gen3Duration}ms linear`;
      gen3ProgressBar.style.width = "100%";
    });
  });
}

function resetGen4Bar() {
  gen4ProgressBar.style.transition = "none";
  gen4ProgressBar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gen4ProgressBar.style.transition = `width ${gen4Duration}ms linear`;
      gen4ProgressBar.style.width = "100%";
    });
  });
}

const gen1Interval = setInterval(() => {
  runGen1();
  resetGen1Bar();
}, gen1Duration);

resetGen1Bar();