// Choix de la langue : ?lang=ar|fr, sinon dernier choix, sinon langue du navigateur.
(function () {
  var q = new URLSearchParams(location.search).get('lang');
  var saved = null;
  try { saved = localStorage.getItem('qima-lang'); } catch (e) {}
  var lang = q === 'ar' || q === 'fr' ? q : saved || ((navigator.language || 'fr').slice(0, 2) === 'ar' ? 'ar' : 'fr');
  function apply(l) {
    document.documentElement.setAttribute('data-lang', l);
    document.documentElement.setAttribute('lang', l);
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('qima-lang', l); } catch (e) {}
  }
  apply(lang);
  window.qimaToggleLang = function () { apply(document.documentElement.getAttribute('data-lang') === 'ar' ? 'fr' : 'ar'); };
})();
