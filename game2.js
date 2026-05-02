let score = 10000;
const scoreVal = document.getElementById("score-val");

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

const gen1Interval = setInterval(runGen1, 1000);