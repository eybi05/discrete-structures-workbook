// Unit tests for core.js against answers verified independently in Python.
const C = require('../src/core.js');
let fails = 0, passes = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passes++; else { fails++; console.log('FAIL', name, '\n   got ', g, '\n   want', w); }
};
const X = ['x', 'y', 'z'], X4 = ['x', 'y', 'z', 't'], ABC = ['A', 'B', 'C'];
const tt = (e, v) => C.table(C.parse(e), v).join('');
const msop = (e, v) => { const r = C.minimalSums(C.minterms(C.parse(e), v), v.length); return r.sums.map((s) => C.sumStr(s, v)).sort(); };
const sortSum = (s) => s.split(' + ').sort().join(' + ');
const msopN = (e, v) => msop(e, v).map(sortSum).sort();

// parsing and truth tables (lecture examples)
eq('ex16', tt("ABC+AB'C+A'B", ABC), '00110101');
eq('ex19', tt("(x'y)'yz'+x'(yz+z')", X), '10110010');
eq('1.17b', tt("xy'z+xy+z'", X), '10101111');
eq('hw2.9a', tt("xy+x'z", X), '01010011');
eq('hw2.9b', tt("xyz'+xy'z'+x'y'z'", X), '10001010');
eq('unicode prime', tt('xy′+x′z', X), '01011100');
eq('unicode prime 2', tt('xy+x′z', X), '01010011');
eq('lhs strip', tt("E = xy + x'z", X), '01010011');
eq('lhs strip f(x)', tt('f(x, y) = x + y', ['x', 'y']), '0111');
eq('= between variables is iff', tt('x = y', ['x', 'y']), '1001');
eq('== is iff', tt('p == q', ['p', 'q']), '1001');
eq('label reused on the right is kept', tt('A = A + B', ['A', 'B']), '1011');
// (p∨¬q)→(p∧q) in 0-first order: pq=00: (0∨1)→0 = 0; 01: (0∨0)→0 = 1; 10: 1→0 = 0; 11: 1→1 = 1  => 0101
eq('logic ops fixed', tt('(p ∨ ¬q) → (p ∧ q)', ['p', 'q']), '0101');
eq('iff taut', tt('(p→q) ↔ (¬q→¬p)', ['p', 'q']), '1111');
eq('ascii ops', tt('~(p & q) <-> (~p | ~q)', ['p', 'q']), '1111');
eq('xor', tt('p ⊕ q', ['p', 'q']), '0110');
eq('imp right assoc', tt('p -> q -> r', ['p', 'q', 'r']), tt('p -> (q -> r)', ['p', 'q', 'r']));
eq('set ops', tt('A ∪ B ∩ C′', ABC), tt("A+BC'", ABC));
eq('diff', tt('A ∖ B', ['A', 'B']), '0010');
eq('constants', tt('p ∨ T', ['p']), '11');
eq('precedence ¬∧', tt('¬p ∧ q', ['p', 'q']), '0100');

// parse errors
const err = (s) => { try { C.parse(s); return 'no error'; } catch (e) { return e instanceof C.ParseError ? 'ParseError' : 'other'; } };
eq('err paren', err('(x+y'), 'ParseError');
eq('err close', err('x+y)'), 'ParseError');
eq('err op', err('+x'), 'ParseError');
eq('err empty', err('   '), 'ParseError');
eq('err sym', err('x # y'), 'ParseError');

