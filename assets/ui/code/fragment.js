// code: still until the pointer is on it. At rest the line marked is-mark is highlighted with the note
// as written in the markup. Every line with code answers the pointer: on it, that line takes the
// highlight, and when it carries data-note="..." (or opts.steps [{line, text}]) the note names its
// change, else the note is hidden; off the fragment, the first again. So the note never shows words the page did not write. The chip is left
// as written.

export default function init(root, opts = {}) {
  const lines = [...root.querySelectorAll('.ui-code__ln')];
  const hint = root.querySelector('[data-code-hint]'), text = root.querySelector('[data-code-text]');
  if (!lines.length || !hint || !text) return null;
  const first = lines.find(l => l.classList.contains('is-mark')) || lines.find(l => l.dataset.note) || lines[0];
  const steps = opts.steps || [
    { line: +first.dataset.n, text: text.textContent },
    ...lines.filter(l => l !== first && l.dataset.note).map(l => ({ line: +l.dataset.n, text: l.dataset.note })),
  ];
  // a line without a note is highlighted with the note hidden, so no words are put in its mouth
  const show = s => {
    lines.forEach(l => l.classList.toggle('is-mark', +l.dataset.n === s.line));
    if (s.text && text.textContent !== s.text) text.textContent = s.text;
    hint.classList.toggle('is-hidden', !s.text);
  };
  const rest = () => show(steps[0]);
  rest();
  for (const l of lines) {
    if (!l.textContent.trim()) continue;              // blank lines have nothing to point at
    const s = steps.find(x => x.line === +l.dataset.n);
    if (s) l.classList.add('has-note');
    l.addEventListener('pointerenter', () => show(s || { line: +l.dataset.n, text: '' }));
  }
  root.addEventListener('pointerleave', rest);
  return null;
}
