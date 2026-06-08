// ─── State ────────────────────────────────────────────────────────────────────
let objections = [];
let visited = new Set(JSON.parse(localStorage.getItem('btc_visited') || '[]'));
let activeFilter = 'all';
let featuredIds = [];   // current 4 shown on homepage
let currentId = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const res = await fetch('objections.json');
    objections = await res.json();
  } catch (e) {
    console.warn('Could not load objections.json:', e);
    return;
  }
  updateProgress();
  bindEvents();
  handleRoute();
}

// ─── Routing ──────────────────────────────────────────────────────────────────
function handleRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && objections.find(o => o.id === hash)) {
    showObjection(hash);
  } else {
    showHome();
  }
}
window.addEventListener('hashchange', handleRoute);
window.addEventListener('popstate', handleRoute);

// ─── Views ────────────────────────────────────────────────────────────────────
function showHome() {
  currentId = null;
  document.getElementById('home-view').style.display = 'block';
  document.getElementById('objection-view').style.display = 'none';
  renderFeatured();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showObjection(id) {
  const obj = objections.find(o => o.id === id);
  if (!obj) return;
  currentId = id;

  // Track visit
  visited.add(id);
  localStorage.setItem('btc_visited', JSON.stringify([...visited]));
  updateProgress();

  // Update hash
  if (window.location.hash !== '#' + id) {
    history.pushState(null, '', '#' + id);
  }

  // ── Populate header ──
  document.getElementById('obj-cat').textContent = capitalise(obj.category);
  document.getElementById('obj-title').innerHTML = '"' + escHtml(obj.title) + '"';
  document.getElementById('obj-opening').textContent = obj.openingLine || '';

  // ── Stats ──
  const statsEl = document.getElementById('obj-stats');
  statsEl.innerHTML = (obj.stats || []).map(s => `
    <div class="stat-box">
      <div class="stat-value">${escHtml(s.value)}</div>
      <div class="stat-label">${escHtml(s.label)}</div>
      <div class="stat-note">${escHtml(s.note || '')}</div>
    </div>`).join('');

  // ── Why ──
  document.getElementById('obj-why').textContent = obj.whyPeopleBelieve || '';

  // ── Supporting args ──
  document.getElementById('obj-supporting').innerHTML =
    (obj.supportingArguments || []).map(a => `
      <div class="arg-item for">
        <div class="arg-icon for">✕</div>
        <span>${escHtml(a)}</span>
      </div>`).join('');

  // ── Counter args ──
  document.getElementById('obj-counter').innerHTML =
    (obj.counterArguments || []).map(a => `
      <div class="arg-item against">
        <div class="arg-icon against">✓</div>
        <span>${escHtml(a)}</span>
      </div>`).join('');

  // ── Quote ──
  const quoteWrap = document.getElementById('obj-quote-wrap');
  if (obj.quote) {
    quoteWrap.innerHTML = `
      <div class="quote-block">
        <p>${escHtml(obj.quote.text)}</p>
        <div class="quote-author">— ${escHtml(obj.quote.author)}</div>
      </div>`;
  } else {
    quoteWrap.innerHTML = '';
  }

  // ── Takeaway ──
  document.getElementById('obj-takeaway').textContent = obj.keyTakeaway || '';

  // ── Next cards ──
  renderNextCards(obj);

  // ── Switch views ──
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('objection-view').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Stagger fade-in
  document.querySelectorAll('#objection-view .fade-in').forEach((el, i) => {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = `fadeIn 0.3s ease ${i * 0.06}s both`;
  });
}

// ─── Featured (4 big cards on homepage) ──────────────────────────────────────
function renderFeatured(forceNew) {
  if (forceNew || featuredIds.length === 0) {
    featuredIds = pickRandom(objections, 4).map(o => o.id);
  }
  const cards = featuredIds.map(id => objections.find(o => o.id === id)).filter(Boolean);
  const container = document.getElementById('featured-grid');
  container.innerHTML = cards.map(obj => featCardHTML(obj)).join('');
  bindCardClicks(container);
}

function featCardHTML(obj) {
  const vis = visited.has(obj.id);
  return `
    <div class="feat-card ${vis ? 'visited' : ''}" data-id="${obj.id}">
      <div class="feat-card-top">
        <div class="feat-cat">${capitalise(obj.category)}</div>
        <div class="feat-title">${escHtml(obj.title)}</div>
        <div class="feat-subtitle">${escHtml(obj.subtitle || '')}</div>
      </div>
      <div class="feat-bottom">
        <span class="feat-cta">Read the rebuttal →</span>
        <div class="feat-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    </div>`;
}

// ─── All cards grid ───────────────────────────────────────────────────────────
function renderAll() {
  const pool = filteredPool();
  const container = document.getElementById('all-grid');
  if (pool.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No objections match your search.</div>`;
    return;
  }
  container.innerHTML = pool.map(obj => miniCardHTML(obj)).join('');
  bindCardClicks(container);
}

function miniCardHTML(obj) {
  const vis = visited.has(obj.id);
  return `
    <div class="mini-card ${vis ? 'visited' : ''}" data-id="${obj.id}">
      <div class="mini-cat">${capitalise(obj.category)}</div>
      <div class="mini-title">${escHtml(obj.title)}</div>
    </div>`;
}

// ─── Next cards (after reading) ───────────────────────────────────────────────
function renderNextCards(obj) {
  const related = (obj.related || [])
    .map(id => objections.find(o => o.id === id)).filter(Boolean).slice(0, 4);
  const extras = pickRandom(
    objections.filter(o => o.id !== obj.id && !(obj.related || []).includes(o.id)),
    Math.max(0, 4 - related.length)
  );
  const cards = [...related, ...extras].slice(0, 4);
  const container = document.getElementById('next-grid');
  container.innerHTML = cards.map(o => featCardHTML(o)).join('');
  bindCardClicks(container);
}

// ─── Filter pool ──────────────────────────────────────────────────────────────
function filteredPool() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  return objections.filter(o => {
    const catOk = activeFilter === 'all' || o.category === activeFilter;
    const searchOk = !q ||
      o.title.toLowerCase().includes(q) ||
      (o.subtitle || '').toLowerCase().includes(q) ||
      o.category.toLowerCase().includes(q) ||
      (o.keyTakeaway || '').toLowerCase().includes(q);
    return catOk && searchOk;
  });
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function updateProgress() {
  document.getElementById('progress-count').textContent = visited.size;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function bindCardClicks(container) {
  container.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => showObjection(el.dataset.id));
  });
}

// ─── Event bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Nav logo → home
  document.getElementById('nav-home-btn').addEventListener('click', () => {
    history.pushState(null, '', '#');
    showHome();
  });

  // Footer home
  document.getElementById('footer-home').addEventListener('click', e => {
    e.preventDefault();
    history.pushState(null, '', '#');
    showHome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    history.pushState(null, '', '#');
    showHome();
  });

  // Surprise Me (nav)
  document.getElementById('btn-surprise').addEventListener('click', () => {
    const pick = pickRandom(objections, 1)[0];
    if (pick) showObjection(pick.id);
  });

  // Shuffle featured
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    renderFeatured(true);
  });

  // Search
  let t;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => renderAll(), 180);
  });

  // Category pills
  document.getElementById('filter-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.cat;
    renderAll();
  });

  // Share button
  document.getElementById('share-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = document.getElementById('share-btn');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    });
  });
}

// ─── Go ───────────────────────────────────────────────────────────────────────
boot();