// minimal sums (lecture examples + HW)
eq('ex18', msopN("A'B'C'+A'B'C+AB'C'+AB'C+ABC", ABC), ["AC + B′"].map(sortSum));
eq('ex12c count', msop("xyz+xyz'+x'yz'+x'y'z'+x'y'z", X).length, 2);
eq('ex14', msopN("xy'+xyz+x'y'z'+x'yzt'", X4), [sortSum("xz + y′z′ + yzt′")]);
eq('hw2.3a', msopN("xy'z'+x'y+x'y'z'+x'yz", X), [sortSum("x′y + y′z′")]);
eq('hw2.3b', msopN("xy'+x'z't+xyzt'+x'y'zt'", X4), [sortSum("xy′ + xzt′ + x′z′t + y′zt′")]);
eq('hw2.3c', msopN("xyzt+xyz't'+xz't'+x'y'z'+x'yz't", X4), [sortSum("xyzt + xz′t′ + x′z′t + y′z′t′"), sortSum("xyzt + xz′t′ + x′z′t + x′y′z′")].sort());
const fig25a = [2, 4, 5, 6, 7, 9, 10, 11, 13, 14], fig25b = [2, 4, 6, 7, 8, 9, 10, 12, 14, 15];
const ms = (m, v) => C.minimalSums(m, v.length).sums.map((s) => sortSum(C.sumStr(s, v))).sort();
eq('hw2.11a', ms(fig25a, X4), ["zt′ + x′y + yz′t + xy′t", "zt′ + x′y + xz′t + xy′t", "zt′ + x′y + xz′t + xy′z"].map(sortSum).sort());
eq('hw2.11b', ms(fig25b, X4), [sortSum("zt′ + yt′ + yz + xy′z′")]);
eq('hw2.12a', msopN("y'z+y'z't'+z't", X4), [sortSum("y′ + z′t")]);
eq('hw2.12b', msopN("y'zt+xzt'+xy'z'", X4), [sortSum("xy′ + y′zt + xzt′")]);
eq('hw2.13a', msopN("AB'C+ABC'+AB'C'", ABC), [sortSum("AB′ + AC′")]);
eq('hw2.13b', msopN("ABC+A'BC'+ABC'", ABC), [sortSum("AB + BC′")]);
eq('hw2.14', msop("A'B'C+A'BC'+AB'C'+ABC", ABC).length, 1);
eq('K4 three sums', msop("x'y'z'+x'y'zt+xyt'+xy'z't'+x'yzt", X4).length, 3);
eq('cyclic 3var', msop("x'y'z'+x'y'z+x'yz'+xy'z+xyz'+xyz", X).length, 2);
eq('constant 0', C.minimalSums([], 3).sums, [[]]);
eq('constant 1', C.sumStr(C.minimalSums([0, 1, 2, 3, 4, 5, 6, 7], 3).sums[0], X), '1');
eq('fig4 nand', msopN("(AB)'+(A'+C)'", ABC), [sortSum("A′ + B′ + C′")]);
// more than 31 minterms used to overflow the 32-bit cover masks
const V5 = ['a', 'b', 'c', 'd', 'e'];
eq('5 vars, 31 minterms', C.minimalSums([...Array(32).keys()].filter((i) => i !== 5), 5).sums.map((s) => sortSum(C.sumStr(s, V5))), [sortSum('a + b + c′ + d + e′')]);
eq('6 vars, 63 minterms', C.minimalSums([...Array(64).keys()].slice(1), 6).sums.length, 1);

