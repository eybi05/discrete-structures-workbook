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
const norm = (v) => (Array.isArray(v) ? [...v].sort((a, b) => a - b).join(',') : String(v));
for (const c of checks) {
  const key = `${c.owner}|${c.label}`;
  if (!(key in values)) continue;
  seen.add(key);
  const want = norm(values[key]);
  const got = c.kind === 'set' ? norm(c.answer.split(',').filter(Boolean).map(Number)) : c.kind === 'pairs' ? pairNorm(c.answer) : String(+c.answer);
  if (got !== want) bad(`${key}: key ${c.answer} but computed ${want}`);
}
const unchecked = checks.filter((c) => (c.kind !== 'set' || c.owner.startsWith('p8') || c.owner.startsWith('p9')) && !seen.has(`${c.owner}|${c.label}`) && c.owner !== 'hw-t8');
console.log(`${checks.length} answer boxes; ${seen.size} cross-checked against problem data; sets verified separately in Python.`);
if (unchecked.length) console.log('not cross-checked:', unchecked.map((c) => `${c.owner}|${c.label}`));
console.log(fails ? `${fails} FAILURES` : 'all keys consistent');
process.exit(fails ? 1 : 0);
