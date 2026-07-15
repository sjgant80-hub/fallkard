/*! konomi-footer — "◊ Powered by Konomi Architecture" · public brand · no seed · MIT
 *  Sovereign shim: zero deps, self-contained, idempotent, theme-neutral.
 *  Use EITHER form (identical result):
 *    external : <script src="konomi-footer.js" defer></script>
 *    inline   : paste the IIFE below straight before </body>
 */
(function () {
  if (document.getElementById('konomi-footer')) return;            // idempotent — never double-stamp
  function stamp() {
    if (document.getElementById('konomi-footer')) return;
    var f = document.createElement('footer');
    f.id = 'konomi-footer';
    f.setAttribute('role', 'contentinfo');
    f.style.cssText =
      'text-align:center;padding:20px 12px;margin-top:40px;' +
      'font:500 12px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;' +
      'color:currentColor;opacity:.55;border-top:1px solid;border-color:currentColor;' +
      'border-image:linear-gradient(90deg,transparent,currentColor,transparent) 1';
    var a = document.createElement('a');
    a.href = 'https://ai-nativesolutions.com';
    a.rel = 'noopener';
    a.textContent = '◊ Powered by Konomi Architecture';   // ◊
    a.style.cssText = 'color:inherit;text-decoration:none;letter-spacing:.3px';
    f.appendChild(a);
    (document.body || document.documentElement).appendChild(f);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp);
  else stamp();
})();
