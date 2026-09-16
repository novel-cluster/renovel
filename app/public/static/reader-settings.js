// Reader Settings island (frontend.md §4.1). Progressive enhancement: the page
// is fully readable without JS; this applies font size / theme / writing-mode
// from localStorage and wires the controls. No framework — keeps the reader
// page free of heavy client JS (PRD §55).
(function () {
  var KEY = 'renovel.reader'
  var def = { fs: 1.05, theme: 'light', vertical: false }
  function load() {
    try {
      return Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}'))
    } catch (e) {
      return Object.assign({}, def)
    }
  }
  var s = load()
  var root = document.documentElement
  var body = document.getElementById('reader-body')
  function apply() {
    if (body) {
      body.style.fontSize = s.fs + 'rem'
      body.classList.toggle('reader-vertical', !!s.vertical)
    }
    root.classList.remove('dark', 'sepia')
    if (s.theme === 'dark') root.classList.add('dark')
    else if (s.theme === 'sepia') root.classList.add('sepia')
    document.querySelectorAll('[data-theme]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme') === s.theme)
    })
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-action],[data-theme]') : null
    if (!t) return
    if (t.dataset.theme) s.theme = t.dataset.theme
    else if (t.dataset.action === 'fs-inc') s.fs = Math.min(1.8, +(s.fs + 0.1).toFixed(2))
    else if (t.dataset.action === 'fs-dec') s.fs = Math.max(0.8, +(s.fs - 0.1).toFixed(2))
    else if (t.dataset.action === 'vertical') s.vertical = !s.vertical
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch (err) {
      console.error(err)
    }
    apply()
  })
  apply()
})()
