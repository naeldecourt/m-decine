/* Thème (clair / sombre / pastel) + année du pied de page.
   Le choix est conservé d'une session à l'autre dans localStorage. */
(function () {
  var KEY = 'edn-revision:theme';
  var THEMES = ['clair', 'sombre', 'pastel'];

  function read() {
    try {
      var t = localStorage.getItem(KEY);
      return THEMES.indexOf(t) !== -1 ? t : null;
    } catch (e) { return null; }
  }

  function preferred() {
    if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) return 'sombre';
    return 'clair';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var buttons = document.querySelectorAll('.theme-switch button[data-theme]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.theme === theme));
    }
  }

  // Appliqué immédiatement (le script est chargé dans <head>) pour éviter le flash.
  apply(read() || preferred());

  document.addEventListener('DOMContentLoaded', function () {
    apply(read() || preferred());

    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.theme-switch button[data-theme]');
      if (!btn) return;
      var theme = btn.dataset.theme;
      try { localStorage.setItem(KEY, theme); } catch (e) { /* mode privé */ }
      apply(theme);
    });

    // Onglet de navigation courant
    var here = location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.site-nav a');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].getAttribute('href') || '').split('/').pop() === here) {
        links[i].setAttribute('aria-current', 'page');
      }
    }

    var y = document.getElementById('year');
    if (y) y.textContent = String(new Date().getFullYear());
  });
})();
