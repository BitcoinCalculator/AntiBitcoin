// ─── State ───────────────────────────────────────────────────────────────────
let objections = [];
let visited = new Set(JSON.parse(localStorage.getItem('btc_visited') || '[]'));
let activeFilter = 'all';
let showingAll = false;
let currentId = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const res = await fetch('objections.json');
    objections = await res.json();
  } catch (e) {
    // Fallback: try relative path for local file:// usage
    console.warn('Could not fetch objections.json:', e);
    return;
  }

  updateProgress();
  bindEvents();
  handleRoute();
}

// ─── Routing (hash-based) ─────────────────────────────────────────────────────
function handleRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && objections.find(o => o.id === hash)) {
    showObjection(hash);
  } else {
    showHome();
  }
}

window.addEventListener('hashchange', handleRoute);

// ─── Views ────────────────────────────────────────────────────────────────────
function showHome(filter) {
  currentId = null;
  document.getElementById('home-view').style.display = 'block';
  document.getElementById('objection-view').style.display = 'none';
  if (filter) activeFilter = filter;
  renderFeatured();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showObjection(id) {
  const obj = objections.find(o => o.id === id);
  if (!obj) return;

  currentId = id;

  // Mark visited
  visited.add(id);
  localStorage.setItem('btc_visited', JSON.stringify([...visited]));
  updateProgress();

  // Update hash without triggering hashchange loop
  if (window.location.hash !== '#' + id) {
    history.pushState(null, '', '#' + id);
  }

  // Populate fields
  document.getElementById('obj-cat').textContent = capitalise(obj.category);
  document.getElementById('obj-title').innerHTML = '"' + obj.title + '"';
  document.getElementById('obj-subtitle').textContent = obj.subtitle || '';
  document.getElementById('obj-why').textContent = obj.whyPeopleBelieve;

  // Supporting args
  const supEl = document.getElementById('obj-supporting');
  supEl.innerHTML = obj.supportingArguments.map(a =>
    `<div class="arg-item">
      <div class="arg-icon for">✕</div>
      <span>${a}</span>
    </div>`
  ).join('');

  // Counter args
  const ctrEl = document.getElementById('obj-counter');
  ctrEl.innerHTML = obj.counterArguments.map(a =>
    `<div class="arg-item counter">
      <div class="arg-icon against">✓</div>
      <span>${a}</span>
    </div>`
  ).join('');

  document.getElementById('obj-takeaway').textContent = obj.keyTakeaway;

  // Next cards
  renderNextCards(obj);

  // Switch views
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('objection-view').style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'instant' });

  // Animate sections
  document.querySelectorAll('#objection-view .content-section, #objection-view .next-section').forEach((el, i) => {
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = `fadeIn 0.3s ease ${i * 0.07}s both`;
  });
}

// ─── Render: Featured (4 random) ─────────────────────────────────────────────
function renderFeatured() {
  const pool = filteredPool();
  const cards = pickRandom(pool, 4);

  const label = document.getElementById('featured-label');
  const container = document.getElementById('featured-cards');

  if (cards.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No results</h3><p>Try a different search or filter.</p></div>`;
    label.textContent = 'No matches found';
    return;
  }

  label.textContent = activeFilter === 'all' && !document.getElementById('search-input').value
    ? 'Start with one of these →'
    : `${pool.length} result${pool.length !== 1 ? 's' : ''} found`;

  container.innerHTML = cards.map(obj => cardHTML(obj)).join('');
  bindCardClicks(container);
}

// ─── Render: All objections ───────────────────────────────────────────────────
function renderAll() {
  const pool = filteredPool();
  const container = document.getElementById('all-cards');
  container.innerHTML = pool.map(obj => cardHTML(obj)).join('');
  bindCardClicks(container);
  updateAllLabel(pool.length);
}

function updateAllLabel(count) {
  document.getElementById('all-label').textContent =
    `All ${count} Objection${count !== 1 ? 's' : ''}`;
}

// ─── Render: Next cards (after reading an objection) ─────────────────────────
function renderNextCards(obj) {
  const container = document.getElementById('next-cards');

  // Start with related, fill up to 4 with random others
  let related = (obj.related || [])
    .map(id => objections.find(o => o.id === id))
    .filter(Boolean);

  const others = objections.filter(o => o.id !== obj.id && !obj.related?.includes(o.id));
  const fill = pickRandom(others, Math.max(0, 4 - related.length));
  const cards = [...related.slice(0, 4), ...fill].slice(0, 4);

  container.innerHTML = cards.map(o => cardHTML(o)).join('');
  bindCardClicks(container);
}

// ─── Card HTML ────────────────────────────────────────────────────────────────
function cardHTML(obj) {
  const isVisited = visited.has(obj.id);
  return `
    <div class="obj-card ${isVisited ? 'visited' : ''}" data-id="${obj.id}">
      <div class="card-cat">${capitalise(obj.category)}</div>
      <div class="card-title">"${obj.title}"</div>
      <div class="card-subtitle">${obj.subtitle || ''}</div>
      <div class="card-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </div>
    </div>
  `;
}

function bindCardClicks(container) {
  container.querySelectorAll('.obj-card').forEach(card => {
    card.addEventListener('click', () => showObjection(card.dataset.id));
  });
}

// ─── Filtering ────────────────────────────────────────────────────────────────
function filteredPool() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  return objections.filter(o => {
    const catMatch = activeFilter === 'all' || o.category === activeFilter;
    const searchMatch = !query ||
      o.title.toLowerCase().includes(query) ||
      o.subtitle?.toLowerCase().includes(query) ||
      o.category.toLowerCase().includes(query) ||
      o.keyTakeaway?.toLowerCase().includes(query);
    return catMatch && searchMatch;
  });
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function updateProgress() {
  document.getElementById('progress-count').textContent = visited.size;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Nav home
  document.getElementById('nav-home-btn').addEventListener('click', () => {
    history.pushState(null, '', '#');
    showHome();
  });

  document.getElementById('footer-home').addEventListener('click', (e) => {
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

  // Surprise me
  document.getElementById('btn-random').addEventListener('click', () => {
    const pick = pickRandom(objections, 1)[0];
    if (pick) showObjection(pick.id);
  });

  // Search
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderFeatured();
      if (showingAll) renderAll();
    }, 200);
  });

  // Category filter pills
  document.getElementById('filter-pills').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.cat;
    renderFeatured();
    if (showingAll) renderAll();
  });

  // Toggle show all
  const toggleBtn = document.getElementById('toggle-all-btn');
  const allSection = document.getElementById('all-section');
  toggleBtn.addEventListener('click', () => {
    showingAll = !showingAll;
    allSection.style.display = showingAll ? 'block' : 'none';
    toggleBtn.textContent = showingAll ? 'Show fewer ↑' : 'Show all objections ↓';
    if (showingAll) {
      renderAll();
      allSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Share button
  document.getElementById('share-btn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy link';
        btn.classList.remove('copied');
      }, 2000);
    });
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
boot();
