/* ===========================
   PASS NOTE — app.js
   =========================== */

'use strict';

// ─── Categories ───────────────────────────────────
const CATEGORIES = [
  { key: 'Finance',  icon: '💳', desc: 'Bank, Card, Payment' },
  { key: 'Website',  icon: '🌐', desc: 'Web services, Portals' },
  { key: 'Shopping', icon: '🛒', desc: 'Online store, Commerce' },
  { key: 'Game',     icon: '🎮', desc: 'Games, Platforms' },
  { key: 'Coding',   icon: '💻', desc: 'GitHub, Dev tools' },
  { key: 'Social',   icon: '💬', desc: 'SNS, Messaging' },
  { key: 'Other',    icon: '📁', desc: 'Everything else' },
];

const CAT_META = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

// ─── State ────────────────────────────────────────
let passwords = JSON.parse(localStorage.getItem('passnote_v2') || '[]');
let editingId = null;
let currentFilter = 'All';
let searchQuery = '';
let modalPwVisible = false;
let formPwVisible = false;
let currentModalId = null;
let pendingCategory = null;   // category chosen in picker, waiting for form

// ─── DOM refs ─────────────────────────────────────
const formPanel      = document.getElementById('formPanel');
const formTitle      = document.getElementById('formTitle');
const formCatLabel   = document.getElementById('formCatLabel');
const formPanelIcon  = document.getElementById('formPanelIcon');
const editIdInput    = document.getElementById('editId');
const editCatInput   = document.getElementById('editCategory');
const inputService   = document.getElementById('inputService');
const inputUrl       = document.getElementById('inputUrl');
const inputUsername  = document.getElementById('inputUsername');
const inputPassword  = document.getElementById('inputPassword');
const inputNote      = document.getElementById('inputNote');
const pwStrengthFill  = document.getElementById('pwStrengthFill');
const pwStrengthLabel = document.getElementById('pwStrengthLabel');
const btnAdd         = document.getElementById('btnAdd');
const btnCloseForm   = document.getElementById('btnCloseForm');
const btnCancel      = document.getElementById('btnCancel');
const btnSave        = document.getElementById('btnSave');
const btnTogglePw    = document.getElementById('btnTogglePw');
const btnExport      = document.getElementById('btnExport');
const pwList         = document.getElementById('pwList');
const emptyState     = document.getElementById('emptyState');
const emptyAddBtn    = document.getElementById('emptyAddBtn');
const filterTabs     = document.getElementById('filterTabs');
const statTotal      = document.getElementById('statTotal');
const statCategory   = document.getElementById('statCategory');
const statCategoryLabel = document.getElementById('statCategoryLabel');
const statWeakNum    = document.getElementById('statWeakNum');
const statWeak       = document.getElementById('statWeak');
const searchInput    = document.getElementById('searchInput');
const searchClear    = document.getElementById('searchClear');
const searchCount    = document.getElementById('searchCount');

// category picker
const catPickerOverlay = document.getElementById('catPickerOverlay');
const catPickerModal   = document.getElementById('catPickerModal');
const catPickerClose   = document.getElementById('catPickerClose');
const catPickerGrid    = document.getElementById('catPickerGrid');

// detail modal
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalIcon      = document.getElementById('modalIcon');
const modalService   = document.getElementById('modalService');
const modalUrl       = document.getElementById('modalUrl');
const modalUsername  = document.getElementById('modalUsername');
const modalPassword  = document.getElementById('modalPassword');
const modalNote      = document.getElementById('modalNote');
const modalNoteField = document.getElementById('modalNoteField');
const modalCat       = document.getElementById('modalCat');
const modalDate      = document.getElementById('modalDate');
const modalTogglePw  = document.getElementById('modalTogglePw');
const btnModalEdit   = document.getElementById('btnModalEdit');
const btnModalDelete = document.getElementById('btnModalDelete');
const toast          = document.getElementById('toast');

// ─── Utilities ────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function save() {
  localStorage.setItem('passnote_v2', JSON.stringify(passwords));
}

