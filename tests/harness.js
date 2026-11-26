// Test-only: submit every answer key into its own box and report what the page says.
window.__errors = window.__errors || [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
setTimeout(() => {
  const out = { fail: [], ok: 0 };
  document.querySelectorAll('.check').forEach((box) => {
    const input = box.querySelector('input');
    const form = box.querySelector('form');
    const fb = box.querySelector('.fb');
    if (!input || !form) { out.fail.push('not built: ' + (box.dataset.label || '?')); return; }
    input.value = box.dataset.kind === 'set' && box.dataset.answer === '' ? '∅' : box.dataset.answer;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    if (fb.classList.contains('ok')) out.ok++;
    else out.fail.push(`${box.closest('[id]')?.id} ${box.dataset.label}: ${fb.className} ${fb.textContent}`);
    // wrong answer must not pass
    if (box.dataset.kind === 'bool') {
      input.value = box.dataset.vars[0] + "'";
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      if (fb.classList.contains('ok') && box.dataset.answer.replace(/\s/g, '') !== box.dataset.vars[0] + "'") out.fail.push('wrong answer accepted at ' + box.dataset.label);
      input.value = '';
      fb.className = 'fb';
      fb.textContent = '';
    } else { input.value = ''; fb.className = 'fb'; fb.textContent = ''; }
  });
  // the ∅ button on a set box must produce an accepted empty-set answer
  const emptyBox = [...document.querySelectorAll('.check[data-kind="set"]')].find((b) => b.dataset.answer === '');
  if (emptyBox) {
    emptyBox.querySelector('.ins-key').click();
    emptyBox.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    out.emptyButton = emptyBox.querySelector('.fb').className + ' EMPTYBTN';
  }
  // proof puzzles: a wrong order must be rejected, the key order accepted
  out.orderOk = 0; out.orderFail = [];
  document.querySelectorAll('.order').forEach((el) => {
    const id = el.closest('[id]').id;
    const n = el.querySelectorAll('.order-key li').length;
    const place = (seq) => seq.forEach((i) => el.querySelector(`.order-pool .order-step[data-i="${i}"]`).click());
    const btn = (txt) => [...el.querySelectorAll('button')].find((b) => b.textContent === txt);
    const fb = el.querySelector('.fb');
    place([...Array(n).keys()].reverse()); btn('Check').click();
    if (!fb.classList.contains('wrong')) out.orderFail.push(id + ' reversed order not rejected');
    btn('Start again').click();
    place([...Array(n).keys()]); btn('Check').click();
    if (fb.classList.contains('ok')) out.orderOk++; else out.orderFail.push(id + ': ' + fb.textContent);
    btn('Start again').click();
  });
  // a problem marks itself done when all its checks are right, and the button still un-marks it
  out.autoDone = [];
  const isDone = (id) => document.getElementById(id).classList.contains('is-done');
  if (!isDone('p10-2')) out.autoDone.push('p10-2 not auto-marked after its answer boxes');
  const tf = document.getElementById('p10-15'), tfItems = [...tf.querySelectorAll('.tf > li')];
  tfItems.slice(0, -1).forEach((li) => li.querySelectorAll('.tfb')[li.dataset.a === 'T' ? 0 : 1].click());
  if (isDone('p10-15')) out.autoDone.push('p10-15 marked before its last item');
  const last = tfItems[tfItems.length - 1];
  last.querySelectorAll('.tfb')[last.dataset.a === 'T' ? 1 : 0].click();
  if (isDone('p10-15')) out.autoDone.push('p10-15 marked with a wrong last item');
  last.querySelectorAll('.tfb')[last.dataset.a === 'T' ? 0 : 1].click();
  if (!isDone('p10-15')) out.autoDone.push('p10-15 not auto-marked after all items right');
  tf.querySelector('.done-btn').click();
  if (isDone('p10-15')) out.autoDone.push('manual button does not un-mark');
  const count = (sel) => document.querySelectorAll(sel).length;
  const vennPainted = [...document.querySelectorAll('canvas.venn')].filter((c) => c.width > 0).length;
  const summary = {
    checksOk: out.ok, checkFails: out.fail, emptyButton: out.emptyButton, errors: window.__errors,
    circuits: count('svg.circ'), kmaps: count('table.km'), kmSolutions: count('.km-sol'), venns: count('canvas.venn'), vennPainted,
    tfButtons: count('.tfb'), mcqOptions: count('.mcq .opt'), doneButtons: count('.done-btn'), italicLetters: count('.m i'),
    ttRows: count('#tt-out table.tt tbody tr'), ktCells: count('#kmap-tool .km-btn'), timing: count('.timing-svg'), orderOk: out.orderOk, orderFail: out.orderFail, autoDoneFails: out.autoDone,
    tocCounts: [...document.querySelectorAll('[data-count]')].map((e) => e.dataset.count + '=' + e.textContent),
  };
  console.log('HARNESS ' + JSON.stringify(summary));
  document.title = 'HARNESS-DONE';
}, 1500);
