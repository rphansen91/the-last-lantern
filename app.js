/* Night Arcade — catalog-driven library UI. Zero deps. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const grid = $('#grid');
  const sheet = $('#sheet');
  const backdrop = $('#backdrop');
  const mast = $('#mast');
  let catalog = null;
  let active = null;

  function statusLabel(s) {
    return s === 'playable' ? 'Playable' : 'Prototype';
  }

  function renderMast(arcade) {
    mast.innerHTML = '';
    const ey = document.createElement('div'); ey.className = 'eyebrow'; ey.textContent = 'Library';
    const h1 = document.createElement('h1'); h1.textContent = arcade.name || 'Night Arcade';
    const p = document.createElement('p'); p.className = 'tagline'; p.textContent = arcade.tagline || '';
    if (arcade.accent) document.documentElement.style.setProperty('--accent', arcade.accent);
    mast.append(ey, h1, p);
  }

  function cardFor(game) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card';
    btn.setAttribute('aria-label', game.title + ' — open details');
    const cover = document.createElement('div');
    cover.className = 'cover';
    if (game.cover) cover.style.backgroundImage = `url("${game.cover}")`;
    const st = document.createElement('span');
    st.className = 'status' + (game.status === 'playable' ? '' : ' prototype');
    st.textContent = statusLabel(game.status);
    cover.appendChild(st);
    const body = document.createElement('div'); body.className = 'body';
    const h2 = document.createElement('h2'); h2.textContent = game.title;
    const blurb = document.createElement('p'); blurb.className = 'blurb'; blurb.textContent = game.blurb || '';
    const tags = document.createElement('div'); tags.className = 'tags';
    (game.tags || []).forEach(t => {
      const span = document.createElement('span'); span.className = 'tag'; span.textContent = t;
      tags.appendChild(span);
    });
    body.append(h2, blurb, tags);
    btn.append(cover, body);
    btn.addEventListener('click', () => openSheet(game));
    return btn;
  }

  function renderComingSoon() {
    const el = document.createElement('div');
    el.className = 'empty';
    el.innerHTML = '<strong>More games soon</strong>Drop a folder under <code>games/&lt;slug&gt;/</code> and add an entry to <code>catalog.json</code>.';
    return el;
  }

  function renderGrid(games) {
    grid.innerHTML = '';
    if (!games || !games.length) {
      grid.appendChild(renderComingSoon());
      return;
    }
    games.forEach(g => grid.appendChild(cardFor(g)));
    if (games.length < 2) grid.appendChild(renderComingSoon());
  }

  function openSheet(game) {
    active = game;
    const accent = game.accent || '#6ec8ff';
    sheet.innerHTML = '';
    const handle = document.createElement('div'); handle.className = 'handle'; handle.setAttribute('aria-hidden', 'true');
    const hero = document.createElement('div'); hero.className = 'hero';
    if (game.cover) hero.style.backgroundImage = `url("${game.cover}")`;
    const meta = document.createElement('div'); meta.className = 'meta';
    const h2 = document.createElement('h2'); h2.textContent = game.title;
    const row = document.createElement('div'); row.className = 'status-row';
    const pill = document.createElement('span');
    pill.className = 'pill' + (game.status === 'playable' ? '' : ' prototype');
    pill.textContent = statusLabel(game.status);
    row.appendChild(pill);
    (game.tags || []).forEach(t => {
      const span = document.createElement('span'); span.className = 'tag'; span.textContent = t;
      row.appendChild(span);
    });
    const desc = document.createElement('p'); desc.className = 'desc'; desc.textContent = game.description || game.blurb || '';
    meta.append(h2, row, desc);
    if (game.how) {
      const lab = document.createElement('div'); lab.className = 'how-label'; lab.textContent = 'How it plays';
      const how = document.createElement('p'); how.className = 'how'; how.textContent = game.how;
      meta.append(lab, how);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    const closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'btn'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeSheet);
    const play = document.createElement('a');
    play.className = 'btn primary';
    play.textContent = game.status === 'playable' ? 'Play' : 'Preview';
    const path = (game.path || '').replace(/\/?$/, '/');
    play.href = path + '?from=arcade';
    if (game.status !== 'playable' && game.status !== 'prototype') play.setAttribute('aria-disabled', 'true');
    actions.append(closeBtn, play);
    sheet.append(handle, hero, meta, actions);
    document.documentElement.style.setProperty('--accent', accent);
    sheet.classList.add('open');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeSheet() {
    active = null;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    sheet.setAttribute('aria-hidden', 'true');
    if (catalog && catalog.arcade && catalog.arcade.accent) {
      document.documentElement.style.setProperty('--accent', catalog.arcade.accent);
    }
  }

  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
  });

  fetch('./catalog.json', { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    })
    .then(data => {
      catalog = data;
      renderMast(data.arcade || { name: 'Night Arcade', tagline: 'Small games for dark hours.' });
      renderGrid(data.games || []);
      document.title = (data.arcade && data.arcade.name ? data.arcade.name : 'Night Arcade') + ' — Library';
    })
    .catch(err => {
      grid.innerHTML = '';
      const e = document.createElement('div');
      e.className = 'err';
      e.textContent = 'Could not load catalog.json (' + err.message + '). Serve the folder over http(s).';
      grid.appendChild(e);
      renderMast({ name: 'Night Arcade', tagline: 'Small games for dark hours.' });
    });

  if (/^https?:$/.test(location.protocol)) {
    const ml = document.createElement('link');
    ml.rel = 'manifest';
    ml.href = 'manifest.webmanifest';
    document.head.appendChild(ml);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(
          r => { window.__sw = 'registered:' + r.scope; },
          e => { window.__sw = 'failed:' + e.message; }
        );
      });
    }
  }
})();