function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function getIconLetters(service) {
  const s = service.trim();
  if (!s) return '?';
  const words = s.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

const ICON_COLORS = 8;
function iconColorClass(service) {
  let hash = 0;
  for (const c of service) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return `icon-color-${Math.abs(hash) % ICON_COLORS}`;
}

function catColorClass(cat) {
  return `cat-${cat.toLowerCase()}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, query) {
  if (!query) return escHtml(text);
  const escaped = escHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

// ─── Password Strength ────────────────────────────
function measureStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20,  label: 'Very Weak', color: '#ef4444' };
  if (score === 2) return { score: 40,  label: 'Weak',      color: '#f97316' };
  if (score === 3) return { score: 60,  label: 'Fair',      color: '#eab308' };
  if (score === 4) return { score: 80,  label: 'Strong',    color: '#22c55e' };
  return               { score: 100, label: 'Very Strong', color: '#16a34a' };
}

function isWeak(pw) { return measureStrength(pw).score <= 40; }

function updateStrengthUI() {
  const pw = inputPassword.value;
  const { score, label, color } = measureStrength(pw);
  pwStrengthFill.style.width = pw ? score + '%' : '0';
  pwStrengthFill.style.background = color;
  pwStrengthLabel.textContent = label;
  pwStrengthLabel.style.color = color;
}

// ─── Eye icon ─────────────────────────────────────
function updateEyeIcon(btn, visible) {
  const open   = btn.querySelector('.eye-open');
  const closed = btn.querySelector('.eye-closed');
  if (open)   open.style.display   = visible ? 'none' : '';
  if (closed) closed.style.display = visible ? ''     : 'none';
}

// ─── Filter / Search ──────────────────────────────
function getFiltered() {
  // always newest first
  let list = [...passwords].sort((a, b) => b.createdAt - a.createdAt);
  if (currentFilter !== 'All') {
    list = list.filter(p => p.category === currentFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      p.service.toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.url || '').toLowerCase().includes(q)
    );
  }
  return list;
}

// ─── Category Picker ──────────────────────────────
function buildCatPicker() {
  catPickerGrid.innerHTML = CATEGORIES.map(c => `
    <button class="cat-pick-item" data-cat="${c.key}">
      <span class="cat-pick-icon">${c.icon}</span>
      <span class="cat-pick-key">${c.key}</span>
      <span class="cat-pick-desc">${c.desc}</span>
    </button>
  `).join('');
}

function openCatPicker(callback) {
  buildCatPicker();
  catPickerOverlay.classList.add('open');
  catPickerOverlay._callback = callback;
}

function closeCatPicker() {
  catPickerOverlay.classList.remove('open');
  catPickerOverlay._callback = null;
}

catPickerGrid.addEventListener('click', e => {
  const item = e.target.closest('.cat-pick-item');
  if (!item) return;
  const cat = item.dataset.cat;
  closeCatPicker();
  if (catPickerOverlay._callback) catPickerOverlay._callback(cat);
});

catPickerClose.addEventListener('click', closeCatPicker);
catPickerOverlay.addEventListener('click', e => {
  if (e.target === catPickerOverlay) closeCatPicker();
});

// ─── Render ───────────────────────────────────────
function render() {
  const filtered = getFiltered();

  // stats
  statTotal.textContent = passwords.length;
  const weakCount = passwords.filter(p => isWeak(p.password)).length;
  statWeakNum.textContent = weakCount;
  statWeak.style.display = weakCount > 0 ? 'flex' : 'none';

  if (currentFilter !== 'All') {
    statCategory.textContent = passwords.filter(p => p.category === currentFilter).length;
    statCategoryLabel.textContent = currentFilter;
  } else {
    const cats = [...new Set(passwords.map(p => p.category))];
    statCategory.textContent = cats.length;
    statCategoryLabel.textContent = 'Categories';
  }

  if (searchQuery) {
    searchCount.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  } else {
    searchCount.textContent = '';
  }

  if (filtered.length === 0) {
    pwList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  pwList.style.display = 'flex';
  emptyState.style.display = 'none';

  pwList.innerHTML = filtered.map(p => {
    const letters   = getIconLetters(p.service);
    const colorCls  = iconColorClass(p.service);
    const catCls    = catColorClass(p.category);
    const svcHtml   = highlight(p.service, searchQuery);
    // masked password — show length-based dots
    const dots = '•'.repeat(Math.min(p.password.length, 16));

    return `
      <div class="pw-card" data-id="${p.id}" tabindex="0" role="button" aria-label="${escHtml(p.service)}">
        <div class="pw-card-icon ${colorCls}">${letters}</div>
        <div class="pw-card-body">
          <!-- Row 1: name + category badge -->
          <div class="pw-card-row1">
            <span class="pw-card-service">${svcHtml}</span>
            <span class="pw-cat-badge ${catCls}">${p.category}</span>
          </div>
          <!-- Row 2: masked password -->
          <div class="pw-card-row2">
            <span class="pw-card-dots">${dots}</span>
            <div class="pw-card-actions">
              <button class="btn-card-action" data-action="copy" data-id="${p.id}" title="Copy password">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn-card-action" data-action="edit" data-id="${p.id}" title="Edit">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn-card-action danger" data-action="delete" data-id="${p.id}" title="Delete">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Form ─────────────────────────────────────────
function applyFormCategory(cat) {
  editCatInput.value = cat;
  const meta = CAT_META[cat] || { icon: '📁', key: cat };
  formCatLabel.textContent = `${meta.icon} ${meta.key}`;
  formCatLabel.style.display = '';
  // tint panel icon
  formPanelIcon.setAttribute('data-cat', cat);
}

function openForm(id = null, cat = null) {
  editingId = id;
  formPwVisible = false;
  inputPassword.type = 'password';
  updateEyeIcon(btnTogglePw, false);

  if (id) {
    const p = passwords.find(x => x.id === id);
    if (!p) return;
    formTitle.textContent   = 'Edit Entry';
    editIdInput.value       = id;
    inputService.value      = p.service;
    inputUrl.value          = p.url || '';
    inputUsername.value     = p.username || '';
    inputPassword.value     = p.password;
    inputNote.value         = p.note || '';
    applyFormCategory(p.category);
  } else {
    formTitle.textContent   = 'New Entry';
    editIdInput.value       = '';
    inputService.value      = '';
    inputUrl.value          = '';
    inputUsername.value     = '';
    inputPassword.value     = '';
    inputNote.value         = '';
    applyFormCategory(cat || 'Other');
  }

  updateStrengthUI();
  formPanel.classList.add('open');
  setTimeout(() => inputService.focus(), 60);
}

function closeForm() {
  formPanel.classList.remove('open');
  editingId = null;
}

function saveEntry() {
  const service  = inputService.value.trim();
  const password = inputPassword.value;
  const category = editCatInput.value || 'Other';

  if (!service)  { inputService.focus();  showToast('Name is required.'); return; }
  if (!password) { inputPassword.focus(); showToast('Password is required.'); return; }

  if (editingId) {
    const idx = passwords.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      passwords[idx] = {
        ...passwords[idx],
        service,
        url: inputUrl.value.trim(),
        username: inputUsername.value.trim(),
        password,
        note: inputNote.value.trim(),
        category,
        updatedAt: Date.now(),
      };
      showToast('Updated ✓');
    }
  } else {
    passwords.unshift({
      id: uid(),
      service,
      url: inputUrl.value.trim(),
      username: inputUsername.value.trim(),
      password,
      note: inputNote.value.trim(),
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    showToast('Saved ✓');
  }

  save();
  render();
  closeForm();
}

// ─── Modal (detail) ───────────────────────────────
function openModal(id) {
  const p = passwords.find(x => x.id === id);
  if (!p) return;
  currentModalId = id;
  modalPwVisible = false;

  const letters  = getIconLetters(p.service);
  const colorCls = iconColorClass(p.service);
  modalIcon.textContent = letters;
  modalIcon.className   = `modal-service-icon ${colorCls}`;

  modalService.textContent  = p.service;
  modalUrl.textContent      = p.url || '—';
  modalUsername.textContent = p.username || '—';
  modalPassword.textContent = '••••••••••';
  modalPassword.style.letterSpacing = '3px';
  modalPassword.dataset.real = p.password;

  updateEyeIcon(modalTogglePw, false);

  if (p.note) {
    modalNote.textContent = p.note;
    modalNoteField.style.display = '';
  } else {
    modalNoteField.style.display = 'none';
  }

  const catCls = catColorClass(p.category);
  modalCat.textContent = p.category;
  modalCat.className   = `modal-cat-badge ${catCls}`;
  modalDate.textContent = formatDate(p.createdAt);

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  currentModalId = null;
  modalPwVisible = false;
}

// ─── Export ───────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(passwords, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `passnote_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export complete ✓');
}

// ─── Copy ─────────────────────────────────────────
async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} ✓`);
  } catch {
    showToast('Copy failed — check permissions.');
  }
}

// ─── Events ───────────────────────────────────────

// "New" button → category picker → form
function triggerNewEntry() {
  openCatPicker(cat => openForm(null, cat));
}

btnAdd.addEventListener('click', triggerNewEntry);
emptyAddBtn.addEventListener('click', triggerNewEntry);

// Close form
btnCloseForm.addEventListener('click', closeForm);
btnCancel.addEventListener('click', closeForm);

// Save
btnSave.addEventListener('click', saveEntry);
[inputService, inputUrl, inputUsername, inputPassword].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') saveEntry(); });
});

// PW toggle (form)
btnTogglePw.addEventListener('click', () => {
  formPwVisible = !formPwVisible;
  inputPassword.type = formPwVisible ? 'text' : 'password';
  updateEyeIcon(btnTogglePw, formPwVisible);
});

inputPassword.addEventListener('input', updateStrengthUI);

// Filter tabs
filterTabs.addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentFilter = tab.dataset.filter;
  render();
});

// PW list delegation
pwList.addEventListener('click', e => {
  const action = e.target.closest('[data-action]');
  if (action) {
    e.stopPropagation();
    const id = action.dataset.id;
    const p  = passwords.find(x => x.id === id);
    if (!p) return;
    if (action.dataset.action === 'copy') {
      copyText(p.password, 'Password copied');
    } else if (action.dataset.action === 'edit') {
      closeModal();
      openForm(id);
    } else if (action.dataset.action === 'delete') {
      if (confirm(`Delete "${p.service}"?`)) {
        passwords = passwords.filter(x => x.id !== id);
        save(); render();
        showToast('Deleted.');
      }
    }
    return;
  }
  const card = e.target.closest('.pw-card');
  if (card) openModal(card.dataset.id);
});

pwList.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.pw-card');
    if (card) { e.preventDefault(); openModal(card.dataset.id); }
  }
});

// Search
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  searchClear.style.display = searchQuery ? '' : 'none';
  render();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  render();
});

// Shortcuts
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === 'Escape') {
    closeCatPicker();
    closeModal();
    closeForm();
  }
});

// Detail modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

modalTogglePw.addEventListener('click', () => {
  modalPwVisible = !modalPwVisible;
  modalPassword.textContent = modalPwVisible ? modalPassword.dataset.real : '••••••••••';
  modalPassword.style.letterSpacing = modalPwVisible ? 'normal' : '3px';
  updateEyeIcon(modalTogglePw, modalPwVisible);
});

document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = passwords.find(x => x.id === currentModalId);
    if (!p) return;
    if (btn.dataset.target === 'password') copyText(p.password, 'Password copied');
    if (btn.dataset.target === 'username') copyText(p.username || '', 'ID copied');
  });
});

btnModalEdit.addEventListener('click', () => {
  const id = currentModalId;
  closeModal();
  openForm(id);
});

btnModalDelete.addEventListener('click', () => {
  const p = passwords.find(x => x.id === currentModalId);
  if (!p) return;
  if (confirm(`Delete "${p.service}"?`)) {
    passwords = passwords.filter(x => x.id !== currentModalId);
    save(); render(); closeModal();
    showToast('Deleted.');
  }
});

btnExport.addEventListener('click', exportData);

// ─── Init ─────────────────────────────────────────
render();
