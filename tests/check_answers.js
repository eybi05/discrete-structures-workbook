// Cross-check every answer key embedded in the page against the original problem data.
const fs = require('fs');
const C = require('../src/core.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8').split('<script>')[0];
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
const checks = [];
const re = /<div class="check"([^>]*)><\/div>/g;
let m;
while ((m = re.exec(html))) {
  const attrs = {};
  m[1].replace(/data-([a-z-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = decode(v); });
  const before = html.slice(0, m.index);
  const owner = [...before.matchAll(/<article class="prob" id="([^"]+)"/g)].pop();
  attrs.owner = owner ? owner[1] : '?';
  checks.push(attrs);
}
let fails = 0;
const bad = (msg) => { fails++; console.log('FAIL', msg); };

// 1. every key grades itself as fully correct
for (const c of checks) {
  let res;
  if (c.kind === 'bits') res = C.gradeBits(c.answer, c.answer);
  else if (c.kind === 'set') res = C.gradeSet(c.answer === '' ? '∅' : c.answer, c.answer);
  else if (c.kind === 'num') res = C.gradeNum(c.answer, c.answer);
  else if (c.kind === 'pairs') res = C.gradePairs(c.answer, c.answer);
  else res = C.grade(c.answer, { answer: c.answer, vars: [...c.vars], mode: c.mode || 'eq', only: c.only ? c.only.split(',') : null });
  if (res.status !== 'ok') bad(`${c.owner} ${c.label}: key does not grade as ok -> ${res.status}: ${res.msg}`);
}

// 2. keys must match the original problems (independent data typed from the statements)
const tt = (e, v) => C.table(C.parse(e), [...v]).join('');
const AND = (...s) => s[0].split('').map((_, i) => (s.every((x) => x[i] === '1') ? '1' : '0')).join('');
const OR = (...s) => s[0].split('').map((_, i) => (s.some((x) => x[i] === '1') ? '1' : '0')).join('');
const NOT = (s) => s.split('').map((c) => (c === '1' ? '0' : '1')).join('');
const fromMinterms = (ms, n) => C.csopStr(ms, ['x', 'y', 'z', 't'].slice(0, n));
const expected = {
  // owner|label : original expression (bool) or computed string (bits)
  'p2-9|p → q ≡': '(p → q)', 'p2-9|p ↔ q ≡': '(p ↔ q)', 'p2-9|p ⊕ q ≡': '(p ⊕ q)', 'p2-9|¬(p → q) ≡': '¬(p → q)',
  'p3-6|(a)': null, 'p3-6|(b)': null,
  'p4-4|Y =': "AB'+A'C+BC'", 'p4-6|Y =': "ABC+AB'C+A'BC+A'B'C", 'p4-8|Y =': "(A+B)'+(A'+B)'",
  'p5-1|(a) x′yzx′t =': "x'yzx't", 'p5-1|(b) xy′ztx =': "xy'ztx", 'p5-1|(c) yz′xy′ =': "yz'xy'", 'p5-1|(d) z′xtz′x′ =': "z'xtz'x'", 'p5-1|(e) t′yt′x =': "t'yt'x",
  'p5-4|(a) SoP:': "(x+y)(x'+z)", 'p5-4|(a) CSoP:': "(x+y)(x'+z)", 'p5-4|(b) SoP:': "(xy'+z)'", 'p5-4|(b) CSoP:': "(xy'+z)'",
  'p5-4|(c) SoP:': "x'(y+z')'+yz", 'p5-4|(c) CSoP:': "x'(y+z')'+yz", 'p5-4|(d) SoP:': "(x'+yz)(x+z')'", 'p5-4|(d) CSoP:': "(x'+yz)(x+z')'",
  'p5-6|MSoP =': "x'y'+x'yz+xyz", 'p5-7|(a)': "(A+B')'(A+C)", 'p5-7|(b)': "(AB)'(A+B)",
  'p6-1|E =': "x'yz+x'yz'+xyz'+xy'z'", 'p6-2|E =': "xyz+xy'z+x'yz+x'y'z+xyz'",
  'p6-3|first =': "x'y'z'+x'y'z+x'yz'+xy'z+xyz'+xyz", 'p6-3|second =': "x'y'z'+x'y'z+x'yz'+xy'z+xyz'+xyz",
  'p6-4|E =': fromMinterms([0, 2, 4, 7, 8, 10, 12, 15], 4), 'p6-5|E =': fromMinterms([1, 5, 6, 9, 11, 13, 14], 4),
  'p6-6|one =': fromMinterms([0, 1, 3, 7, 8, 12, 14], 4), 'p6-6|another =': fromMinterms([0, 1, 3, 7, 8, 12, 14], 4), 'p6-6|third =': fromMinterms([0, 1, 3, 7, 8, 12, 14], 4),
  'p6-7|E =': "xz+xy'z'+x'yt+x'y'z't'", 'p6-8|Y =': "ABC+ABC'+AB'C+A'BC",
  'p7-4|CSoP:': '#01100110', 'p7-4|MSoP:': '#01100110', 'p7-5|(a) E =': '#11110000', 'p7-5|(b) E =': '#00001111', 'p7-6|Y =': '#11010001',
  'hw-t9|∃!x P(x) ≡': null,
  'hw-21|(a) xy′zxy′ =': "xy'zxy'", 'hw-21|(b) xyz′sy′ts =': "xyz'sy'ts", 'hw-21|(c) xy′xz′ty′ =': "xy'xz'ty'", 'hw-21|(d) xyz′ty′t =': "xyz'ty't",
  'hw-22|(a) SoP:': "x(xy'+x'y+y'z)", 'hw-22|(a) CSoP:': "x(xy'+x'y+y'z)", 'hw-22|(b) SoP:': "(x+y'z)(y+z')", 'hw-22|(b) CSoP:': "(x+y'z)(y+z')",
  'hw-22|(c) SoP:': "(x'+y)'+y'z", 'hw-22|(c) CSoP:': "(x'+y)'+y'z", 'hw-22|(d) SoP:': "(x'y)'(x'+xyz')", 'hw-22|(d) CSoP:': "(x'y)'(x'+xyz')",
  'hw-22|(e) SoP:': "(x+y)'(xy')'", 'hw-22|(e) CSoP:': "(x+y)'(xy')'", 'hw-22|(f) SoP:': "y(x+yz)'", 'hw-22|(f) CSoP:': "y(x+yz)'",
  'hw-23|(a) E₁ =': "xy'z'+x'y+x'y'z'+x'yz", 'hw-23|(b) E₂ =': "xy'+x'z't+xyzt'+x'y'zt'", 'hw-23|(c) E₃ =': "xyzt+xyz't'+xz't'+x'y'z'+x'yz't",
  'hw-24|(a) Y =': "A'BC+A'C'+BC'", 'hw-24|(b) Y =': "ABC+A'BC+AB'C'",
  'hw-210|(a) E =': '#10001010', 'hw-210|(b) E =': '#00010001', 'hw-210|(c) E =': '#00110000',
  'hw-211|(a) one =': fromMinterms([2, 4, 5, 6, 7, 9, 10, 11, 13, 14], 4), 'hw-211|(a) another =': fromMinterms([2, 4, 5, 6, 7, 9, 10, 11, 13, 14], 4),
  'hw-211|(a) third =': fromMinterms([2, 4, 5, 6, 7, 9, 10, 11, 13, 14], 4), 'hw-211|(b) E =': fromMinterms([2, 4, 6, 7, 8, 9, 10, 12, 14, 15], 4),
  'hw-212|(a) E =': "y'z+y'z't'+z't", 'hw-212|(b) E =': "y'zt+xzt'+xy'z'",
  'hw-213|(a) circuit Y =': "AB'C+ABC'+AB'C'", 'hw-213|(a) minimal Y =': "AB'C+ABC'+AB'C'", 'hw-213|(b) circuit Y =': "ABC+A'BC'+ABC'", 'hw-213|(b) minimal Y =': "ABC+A'BC'+ABC'",
  'hw-214|(b) L =': '#01101001',
  // Midterm 1 (Fall 2025): truth tables and K-map cells typed from the solution sheets
  'mt-a1|Step 1 CSoP:': '#10011011', 'mt-a1|Step 3 MSoP:': '#10011011',
  'mt-a2|Step 1 SoP:': "(xy'+z')'(x+yz')+(x'z+y)(y'z)'+x'z+xy'z'", 'mt-a2|Step 2 CSoP:': "(xy'+z')'(x+yz')+(x'z+y)(y'z)'+x'z+xy'z'",
  'mt-a3|Step 1 CSoP:': '#11011001', 'mt-a3|Step 2 MSoP:': '#11011001',
  'mt-a4|(A) E =': "xyz't'+xyz't+xy'zt+xy'zt'+xy'z't'+x'y'zt'+x'yzt+x'yz't'+x'yz't",
  'mt-a4|(B) E =': "xyzt+xyz't'+xyz't+xy'+x'y'z't'+x'yzt+x'yz't'+x'yz't",
  'mt-b1|Step 1 CSoP:': '#01010111', 'mt-b1|Step 3 MSoP:': '#01010111',
  'mt-b2|Step 1 SoP:': "(xy+z')(x+y'z')'+(xy'+z)'(yz')'+x'y+x'yz'", 'mt-b2|Step 2 CSoP:': "(xy+z')(x+y'z')'+(xy'+z)'(yz')'+x'y+x'yz'",
  'mt-b3|Step 1 CSoP:': '#10110011', 'mt-b3|Step 2 MSoP:': '#10110011',
  'mt-b4|(A) E =': "xyzt'+xyz't'+xyz't+xy'zt'+xy'z't'+xy'z't+x'y'zt'+x'yzt+x'yz't'+x'yz't",
  'mt-b4|(B) E =': "xyz't'+xy'+x'y'zt+x'y'z't'+x'yzt+x'yz't'+x'yz't",
  'mt24-a1|Step 1 CSoP:': '#10011011', 'mt24-a1|Step 3 MSoP:': '#10011011', 'mt24-a3|Step 1 CSoP:': '#10011011', 'mt24-a3|Step 2 MSoP:': '#10011011',
  'mt24-a2|Step 1 SoP:': "(x'y+z)'(x'+y'z)+(x'z+y)(y'z)'+xz'+x'y'z", 'mt24-a2|Step 2 CSoP:': "(x'y+z)'(x'+y'z)+(x'z+y)(y'z)'+xz'+x'y'z",
  'mt24-a4|(A) E =': "xy+x'y+xy'zt'+xy'z't'+x'y'zt'", 'mt24-a4|(B) E =': "xyz't'+xyz't+xy'zt'+xy'z't'+x'y'zt+x'y'z't'+x'yzt+x'yz't'+x'yz't",
  'mt24-b1|Step 1 CSoP:': '#01011011', 'mt24-b1|Step 3 MSoP:': '#01011011', 'mt24-b3|Step 1 CSoP:': '#01011011', 'mt24-b3|Step 2 MSoP:': '#01011011',
  'mt24-b2|Step 1 SoP:': "((x+y)'+z)'(x'+yz')'+(xy+z')'(yz')+x'z+x'yz'", 'mt24-b2|Step 2 CSoP:': "((x+y)'+z)'(x'+yz')'+(xy+z')'(yz')+x'z+x'yz'",
  'mt24-b4|(A) E =': "xyzt'+xyz't'+xyz't+xy'zt+xy'z't'+xy'z't+x'y'zt+x'y'zt'+x'y'z't+x'yz't'+x'yz't", 'mt24-b4|(B) E =': "xyzt+xyz't'+xyz't+xy'+x'yzt+x'yz't'+x'yz't",
  'mt23-1|Step 1 CSoP:': '#11011001', 'mt23-1|Step 3 MSoP:': '#11011001', 'mt23-3|Step 1 CSoP:': '#11011001', 'mt23-3|Step 2 MSoP:': '#11011001',
  'mt23-2|Step 1 SoP:': "(xy'+z')'(x+yz')+(x'z+y)'(y'z)+x'z+xy'z'", 'mt23-2|Step 2 CSoP:': "(xy'+z')'(x+yz')+(x'z+y)'(y'z)+x'z+xy'z'",
  'mt23-4|(A) E =': "xyz't'+xyz't+xy'zt+xy'zt'+xy'z't'+x'y'zt'+x'yzt+x'yz't'+x'yz't",
  'mt23-4|(B) E =': "xyzt+xyz't'+xyz't+xy'+x'y'z't'+x'yzt+x'yz't'+x'yz't",
  'mts-1|Step 1 CSoP:': '#01011111', 'mts-1|Step 3 MSoP:': '#01011111', 'mts-3|Step 1 CSoP:': '#11011100', 'mts-3|Step 2 MSoP:': '#11011100',
  'mts-2|Step 1 SoP:': "(x'y'+z)'yz'+(x'z+y)'(y'z+x)+x'z+xy'z'", 'mts-2|Step 2 CSoP:': "(x'y'+z)'yz'+(x'z+y)'(y'z+x)+x'z+xy'z'",
  'mts-5|(A) E =': "xyzt+xyzt'+xyz't+xy'z't'+xy'z't+x'y'zt+x'y'zt'+x'y", 'mts-5|(B) E =': "xyzt+xyz't+xy'zt'+xy'z't'+xy'z't+x'y'+x'yzt+x'yzt'",
  // bits
  'p2-7|u ∨ v =': OR('11010110', '10111100'), 'p2-7|u ∧ v =': AND('11010110', '10111100'), 'p2-7|u ⊕ v =': '01101010',
  'p4-1|ABC =': AND('101101', '111001', '011101'), 'p4-1|A + B + C =': OR('101101', '111001', '011101'), 'p4-1|A′ =': NOT('101101'),
  'p4-2|ABC =': AND('11001010', '10101100', '11110000'), 'p4-2|A + B + C =': OR('11001010', '10101100', '11110000'),
  'p4-3|(AB)′ =': NOT(AND('1100', '1010')), 'p4-3|(A + B)′ =': NOT(OR('1100', '1010')),
  'p4-7|T(Y) =': tt("AC'+BC", 'ABC'), 'p7-1|A =': '0011', 'p7-1|B =': '0101', 'p7-2|T(E) =': tt("x'y+yz'", 'xyz'), 'p7-3|T(E) =': tt("xy'+z", 'xyz'),
  'hw-26|(a) Y =': AND('110001', '101101', '110011'), 'hw-26|(b) Y =': AND('01111100', '10111010', '00111100'), 'hw-26|(c) Y =': AND('00111110', '01111100', '11110011'),
  'hw-27|(a) Y =': OR('100011', '100101', '100001'), 'hw-27|(b) Y =': OR('10000001', '00100100', '00000011'), 'hw-27|(c) Y =': OR('00111100', '11110000', '10000001'),
  'hw-28|(a) Y =': NOT('11100111'), 'hw-28|(b) Y =': NOT('10001000'), 'hw-28|(c) Y =': NOT('11111000'),
  'mt-a2|Step 3 T(E) =': tt("(xy'+z')'(x+yz')+(x'z+y)(y'z)'+x'z+xy'z'", 'xyz'), 'mt-b2|Step 3 T(E) =': tt("(xy+z')(x+y'z')'+(xy'+z)'(yz')'+x'y+x'yz'", 'xyz'),
  'mt24-a2|Step 3 T(E) =': tt("(x'y+z)'(x'+y'z)+(x'z+y)(y'z)'+xz'+x'y'z", 'xyz'), 'mt24-b2|Step 3 T(E) =': tt("((x+y)'+z)'(x'+yz')'+(xy+z')'(yz')+x'z+x'yz'", 'xyz'),
  'mt23-2|Step 3 T(E) =': tt("(xy'+z')'(x+yz')+(x'z+y)'(y'z)+x'z+xy'z'", 'xyz'), 'mts-2|Step 3 T(E) =': tt("(x'y'+z)'yz'+(x'z+y)'(y'z+x)+x'z+xy'z'", 'xyz'),
  'hw-29|(a) T(E) =': tt("xy+x'z", 'xyz'), 'hw-29|(b) T(E) =': tt("xyz'+xy'z'+x'y'z'", 'xyz'),
};
const seen = new Set();
for (const c of checks) {
  const key = `${c.owner}|${c.label}`;
  if (!(key in expected)) continue;
  seen.add(key);
  const want = expected[key];
  if (want === null) continue;
  if (c.kind === 'bits') { if (c.answer !== want) bad(`${key}: key ${c.answer} but computed ${want}`); continue; }
  const v = c.vars;
  const target = want.startsWith('#') ? want.slice(1) : tt(want, v);
  const got = tt(c.answer, v);
  if (got !== target) bad(`${key}: key ${c.answer} has table ${got}, problem has ${target}`);
}
// special predicate checks
const P36a = (a, b, c) => a + b + c === 2, P36b = (a, b, c) => a + b + c <= 1, U9 = (a, b, c) => a + b + c === 1;
const brute = (expr, vars, f) => C.table(C.parse(expr), vars).every((val, r) => { const bits = vars.map((_, k) => (r >> (vars.length - 1 - k)) & 1); return !!val === f(...bits); });
for (const c of checks) {
  if (c.owner === 'p3-6' && c.label === '(a)' && !brute(c.answer, ['a', 'b', 'c'], P36a)) bad('p3-6 (a)');
  if (c.owner === 'p3-6' && c.label === '(b)' && !brute(c.answer, ['a', 'b', 'c'], P36b)) bad('p3-6 (b)');
  if (c.owner === 'hw-t9' && !brute(c.answer, ['a', 'b', 'c'], U9)) bad('hw-t9');
  if (c.owner === 'hw-t8') {
    const f = { '(a)': (a, b, c_, d, e, g) => !!(a || b || c_ || d || e || g), '(b)': (...x) => x.every(Boolean), '(c)': (a, b, c_, d, e, g) => !!(a && b && c_ && e && g),
      '(d)': (a, b, c_, d, e, g) => !!(d || e || g), '(e)': (a, b, c_, d, e, g) => !![a, b, c_, d, e, g].some((x) => !x) && !!(a && b && c_) }[c.label];
    if (!brute(c.answer, ['a', 'b', 'c', 'd', 'e', 'f'], f)) bad('hw-t8 ' + c.label);
  }
}
// Lectures 6–7: numbers and sets computed by brute force from the problem statements
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const firstFrom = (ok) => range(1, 50).find((b) => ok(b) && !ok(b - 1) && range(b, 40).every(ok)); // holds from b on, fails at b − 1
const makeable = (n, coins) => (n === 0 ? true : coins.some((c) => c <= n && makeable(n - c, coins)));
const reach = (start, step) => { const s = new Set(start); for (let r = 0; r < 20; r++) [...s].forEach((n) => step(n).forEach((m) => { if (m <= 10) s.add(m); })); return [...s].filter((n) => n <= 10); };
const reachPairs = (start) => { const s = new Set(start); for (let r = 0; r < 20; r++) [...s].forEach((n) => { if (s.has(n + 1) && n + 2 <= 10) s.add(n + 2); }); return [...s]; };
const minPos = (f) => Math.min(...range(-100, 100).map(f).filter((v) => v > 0));
const closure = (gen, max) => { const s = new Set(gen); let grew = true; while (grew) { grew = false; for (const x of [...s]) for (const y of [...s]) if (x + y <= max && !s.has(x + y)) { s.add(x + y); grew = true; } } return [...s]; };
const recF = (n) => (n === 0 ? 1 : 2 * recF(n - 1) + 3);
const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
const amn = (m, n) => (m === 0 && n === 0 ? 0 : n === 0 ? amn(m - 1, 0) + 1 : amn(m, n - 1) + n);
const divq = (a, d) => Math.floor(a / d), divr = (a, d) => a - d * Math.floor(a / d);
// HW2: the new pairs of each of the first n applications of the recursive step, starting from (0, 0)
const levels = (rules, n) => {
  const known = new Set(['0,0']), out = [];
  for (let r = 0; r < n; r++) {
    const fresh = new Set();
    known.forEach((p) => { const [a, b] = p.split(',').map(Number); rules(a, b).forEach(([c, d]) => { if (!known.has(`${c},${d}`)) fresh.add(`${c},${d}`); }); });
    fresh.forEach((q) => known.add(q));
    out.push([...fresh].sort().join(';'));
  }
  return out;
};
const t11 = levels((a, b) => [[a, b + 1], [a + 1, b + 1], [a + 2, b + 1]], 3);
const t12 = levels((a, b) => [[a + 2, b + 3], [a + 3, b + 2]], 4);
const pairNorm = (s) => (s.match(/-?\d+,-?\d+/g) || []).sort().join(';');
const values = {
  'p8-2|(a) b =': firstFrom((n) => n >= 1 && 2 ** n < fact(n)), 'p8-2|(b) b =': firstFrom((n) => n >= 1 && 3 ** n < fact(n)),
  'p8-2|(c) b =': firstFrom((n) => n >= 1 && n * n < 2 ** n), 'p8-2|(d) b =': firstFrom((n) => n >= 1 && 2 * n + 3 <= 2 ** n),
  'p8-4|1² + ⋯ + 10² =': range(1, 10).reduce((a, k) => a + k * k, 0),
  'p8-7|(a)': (10 * 9) / 2, 'p8-7|(b)': range(0, 127).filter((m) => m.toString(2).split('1').length - 1 === 3).length, 'p8-7|(c)': 2 ** 7,
  'p8-8|(a) cannot form': range(1, 17).filter((n) => !makeable(n, [4, 7])),
  'p8-8|(d) largest =': Math.max(...range(1, 60).filter((n) => !makeable(n, [3, 7]))),
  'p8-9|(a)': reach([0], (n) => [n + 2]), 'p8-9|(b)': reach([0], (n) => [n + 3]), 'p8-9|(c)': reachPairs([0, 1]), 'p8-9|(d)': reach([0], (n) => [n + 2, n + 3]),
  'p9-1|(a) min =': minPos((x) => x * x - 8 * x + 12), 'p9-1|(b) min =': minPos((x) => x * x - 10 * x + 28), 'p9-1|(c) min =': minPos((x) => x * x - 4 * x - 2),
  'p9-2|(a) q =': divq(47, 6), 'p9-2|(a) r =': divr(47, 6), 'p9-2|(b) q =': divq(-17, 5), 'p9-2|(b) r =': divr(-17, 5),
  'p9-6|(a) f(4) =': recF(4), 'p9-6|(b) F(10) =': fib(10), 'p9-6|(c) a₂,₃ =': amn(2, 3),
  'p9-8|(a)': closure([5], 30), 'p9-8|(b)': closure([3, 5], 15), 'p9-8|(c)': range(0, 3).reduce((a, k) => a + 2 ** k, 0),
  'hw2-t10|Largest impossible amount =': Math.max(...range(1, 60).filter((n) => !makeable(n, [5, 8]))),
  'hw2-t11|(a) 1st application:': t11[0], 'hw2-t11|(a) 2nd application:': t11[1], 'hw2-t11|(a) 3rd application:': t11[2],
  'hw2-t12|(a) 1st application:': t12[0], 'hw2-t12|(a) 2nd application:': t12[1], 'hw2-t12|(a) 3rd application:': t12[2],
  'hw2-t12|(a) 4th application:': t12[3],
};
// Lectures 8–9: counts by enumeration where it is small enough, by formula from the statement otherwise
const subsets = (n, k, start = 0) => (k === 0 ? [[]] : range(start, n - 1).flatMap((i) => subsets(n, k - 1, i + 1).map((s) => [i, ...s])));
const arrangements = (n, k) => (k === 0 ? [[]] : arrangements(n, k - 1).flatMap((p) => range(0, n - 1).filter((x) => !p.includes(x)).map((x) => [...p, x])));
const tuples = (n, k) => (k === 0 ? [[]] : tuples(n, k - 1).flatMap((t) => range(0, n - 1).map((x) => [...t, x])));
const count = (xs, ok = () => true) => xs.filter(ok).length;
const distinctWords = (w) => new Set(arrangements(w.length, w.length).map((p) => p.map((i) => w[i]).join(''))).size;
const multinom = (w) => Object.values([...w].reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {})).reduce((r, c) => r / fact(c), fact(w.length));
const nC = (n, k) => subsets(n, k).length, nP = (n, k) => fact(n) / fact(n - k);
const upTo = (N, ok) => count(range(1, N), ok);
const bitsOf = (n) => tuples(2, n);
const together = (p, S) => { const ix = S.map((x) => p.indexOf(x)); return Math.max(...ix) - Math.min(...ix) === S.length - 1; };
const sumsTo7 = (k) => subsets(6, k).every((s) => s.some((a) => s.some((b) => a !== b && a + b + 2 === 7)));
const venn3 = (U, a, b, c, ab, ac, bc, abc) => ({ union: a + b + c - ab - ac - bc + abc, onlyA: a - (ab - abc) - (ac - abc) - abc, exactly1: a + b + c - 2 * (ab + ac + bc) + 3 * abc });
const mag = venn3(120, 65, 45, 42, 20, 25, 15, 8);
const committee = subsets(12, 4), women = (s) => s.filter((x) => x >= 9).length; // people 9, 10, 11 are the women
const exam = subsets(13, 10), first5 = (s) => s.filter((x) => x < 5).length;
Object.assign(values, {
  'p10-1|(a)': 3 + 7 + 5, 'p10-1|(b)': count(tuples(7, 3), ([j, s, p]) => j < 3 && p < 5),
  'p10-2|(a)': 26 * 26 * 1000, 'p10-2|(b)': nP(26, 2) * 1000, 'p10-2|(c)': 26 * 1000,
  'p10-3|(a)': 4 * 3, 'p10-3|(b)': 12 * 12, 'p10-3|(c)': count(tuples(4, 4), ([a, b, c, d]) => b < 3 && c < 3 && b !== c && a !== d),
  'p10-4|(a) k =': count(tuples(5, 3), ([i, j]) => i < 3 && j < 4), 'p10-4|(b) k =': 3 + 4 + 5,
  'p10-5|(a) P₆ =': 36 ** 6 - 26 ** 6, 'p10-5|(b) P =': [6, 7, 8].reduce((s, k) => s + 36 ** k - 26 ** k, 0),
  'p10-6|Number =': count(bitsOf(10), (b) => b[0] === 1 || (b[8] === 0 && b[9] === 0)),
  'p10-7|(a)': (32 - 10) + (24 - 10), 'p10-7|(b)': 32 - 10, 'p10-7|(c)': 24 - 10,
  'p10-8|(a)': upTo(300, (n) => n % 3 === 0 || n % 5 === 0 || n % 7 === 0), 'p10-8|(b)': upTo(300, (n) => n % 15 === 0 && n % 7 !== 0),
  'p10-8|(c)': upTo(300, (n) => n % 5 === 0 && n % 3 !== 0 && n % 7 !== 0), 'p10-8|(d)': upTo(300, (n) => n % 3 && n % 5 && n % 7),
  'p10-9|(a)': upTo(100, (n) => n % 2 === 1 || Number.isInteger(Math.sqrt(n))), 'p10-9|(b)': upTo(100, (n) => n % 2 === 0 || [1, 8, 27, 64].includes(n)),
  'p10-10|(a)': mag.union, 'p10-10|(b)': mag.onlyA, 'p10-10|(c)': mag.exactly1, 'p10-10|(d)': 120 - mag.union,
  'p10-11|(a)': 50 + 60 + 70 + 80 - 6 * 20 + 4 * 10 - 5, 'p10-11|(b)': 11 + 77 - 48 + 26 - 4,
  'p10-12|(a)': count(tuples(5, 3), (t) => new Set(t).size === 3), 'p10-12|(b)': count(tuples(3, 5), (t) => new Set(t).size === 3),
  'p10-13|(a)': 4 * (5 - 1) + 1, 'p10-13|(b)': 4 * (5 - 1) + 1, 'p10-13|(c)': 3 * 13 + 4, 'p10-13|(d)': range(1, 6).find(sumsTo7), 'p10-13|(e)': 50 * 85 * 5 + 1,
  'p11-1|(a)': count(arrangements(7, 3)), 'p11-1|(b)': count(arrangements(14, 2)), 'p11-1|(c)': nC(10, 7), 'p11-1|(d)': nC(13, 6),
  'p11-2|(a) n =': range(2, 40).find((n) => nP(n, 2) === 20), 'p11-2|(b) n =': range(4, 40).find((n) => nP(n, 4) === 42 * nP(n, 2)),
  'p11-2|(c) n =': range(1, 40).find((n) => 2 * nP(n, 2) + 50 === nP(2 * n, 2)),
  'p11-3|(a)': count(arrangements(5, 5)), 'p11-3|(b)': count(arrangements(5, 5), (p) => together(p, [0, 1])),
  'p11-3|(c)': count(arrangements(5, 5), (p) => p[0] === 0), 'p11-3|(d)': count(arrangements(5, 5), (p) => p[0] === 0 && [p[1], p[4]].includes(1)),
  'p11-4|(a)': count(arrangements(6, 6)), 'p11-4|(b)': count(arrangements(6, 6), (p) => together(p, [0, 1, 2]) && together(p, [3, 4, 5])),
  'p11-4|(c)': count(arrangements(6, 6), (p) => together(p, [3, 4, 5])),
  'p11-5|(a)': fact(12), 'p11-5|(b)': fact(3) * fact(5) * fact(4) * fact(3),
  'p11-6|(a)': distinctWords('THOSE'), 'p11-6|(b)': distinctWords('UNUSUAL'), 'p11-6|(c)': distinctWords('BENZENE'), 'p11-6|(d)': distinctWords('QUEUE'),
  'p11-6|(e)': multinom('COMMITTEE'), 'p11-6|(f)': distinctWords('BASEBALL'),
  'p11-7|(a)': multinom('RRRRBBGGG'), 'p11-7|(b)': count(tuples(12, 3)), 'p11-7|(c)': count(arrangements(12, 3)),
  'p11-8|(a)': count(arrangements(6, 3)), 'p11-8|(b)': count(arrangements(6, 3), (p) => p[0] < 2), 'p11-8|(c)': count(arrangements(6, 3), (p) => [0, 3].includes(p[2])),
  'p11-9|(a)': nP(26, 2) * count(arrangements(10, 3)), 'p11-9|(b)': nP(26, 2) * count(arrangements(10, 3), (p) => p[0] !== 0), 'p11-9|(c)': count(arrangements(18, 3)),
  'p11-10|(a)': committee.length, 'p11-10|(b)': count(committee, (s) => women(s) === 2), 'p11-10|(c)': count(committee, (s) => women(s) === 1), 'p11-10|(d)': count(committee, (s) => women(s) >= 1),
  'p11-11|(a)': nC(11, 5), 'p11-11|(b)': count(subsets(11, 5), (s) => s.includes(0) === s.includes(1)), 'p11-11|(c)': count(subsets(11, 5), (s) => !(s.includes(0) && s.includes(1))),
  'p11-12|(a)': count(exam, (s) => s.includes(0) && s.includes(1)), 'p11-12|(b)': count(exam, (s) => s.includes(0) !== s.includes(1)),
  'p11-12|(c)': count(exam, (s) => first5(s) === 3), 'p11-12|(d)': count(exam, (s) => first5(s) >= 3),
  'p11-13|(a)': count(subsets(10, 2), ([a, b]) => (a < 6) !== (b < 6)), 'p11-13|(b)': count(subsets(16, 2), ([a, b]) => (a < 9) === (b < 9)),
  'p11-13|(c)': 9 * nC(8, 2), 'p11-13|(d)': nC(5, 2) * nC(9, 3),
  'p11-14|(a)': count(subsets(8, 5)), 'p11-14|(b)': count(bitsOf(10), (b) => b.filter(Boolean).length === 3), 'p11-14|(c)': range(0, 7).reduce((s, r) => s + nC(7, r), 0),
});
// Lectures 10–11: relations recomputed here from the problem data, without the page's engine
const rel = (s) => (s.match(/\(\s*-?\w+\s*,\s*-?\w+\s*\)/g) || []).map((p) => p.replace(/[()\s]/g, '').split(','));
const uniq = (R) => [...new Map(R.map((p) => [p.join(','), p])).values()];
const comp = (S, R) => uniq(R.flatMap(([a, b]) => S.filter(([c]) => c === b).map(([, d]) => [a, d]))); // S∘R
const inv = (R) => R.map(([a, b]) => [b, a]);
const diag = (A) => A.map((a) => [a, a]);
const tclose = (R) => { let T = uniq(R); for (let i = 0; i < 10; i++) T = uniq([...T, ...comp(R, T)]); return T; };
const asKey = (R) => uniq(R).map((p) => p.join(',')).sort().join(';');
const props = (A, R) => {
  const has = (a, b) => R.some(([x, y]) => x === a && y === b);
  return { refl: A.every((a) => has(a, a)), sym: R.every(([a, b]) => has(b, a)), anti: R.every(([a, b]) => a === b || !has(b, a)),
    trans: R.every(([a, b]) => R.every(([c, d]) => c !== b || has(a, d))) };
};
const indices = (rels, A, p) => rels.flatMap((R, i) => (props(A, R)[p] ? [i + 1] : []));
const nums = (a, b) => range(a, b).map(String);
const ex7 = ['(1,1),(1,2),(2,1),(2,2),(3,4),(4,1),(4,4)', '(1,1),(1,2),(2,1)', '(1,1),(1,2),(1,4),(2,1),(2,2),(3,3),(4,1),(4,4)', '(2,1),(3,1),(3,2),(4,1),(4,2),(4,3)',
  '(1,1),(1,2),(1,3),(1,4),(2,2),(2,3),(2,4),(3,3),(3,4),(4,4)', '(3,4)'].map(rel);
