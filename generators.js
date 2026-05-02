function gen1PDF(x, n) {
  if (x < 0 || x > 1) return 0;

  return 2 * ((1 - n / 10) + x * (n / 5 - 1));
}

function drawFromGen1(n) {
  // n should be from 0 to 10
  const u = Math.random();

  const a = 1 - n / 10;
  const b = n / 5 - 1;

  // PDF is 2(a + bx)
  // CDF is 2ax + bx^2

  if (Math.abs(b) < 1e-12) {
    // This happens when n = 5, giving a uniform distribution
    return u;
  }

  return (-a + Math.sqrt(a * a + b * u)) / b;
}

function gen2PDF(x, n) {
  if (x < 0 || x > 1) return 0;
  const A = 2 - n / 5;
  const B = 2 * n / 5 - 2;
  return A + B * x;
}

function drawFromGen2(n) {
  const u = Math.random();
  const A = 2 - n / 5;
  const B = 2 * n / 5 - 2;
  if (Math.abs(B) < 1e-9) return u; // n=5, uniform

  // CDF: A*x + B/2*x^2 = u  =>  B/2*x^2 + A*x - u = 0
  return (-A + Math.sqrt(A * A + 2 * B * u)) / B;
}

function gen3PDF(x, n) {
  if (x < 0 || x > 1) return 0;
  const A = 3 - n / 5;
  const B = 2 * n / 5 - 3;
  return A + B * x;
}
function drawFromGen3(n) {
  const u = Math.random();
  const A = 3 - n / 5;
  const B = 2 * n / 5 - 3;
  if (Math.abs(B) < 1e-9) return u;
  return (-A + Math.sqrt(A * A + 2 * B * u)) / B;
}

function gen4PDF(x, n) {
  if (x < 0 || x > 1) return 0;
  const A = 5 - n / 5;
  const B = 2 * n / 5 - 5;
  return A + B * x;
}
function drawFromGen4(n) {
  const u = Math.random();
  const A = 5 - n / 5;
  const B = 2 * n / 5 - 5;
  if (Math.abs(B) < 1e-9) return u;
  return (-A + Math.sqrt(A * A + 2 * B * u)) / B;
}