// grading
const g = (inp, spec) => C.grade(inp, spec).status;
eq('grade ok min', g("y'z'+x'y", { answer: "xy'z'+x'y+x'y'z'+x'yz", vars: X, mode: 'min' }), 'ok');
eq('grade order-insensitive', g("x′y + z′y′", { answer: "xy'z'+x'y+x'y'z'+x'yz", vars: X, mode: 'min' }), 'ok');
eq('grade not minimal', g("x'y+y'z'+x'z'", { answer: "xy'z'+x'y+x'y'z'+x'yz", vars: X, mode: 'min' }), 'partial');
eq('grade wrong', g("x'y+z'", { answer: "xy'z'+x'y+x'y'z'+x'yz", vars: X, mode: 'min' }), 'wrong');
eq('grade parse err', g("x'y+(z'", { answer: "x'y", vars: X, mode: 'eq' }), 'error');
eq('grade bad var', g("x'w", { answer: "x'y", vars: X, mode: 'eq' }), 'error');
eq('grade p = q as iff', g('p = q', { answer: 'p <-> q', vars: ['p', 'q'], mode: 'eq' }), 'ok');
eq('grade label stripped', g("E = x'y", { answer: "x'y", vars: X, mode: 'eq' }), 'ok');
eq('num ok', C.gradeNum(' 82 ', '82').status, 'ok');
eq('num negative', C.gradeNum('−4', '-4').status, 'ok');
eq('num wrong', C.gradeNum('81', '82').status, 'wrong');
eq('num not a number', C.gradeNum('8x', '82').status, 'error');
eq('num empty', C.gradeNum('', '82').status, 'error');
// arithmetic in number boxes
const ev = (s) => { const v = C.evalNum(s); return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`; };
eq('expr product', ev('26*26*10*10*10'), '676000');
eq('expr power', ev('26^2 * 10^3'), '676000');
eq('expr superscripts and dot', ev('26²·10³'), '676000');
eq('expr times sign', ev('26 × 25 × 10³'), '650000');
eq('expr factorial quotient', ev('12!/(3!2!2!2!)'), '9979200');
eq('expr implicit product', ev('2·3!·3!'), '72');
eq('expr C and P', ev('C(13, 6) + P(7, 3)'), String(1716 + 210));
eq('expr nested C', ev('C(9,2)*C(3,2)'), '108');
eq('expr IEP', ev('100 + 60 + 42 − 20 − 14 − 8 + 2'), '162');
eq('expr subtraction of powers', ev('36^6 − 26^6'), '1867866560');
eq('expr big exact', ev('36^8-26^8+36^7-26^7+36^6-26^6'), '2684483063360');
eq('expr precedence', ev('2+3*4^2'), '50');
eq('expr power right-assoc', ev('2^3^2'), '512');
eq('expr unary minus', ev('-2^2'), '-4');
eq('expr fraction', ev('7/2'), '7/2');
eq('expr brackets', ev('(2+3)(4)'), '20');
eq('num expr ok', C.gradeNum('26*26*10^3', '676000').status, 'ok');
eq('num expr ok msg', C.gradeNum('26*26*10^3', '676000').msg, 'Correct. Your expression equals 676 000.');
eq('num expr wrong shows value', C.gradeNum('26*26*10*10', '676000').msg.includes('67 600'), true);
eq('num expr not whole', C.gradeNum('7/2', '3').status, 'wrong');
eq('num thousands comma', C.gradeNum('676,000', '676000').status, 'ok');
eq('num thousands space', C.gradeNum('676 000', '676000').status, 'ok');
eq('num bad bracket', C.gradeNum('(2+3', '5').status, 'error');
eq('num letters', C.gradeNum('n!', '5').status, 'error');
eq('num div zero', C.gradeNum('5/0', '5').status, 'error');
eq('num factorial of fraction', C.gradeNum('(1/2)!', '1').status, 'error');
eq('num huge factorial refused', C.gradeNum('5000!', '1').status, 'error');
eq('num huge power refused', C.gradeNum('2^5000', '1').status, 'error');
eq('sop ok', g("xy+xz'", { answer: "(x+y'z)(y+z')", vars: X, mode: 'sop' }), 'ok');
eq('sop not expanded', g("x(y+z')", { answer: "(x+y'z)(y+z')", vars: X, mode: 'sop' }), 'partial');
eq('sop containment', g("xy+xz'+xyz'", { answer: "(x+y'z)(y+z')", vars: X, mode: 'sop' }), 'partial');
eq('csop ok', g("xyz+xyz'+xy'z'", { answer: "(x+y'z)(y+z')", vars: X, mode: 'csop' }), 'ok');
eq('csop short', g("xy+xy'z'", { answer: "(x+y'z)(y+z')", vars: X, mode: 'csop' }), 'partial');
eq('prod zero', g('0', { answer: "xyz'sy'ts", vars: ['x', 'y', 'z', 's', 't'], mode: 'prod' }), 'ok');
eq('prod ok', g("xy'z", { answer: "xy'zxy'", vars: ['x', 'y', 'z', 's', 't'], mode: 'prod' }), 'ok');
eq('prod unsimplified', g("xy'zxy'", { answer: "xy'zxy'", vars: ['x', 'y', 'z', 's', 't'], mode: 'prod' }), 'partial');
eq('min multi', C.grade("zt'+x'y+xz't+xy'z", { answer: C.csopStr(fig25a, X4), vars: X4, mode: 'min' }).msg.includes('3 different minimal sums'), true);
eq('bits ok', C.gradeBits('0011 1000', '00111000').status, 'ok');
eq('bits len', C.gradeBits('0101000', '00101000').status, 'wrong');
eq('set ok', C.gradeSet('{5, 2}', '2,5').status, 'ok');
eq('set empty', C.gradeSet('∅', '').status, 'ok');
eq('set wrong', C.gradeSet('{2}', '2,5').status, 'wrong');
eq('pairs ok', C.gradePairs('{(1, 1), (0,1); (2, 1)}', '(0,1),(1,1),(2,1)').status, 'ok');
eq('pairs repeat ok', C.gradePairs('(0,1),(0,1),(1,1),(2,1)', '(0,1),(1,1),(2,1)').status, 'ok');
eq('pairs minus', C.gradePairs('(−1, 2)', '(-1,2)').status, 'ok');
eq('pairs missing', C.gradePairs('(0,1),(1,1)', '(0,1),(1,1),(2,1)').msg, 'Not quite: 1 pair is missing.');
eq('pairs extra', C.gradePairs('(0,0),(0,1),(1,1),(2,1)', '(0,1),(1,1),(2,1)').msg, 'Not quite: 1 pair does not belong.');
eq('pairs swapped', C.gradePairs('(1,0),(1,1),(1,2)', '(0,1),(1,1),(2,1)').status, 'wrong');
eq('pairs format', C.gradePairs('0 1, 1 1', '(0,1),(1,1)').status, 'error');
eq('pairs empty', C.gradePairs('  ', '(0,1)').status, 'error');
eq('pairs letters', C.gradePairs('{(b, a), (1, x)}', '(1,x),(b,a)').status, 'ok');
eq('pairs letters swapped', C.gradePairs('(a, b)', '(b,a)').status, 'wrong');
eq('pairs empty relation', C.gradePairs('{}', '').status, 'ok');
eq('pairs word rejected', C.gradePairs('(ab, c)', '(a,c)').status, 'error');

// relations (Lectures 10–11), checked against worked examples in the notes
const P = (s) => C.parsePairs(s), A4 = ['1', '2', '3', '4'];
eq('compose ex16', C.relStr(C.compose(P('(1,0),(2,0),(3,1),(3,2),(4,1)'), P('(1,1),(1,4),(2,3),(3,1),(3,4)'))), '{(1, 0), (1, 1), (2, 1), (2, 2), (3, 0), (3, 1)}');
eq('compose ex18', C.relStr(C.compose(P('(b,x),(b,z),(c,y),(d,z)'), P('(1,a),(2,d),(3,a),(3,b),(3,d)'))), '{(2, z), (3, x), (3, z)}');
eq('trans closure ex23', C.relStr(C.transClosure(P('(1,2),(2,3),(3,3)'))), '{(1, 2), (1, 3), (2, 3), (3, 3)}');
eq('refl closure ex19', C.relStr(C.reflClosure(A4, P('(1,1),(1,3),(2,4),(3,1),(3,3),(4,3)'))), '{(1, 1), (1, 3), (2, 2), (2, 4), (3, 1), (3, 3), (4, 3), (4, 4)}');
const ex7 = ['(1,1),(1,2),(2,1),(2,2),(3,4),(4,1),(4,4)', '(1,1),(1,2),(2,1)', '(1,1),(1,2),(1,4),(2,1),(2,2),(3,3),(4,1),(4,4)', '(2,1),(3,1),(3,2),(4,1),(4,2),(4,3)',
  '(1,1),(1,2),(1,3),(1,4),(2,2),(2,3),(2,4),(3,3),(3,4),(4,4)', '(3,4)'].map((r) => C.relProps(A4, P(r)));
const which = (prop) => ex7.flatMap((p, i) => (p[prop] === null ? [i + 1] : [])).join(',');
eq('ex7 reflexive', which('reflexive'), '3,5');
eq('ex9 symmetric', which('symmetric'), '2,3');
eq('ex9 antisymmetric', which('antisymmetric'), '4,5,6');
eq('ex11 transitive', which('transitive'), '4,5,6');
eq('ex11 R1 witness', ex7[0].transitive.join(','), '3,4,1');
eq('classes set1 #10', JSON.stringify(C.eqClasses(['1', '2', '3', '4', '5', '6'], P('(1,1),(1,5),(2,2),(2,3),(2,6),(3,2),(3,3),(3,6),(4,4),(5,1),(5,5),(6,2),(6,3),(6,6)'))), '[["1","5"],["2","3","6"],["4"]]');
eq('eq closure set2 #14', C.eqClosure(['a', 'b', 'c', 'd', 'e'], P('(a,b),(a,c),(d,e)')).length, 13);
eq('elems', C.parseElems('{a, 2, −1}').join(','), 'a,2,-1');
eq('elems bad', C.parseElems('1, xy'), null);

// printing and steps
eq('show bool', C.show(C.parse("(x+y')'z")), '(x + y′)′z');
eq('show logic', C.show(C.parse('(p ∨ ¬q) → (p ∧ q)'), 'logic'), 'p ∨ ¬q → p ∧ q');
eq('steps', C.steps(C.parse('(p ∨ ¬q) → (p ∧ q)')).map((s) => s.label), ['¬q', 'p ∨ ¬q', 'p ∧ q', 'p ∨ ¬q → p ∧ q']);
eq('csop str', C.csopStr([1, 3], X), 'x′yz + x′y′z');

// random cross-check: every minimal sum is equivalent and irredundant; brute-force small cases
let rnd = 7;
const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
for (let trial = 0; trial < 360; trial++) {
  const n = trial >= 300 ? 5 : trial % 2 ? 4 : 3;
  const m = [];
  for (let i = 0; i < (1 << n); i++) if (rand() < 0.45) m.push(i);
  const res = C.minimalSums(m, n);
  for (const s of res.sums) {
    const cells = new Set(s.flatMap((p) => C.patCells(p, n)));
    const ok = m.every((x) => cells.has(x)) && [...cells].every((x) => m.includes(x));
    if (!ok) { fails++; console.log('FAIL random cover', n, m, s); break; }
  }
  if (res.sums.length === 0) { fails++; console.log('FAIL no sums', m); }
}
const t0 = Date.now();
for (let mask = 0; mask < 65536; mask += 97) {
  const m = []; for (let i = 0; i < 16; i++) if ((mask >> i) & 1) m.push(i);
  C.minimalSums(m, 4);
}
console.log('perf: ~676 random 4-var maps in', Date.now() - t0, 'ms');
const worst = []; for (let i = 0; i < 16; i++) { const c = i.toString(2).split('1').length - 1; if (c === 1 || c === 2) worst.push(i); }
const t1 = Date.now(); const wr = C.minimalSums(worst, 4);
console.log('worst-ish case primes', wr.primes.length, 'sums', wr.sums.length, 'in', Date.now() - t1, 'ms');
console.log(`\n${passes} passed, ${fails} failed`);