const A3 = nums(1, 3), set1ex6 = ['(1,1),(1,2),(1,3),(3,3)', '(1,1),(1,2),(2,1),(2,2),(3,3)', '(1,1),(1,2),(2,2),(2,3)', ''].map(rel).concat([A3.flatMap((a) => A3.map((b) => [a, b]))]);
const Z = nums(-6, 6), onZ = (f) => Z.flatMap((a) => Z.filter((b) => f(+a, +b)).map((b) => [a, b]));
const ex10 = [(a, b) => a <= b, (a, b) => a > b, (a, b) => a === b || a === -b, (a, b) => a === b, (a, b) => a === b + 1, (a, b) => a + b <= 3].map(onZ);
const r3 = rel('(1,3),(1,4),(3,2),(3,3),(3,4)');
const pR = rel('(a,a),(a,c),(c,b),(c,d),(d,b)'), pS = rel('(b,a),(c,c),(c,d),(d,a)');
const r6 = rel('(1,1),(1,2),(2,3),(3,1),(3,3)'), s6 = rel('(1,2),(1,3),(2,1),(3,3)');
const r8 = rel('(a,a),(a,b),(b,c),(c,c)'), r7 = rel('(0,1),(1,1),(1,2),(2,0),(2,2),(3,0)'), r84 = rel('(1,2),(1,4),(3,3),(4,1)');
const r19 = rel('(1,1),(1,3),(2,4),(3,1),(3,3),(4,3)'), rb = rel('(1,2),(2,1),(2,3),(4,4)'), r23 = rel('(1,2),(2,3),(3,3)');
const r10 = rel('(1,1),(1,5),(2,2),(2,3),(2,6),(3,2),(3,3),(3,6),(4,4),(5,1),(5,5),(6,2),(6,3),(6,6)');
const cls = (R, a) => R.filter(([x]) => x === String(a)).map(([, y]) => +y);
const A4 = nums(1, 4), A5 = ['a', 'b', 'c', 'd', 'e'];
const relVals = {
  'p12-1|(a)': 2 ** (3 * 2), 'p12-1|(b)': 2 ** 9, 'p12-1|(c)': 2 ** 16, 'p12-1|(d)': count(tuples(2, 9), (t) => t[0] && t[4] && t[8]),
  'p12-2|R =': asKey(onZ((a, b) => a >= 1 && a <= 6 && b >= 1 && b <= 6 && b % a === 0)),
  'p12-3|Domain =': [...new Set(r3.map(([a]) => +a))], 'p12-3|Range =': [...new Set(r3.map(([, b]) => +b))],
  'p12-3|R⁻¹ =': asKey(inv(r3)), 'p12-3|R∘R =': asKey(comp(r3, r3)), 'p12-3|R∘R⁻¹ =': asKey(comp(r3, inv(r3))), 'p12-3|R⁻¹∘R =': asKey(comp(inv(r3), r3)),
  'p12-4|(a) S∘R =': asKey(comp(rel('(a,y),(b,x),(c,y),(c,z)'), rel('(1,b),(2,a),(2,c)'))),
  'p12-4|(a) entry (2, y) =': count(rel('(1,b),(2,a),(2,c)'), ([a, b]) => a === '2' && rel('(a,y),(b,x),(c,y),(c,z)').some(([c, d]) => c === b && d === 'y')),
  'p12-4|(b) S∘R =': asKey(comp(rel('(a,y),(c,x),(a,z)'), rel('(1,b),(3,a),(3,b),(4,c)'))),
  'p12-5|(a) R∘S =': asKey(comp(pR, pS)), 'p12-5|(b) S∘R =': asKey(comp(pS, pR)), 'p12-5|(c) R∘R =': asKey(comp(pR, pR)), 'p12-5|(d) S∘S =': asKey(comp(pS, pS)),
  'p12-6|R ∩ S =': asKey(r6.filter(([a, b]) => s6.some(([c, d]) => a === c && b === d))),
  'p12-6|R′ =': asKey(A3.flatMap((a) => A3.map((b) => [a, b])).filter(([a, b]) => !r6.some(([c, d]) => a === c && b === d))),
  'p12-6|S∘R =': asKey(comp(s6, r6)), 'p12-6|S² =': asKey(comp(s6, s6)),
  'p12-7|(a)': indices(ex7, A4, 'refl'), 'p12-7|(b)': indices(ex7, A4, 'sym'), 'p12-7|(c)': indices(ex7, A4, 'anti'), 'p12-7|(d)': indices(ex7, A4, 'trans'),
  'p12-8|(a)': indices(set1ex6, A3, 'refl'), 'p12-8|(b)': indices(set1ex6, A3, 'sym'), 'p12-8|(c)': indices(set1ex6, A3, 'trans'), 'p12-8|(d)': indices(set1ex6, A3, 'anti'),
  'p12-9|(a)': indices(ex10, Z, 'refl'), 'p12-9|(b)': indices(ex10, Z, 'sym'), 'p12-9|(c)': indices(ex10, Z, 'anti'), 'p12-9|(d)': indices(ex10, Z, 'trans'),
  'p13-1|(a)': asKey([...r7, ...diag(nums(0, 3))]), 'p13-1|(b)': asKey([...r7, ...inv(r7)]),
  'p13-2|(a)': asKey([...r8, ...diag(['a', 'b', 'c'])]), 'p13-2|(b)': asKey([...r8, ...inv(r8)]), 'p13-2|(c)': asKey(comp(r8, r8)), 'p13-2|(d)': asKey(tclose(r8)),
  'p13-3|(a) R² =': asKey(comp(r23, r23)), 'p13-3|(b) R² =': asKey(comp(rb, rb)), 'p13-3|(b) transitive(R) =': asKey(tclose(rb)), 'p13-3|(c) transitive(R) =': asKey(tclose(r19)),
  'p13-4|(a)': asKey(tclose([...r84, ...diag(A4)])), 'p13-4|(b)': asKey(tclose([...r84, ...inv(r84)])), 'p13-4|(c)': asKey(tclose([...r84, ...inv(r84), ...diag(A4)])),
  'p13-5|[1] =': cls(r10, 1), 'p13-5|[6] =': cls(r10, 6), 'p13-5|[4] =': cls(r10, 4), 'p13-5|Number of classes =': new Set(nums(1, 6).map((a) => cls(r10, a).join())).size,
  'p13-6|(a)': range(0, 20).filter((n) => (n - 13) % 5 === 0), 'p13-6|(b)': range(0, 20).filter((n) => (n - 11) % 4 === 0), 'p13-6|(c)': new Set(range(-50, 50).map((n) => ((n % 7) + 7) % 7)).size,
  'p13-7|Relation =': asKey(tclose([...rel('(a,b),(a,c),(d,e)'), ...inv(rel('(a,b),(a,c),(d,e)')), ...diag(A5)])),
};
const relKeyOf = (s) => asKey(rel(s));
for (const c of checks) {
  const key = `${c.owner}|${c.label}`;
  if (!(key in relVals)) continue;
  seen.add(key);
  const want = relVals[key];
  const got = c.kind === 'pairs' ? relKeyOf(c.answer) : c.kind === 'set' ? norm(c.answer.split(',').filter(Boolean).map(Number)) : String(+c.answer);
  const exp = c.kind === 'pairs' ? want : norm(want);
  if (got !== exp) bad(`${key}: key ${c.answer} but computed ${exp}`);
}
function norm(v) { return Array.isArray(v) ? [...v].sort((a, b) => a - b).join(',') : String(v); }
for (const c of checks) {
  const key = `${c.owner}|${c.label}`;
  if (!(key in values)) continue;
  seen.add(key);
  const want = norm(values[key]);
  const got = c.kind === 'set' ? norm(c.answer.split(',').filter(Boolean).map(Number)) : c.kind === 'pairs' ? pairNorm(c.answer) : String(+c.answer);
  if (got !== want) bad(`${key}: key ${c.answer} but computed ${want}`);
}
const unchecked = checks.filter((c) => (c.kind !== 'set' || /^p(8|9|1[0-3])-/.test(c.owner)) && !seen.has(`${c.owner}|${c.label}`) && c.owner !== 'hw-t8');
console.log(`${checks.length} answer boxes; ${seen.size} cross-checked against problem data; sets verified separately in Python.`);
if (unchecked.length) console.log('not cross-checked:', unchecked.map((c) => `${c.owner}|${c.label}`));
console.log(fails ? `${fails} FAILURES` : 'all keys consistent');
process.exit(fails ? 1 : 0);
