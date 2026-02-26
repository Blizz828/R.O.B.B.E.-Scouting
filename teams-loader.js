// teams-loader.js
// Attempt to fetch teams.json from common candidate locations and expose
// the data as window.__TEAMS__ for other modules to consume.
(async function(){
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (Array.isArray(window.__TEAMS__)) return; // already provided

  const attempted = new Set();
  function add(u){ try{ if(u) attempted.add(new URL(u, location.href).href); }catch(e){ if(u) attempted.add(u);} }

  // Candidates: path relative to script, document, walking up, common relative paths
  if (document.currentScript && document.currentScript.src) {
    try { add(new URL('teams.json', new URL('.', document.currentScript.src).href).href); } catch(e){}
  }

  try {
    add(new URL('teams.json', location.href).href);
    let up = '';
    for (let i=0;i<6;i++){ up += '../'; add(new URL(up+'teams.json', location.href).href); }
    add(location.origin + '/teams.json');
  } catch(e) {}

  add('./teams.json');
  add('/teams.json');

  for (const url of attempted) {
    try {
      const res = await fetch(url, {cache: 'no-store'});
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json)) {
        window.__TEAMS__ = json;
        window.__TEAMS_LOADED_FROM__ = url;
        return;
      }
    } catch (e) {
      // ignore and try next
    }
  }
})();
