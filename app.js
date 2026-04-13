/* ===========================
   PASS NOTE — app.js
   =========================== */
'use strict';

// ─── Category meta ────────────────────────────────
const CAT_COLORS = {
  Finance:  '#16a34a',
  Website:  '#2563eb',
  Shopping: '#c2410c',
  Game:     '#db2777',
  Coding:   '#7c3aed',
  Social:   '#0d9488',
  Other:    '#5e6a82',
};

// ─── State ────────────────────────────────────────
let passwords     = JSON.parse(localStorage.getItem('passnote_v2') || '[]');
let editingId     = null;
let currentFilter = 'All';
let searchQuery   = '';
let currentModalId   = null;
let currentPhotoData = null;

// ─── DOM ──────────────────────────────────────────
const $ = id => document.getElementById(id);

const filterTabs     = $('filterTabs');
const pwList         = $('pwList');
const emptyState     = $('emptyState');
const emptyAddBtn    = $('emptyAddBtn');
const searchInput    = $('searchInput');
const searchClear    = $('searchClear');
const toast          = $('toast');

// form
const formOverlay   = $('formOverlay');
const formTitle     = $('formTitle');
const btnCloseForm  = $('btnCloseForm');
const btnCancel     = $('btnCancel');
const btnSave       = $('btnSave');
const editIdInput   = $('editId');
const editCatInput  = $('editCategory');
const typeChips     = $('typeChips');
const inputService  = $('inputService');
const inputPassword = $('inputPassword');
const pwStrengthFill  = $('pwStrengthFill');
const pwStrengthLabel = $('pwStrengthLabel');
const photoThumb    = $('photoThumb');
const photoInput    = $('photoInput');
const photoRemove   = $('photoRemove');

// detail
const modalOverlay   = $('modalOverlay');
const modalClose     = $('modalClose');
const modalIcon      = $('modalIcon');
const modalService   = $('modalService');
const modalUrl       = $('modalUrl');
const modalUsername  = $('modalUsername');
const modalPassword  = $('modalPassword');
const modalNote      = $('modalNote');
const detailNoteRow  = $('detailNoteRow');
const modalPhotoWrap = $('modalPhotoWrap');
const modalPhoto     = $('modalPhoto');
const btnModalEdit   = $('btnModalEdit');
const btnModalDelete = $('btnModalDelete');
const btnAdd         = $('btnAdd');
const btnExport      = $('btnExport');

// ─── Utils ────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function save() {
  localStorage.setItem('passnote_v2', JSON.stringify(passwords));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function getLetters(service) {
  const s = service.trim();
  if (!s) return '?';
  const w = s.split(/\s+/);
  return w.length >= 2
    ? (w[0][0] + w[1][0]).toUpperCase()
    : s.slice(0,2).toUpperCase();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(text, q) {
  if (!q) return escHtml(text);
  return escHtml(text).replace(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
    '<mark>$1</mark>'
  );
}

// short label for cat box (≤3 chars)
function catShort(cat) {
  const map = { Finance:'FIN', Website:'WEB', Shopping:'SHOP', Game:'GAME', Coding:'DEV', Social:'SOC', Other:'ETC' };
  return map[cat] || cat.slice(0,3).toUpperCase();
}

// ─── Strength ─────────────────────────────────────
function measureStrength(pw) {
  if (!pw) return { score:0, label:'', color:'' };
  let s = 0;
  if (pw.length>=8)  s++;
  if (pw.length>=12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s<=1) return { score:20,  label:'Very Weak',  color:'#ef4444' };
  if (s===2) return { score:40,  label:'Weak',       color:'#f97316' };
  if (s===3) return { score:60,  label:'Fair',       color:'#eab308' };
  if (s===4) return { score:80,  label:'Strong',     color:'#22c55e' };
  return             { score:100, label:'Very Strong', color:'#16a34a' };
}

function updateStrengthUI() {
  const { score, label, color } = measureStrength(inputPassword.value);
  pwStrengthFill.style.width      = inputPassword.value ? score+'%' : '0';
  pwStrengthFill.style.background = color;
  pwStrengthLabel.textContent     = label;
  pwStrengthLabel.style.color     = color;
}

// ─── Filter / Sort ────────────────────────────────
function getFiltered() {
  let list = [...passwords].sort((a,b) => b.createdAt - a.createdAt);
  if (currentFilter !== 'All')
    list = list.filter(p => p.category === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      p.service.toLowerCase().includes(q) ||
      (p.username||'').toLowerCase().includes(q)
    );
  }
  return list;
}

