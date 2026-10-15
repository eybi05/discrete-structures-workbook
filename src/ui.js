(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, text) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: progress is not saved */ } },
  };

  // ------------------------------------------------------------ math typesetting
  // Letters inside .m become italic, the way variables are set in math.
  function typesetEl(el) {
    if (el.dataset.ts) return;
    el.dataset.ts = '1';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement.closest('.up, i, code, .mono, button.tfb') && node.parentElement !== el
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((tn) => {
      if (tn.parentElement.closest('.up')) return;
      const txt = tn.nodeValue;
      if (!/[A-Za-z]/.test(txt)) return;
      const frag = document.createDocumentFragment();
      let buf = '';
      for (const ch of txt) {
        if (/[A-Za-z]/.test(ch)) {
          if (buf) { frag.append(buf); buf = ''; }
          frag.append(h('i', {}, ch));
        } else buf += ch;
      }
      if (buf) frag.append(buf);
      tn.replaceWith(frag);
    });
    // Short formulas stay on one line; long ones may wrap at their spaces so they never widen the page.
    if (el.textContent.length > 28 && !el.closest('table.km, .chip')) el.classList.add('wrap');
  }
  function typeset(root = document) {
    if (root.nodeType === 1 && root.matches('.m')) typesetEl(root);
    $$('.m', root).forEach(typesetEl);
  }
  const math = (txt, cls = '') => { const e = h('span', { class: ('m ' + cls).trim() }, txt); typesetEl(e); return e; };

  function insertAt(input, text) {
    const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, a) + text + input.value.slice(b);
    input.focus();
    input.setSelectionRange(a + text.length, a + text.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ------------------------------------------------------------ feedback
  const ICON = { ok: '✓', partial: '≈', wrong: '✗', error: '!' };
  function showFb(el, res) {
    el.className = 'fb ' + res.status;
    el.replaceChildren(h('span', { class: 'fb-icon', 'aria-hidden': 'true' }, ICON[res.status]), h('span', {}, res.msg));
  }

  // ------------------------------------------------------------ answer boxes
  let seq = 0;
  function buildCheck(box) {
    const kind = box.dataset.kind || 'bool';
    const owner = box.closest('[id]');
    const id = `${owner ? owner.id : 'c'}-in${++seq}`;
    const ph = box.dataset.ph || (kind === 'bits' ? 'e.g. 01100101' : kind === 'set' ? 'e.g. {1, 2, 3}; type {} for ∅' : "use ' for the prime ′");
    const input = h('input', {
      id, type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      inputmode: kind === 'bits' ? 'numeric' : null, placeholder: ph, 'aria-describedby': id + '-fb',
    });
    const fb = h('p', { class: 'fb', id: id + '-fb', role: 'status', 'aria-live': 'polite' });
    const keyList = kind === 'bool' ? (box.dataset.keys || '′') : kind === 'set' ? '∅' : '';
    const keys = keyList.split(' ').filter(Boolean).map((k) => h('button', {
      type: 'button', class: 'ins-key', 'aria-label': kind === 'set' ? 'Answer: the empty set' : `Insert ${k}`,
      onclick: () => {
        if (kind === 'set') { input.value = '∅'; input.focus(); } else insertAt(input, k);
      },
    }, k));
    const form = h('form', { class: 'check-form', novalidate: true },
      h('label', { for: id, class: 'm' }, box.dataset.label || 'Your answer'),
      h('span', { class: 'field' }, input, ...keys),
      h('button', { type: 'submit', class: 'btn' }, 'Check'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let res;
      if (kind === 'bits') res = Core.gradeBits(input.value, box.dataset.answer);
      else if (kind === 'set') res = Core.gradeSet(input.value, box.dataset.answer);
      else {
        res = Core.grade(input.value, {
          answer: box.dataset.answer, vars: [...box.dataset.vars], mode: box.dataset.mode || 'eq',
          only: box.dataset.only ? box.dataset.only.split(',') : null,
        });
      }
      showFb(fb, res);
    });
    box.append(form, fb);
    typeset(box);
  }

  // ------------------------------------------------------------ true / false items
  function buildTF(li) {
    const ans = li.dataset.a;
    const why = $('.why', li);
    if (why) why.hidden = true;
    const res = h('span', { class: 'tf-res', role: 'status', 'aria-live': 'polite' });
    const labels = (li.closest('[data-tf-labels]')?.dataset.tfLabels || 'True,False').split(',');
    const grp = h('span', { class: 'tf-btns', role: 'group', 'aria-label': 'Choose an answer' });
    ['T', 'F'].forEach((v, k) => {
      grp.append(h('button', {
        type: 'button', class: 'tfb', 'aria-pressed': 'false',
        onclick: (e) => {
          $$('button', grp).forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          const ok = v === ans;
          li.classList.toggle('is-ok', ok);
          li.classList.toggle('is-bad', !ok);
          res.textContent = ok ? '✓ Right' : '✗ Not quite';
          if (why) why.hidden = false;
        },
      }, labels[k]));
    });
    const q = $('.q', li);
    (q || li).after(h('span', { class: 'tf-ctl' }, grp, res));
  }

  // ------------------------------------------------------------ multiple choice
  function buildMCQ(box) {
    const ans = +box.dataset.a;
    const why = $('.why', box);
    if (why) why.hidden = true;
    const res = h('p', { class: 'tf-res', role: 'status', 'aria-live': 'polite' });
    const items = $$('li', box);
    items.forEach((li, i) => {
      const btn = h('button', {
        type: 'button', class: 'opt', 'aria-pressed': 'false',
        onclick: () => {
          items.forEach((other) => $('button', other).setAttribute('aria-pressed', String(other === li)));
          const ok = i === ans;
          box.classList.toggle('is-ok', ok);
          box.classList.toggle('is-bad', !ok);
          res.textContent = ok ? '✓ Right' : '✗ Not quite, try another option';
          if (why) why.hidden = !ok;
        },
      });
      while (li.firstChild) btn.append(li.firstChild);
      li.append(btn);
    });
    $('ul, ol', box).after(res);
  }

  // ------------------------------------------------------------ progress
  const done = new Set(store.get('dsw-done', []));
  function updateCounts() {
    $$('[data-count]').forEach((el) => {
      const set = document.getElementById(el.dataset.count);
      if (!set) return;
      const probs = $$('.prob', set);
      const n = probs.filter((p) => done.has(p.id)).length;
      el.textContent = `${n}/${probs.length}`;
      el.classList.toggle('full', n === probs.length && n > 0);
    });
    const all = $$('main .prob'), n = all.filter((p) => done.has(p.id)).length;
    $$('[data-count-all]').forEach((el) => { el.textContent = `${n} of ${all.length}`; });
  }
  function buildProb(art) {
    const head = $('.p-head', art);
    if (!head) return;
    const on = done.has(art.id);
    art.classList.toggle('is-done', on);
    const btn = h('button', {
      type: 'button', class: 'done-btn', 'aria-pressed': String(on), title: 'Mark this problem as done',
      onclick: () => {
        if (done.has(art.id)) done.delete(art.id); else done.add(art.id);
        store.set('dsw-done', [...done]);
        const now = done.has(art.id);
        btn.setAttribute('aria-pressed', String(now));
        btn.lastChild.textContent = now ? 'Done' : 'Mark done';
        art.classList.toggle('is-done', now);
        updateCounts();
      },
    }, h('span', { class: 'box', 'aria-hidden': 'true' }), on ? 'Done' : 'Mark done');
    head.append(btn);
  }

  // ------------------------------------------------------------ Karnaugh maps
  // The course's layouts: rows x, x′ (or xy, xy′, x′y′, x′y) and columns yz, yz′, y′z′, y′z (or zt, …).
  const DEFAULT_VARS = { 2: ['x', 'y'], 3: ['x', 'y', 'z'], 4: ['x', 'y', 'z', 't'] };
  function layout(n, vars = DEFAULT_VARS[n]) {
    const one = (v) => [[v, 1], [v + '′', 0]];
    const pair = (a, b) => [[a + b, 3], [a + b + '′', 2], [a + '′' + b + '′', 0], [a + '′' + b, 1]];
    if (n === 2) return { n, vars, shift: 1, rows: one(vars[0]), cols: one(vars[1]) };
    if (n === 3) return { n, vars, shift: 2, rows: one(vars[0]), cols: pair(vars[1], vars[2]) };
    return { n, vars, shift: 2, rows: pair(vars[0], vars[1]), cols: pair(vars[2], vars[3]) };
  }
  const KM = { 2: layout(2), 3: layout(3), 4: layout(4) };
  function kmapTable(n, set, opts = {}) {
    const L = opts.layout || KM[n];
    const cells = new Map();
    const thead = h('thead', {}, h('tr', {}, h('td', { class: 'corner' }), ...L.cols.map(([lab]) => h('th', { scope: 'col', class: 'm' }, lab))));
    const tbody = h('tbody');
    L.rows.forEach(([rl, rv]) => {
      const tr = h('tr', {}, h('th', { scope: 'row', class: 'm' }, rl));
      L.cols.forEach(([, cv]) => {
        const m = (rv << L.shift) | cv;
        const name = Core.patStr(Core.toBits(m, n), L.vars);
        const on = set.has(m);
        let cell, target;
        if (opts.interactive) {
          target = h('button', { type: 'button', class: 'km-btn', 'aria-pressed': String(on), 'aria-label': `square ${name}`, title: name, onclick: () => opts.onToggle(m) }, on ? '✓' : '');
          cell = h('td', { class: 'km-cell' + (on ? ' on' : '') }, target);
        } else {
          cell = h('td', { class: 'km-cell' + (on ? ' on' : ''), title: name }, opts.labels ? math(name, 'km-name') : (on ? '✓' : ''));
          target = cell;
        }
        cells.set(m, cell);
        tr.append(cell);
      });
      tbody.append(tr);
    });
    const table = h('table', { class: `km km${n}` }, thead, tbody);
    typeset(table);
    return { table, cells };
  }

  // Chips for products; hover, focus or tap a chip to outline its squares.
  function chipGroup(n, cells, vars = KM[n].vars) {
    const pinned = new Set();
    let hover = null;
    const refresh = () => {
      cells.forEach((c) => c.classList.remove('hl'));
      const pats = [...pinned].map((b) => b.dataset.p);
      if (hover) pats.push(hover);
      pats.forEach((p) => Core.patCells(p, n).forEach((m) => cells.get(m)?.classList.add('hl')));
    };
    return (p, cls = '') => {
      const b = h('button', { type: 'button', class: ('chip ' + cls).trim(), 'aria-pressed': 'false', 'data-p': p, title: 'Outline this rectangle on the map' }, math(Core.patStr(p, vars)));
      b.addEventListener('mouseenter', () => { hover = p; refresh(); });
      b.addEventListener('mouseleave', () => { hover = null; refresh(); });
      b.addEventListener('focus', () => { hover = p; refresh(); });
      b.addEventListener('blur', () => { hover = null; refresh(); });
      b.addEventListener('click', () => {
        if (pinned.has(b)) { pinned.delete(b); hover = null; } else pinned.add(b);
        b.setAttribute('aria-pressed', String(pinned.has(b)));
        refresh();
      });
      return b;
    };
  }

  function solveView(n, set, cells, { primes: showPrimes = true, vars = KM[n].vars } = {}) {
    const ms = [...set].sort((a, b) => a - b);
    const res = Core.minimalSums(ms, n);
    const chip = chipGroup(n, cells, vars);
    const wrap = h('div', { class: 'km-sol' });
    if (!ms.length) { wrap.append(h('p', {}, 'No squares are checked, so E = 0.')); return wrap; }
    if (ms.length === 1 << n) { wrap.append(h('p', {}, 'Every square is checked, so E = 1.')); return wrap; }
    if (showPrimes) {
      wrap.append(h('div', { class: 'km-row' }, h('span', { class: 'km-lab' }, 'Prime implicants'),
        h('span', { class: 'chips' }, ...res.primes.map((p) => chip(p, res.essential.includes(p) ? 'ess' : '')))));
    }
    res.sums.forEach((sum, i) => {
      const lab = res.sums.length > 1 ? `Minimal sum ${i + 1} of ${res.sums.length}` : 'Minimal sum';
      const chips = [];
      sum.forEach((p, k) => { if (k) chips.push(h('span', { class: 'plus', 'aria-hidden': 'true' }, '+')); chips.push(chip(p, res.essential.includes(p) ? 'ess' : '')); });
      wrap.append(h('div', { class: 'km-row' }, h('span', { class: 'km-lab' }, lab), h('span', { class: 'chips' }, ...chips)));
    });
    if (showPrimes && res.essential.length) {
      wrap.append(h('p', { class: 'km-note' }, h('span', { class: 'chip ess demo', 'aria-hidden': 'true' }, 'xy'), ' Filled chips are essential prime implicants. Hover over or tap a chip to outline its rectangle.'));
    } else {
      wrap.append(h('p', { class: 'km-note' }, 'Hover over or tap a chip to outline its rectangle.'));
    }
    return wrap;
  }

  function buildKmap(el) {
    const n = +el.dataset.n || 4;
    const vars = el.dataset.vars ? [...el.dataset.vars] : DEFAULT_VARS[n];
    const L = layout(n, vars);
    let ms = el.dataset.m !== undefined ? el.dataset.m.split(',').filter(Boolean).map(Number) : [];
    if (el.dataset.expr) ms = Core.minterms(Core.parse(el.dataset.expr), vars);
    const set = new Set(ms);
    const { table, cells } = kmapTable(n, set, { labels: el.dataset.labels !== undefined, layout: L });
    el.append(h('div', { class: 'km-wrap' }, table));
    if (el.dataset.solve !== undefined) el.append(solveView(n, set, cells, { primes: el.dataset.solve !== 'sums', vars }));
  }

  // ------------------------------------------------------------ AND-OR circuits
  function sortedTerms(expr) {
    const tree = Core.parse(expr);
    const sop = Core.asSop(tree);
    if (!sop.ok) throw new Error('not a sum of products: ' + expr);
    const rk = (v) => 'ABCDEGHIJKLMNOPQRSUVWXYZabcdefghijklmnopqrsuvwxyzt'.indexOf(v);
    return sop.terms.map((t) => [...t].sort((a, b) => rk(a.v) - rk(b.v)));
  }
  function circuitSVG(terms, inputs, outName = 'Y') {
    const busTop = 16, busGap = 18, labelX = 10, busX0 = 22;
    const inGap = 13, gateGap = 22, dropGap = 13, notLen = 22;
    const busY = (v) => busTop + inputs.indexOf(v) * busGap;
    const maxK = Math.max(...terms.map((t) => t.length));
    const H = Math.max(30, (maxK + 1) * inGap);
    const andLen = 18 + H / 2;
    let y = busTop + (inputs.length - 1) * busGap + 30;
    const gates = terms.map((lits) => {
      const g = { lits, k: lits.length, top: y, mid: y + H / 2 };
      g.ins = lits.map((_, i) => g.mid + (i - (g.k - 1) / 2) * inGap);
      y += H + gateGap;
      return g;
    });
    const bottom = y - gateGap;
    const drops = [];
    for (let gi = gates.length - 1; gi >= 0; gi--) for (let li = gates[gi].k - 1; li >= 0; li--) drops.push({ gi, li });
    const x0 = busX0 + 16;
    drops.forEach((d, i) => { d.x = x0 + i * dropGap; });
    const busEnd = x0 + Math.max(0, drops.length - 1) * dropGap + 10;
    const xGate = busEnd + notLen + 22;
    const xOut = xGate + andLen;
    const m = gates.length;
    const dmax = (m - 1) / 2;
    const xOr = xOut + 18 + Math.ceil(dmax) * 9 + 8;
    const orW = 46;
    const orGap = 11;
    const orH = Math.max(34, (m + 1) * orGap);
    const yc = m > 1 ? (gates[0].mid + gates[m - 1].mid) / 2 : gates[0].mid;
    const width = (m > 1 ? xOr + orW : xOut) + 42;
    const height = Math.max(bottom, yc + orH / 2) + 12;
    const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'circ', role: 'img' });
    const wires = s('g', { class: 'wire' }), parts = s('g', { class: 'part' }), dots = s('g', { class: 'dot' }), text = s('g', { class: 'ctext' });
    svg.append(wires, parts, dots, text);
    const line = (x1, y1, x2, y2) => wires.append(s('line', { x1, y1, x2, y2 }));
    const notGate = (x, yy) => {
      parts.append(s('path', { d: `M${x},${yy - 6} L${x},${yy + 6} L${x + 13},${yy} Z` }));
      parts.append(s('circle', { cx: x + 16, cy: yy, r: 3 }));
    };
    inputs.forEach((v) => {
      line(busX0, busY(v), busEnd, busY(v));
      text.append(s('text', { x: labelX, y: busY(v) + 4, class: 'lab' }, v));
    });
    drops.forEach((d) => {
      const g = gates[d.gi], lit = g.lits[d.li], yIn = g.ins[d.li];
      line(d.x, busY(lit.v), d.x, yIn);
      dots.append(s('circle', { cx: d.x, cy: busY(lit.v), r: 2.6 }));
      const end = g.k === 1 ? xOut : xGate;
      if (lit.neg) {
        const nx = xGate - notLen - 4;
        line(d.x, yIn, nx, yIn);
        notGate(nx, yIn);
        line(nx + 19, yIn, end, yIn);
      } else line(d.x, yIn, end, yIn);
    });
    gates.forEach((g) => {
      if (g.k === 1) return;
      parts.append(s('path', { d: `M${xGate},${g.top} H${xGate + 18} A${H / 2},${H / 2} 0 0 1 ${xGate + 18},${g.top + H} H${xGate} Z` }));
      text.append(s('text', { x: xGate + 5, y: g.mid + 3, class: 'gl' }, 'AND'));
    });
    if (m > 1) {
      const y0 = yc - orH / 2, y1 = yc + orH / 2;
      gates.forEach((g, i) => {
        const yo = yc + (i - dmax) * orGap;
        const d = Math.abs(i - dmax);
        const xe = xOr - 10 - (Math.ceil(dmax) - d) * 9;
        const t = (yo - y0) / (y1 - y0);
        const xin = xOr + 20 * t * (1 - t);
        wires.append(s('polyline', { points: `${xOut},${g.mid} ${xe},${g.mid} ${xe},${yo} ${xin},${yo}` }));
      });
      parts.append(s('path', { d: `M${xOr},${y0} Q${xOr + orW * 0.62},${y0} ${xOr + orW},${yc} Q${xOr + orW * 0.62},${y1} ${xOr},${y1} Q${xOr + 10},${yc} ${xOr},${y0} Z` }));
      text.append(s('text', { x: xOr + 13, y: yc + 3, class: 'gl' }, 'OR'));
      line(xOr + orW, yc, xOr + orW + 20, yc);
      text.append(s('text', { x: xOr + orW + 24, y: yc + 4, class: 'lab' }, outName));
    } else {
      line(xOut, yc, xOut + 20, yc);
      text.append(s('text', { x: xOut + 24, y: yc + 4, class: 'lab' }, outName));
    }
    return svg;
  }
  function buildCircuit(el) {
    const expr = el.dataset.expr;
    const terms = sortedTerms(expr);
    const used = [...new Set(terms.flat().map((l) => l.v))];
    const inputs = el.dataset.inputs ? [...el.dataset.inputs] : Core.sortVars(used);
    const svg = circuitSVG(terms, inputs, el.dataset.out || 'Y');
    const shown = Core.show(Core.parse(expr));
    svg.setAttribute('aria-label', el.dataset.aria || `AND–OR circuit for ${el.dataset.out || 'Y'} = ${shown}`);
    el.append(h('div', { class: 'circ-wrap' }, svg));
  }

  // ------------------------------------------------------------ gate symbols
  function gateIcon(kind) {
    const svg = s('svg', { viewBox: '0 0 120 54', width: 120, height: 54, class: 'circ gate-icon', role: 'img', 'aria-label': `${kind} gate symbol` });
    const g = s('g', { class: 'part' }), w = s('g', { class: 'wire' }), t = s('g', { class: 'ctext' });
    svg.append(w, g, t);
    const twoIn = () => { w.append(s('line', { x1: 8, y1: 18, x2: 36, y2: 18 }), s('line', { x1: 8, y1: 36, x2: 36, y2: 36 })); t.append(s('text', { x: 0, y: 21, class: 'lab' }, 'A'), s('text', { x: 0, y: 39, class: 'lab' }, 'B')); };
    const out = (x) => { w.append(s('line', { x1: x, y1: 27, x2: 108, y2: 27 })); t.append(s('text', { x: 110, y: 31, class: 'lab' }, 'Y')); };
    const and = () => g.append(s('path', { d: 'M36,10 H52 A17,17 0 0 1 52,44 H36 Z' }));
    const or = () => g.append(s('path', { d: 'M34,10 Q62,10 76,27 Q62,44 34,44 Q44,27 34,10 Z' }));
    const bubble = (x) => g.append(s('circle', { cx: x + 3.5, cy: 27, r: 3.5 }));
    if (kind === 'AND') { twoIn(); and(); out(69); }
    if (kind === 'OR') { twoIn(); or(); out(76); }
    if (kind === 'NAND') { twoIn(); and(); bubble(69); out(76); }
    if (kind === 'NOR') { twoIn(); or(); bubble(76); out(83); }
    if (kind === 'NOT') {
      w.append(s('line', { x1: 8, y1: 27, x2: 38, y2: 27 }));
      t.append(s('text', { x: 0, y: 30, class: 'lab' }, 'A'));
      g.append(s('path', { d: 'M38,13 L38,41 L62,27 Z' }));
      bubble(62); out(69);
    }
    return svg;
  }

  // ------------------------------------------------------------ timing diagram (special sequences)
  function buildTiming(el) {
    const traces = el.dataset.traces.split(',').map((p) => { const i = p.lastIndexOf(':'); return { name: p.slice(0, i), bits: p.slice(i + 1) }; });
    const N = traces[0].bits.length, cw = 30, lh = 34, left = 78, top = 22;
    const W = left + N * cw + 8, H = top + traces.length * lh + 4;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'timing-svg', role: 'img', 'aria-label': 'Timing diagram: ' + traces.map((t) => `${t.name} = ${t.bits}`).join('; ') });
    for (let k = 0; k <= N; k++) svg.append(s('line', { x1: left + k * cw, y1: top - 6, x2: left + k * cw, y2: H - 4, class: 'grid' }));
    for (let k = 0; k < N; k++) svg.append(s('text', { x: left + k * cw + cw / 2, y: 12, class: 'pos' }, String(k + 1)));
    traces.forEach((t, r) => {
      const base = top + r * lh + lh - 8, hi = base - 16;
      let d = '';
      [...t.bits].forEach((b, k) => {
        const yy = b === '1' ? hi : base, x = left + k * cw;
        d += (k === 0 ? `M${x},${yy}` : ` L${x},${yy}`) + ` L${x + cw},${yy}`;
      });
      const last = r === traces.length - 1;
      svg.append(s('path', { d, class: 'trace' + (last ? ' out' : '') }));
      const label = s('text', { x: left - 10, y: base - 3, class: 'tname' + (last ? ' out' : '') });
      label.textContent = t.name;
      svg.append(label);
      [...t.bits].forEach((b, k) => svg.append(s('text', { x: left + k * cw + cw / 2, y: (b === '1' ? hi : base) - 4, class: 'bit' + (last ? ' out' : '') }, b)));
    });
    el.append(svg);
  }

  // ------------------------------------------------------------ Prim's algorithm on a grid graph
  // data-rows="a b c d|e f g h|i j k l" places the vertices; data-e="a-b:2 b-c:3 …" lists the weighted edges.
  // Each click must add an edge Prim's algorithm could choose next (the first one: any lightest edge).
  function buildPrim(el) {
    const rows = el.dataset.rows.split('|').map((r) => r.trim().split(/\s+/));
    const pos = {};
    const gx = 120, gy = 96, pad = 30;
    rows.forEach((r, i) => r.forEach((v, j) => { pos[v] = [pad + j * gx, pad + i * gy]; }));
    const edges = el.dataset.e.trim().split(/\s+/).map((t) => {
      const [, u, v, w] = t.match(/^(\w+)-(\w+):(\d+)$/);
      return { u, v, w: +w, name: `{${u}, ${v}}` };
    });
    const nV = Object.keys(pos).length;
    const W = pad * 2 + (Math.max(...rows.map((r) => r.length)) - 1) * gx, H = pad * 2 + (rows.length - 1) * gy;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'prim-svg', role: 'group', 'aria-label': 'Weighted graph: press an edge to add it to the tree' });
    const chosen = [];
    const inTree = () => new Set(chosen.flatMap((e) => [e.u, e.v]));
    const fb = h('p', { class: 'fb', role: 'status', 'aria-live': 'polite' });
    const log = h('ol', { class: 'prim-log' });
    const total = h('span', { class: 'prim-total' });

    function candidates() {
      const T = inTree();
      const free = edges.filter((e) => !chosen.includes(e) && (chosen.length === 0 || T.has(e.u) !== T.has(e.v)));
      const min = Math.min(...free.map((e) => e.w));
      return { T, min, ok: free.filter((e) => e.w === min) };
    }
    function render() {
      edges.forEach((e) => {
        const on = chosen.includes(e);
        e.g.classList.toggle('on', on);
        e.g.setAttribute('aria-pressed', String(on));
      });
      const T = inTree();
      Object.entries(pos).forEach(([v]) => svg.querySelector(`[data-v="${v}"]`).classList.toggle('on', T.has(v)));
      log.replaceChildren(...chosen.map((e) => h('li', {}, h('span', { class: 'm' }, e.name), ` — ${e.w}`)));
      total.textContent = `${chosen.length} of ${nV - 1} edges · total weight ${chosen.reduce((a, e) => a + e.w, 0)}`;
      typeset(log);
    }
    function pick(e) {
      if (chosen.length === nV - 1) return;
      if (chosen.includes(e)) { showFb(fb, { status: 'error', msg: `${e.name} is already in the tree. Use Undo to take the last edge back.` }); return; }
      const { T, min, ok } = candidates();
      if (ok.includes(e)) {
        chosen.push(e);
        render();
        const sum = chosen.reduce((a, x) => a + x.w, 0);
        if (chosen.length === nV - 1) showFb(fb, { status: 'ok', msg: `Done: ${nV - 1} edges reach all ${nV} vertices. Minimum spanning tree, total weight ${sum}.` });
        else showFb(fb, { status: 'ok', msg: `${e.name} (weight ${e.w}) is a correct choice.` });
        return;
      }
      let msg;
      if (chosen.length === 0) msg = `Start with an edge of the smallest weight in the graph (${min}).`;
      else if (T.has(e.u) && T.has(e.v)) msg = `Both ends of ${e.name} are already in the tree, so it would close a circuit.`;
      else if (!T.has(e.u) && !T.has(e.v)) msg = `${e.name} does not touch the tree yet. Prim's algorithm only adds edges with one end in the tree.`;
      else msg = `${e.name} leaves the tree, but a lighter edge does too (weight ${min}).`;
      showFb(fb, { status: 'wrong', msg });
    }

    edges.forEach((e) => {
      const [x1, y1] = pos[e.u], [x2, y2] = pos[e.v];
      const horiz = Math.abs(y1 - y2) < 1;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      e.g = s('g', { class: 'edge', tabindex: 0, role: 'button', 'aria-label': `Edge ${e.u}–${e.v}, weight ${e.w}` });
      e.g.append(
        s('line', { x1, y1, x2, y2, class: 'hit' }),
        s('line', { x1, y1, x2, y2, class: 'ln' }),
        s('text', { x: horiz ? mx : mx - 10, y: horiz ? my - 8 : my + 5, class: 'w', 'text-anchor': horiz ? 'middle' : 'end' }, String(e.w)),
      );
      e.g.addEventListener('click', () => pick(e));
      e.g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(e); } });
      svg.append(e.g);
    });
    Object.entries(pos).forEach(([v, [x, y]]) => {
      const g = s('g', { class: 'vx', 'data-v': v, 'aria-hidden': 'true' });
      const above = y < H / 2;
      g.append(s('circle', { cx: x, cy: y, r: 5 }), s('text', { x: x + 8, y: above ? y - 9 : y + 19, class: 'vl' }, v));
      svg.append(g);
    });

    const undo = h('button', { type: 'button', class: 'btn ghost', onclick: () => { chosen.pop(); fb.replaceChildren(); fb.className = 'fb'; render(); } }, 'Undo');
    const reset = h('button', { type: 'button', class: 'btn ghost', onclick: () => { chosen.length = 0; fb.replaceChildren(); fb.className = 'fb'; render(); } }, 'Start again');
    el.append(
      h('div', { class: 'prim-wrap' }, svg),
      h('div', { class: 'prim-bar' }, total, undo, reset),
      fb,
      log,
    );
    render();
  }

  // ------------------------------------------------------------ Venn diagrams (canvas)
  const colorCache = new Map();
  function rgbOf(cssColor) {
    if (colorCache.has(cssColor)) return colorCache.get(cssColor);
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillStyle = cssColor; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const out = [d[0], d[1], d[2]];
    colorCache.set(cssColor, out);
    return out;
  }
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function drawVenn(canvas) {
    const n = +canvas.dataset.sets || 2;
    let tree;
    try { tree = Core.parse(canvas.dataset.expr.replace(/U/g, '1')); } catch (e) { return; }
    const names = ['A', 'B', 'C'].slice(0, n);
    const cssW = canvas.clientWidth || 240, cssH = Math.round(cssW * (n === 3 ? 0.78 : 0.62));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    const W = canvas.width, H = canvas.height;
    const circles = n === 3
      ? [[0.40 * W, 0.40 * H, 0.235 * W], [0.60 * W, 0.40 * H, 0.235 * W], [0.50 * W, 0.66 * H, 0.235 * W]]
      : [[0.38 * W, 0.52 * H, 0.25 * W], [0.62 * W, 0.52 * H, 0.25 * W]];
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const on = rgbOf(token('--venn-on')), off = rgbOf(token('--panel'));
    const env = {};
    const cache = new Map();
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        let key = 0;
        circles.forEach(([cx, cy, r], k) => { const inside = (px - cx) ** 2 + (py - cy) ** 2 <= r * r; env[names[k]] = inside ? 1 : 0; key = (key << 1) | (inside ? 1 : 0); });
        let v = cache.get(key);
        if (v === undefined) { v = Core.ev(tree, env); cache.set(key, v); }
        const col = v ? on : off, o = (py * W + px) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineWidth = 1.6 * dpr;
    ctx.strokeStyle = token('--ink');
    circles.forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
    ctx.strokeStyle = token('--rule');
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    ctx.fillStyle = token('--ink');
    ctx.font = `italic ${15 * dpr}px "Source Serif 4", Georgia, serif`;
    ctx.fillText('U', 8 * dpr, 18 * dpr);
    const pos = n === 3
      ? [[0.17 * W, 0.20 * H], [0.80 * W, 0.20 * H], [0.47 * W, 0.97 * H]]
      : [[0.17 * W, 0.25 * H], [0.79 * W, 0.25 * H]];
    names.forEach((nm, k) => ctx.fillText(nm, pos[k][0], pos[k][1]));
  }
  const redrawVenns = () => { colorCache.clear(); $$('canvas.venn').forEach(drawVenn); };

  // ------------------------------------------------------------ gate calculator
  function buildGateCalc(el) {
    const ids = ['A', 'B', 'C'];
    const defaults = { A: '10110010', B: '11010110', C: '01110011' };
    const inputs = ids.map((v) => h('input', { id: 'gc-' + v, type: 'text', value: defaults[v], inputmode: 'numeric', autocomplete: 'off', spellcheck: 'false', class: 'mono', 'aria-label': `Input ${v} bit sequence` }));
    const out = h('div', { class: 'gc-out', role: 'status', 'aria-live': 'polite' });
    const run = () => {
      const vals = inputs.map((i) => i.value.replace(/\s/g, ''));
      if (vals.some((v) => !/^[01]+$/.test(v))) { out.replaceChildren(h('p', { class: 'fb error' }, 'Use only 0 and 1 in each sequence.')); return; }
      if (new Set(vals.map((v) => v.length)).size > 1) { out.replaceChildren(h('p', { class: 'fb error' }, 'All three sequences must have the same length.')); return; }
      const N = vals[0].length, at = (f) => Array.from({ length: N }, (_, k) => f(vals.map((v) => v[k] === '1')) ? '1' : '0').join('');
      const rows = [
        ['AND', 'ABC', at((b) => b.every(Boolean))],
        ['OR', 'A + B + C', at((b) => b.some(Boolean))],
        ['NAND', '(ABC)′', at((b) => !b.every(Boolean))],
        ['NOR', '(A + B + C)′', at((b) => !b.some(Boolean))],
        ['NOT', 'A′', at((b) => !b[0])],
      ];
      out.replaceChildren(h('table', { class: 'gc-table' }, h('tbody', {}, ...rows.map(([g, f, v]) => h('tr', {}, h('th', { scope: 'row' }, g), h('td', {}, math(f)), h('td', { class: 'mono bitsout' }, v))))));
    };
    inputs.forEach((i) => i.addEventListener('input', run));
    el.append(h('div', { class: 'gc-in' }, ...ids.map((v, k) => h('label', { for: 'gc-' + v, class: 'gc-l' }, h('span', { class: 'm' }, v), inputs[k]))), out);
    typeset(el);
    run();
  }

  // ------------------------------------------------------------ truth-table tool
  function buildTT(el) {
    const input = $('#tt-in', el), input2 = $('#tt-in2', el), out = $('#tt-out', el);
    const styleBtns = $$('[data-style]', el);
    let style = 'auto';
    const detect = (txt) => (/[¬~!∧&∨|→↔⇒⇔≡⊕^]|->|<->|\bT\b|\bF\b/.test(txt) ? 'logic' : 'bool');
    const render = () => {
      out.replaceChildren();
      const txt = input.value;
      if (!txt.trim()) { out.append(h('p', { class: 'muted' }, 'Type an expression to see its truth table.')); return; }
      let tree;
      try { tree = Core.parse(txt); } catch (e) { out.append(h('p', { class: 'fb error' }, h('span', { class: 'fb-icon' }, '!'), e.message)); return; }
      let tree2 = null;
      if (input2.value.trim()) {
        try { tree2 = Core.parse(input2.value); } catch (e) { out.append(h('p', { class: 'fb error' }, h('span', { class: 'fb-icon' }, '!'), 'Second expression: ' + e.message)); }
      }
      const vars = Core.sortVars(new Set([...Core.varsOf(tree), ...(tree2 ? Core.varsOf(tree2) : [])]));
      if (vars.length > 6) { out.append(h('p', { class: 'fb error' }, 'Use at most 6 variables.')); return; }
      const st = style === 'auto' ? detect(txt) : style;
      styleBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === style)));
      const L = st === 'logic';
      const val = (b) => (L ? (b ? 'T' : 'F') : String(b));
      const t1 = Core.table(tree, vars);
      const nT = t1.filter(Boolean).length, R = t1.length;
      const kind = nT === R ? 'Tautology: true in every row.' : nT === 0 ? 'Contradiction: false in every row.' : `Neither: true in ${nT} of ${R} rows.`;
      out.append(h('p', { class: 'tt-kind' }, kind));
      if (tree2) {
        const t2 = Core.table(tree2, vars);
        const bad = t1.findIndex((b, i) => b !== t2[i]);
        if (bad < 0) out.append(h('p', { class: 'fb ok' }, h('span', { class: 'fb-icon' }, '✓'), 'The two expressions are logically equivalent.'));
        else {
          const env = Core.envFor(vars, bad);
          out.append(h('p', { class: 'fb wrong' }, h('span', { class: 'fb-icon' }, '✗'), `Not equivalent: at ${vars.map((v) => `${v} = ${val(env[v])}`).join(', ')} the first is ${val(t1[bad])} and the second is ${val(t2[bad])}.`));
        }
      }
      const steps0 = Core.steps(tree, [], new Set(), L ? 'logic' : 'bool');
      const steps = steps0.length ? steps0 : [{ node: tree, label: Core.show(tree, L ? 'logic' : 'bool') }];
      const cols = steps.length <= 7 ? steps : [steps[steps.length - 1]];
      const order = [...Array(R).keys()];
      if (L) order.reverse();
      const thead = h('thead', {}, h('tr', {}, ...vars.map((v) => h('th', { scope: 'col', class: 'm var' }, v)), ...cols.map((c, k) => h('th', { scope: 'col', class: 'm' + (k === cols.length - 1 ? ' fin' : '') }, c.label))));
      const tbody = h('tbody', {}, ...order.map((r) => {
        const env = Core.envFor(vars, r);
        return h('tr', {}, ...vars.map((v) => h('td', { class: 'var' }, val(env[v]))), ...cols.map((c, k) => { const b = Core.ev(c.node, env); return h('td', { class: (k === cols.length - 1 ? 'fin ' : '') + (b ? 'one' : 'zero') }, val(b)); }));
      }));
      const tbl = h('table', { class: 'tt' }, thead, tbody);
      out.append(h('div', { class: 'scroll' }, tbl));
      if (steps.length > 7) out.append(h('p', { class: 'muted small' }, 'Long expression: only the final column is shown.'));
      if (vars.length <= 4) {
        const ms = t1.flatMap((b, i) => (b ? [i] : []));
        const res = Core.minimalSums(ms, vars.length);
        const ex = h('dl', { class: 'tt-extra' },
          h('dt', {}, 'T(E), special-sequence order'), h('dd', { class: 'mono' }, t1.join('')),
          h('dt', {}, 'Complete SoP'), h('dd', {}, math(Core.csopStr(ms, vars))),
          h('dt', {}, res.sums.length > 1 ? `Minimal sums (${res.sums.length})` : 'Minimal sum'), h('dd', {}, ...res.sums.map((sm, i) => h('span', { class: 'msum' }, i ? h('span', { class: 'muted' }, ' or ') : null, math(Core.sumStr(sm, vars))))));
        out.append(ex);
        if (ms.length && ms.length < R && res.sums[0].length <= 6 && res.sums[0].every((p) => Core.patLits(p) >= 1)) {
          const terms = res.sums[0].map((p) => [...p].flatMap((ch, k) => (ch === '-' ? [] : [{ v: vars[k], neg: ch === '0' }])));
          const svg = circuitSVG(terms, vars, 'E');
          svg.setAttribute('aria-label', 'Minimal AND–OR circuit for E = ' + Core.sumStr(res.sums[0], vars));
          out.append(h('details', { class: 'tt-circ' }, h('summary', {}, 'Minimal AND–OR circuit'), h('div', { class: 'circ-wrap' }, svg)));
        }
      }
    };
    let timer;
    [input, input2].forEach((i) => i.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 160); }));
    styleBtns.forEach((b) => b.addEventListener('click', () => { style = b.dataset.style; render(); }));
    $$('.sym-pad button', el).forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
    $$('.sym-pad button', el).forEach((b) => b.addEventListener('click', () => {
      const target = document.activeElement === input2 || el.dataset.last === 'in2' ? input2 : input;
      insertAt(target, b.dataset.sym || b.textContent);
    }));
    input.addEventListener('focus', () => { el.dataset.last = 'in1'; });
    input2.addEventListener('focus', () => { el.dataset.last = 'in2'; });
    el.ttLoad = (a, b = '') => { input.value = a; input2.value = b; render(); };
    render();
  }

  // ------------------------------------------------------------ K-map tool
  function buildKTool(el) {
    let n = 4;
    let set = new Set(Core.minterms(Core.parse("xy'+xyz+x'y'z'+x'yzt'"), KM[4].vars));
    let practice = false;
    const mapBox = h('div', { class: 'kt-map' });
    const info = h('div', { class: 'kt-info' });
    const exprIn = $('#kt-expr', el), fill = $('#kt-fill', el), msg = $('#kt-msg', el);
    const nBtns = $$('[data-kn]', el), clear = $('#kt-clear', el), rnd = $('#kt-rand', el), prac = $('#kt-practice', el);
    $('#kt-stage', el).append(mapBox, info);
    const draw = () => {
      nBtns.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.kn === n)));
      prac.setAttribute('aria-pressed', String(practice));
      prac.textContent = practice ? 'Show the answer' : 'Hide the answer';
      const { table, cells } = kmapTable(n, set, { interactive: true, onToggle: (m) => { if (set.has(m)) set.delete(m); else set.add(m); draw(); } });
      mapBox.replaceChildren(h('div', { class: 'km-wrap' }, table));
      info.replaceChildren();
      const vars = KM[n].vars, ms = [...set].sort((a, b) => a - b);
      const T = Array.from({ length: 1 << n }, (_, i) => (set.has(i) ? 1 : 0)).join('');
      info.append(h('dl', { class: 'tt-extra' },
        h('dt', {}, 'Checked squares'), h('dd', {}, `${ms.length} of ${1 << n}`),
        h('dt', {}, 'T(E)'), h('dd', { class: 'mono' }, T),
        h('dt', {}, 'Complete SoP'), h('dd', {}, math(Core.csopStr(ms, vars)))));
      if (practice) info.append(h('p', { class: 'muted' }, 'Answer hidden. Find the prime implicants and a minimal sum on paper, then press “Show the answer”.'));
      else info.append(solveView(n, set, cells));
    };
    nBtns.forEach((b) => b.addEventListener('click', () => { n = +b.dataset.kn; set = new Set(); msg.textContent = ''; draw(); }));
    clear.addEventListener('click', () => { set = new Set(); msg.textContent = ''; draw(); });
    rnd.addEventListener('click', () => {
      set = new Set();
      const N = 1 << n, target = n === 3 ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 5);
      while (set.size < target) set.add(Math.floor(Math.random() * N));
      practice = true; msg.textContent = 'New random map. The answer is hidden until you ask for it.';
      draw();
    });
    prac.addEventListener('click', () => { practice = !practice; draw(); });
    const doFill = () => {
      const txt = exprIn.value;
      if (!txt.trim()) { msg.textContent = 'Type an expression first.'; return; }
      try {
        const tree = Core.parse(txt);
        const used = [...Core.varsOf(tree)];
        const bad = used.filter((v) => !KM[4].vars.includes(v));
        if (bad.length) { msg.textContent = `Use the variables x, y, z, t (found ${bad.join(', ')}).`; return; }
        n = used.includes('t') ? 4 : (n === 4 ? 4 : 3);
        set = new Set(Core.minterms(tree, KM[n].vars));
        msg.textContent = `Filled the ${n}-variable map from E = ${Core.show(tree)}.`;
        draw();
      } catch (e) { msg.textContent = e.message; }
    };
    fill.addEventListener('click', doFill);
    exprIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doFill(); } });
    draw();
  }

  // ------------------------------------------------------------ Venn tool
  function buildVennTool(el) {
    const input = $('#vt-in', el), canvas = $('canvas', el), out = $('#vt-out', el);
    const run = () => {
      const txt = input.value.trim();
      if (!txt) { out.textContent = 'Type a set expression in A, B and C.'; return; }
      let tree;
      try { tree = Core.parse(txt.replace(/U/g, '1')); } catch (e) { out.replaceChildren(h('span', { class: 'fb error' }, e.message)); return; }
      const bad = [...Core.varsOf(tree)].filter((v) => !'ABC'.includes(v));
      if (bad.length) { out.replaceChildren(h('span', { class: 'fb error' }, `Use only the sets A, B, C and U (found ${bad.join(', ')}).`)); return; }
      canvas.dataset.expr = txt;
      drawVenn(canvas);
      const vars = ['A', 'B', 'C'], ms = Core.minterms(tree, vars);
      const region = (m) => vars.map((v, k) => (((m >> (2 - k)) & 1) ? v : v + '′')).join(' ∩ ');
      const res = Core.minimalSums(ms, 3);
      out.replaceChildren(
        h('p', {}, h('strong', {}, `${ms.length} of 8 regions shaded. `), ms.length ? 'Regions (fundamental products): ' : '', ...ms.slice().reverse().map((m, i) => [i ? ', ' : '', math(region(m))])),
        h('p', {}, 'Minimal Boolean form: ', math(Core.sumStr(res.sums[0], vars)), h('span', { class: 'muted' }, ' (product = ∩, + = ∪, ′ = complement)')));
    };
    input.addEventListener('input', run);
    $$('.sym-pad button', el).forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => insertAt(input, b.dataset.sym || b.textContent));
    });
    run();
  }

  // ------------------------------------------------------------ "open in tool" links
  function wireLoaders() {
    $$('[data-tt]').forEach((b) => b.addEventListener('click', () => {
      const tool = $('#tt-tool');
      if (!tool || !tool.ttLoad) return;
      tool.ttLoad(b.dataset.tt, b.dataset.tt2 || '');
      tool.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  // ------------------------------------------------------------ laws table notation switch (narrow screens)
  function wireLaws() {
    $$('.law-switch').forEach((sw) => {
      const table = document.getElementById(sw.dataset.for);
      $$('button', sw).forEach((b) => b.addEventListener('click', () => {
        table.dataset.show = b.dataset.show;
        $$('button', sw).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      }));
    });
  }

  // ------------------------------------------------------------ contents: current section
  function wireToc() {
    const links = $$('.toc a[href^="#"]');
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const targets = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !targets.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((a) => a.removeAttribute('aria-current'));
          map.get(en.target.id)?.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    targets.forEach((t) => obs.observe(t));
  }

  // ------------------------------------------------------------ boot
  function boot() {
    $$('.gate-icon-slot').forEach((el) => el.append(gateIcon(el.dataset.gate)));
    $$('.timing').forEach(buildTiming);
    $$('.kmap').forEach((el) => { try { buildKmap(el); } catch (e) { console.error('kmap', el, e); } });
    $$('.circuit').forEach((el) => { try { buildCircuit(el); } catch (e) { console.error('circuit', el, e); } });
    $$('.check').forEach((el) => { try { buildCheck(el); } catch (e) { console.error('check', el, e); } });
    $$('.prim').forEach((el) => { try { buildPrim(el); } catch (e) { console.error('prim', el, e); } });
    $$('.tf > li').forEach(buildTF);
    $$('.mcq').forEach(buildMCQ);
    $$('main .prob').forEach(buildProb);
    const gc = $('#gate-calc'); if (gc) buildGateCalc(gc);
    const tt = $('#tt-tool'); if (tt) buildTT(tt);
    const kt = $('#kmap-tool'); if (kt) buildKTool(kt);
    const vt = $('#venn-tool'); if (vt) buildVennTool(vt);
    typeset(document);
    updateCounts();
    wireLoaders();
    wireLaws();
    wireToc();
    redrawVenns();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', redrawVenns);
    new MutationObserver(redrawVenns).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawVenns, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawVenns);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
