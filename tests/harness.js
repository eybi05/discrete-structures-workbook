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
  const count = (sel) => document.querySelectorAll(sel).length;
  const vennPainted = [...document.querySelectorAll('canvas.venn')].filter((c) => c.width > 0).length;
  const summary = {
    checksOk: out.ok, checkFails: out.fail, emptyButton: out.emptyButton, errors: window.__errors,
    circuits: count('svg.circ'), kmaps: count('table.km'), kmSolutions: count('.km-sol'), venns: count('canvas.venn'), vennPainted,
    tfButtons: count('.tfb'), mcqOptions: count('.mcq .opt'), doneButtons: count('.done-btn'), italicLetters: count('.m i'),
    ttRows: count('#tt-out table.tt tbody tr'), ktCells: count('#kmap-tool .km-btn'), timing: count('.timing-svg'),
    tocCounts: [...document.querySelectorAll('[data-count]')].map((e) => e.dataset.count + '=' + e.textContent),
  };
  console.log('HARNESS ' + JSON.stringify(summary));
  document.title = 'HARNESS-DONE';
}, 1500);