// ─── Render ───────────────────────────────────────
function render() {
  const filtered = getFiltered();

  if (filtered.length === 0) {
    pwList.style.display    = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  pwList.style.display    = 'flex';
  emptyState.style.display = 'none';

  pwList.innerHTML = filtered.map(p => {
    const color    = CAT_COLORS[p.category] || '#5e6a82';
    const nameHtml = highlight(p.service, searchQuery);

    // row1 icon: photo or colour dot
    const dotHtml = p.photo
      ? `<img src="${p.photo}" style="width:10px;height:10px;border-radius:2px;object-fit:cover;" alt="" />`
      : `<span class="card-color-dot" style="background:${color}"></span>`;

    return `
      <div class="pw-card" data-id="${p.id}" role="button" tabindex="0">
        <div class="card-row1">
          ${dotHtml}
          <span class="card-name">${nameHtml}</span>
          <span class="card-cat-box cat-box-${p.category}" style="background:${color}">${catShort(p.category)}</span>
        </div>
        <div class="card-row2">
          <span class="card-pw">${escHtml(p.password)}</span>
          <div class="card-copy-btns">
            <button class="btn-copy-card" data-action="copy-pw" data-id="${p.id}" aria-label="Copy password">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </button>
            <button class="btn-copy-card" data-action="copy-id" data-id="${p.id}" aria-label="Copy ID">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 12c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Photo ────────────────────────────────────────
function setPhoto(dataUrl) {
  currentPhotoData = dataUrl;
  if (dataUrl) {
    photoThumb.innerHTML = `<img src="${dataUrl}" alt="preview" />`;
    photoThumb.classList.add('has-photo');
    photoRemove.style.display = '';
  } else {
    photoThumb.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="15" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 9h3l2-3h10l2 3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      <span>Add</span>`;
    photoThumb.classList.remove('has-photo');
    photoRemove.style.display = 'none';
  }
}

photoThumb.addEventListener('click', () => photoInput.click());
photoRemove.addEventListener('click', () => setPhoto(null));

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const maxW = 800;
      const sc = img.width > maxW ? maxW / img.width : 1;
      const cv = document.createElement('canvas');
      cv.width  = Math.round(img.width  * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      setPhoto(cv.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  photoInput.value = '';
});

// ─── Form ─────────────────────────────────────────
function openForm(id = null) {
  editingId = id;
  currentPhotoData = null;

  if (id) {
    const p = passwords.find(x => x.id === id);
    if (!p) return;
    formTitle.textContent  = 'Edit Entry';
    editIdInput.value      = id;
    inputService.value     = p.service;
    inputPassword.value    = p.password;
    setActiveCat(p.category);
    setPhoto(p.photo || null);
  } else {
    formTitle.textContent  = 'New Entry';
    editIdInput.value      = '';
    inputService.value     = '';
    inputPassword.value    = '';
    setActiveCat('Other');
    setPhoto(null);
  }

  updateStrengthUI();
  formOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => inputService.focus(), 340);
}

function setActiveCat(cat) {
  editCatInput.value = cat;
  typeChips.querySelectorAll('.type-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });
}

function closeForm() {
  formOverlay.classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
}

function saveEntry() {
  const service  = inputService.value.trim();
  const password = inputPassword.value.trim();
  const category = editCatInput.value || 'Other';

  if (!service)  { inputService.focus();  showToast('Name is required.'); return; }
  if (!password) { inputPassword.focus(); showToast('Password is required.'); return; }

  if (editingId) {
    const idx = passwords.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      const prev = passwords[idx];
      passwords[idx] = {
        ...prev, service, password, category,
        photo: currentPhotoData !== null ? currentPhotoData : (prev.photo || null),
        updatedAt: Date.now(),
      };
      showToast('Updated ✓');
    }
  } else {
    passwords.unshift({
      id: uid(), service, password, category,
      username: '', url: '', note: '',
      photo: currentPhotoData || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    showToast('Saved ✓');
  }

  save(); render(); closeForm();
}

// ─── Detail sheet ─────────────────────────────────
function openModal(id) {
  const p = passwords.find(x => x.id === id);
  if (!p) return;
  currentModalId = id;

  const color = CAT_COLORS[p.category] || '#5e6a82';

  if (p.photo) {
    modalIcon.innerHTML = `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    modalIcon.style.background = 'none';
  } else {
    modalIcon.textContent    = getLetters(p.service);
    modalIcon.style.background = color + '22';
    modalIcon.style.color    = color;
  }

  modalService.textContent  = p.service;
  modalUrl.textContent      = p.url || `${p.category} · ${formatDate(p.createdAt)}`;
  modalUsername.textContent = p.username || '—';
  modalPassword.textContent = p.password;

  if (p.note) {
    modalNote.textContent      = p.note;
    detailNoteRow.style.display = '';
  } else {
    detailNoteRow.style.display = 'none';
  }

  if (p.photo) {
    modalPhoto.src             = p.photo;
    modalPhotoWrap.style.display = '';
  } else {
    modalPhotoWrap.style.display = 'none';
  }

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  currentModalId = null;
}

// ─── Copy ─────────────────────────────────────────
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  }
  showToast(label + ' ✓');
}

// ─── Export ───────────────────────────────────────
function exportData() {
  const data = passwords.map(p => ({ ...p, photo: p.photo ? '[photo]' : null }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `passnote_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Export complete ✓');
}

// ─── Events ───────────────────────────────────────
btnAdd.addEventListener('click', () => openForm());
emptyAddBtn.addEventListener('click', () => openForm());
btnExport.addEventListener('click', exportData);

// type chips
typeChips.addEventListener('click', e => {
  const chip = e.target.closest('.type-chip');
  if (!chip) return;
  setActiveCat(chip.dataset.cat);
});

// form
btnCloseForm.addEventListener('click', closeForm);
btnCancel.addEventListener('click', closeForm);
btnSave.addEventListener('click', saveEntry);
formOverlay.addEventListener('click', e => { if (e.target === formOverlay) closeForm(); });
inputPassword.addEventListener('input', updateStrengthUI);

// filter tabs
filterTabs.addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentFilter = tab.dataset.filter;
  render();
});

// pw list
pwList.addEventListener('click', e => {
  const action = e.target.closest('[data-action]');
  if (action) {
    e.stopPropagation();
    const id = action.dataset.id;
    const p  = passwords.find(x => x.id === id);
    if (!p) return;
    if (action.dataset.action === 'copy-pw') copyText(p.password, 'Password copied');
    if (action.dataset.action === 'copy-id') copyText(p.username || p.service, 'ID copied');
    return;
  }
  const card = e.target.closest('.pw-card');
  if (card) openModal(card.dataset.id);
});

// search
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  searchClear.style.display = searchQuery ? '' : 'none';
  render();
});
searchClear.addEventListener('click', () => {
  searchInput.value = ''; searchQuery = '';
  searchClear.style.display = 'none';
  render();
});

// detail sheet
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

document.querySelectorAll('.btn-copy-sm').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = passwords.find(x => x.id === currentModalId);
    if (!p) return;
    if (btn.dataset.target === 'password') copyText(p.password, 'Password copied');
    if (btn.dataset.target === 'username') copyText(p.username || '—', 'ID copied');
  });
});

btnModalEdit.addEventListener('click', () => {
  const id = currentModalId;
  closeModal(); openForm(id);
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

// keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeForm(); }
});

// ─── Init ─────────────────────────────────────────
render();
