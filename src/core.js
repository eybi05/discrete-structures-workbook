/* Logic engine for the workbook: parsing, truth tables, SoP checks, minimal sums.
   Notation accepted: x′ or x' (complement), ¬ ~ ! (not), juxtaposition · * & ∧ ∩ (and),
   + | ∨ ∪ (or), ⊕ ^ (xor), ∖ \ - (set difference), → -> (implies), ↔ <-> ≡ (iff),
   0 1 T F ⊤ ⊥ ∅ (constants). Variables are single letters other than T and F. */
const Core = (() => {
  'use strict';

  const ORDER = 'ABCDEGHIJKLMNOPQRSUVWXYZabcdefghijklmnopqrsuvwxyzt';
  const rank = (v) => { const i = ORDER.indexOf(v); return i < 0 ? 999 : i; };
  const sortVars = (vs) => [...vs].sort((a, b) => rank(a) - rank(b));

  class ParseError extends Error {
    constructor(msg, pos) { super(msg); this.pos = pos; }
  }

  // A leading label such as "E =", "Y =" or "f(x, y) =" is dropped. A single variable before "=",
  // as in "p = q", is kept: there "=" is read as ↔. With no variable list (the tools), a lowercase
  // letter or a name that reappears on the right counts as a variable.
  function stripLhs(s, vars) {
    const m = s.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(\([^)]*\))?\s*=(?![>=])/);
    if (!m) return s;
    const name = m[1], rest = s.slice(m[0].length);
    if (!m[2] && name.length === 1) {
      const isVar = vars ? vars.includes(name) : (/[a-z]/.test(name) || rest.includes(name));
      if (isVar) return s;
    }
    return rest;
  }

  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      const two = s.slice(i, i + 2), three = s.slice(i, i + 3);
      if (/\s/.test(c)) { i++; continue; }
      if (three === '<->' || three === '<=>') { toks.push({ k: 'iff', p: i }); i += 3; continue; }
      if (two === '->' || two === '=>') { toks.push({ k: 'imp', p: i }); i += 2; continue; }
      if (two === '==') { toks.push({ k: 'iff', p: i }); i += 2; continue; }
      if (c === '=') { toks.push({ k: 'iff', p: i }); i++; continue; }
      if ('↔⇔≡'.includes(c)) { toks.push({ k: 'iff', p: i }); i++; continue; }
      if ('→⇒'.includes(c)) { toks.push({ k: 'imp', p: i }); i++; continue; }
      if ('([{'.includes(c)) { toks.push({ k: '(', p: i }); i++; continue; }
      if (')]}'.includes(c)) { toks.push({ k: ')', p: i }); i++; continue; }
      if ('¬~!'.includes(c)) { toks.push({ k: 'not', p: i }); i++; continue; }
      if ("'′’ʹ`´".includes(c)) { toks.push({ k: 'prime', p: i }); i++; continue; }
      if ('∧&*·⋅.∩×'.includes(c)) { toks.push({ k: 'and', p: i }); i++; continue; }
      if ('∨|+∪'.includes(c)) { toks.push({ k: 'or', p: i }); i++; continue; }
      if ('⊕^'.includes(c)) { toks.push({ k: 'xor', p: i }); i++; continue; }
      if ('∖\\−-'.includes(c)) { toks.push({ k: 'diff', p: i }); i++; continue; }
      if (c === '0' || c === '1') { toks.push({ k: 'const', v: +c, p: i }); i++; continue; }
      if (c === '⊤') { toks.push({ k: 'const', v: 1, p: i }); i++; continue; }
      if (c === '⊥' || c === '∅') { toks.push({ k: 'const', v: 0, p: i }); i++; continue; }
      if (c === 'T' || c === 'F') { toks.push({ k: 'const', v: c === 'T' ? 1 : 0, p: i }); i++; continue; }
      if (/[A-Za-z]/.test(c)) { toks.push({ k: 'var', v: c, p: i }); i++; continue; }
      throw new ParseError(`The symbol “${c}” is not one I can read.`, i);
    }
    return toks;
  }

  const mk = (t, x, y) => {
    if (t === 'and' || t === 'or') {
      const args = [];
      for (const n of [x, y]) { if (n.t === t) args.push(...n.args); else args.push(n); }
      return { t, args };
    }
    return { t, a: x, b: y };
  };

  function parse(src, vars) {
    const text = stripLhs(String(src), vars);
    const toks = tokenize(text);
    if (!toks.length) throw new ParseError('Type an expression first.', 0);
    let i = 0;
    const peek = () => toks[i];
    const end = () => new ParseError('The expression stops too early; something is missing at the end.', text.length);

    function pIff() {
      let a = pImp();
      while (peek() && peek().k === 'iff') { i++; a = mk('iff', a, pImp()); }
      return a;
    }
    function pImp() {
      const a = pOr();
      if (peek() && peek().k === 'imp') { i++; return mk('imp', a, pImp()); }
      return a;
    }
    function pOr() {
      let a = pAnd();
      while (peek() && ['or', 'xor', 'diff'].includes(peek().k)) {
        const op = toks[i++].k;
        a = mk(op, a, pAnd());
      }
      return a;
    }
    function pAnd() {
      let a = pUnary();
      while (peek()) {
        const k = peek().k;
        if (k === 'and') { i++; a = mk('and', a, pUnary()); continue; }
        if (k === 'var' || k === 'const' || k === '(' || k === 'not') { a = mk('and', a, pUnary()); continue; }
        break;
      }
      return a;
    }
    function pUnary() {
      const t = peek();
      if (!t) throw end();
      if (t.k === 'not') { i++; return { t: 'not', a: pUnary() }; }
      let a = pAtom();
      while (peek() && peek().k === 'prime') { i++; a = { t: 'not', a }; }
      return a;
    }
    function pAtom() {
      const t = toks[i++];
      if (!t) throw end();
      if (t.k === 'var') return { t: 'var', v: t.v };
      if (t.k === 'const') return { t: 'const', v: t.v };
      if (t.k === '(') {
        const e = pIff();
        const c = toks[i++];
        if (!c || c.k !== ')') throw new ParseError('A closing bracket “)” is missing.', c ? c.p : text.length);
        return e;
      }
      if (t.k === ')') throw new ParseError('This “)” has no matching “(”.', t.p);
      if (t.k === 'prime') throw new ParseError('A prime ′ has to follow a letter or a closing bracket.', t.p);
      throw new ParseError('An operator here is missing something on its left.', t.p);
    }
    const tree = pIff();
    if (i < toks.length) {
      const t = toks[i];
      throw new ParseError(t.k === ')' ? 'This “)” has no matching “(”.' : 'I could not read the expression from this point on.', t.p);
    }
    return tree;
  }

  function ev(n, env) {
    switch (n.t) {
      case 'var': return env[n.v];
      case 'const': return n.v;
      case 'not': return 1 - ev(n.a, env);
      case 'and': for (const c of n.args) { if (!ev(c, env)) return 0; } return 1;
      case 'or': for (const c of n.args) { if (ev(c, env)) return 1; } return 0;
      case 'xor': return ev(n.a, env) ^ ev(n.b, env);
      case 'diff': return ev(n.a, env) & (1 - ev(n.b, env));
      case 'imp': return (1 - ev(n.a, env)) | ev(n.b, env);
      case 'iff': return ev(n.a, env) === ev(n.b, env) ? 1 : 0;
      default: throw new Error('bad node ' + n.t);
    }
  }

  function varsOf(n, acc = new Set()) {
    if (n.t === 'var') acc.add(n.v);
    else if (n.args) n.args.forEach((c) => varsOf(c, acc));
    else { if (n.a) varsOf(n.a, acc); if (n.b) varsOf(n.b, acc); }
    return acc;
  }

  const envFor = (vars, r) => {
    const env = {};
    const k = vars.length;
    vars.forEach((v, idx) => { env[v] = (r >> (k - 1 - idx)) & 1; });
    return env;
  };

  // Row r follows the course's special sequences: first variable is the most significant bit.
  function table(n, vars) {
    const out = [];
    for (let r = 0; r < (1 << vars.length); r++) out.push(ev(n, envFor(vars, r)));
    return out;
  }
  const minterms = (n, vars) => table(n, vars).flatMap((b, i) => (b ? [i] : []));

  // ------------------------------------------------------------------ printing
  const PREC = { iff: 1, imp: 2, or: 3, xor: 3, diff: 3, and: 4, not: 5, var: 6, const: 6 };
  function show(n, style = 'bool') {
    const L = style === 'logic';
    const wrap = (c, min) => (PREC[c.t] < min ? '(' + show(c, style) + ')' : show(c, style));
    switch (n.t) {
      case 'var': return n.v;
      case 'const': return L ? (n.v ? 'T' : 'F') : String(n.v);
      case 'not':
        if (L) return '¬' + wrap(n.a, 5);
        return (n.a.t === 'var' || n.a.t === 'const' ? show(n.a, style) : '(' + show(n.a, style) + ')') + '′';
      case 'and': return n.args.map((c) => wrap(c, 4)).join(L ? ' ∧ ' : '');
      case 'or': return n.args.map((c) => wrap(c, 3)).join(L ? ' ∨ ' : ' + ');
      case 'xor': return wrap(n.a, 3) + ' ⊕ ' + wrap(n.b, 4);
      case 'diff': return wrap(n.a, 3) + ' ∖ ' + wrap(n.b, 4);
      case 'imp': return wrap(n.a, 3) + ' → ' + wrap(n.b, 2);
      case 'iff': return wrap(n.a, 1) + ' ↔ ' + wrap(n.b, 2);
      default: return '?';
    }
  }

  // Sub-formulas in evaluation order (for truth-table columns).
  function steps(n, out = [], seen = new Set(), style = 'logic') {
    if (n.t === 'var' || n.t === 'const') return out;
    if (n.args) n.args.forEach((c) => steps(c, out, seen, style));
    else { if (n.a) steps(n.a, out, seen, style); if (n.b) steps(n.b, out, seen, style); }
    const key = show(n, style);
    if (!seen.has(key)) { seen.add(key); out.push({ node: n, label: key }); }
    return out;
  }

  // ------------------------------------------------------------------ SoP structure
  const litStr = (l) => l.v + (l.neg ? '′' : '');
  const termStr = (t) => (t.length ? [...t].sort((a, b) => rank(a.v) - rank(b.v)).map(litStr).join('') : '1');

  function asSop(n) {
    if (n.t === 'const') return n.v ? { ok: true, terms: [[]] } : { ok: true, terms: [] };
    const sum = n.t === 'or' ? n.args : [n];
    const terms = [];
    for (const t of sum) {
      const facs = t.t === 'and' ? t.args : [t];
      const lits = [];
      for (const f of facs) {
        if (f.t === 'var') lits.push({ v: f.v, neg: false });
        else if (f.t === 'not' && f.a.t === 'var') lits.push({ v: f.a.v, neg: true });
        else {
          let why;
          if (f.t === 'const') why = 'it still contains the constant ' + f.v + ' (simplify it away)';
          else if (f.t === 'not' && f.a.t === 'not') why = 'it has a double complement ' + show(f) + ' (use x″ = x)';
          else if (f.t === 'not') why = 'the complement in ' + show(f) + ' still covers a bracket (push it inside with De Morgan)';
          else if (f.t === 'or') why = 'the bracket (' + show(f) + ') still has to be multiplied out';
          else why = 'it uses an operator other than +, product and ′';
          return { ok: false, why };
        }
      }
      terms.push(lits);
    }
    return { ok: true, terms };
  }

  // Course definitions: fundamental product = no variable twice; SoP = fundamental
  // products, none contained in another.
  function sopIssues(terms) {
    const issues = [];
    terms.forEach((t) => {
      const seen = new Map();
      for (const l of t) {
        if (seen.has(l.v)) {
          issues.push(seen.get(l.v) === l.neg
            ? `the product ${termStr(t)} repeats ${l.v} (xx = x)`
            : `the product ${termStr(t)} contains both ${l.v} and ${l.v}′, so it equals 0`);
          return;
        }
        seen.set(l.v, l.neg);
      }
    });
    if (issues.length) return issues;
    const keyOf = (t) => new Set(t.map(litStr));
    for (let i = 0; i < terms.length; i++) {
      for (let j = 0; j < terms.length; j++) {
        if (i === j) continue;
        const a = keyOf(terms[i]), b = keyOf(terms[j]);
        if ([...a].every((x) => b.has(x))) {
          if (a.size === b.size && i > j) continue;
          issues.push(a.size === b.size
            ? `the product ${termStr(terms[i])} appears twice`
            : `${termStr(terms[i])} is contained in ${termStr(terms[j])}, so ${termStr(terms[j])} is absorbed`);
          return issues;
        }
      }
    }
    return issues;
  }

  const countEL = (terms) => terms.reduce((a, t) => a + t.length, 0);

  // ------------------------------------------------------------------ prime implicants
  const toBits = (m, n) => m.toString(2).padStart(n, '0');
  function covers(p, m, n) {
    for (let k = 0; k < n; k++) {
      if (p[k] === '-') continue;
      if (+p[k] !== ((m >> (n - 1 - k)) & 1)) return false;
    }
    return true;
  }
  function primeImplicants(ms, n) {
    let cur = [...new Set(ms.map((m) => toBits(m, n)))];
    const primes = new Set();
    while (cur.length) {
      const merged = new Set(), used = new Set();
      for (let a = 0; a < cur.length; a++) {
        for (let b = a + 1; b < cur.length; b++) {
          const x = cur[a], y = cur[b];
          let pos = -1, cnt = 0;
          for (let k = 0; k < n && cnt < 2; k++) if (x[k] !== y[k]) { cnt++; pos = k; }
          if (cnt === 1 && x[pos] !== '-' && y[pos] !== '-') {
            merged.add(x.slice(0, pos) + '-' + x.slice(pos + 1));
            used.add(x); used.add(y);
          }
        }
      }
      cur.forEach((x) => { if (!used.has(x)) primes.add(x); });
      cur = [...merged];
    }
    return [...primes].sort((a, b) => patLits(a) - patLits(b) || (a < b ? 1 : -1));
  }
  const patLits = (p) => [...p].filter((c) => c !== '-').length;
  const patStr = (p, vars) => {
    let s = '';
    for (let k = 0; k < vars.length; k++) if (p[k] !== '-') s += vars[k] + (p[k] === '0' ? '′' : '');
    return s || '1';
  };
  const patCells = (p, n) => {
    const out = [];
    for (let m = 0; m < (1 << n); m++) if (covers(p, m, n)) out.push(m);
    return out;
  };

  // All minimal sums in the course's sense (no equivalent SoP is "simpler").
  function minimalSums(ms, n) {
    const full = (1 << n);
    if (!ms.length) return { primes: [], essential: [], sums: [[]] };
    if (ms.length === full) { const one = '-'.repeat(n); return { primes: [one], essential: [one], sums: [[one]] }; }
    const primes = primeImplicants(ms, n);
    // cells[j]: indices (into ms) of the minterms prime j covers; by[i]: the primes covering minterm i.
    // Coverage is counted per minterm, so any number of minterms works (no 32-bit masks).
    const cells = primes.map((p) => ms.flatMap((m, i) => (covers(p, m, n) ? [i] : [])));
    const by = ms.map(() => []);
    cells.forEach((cs, j) => cs.forEach((i) => by[i].push(j)));
    const essential = [];
    by.forEach((c) => { if (c.length === 1 && !essential.includes(primes[c[0]])) essential.push(primes[c[0]]); });

    const count = new Int32Array(ms.length);
    let uncovered = ms.length;
    const add = (j) => cells[j].forEach((i) => { if (count[i]++ === 0) uncovered--; });
    const remove = (j) => cells[j].forEach((i) => { if (--count[i] === 0) uncovered++; });
    const found = new Map();
    let budget = 400000;
    function search(chosen, maxK) {
      if (--budget < 0) return;
      if (!uncovered) {
        const key = [...chosen].sort((a, b) => a - b).join(',');
        if (!found.has(key)) found.set(key, [...chosen]);
        return;
      }
      if (chosen.length >= maxK) return;
      const first = count.indexOf(0);
      for (const j of by[first]) {
        if (chosen.includes(j)) continue;
        chosen.push(j); add(j); search(chosen, maxK); remove(j); chosen.pop();
      }
    }
    let kmin = 0;
    for (let k = 1; k <= primes.length && budget >= 0; k++) { found.clear(); budget = 400000; search([], k); if (found.size) { kmin = k; break; } }
    if (kmin) { found.clear(); budget = 400000; search([], Math.min(primes.length, kmin + 2)); }
    if (!found.size) found.set('greedy', greedyCover());
    function greedyCover() {
      // Fallback when the search budget runs out (very large maps): largest new coverage first.
      const chosen = [], have = new Set();
      while (have.size < ms.length) {
        let best = -1, gain = 0;
        cells.forEach((cs, j) => { const g = cs.filter((i) => !have.has(i)).length; if (g > gain) { gain = g; best = j; } });
        chosen.push(best); cells[best].forEach((i) => have.add(i));
      }
      for (let k = chosen.length - 1; k >= 0; k--) {
        const others = chosen.filter((_, o) => o !== k);
        const c = new Set(others.flatMap((j) => cells[j]));
        if (c.size === ms.length) chosen.splice(k, 1);
      }
      return chosen;
    }
    const irredundant = (set) => set.every((j) => {
      const c = new Int32Array(ms.length);
      set.forEach((o) => { if (o !== j) cells[o].forEach((i) => { c[i]++; }); });
      return c.includes(0);
    });
    const covers_ = [...found.values()].filter(irredundant).map((s) => ({
      s: s.map((j) => primes[j]), ES: s.length, EL: s.reduce((a, j) => a + patLits(primes[j]), 0),
    }));
    const frontier = covers_.filter((a) => !covers_.some((b) => simpler(b, a)));
    const seen = new Set(), sums = [];
    frontier.sort((a, b) => a.ES - b.ES || a.EL - b.EL).forEach((f) => {
      const s = [...f.s].sort((a, b) => patLits(a) - patLits(b) || (a < b ? 1 : -1));
      const key = s.join('|');
      if (!seen.has(key)) { seen.add(key); sums.push(s); }
    });
    return { primes, essential, sums };
  }
  const simpler = (b, a) => (b.EL < a.EL && b.ES <= a.ES) || (b.EL <= a.EL && b.ES < a.ES);

  const sumStr = (sum, vars) => (sum.length ? sum.map((p) => patStr(p, vars)).join(' + ') : '0');
  const csopStr = (ms, vars) => (ms.length
    ? [...ms].sort((a, b) => b - a).map((m) => patStr(toBits(m, vars.length), vars)).join(' + ')
    : '0');

  // ------------------------------------------------------------------ grading
  // spec: { answer, vars:[...], mode: 'eq'|'sop'|'csop'|'min'|'prod' }
  function grade(input, spec) {
    let tree;
    const vars = spec.vars;
    try { tree = parse(input, vars); } catch (e) {
      if (e instanceof ParseError) return { status: 'error', msg: e.message };
      throw e;
    }
    const used = varsOf(tree);
    const extra = [...used].filter((v) => !vars.includes(v));
    if (extra.length) return { status: 'error', msg: `Use only the variables ${vars.join(', ')} (found ${extra.join(', ')}).` };
    const ansTree = parse(spec.answer, vars);
    const tu = table(tree, vars), ta = table(ansTree, vars);
    const bad = ta.findIndex((b, i) => b !== tu[i]);
    if (bad >= 0) {
      const env = envFor(vars, bad);
      const where = vars.map((v) => `${v} = ${env[v]}`).join(', ');
      return { status: 'wrong', msg: `Not equivalent. At ${where} the correct expression is ${ta[bad]}, but yours gives ${tu[bad]}.` };
    }
    if (spec.only) {
      const NAMES = { and: '∧', or: '∨', not: '¬', xor: '⊕', imp: '→', iff: '↔', diff: '∖' };
      const bad = (function find(n) {
        if (n.t === 'var' || n.t === 'const') return null;
        if (!spec.only.includes(n.t)) return n.t;
        const kids = n.args || [n.a, n.b].filter(Boolean);
        for (const k of kids) { const r = find(k); if (r) return r; }
        return null;
      })(tree);
      if (bad) return { status: 'partial', msg: `Equivalent, but it uses ${NAMES[bad]}. Rewrite it with ${spec.only.map((t) => NAMES[t]).join(', ')} only.` };
    }
    if (spec.mode === 'eq') return { status: 'ok', msg: 'Correct. Your expression is equivalent to the answer.' };

    const sop = asSop(tree);
    if (!sop.ok) return { status: 'partial', msg: `Equivalent, but not yet a sum of products: ${sop.why}.` };
    const issues = sopIssues(sop.terms);
    if (issues.length) return { status: 'partial', msg: `Equivalent, but not in SoP form yet: ${issues[0]}.` };
    const ES = sop.terms.length, EL = countEL(sop.terms);

    if (spec.mode === 'prod') {
      if (ES > 1) return { status: 'partial', msg: 'Equivalent, but the answer should be a single fundamental product (or 0).' };
      return { status: 'ok', msg: ES === 0 ? 'Correct: the product reduces to 0.' : `Correct: ${termStr(sop.terms[0])} is a fundamental product.` };
    }
    if (spec.mode === 'sop') return { status: 'ok', msg: `Correct: a valid SoP form (${ES} product${ES === 1 ? '' : 's'}, ${EL} literal${EL === 1 ? '' : 's'}).` };
    if (spec.mode === 'csop') {
      const short = sop.terms.find((t) => t.length < vars.length);
      if (short) {
        const missing = vars.filter((v) => !short.some((l) => l.v === v));
        return { status: 'partial', msg: `Equivalent SoP, but ${termStr(short)} is not a minterm (it is missing ${missing.join(', ')}). Multiply it by (${missing[0]} + ${missing[0]}′).` };
      }
      return { status: 'ok', msg: `Correct: this is the complete SoP form (${ES} minterm${ES === 1 ? '' : 's'}).` };
    }
    if (spec.mode === 'min') {
      const n = vars.length;
      const ms = ta.flatMap((b, i) => (b ? [i] : []));
      const res = minimalSums(ms, n);
      const best = res.sums.map((s) => ({ ES: s.length, EL: s.reduce((a, p) => a + patLits(p), 0) }));
      const better = best.find((b) => simpler(b, { ES, EL }));
      if (better) {
        const primeSet = new Set(res.primes.map((p) => patStr(p, vars)));
        const notPrime = sop.terms.map(termStr).find((t) => !primeSet.has(t));
        const tip = notPrime ? ` Tip: ${notPrime} is not a prime implicant; it fits inside a larger rectangle.` : ' Tip: one of your products is redundant, or a different choice of rectangles needs fewer.';
        return { status: 'partial', msg: `Equivalent, but not minimal: yours has ${ES} products and ${EL} literals; a minimal sum has ${better.ES} products and ${better.EL} literals.${tip}` };
      }
      const many = res.sums.length;
      return { status: 'ok', msg: `Correct and minimal (${ES} product${ES === 1 ? '' : 's'}, ${EL} literal${EL === 1 ? '' : 's'}).` + (many > 1 ? ` This function has ${many} different minimal sums; yours is one of them.` : '') };
    }
    return { status: 'ok', msg: 'Correct.' };
  }

  function gradeBits(input, answer) {
    const s = String(input).replace(/[\s,]/g, '');
    if (!s) return { status: 'error', msg: 'Type the bit string first.' };
    if (!/^[01]+$/.test(s)) return { status: 'error', msg: 'Use only the digits 0 and 1.' };
    if (s.length !== answer.length) return { status: 'wrong', msg: `Your string has ${s.length} bits; the answer has ${answer.length}.` };
    const bad = [...answer].flatMap((c, i) => (c !== s[i] ? [i + 1] : []));
    if (!bad.length) return { status: 'ok', msg: 'Correct.' };
    return { status: 'wrong', msg: `Not quite: position${bad.length > 1 ? 's' : ''} ${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} wrong (counting from the left).` };
  }

  function gradeNum(input, answer) {
    const s = String(input).replace(/[\s,]/g, '').replace(/^−/, '-');
    if (!s) return { status: 'error', msg: 'Type a number first.' };
    if (!/^-?\d+$/.test(s)) return { status: 'error', msg: 'Type a whole number, for example 42 or −3.' };
    if (parseInt(s, 10) === parseInt(String(answer).replace(/^−/, '-'), 10)) return { status: 'ok', msg: 'Correct.' };
    return { status: 'wrong', msg: 'Not quite. Check the computation and try again.' };
  }

  function gradeSet(input, answer) {
    const parse_ = (str) => {
      const t = String(str).trim();
      if (/^(∅|\{\s*\}|empty)$/i.test(t)) return [];
      const nums = t.replace(/[{}\s]/g, '').split(/[,;]/).filter(Boolean);
      if (nums.some((x) => !/^[−-]?\d+$/.test(x))) return null;
      return [...new Set(nums.map((x) => parseInt(x.replace('−', '-'), 10)))].sort((a, b) => a - b);
    };
    if (!String(input).trim()) return { status: 'error', msg: 'Type the set first. For the empty set, type {} or press the ∅ button.' };
    const u = parse_(input), a = parse_(answer);
    if (u === null) return { status: 'error', msg: 'Write the set as numbers separated by commas, for example {1, 2, 3} or ∅.' };
    const same = u.length === a.length && u.every((x, i) => x === a[i]);
    if (same) return { status: 'ok', msg: 'Correct.' };
    const missing = a.filter((x) => !u.includes(x)), extra = u.filter((x) => !a.includes(x));
    const parts = [];
    if (missing.length) parts.push(`${missing.length} element${missing.length > 1 ? 's are' : ' is'} missing`);
    if (extra.length) parts.push(`${extra.length} element${extra.length > 1 ? 's do' : ' does'} not belong`);
    return { status: 'wrong', msg: `Not quite: ${parts.join(' and ')}.` };
  }

  // a set of ordered pairs of integers, typed as (a, b), (c, d), … with optional braces
  function gradePairs(input, answer) {
    const parse_ = (str) => {
      const t = String(str).replace(/\s/g, '').replace(/−/g, '-').replace(/^\{(.*)\}$/, '$1');
      if (!/^(\(-?\d+,-?\d+\)[,;]?)*$/.test(t)) return null;
      const pairs = (t.match(/\(-?\d+,-?\d+\)/g) || []).map((p) => p.slice(1, -1).split(',').map(Number).join(','));
      return [...new Set(pairs)];
    };
    if (!String(input).trim()) return { status: 'error', msg: 'Type the pairs first, for example (0, 1), (1, 1).' };
    const u = parse_(input), a = parse_(answer);
    if (u === null) return { status: 'error', msg: 'Write each pair as (a, b) and separate the pairs with commas, for example (0, 1), (1, 1).' };
    const missing = a.filter((x) => !u.includes(x)), extra = u.filter((x) => !a.includes(x));
    if (!missing.length && !extra.length) return { status: 'ok', msg: 'Correct.' };
    const parts = [];
    if (missing.length) parts.push(`${missing.length} pair${missing.length > 1 ? 's are' : ' is'} missing`);
    if (extra.length) parts.push(`${extra.length} pair${extra.length > 1 ? 's do' : ' does'} not belong`);
    return { status: 'wrong', msg: `Not quite: ${parts.join(' and ')}.` };
  }

  return {
    ParseError, parse, ev, varsOf, sortVars, table, minterms, envFor, show, steps,
    asSop, sopIssues, termStr, countEL, primeImplicants, minimalSums, patStr, patLits, patCells,
    covers, toBits, sumStr, csopStr, grade, gradeBits, gradeNum, gradeSet, gradePairs, simpler,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
