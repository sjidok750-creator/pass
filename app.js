/* ===========================
   PASS NOTE — app.js  (Mobile/Tablet)
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
let passwords    = JSON.parse(localStorage.getItem('passnote_v2') || '[]');
let editingId    = null;
let currentFilter = 'All';
let searchQuery  = '';
let modalPwVisible = false;
let formPwVisible  = false;
let currentModalId = null;
let currentPhotoDataUrl = null;  // base64 photo for current form

// ─── DOM ──────────────────────────────────────────
const $ = id => document.getElementById(id);

const filterTabs      = $('filterTabs');
const statTotal       = $('statTotal');
const statCategory    = $('statCategory');
const statCategoryLabel = $('statCategoryLabel');
const statWeakNum     = $('statWeakNum');
const statWeak        = $('statWeak');
const pwList          = $('pwList');
const emptyState      = $('emptyState');
const emptyAddBtn     = $('emptyAddBtn');
const searchInput     = $('searchInput');
const searchClear     = $('searchClear');
const searchCount     = $('searchCount');
const toast           = $('toast');

// category picker
const catPickerOverlay = $('catPickerOverlay');
const catPickerClose   = $('catPickerClose');
const catPickerGrid    = $('catPickerGrid');

// form sheet
const formOverlay   = $('formOverlay');
const formSheet     = $('formSheet');
const formTitle     = $('formTitle');
const formCatIcon   = $('formCatIcon');
const formCatBadge  = $('formCatBadge');
const btnCloseForm  = $('btnCloseForm');
const btnCancel     = $('btnCancel');
const btnSave       = $('btnSave');
const editIdInput   = $('editId');
const editCatInput  = $('editCategory');
const inputService  = $('inputService');
const inputUrl      = $('inputUrl');
const inputUsername = $('inputUsername');
const inputPassword = $('inputPassword');
const inputNote     = $('inputNote');
const btnTogglePw   = $('btnTogglePw');
const pwStrengthFill  = $('pwStrengthFill');
const pwStrengthLabel = $('pwStrengthLabel');
const photoPreview  = $('photoPreview');
const photoInput    = $('photoInput');
const photoRemove   = $('photoRemove');

// detail sheet
const modalOverlay  = $('modalOverlay');
const modalClose    = $('modalClose');
const modalIcon     = $('modalIcon');
const modalService  = $('modalService');
const modalUrl      = $('modalUrl');
const modalUsername = $('modalUsername');
const modalPassword = $('modalPassword');
const modalNote     = $('modalNote');
const modalNoteField = $('modalNoteField');
const modalCat      = $('modalCat');
const modalDate     = $('modalDate');
const modalTogglePw = $('modalTogglePw');
const modalPhotoWrap = $('modalPhotoWrap');
const modalPhoto    = $('modalPhoto');
const btnModalEdit  = $('btnModalEdit');
const btnModalDelete = $('btnModalDelete');
const btnAdd        = $('btnAdd');
const btnExport     = $('btnExport');

// ─── Utils ────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function save() {
  localStorage.setItem('passnote_v2', JSON.stringify(passwords));
}

let toastTimer;
function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
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
  let h = 0;
  for (const c of service) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return `icon-color-${Math.abs(h) % ICON_COLORS}`;
}

function catColorClass(cat) {
  return `cat-${cat.toLowerCase()}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

function highlight(text, query) {
  if (!query) return escHtml(text);
  return escHtml(text).replace(
    new RegExp(`(${escRegex(query)})`, 'gi'),
    '<mark>$1</mark>'
  );
}

// ─── Password Strength ────────────────────────────
function measureStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 20,  label: 'Very Weak',  color: '#ef4444' };
  if (s === 2) return { score: 40,  label: 'Weak',       color: '#f97316' };
  if (s === 3) return { score: 60,  label: 'Fair',       color: '#eab308' };
  if (s === 4) return { score: 80,  label: 'Strong',     color: '#22c55e' };
  return              { score: 100, label: 'Very Strong', color: '#16a34a' };
}

function isWeak(pw) { return measureStrength(pw).score <= 40; }

function updateStrengthUI() {
  const { score, label, color } = measureStrength(inputPassword.value);
  pwStrengthFill.style.width      = inputPassword.value ? score + '%' : '0';
  pwStrengthFill.style.background = color;
  pwStrengthLabel.textContent     = label;
  pwStrengthLabel.style.color     = color;
}

function updateEyeIcon(btn, visible) {
  btn.querySelector('.eye-open').style.display   = visible ? 'none' : '';
  btn.querySelector('.eye-closed').style.display = visible ? '' : 'none';
}

// ─── Filter / Sort ────────────────────────────────
function getFiltered() {
  let list = [...passwords].sort((a, b) => b.createdAt - a.createdAt);
  if (currentFilter !== 'All')
    list = list.filter(p => p.category === currentFilter);
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

// ─── Render ───────────────────────────────────────
function render() {
  const filtered = getFiltered();

  statTotal.textContent = passwords.length;
  const weakCount = passwords.filter(p => isWeak(p.password)).length;
  statWeakNum.textContent = weakCount;
  statWeak.style.display = weakCount > 0 ? 'flex' : 'none';

  if (currentFilter !== 'All') {
    statCategory.textContent = passwords.filter(p => p.category === currentFilter).length;
    statCategoryLabel.textContent = currentFilter;
  } else {
    statCategory.textContent = [...new Set(passwords.map(p => p.category))].length;
    statCategoryLabel.textContent = 'Categories';
  }

  searchCount.textContent = searchQuery
    ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
    : '';

  if (filtered.length === 0) {
    pwList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  pwList.style.display = 'flex';
  emptyState.style.display = 'none';

  pwList.innerHTML = filtered.map(p => {
    const colorCls = iconColorClass(p.service);
    const catCls   = catColorClass(p.category);
    const svcHtml  = highlight(p.service, searchQuery);
    const dots     = '•'.repeat(Math.min(p.password.length, 14));

    // icon: photo thumbnail or letters
    const iconContent = p.photo
      ? `<img src="${p.photo}" alt="" loading="lazy" />`
      : getIconLetters(p.service);

    return `
      <div class="pw-card" data-id="${p.id}" tabindex="0" role="button">
        <div class="pw-card-icon ${p.photo ? '' : colorCls}">${iconContent}</div>
        <div class="pw-card-body">
          <div class="pw-card-row1">
            <span class="pw-card-service">${svcHtml}</span>
            <span class="pw-cat-badge ${catCls}">${p.category}</span>
          </div>
          <div class="pw-card-row2">
            <span class="pw-card-dots">${dots}</span>
            <div class="pw-card-actions">
              <button class="btn-card-action" data-action="copy" data-id="${p.id}" aria-label="Copy password">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn-card-action" data-action="edit" data-id="${p.id}" aria-label="Edit">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn-card-action danger" data-action="delete" data-id="${p.id}" aria-label="Delete">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Category Picker ──────────────────────────────
function openCatPicker(cb) {
  catPickerGrid.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-pick-item" data-cat="${c.key}">
       <span class="cat-pick-icon">${c.icon}</span>
       <span class="cat-pick-key">${c.key}</span>
       <span class="cat-pick-desc">${c.desc}</span>
     </button>`
  ).join('');
  catPickerOverlay._cb = cb;
  catPickerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCatPicker() {
  catPickerOverlay.classList.remove('open');
  catPickerOverlay._cb = null;
  document.body.style.overflow = '';
}

catPickerGrid.addEventListener('click', e => {
  const item = e.target.closest('.cat-pick-item');
  if (!item) return;
  const cat = item.dataset.cat;
  const cb  = catPickerOverlay._cb;
  closeCatPicker();
  if (cb) cb(cat);
});

catPickerClose.addEventListener('click', closeCatPicker);
catPickerOverlay.addEventListener('click', e => {
  if (e.target === catPickerOverlay) closeCatPicker();
});

// ─── Photo handling ───────────────────────────────
function setPhotoPreview(dataUrl) {
  currentPhotoDataUrl = dataUrl;
  if (dataUrl) {
    photoPreview.innerHTML = `<img src="${dataUrl}" alt="preview" />`;
    photoPreview.classList.add('has-photo');
    photoRemove.style.display = '';
  } else {
    photoPreview.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="5" width="24" height="18" rx="4" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="14" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M2 10h4l2-3h8l2 3h4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      <span>Add Photo</span>`;
    photoPreview.classList.remove('has-photo');
    photoRemove.style.display = 'none';
  }
}

photoPreview.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // compress to max 800px wide
    const img = new Image();
    img.onload = () => {
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  photoInput.value = '';
});

photoRemove.addEventListener('click', () => setPhotoPreview(null));

// ─── Form sheet ───────────────────────────────────
function openForm(id = null, cat = null) {
  editingId = id;
  formPwVisible = false;
  inputPassword.type = 'password';
  updateEyeIcon(btnTogglePw, false);
  currentPhotoDataUrl = null;

  if (id) {
    const p = passwords.find(x => x.id === id);
    if (!p) return;
    formTitle.textContent   = 'Edit Entry';
    editIdInput.value       = id;
    inputService.value      = p.service;
    inputUrl.value          = p.url      || '';
    inputUsername.value     = p.username || '';
    inputPassword.value     = p.password;
    inputNote.value         = p.note     || '';
    applyFormCat(p.category);
    setPhotoPreview(p.photo || null);
  } else {
    formTitle.textContent   = 'New Entry';
    editIdInput.value       = '';
    inputService.value      = '';
    inputUrl.value          = '';
    inputUsername.value     = '';
    inputPassword.value     = '';
    inputNote.value         = '';
    applyFormCat(cat || 'Other');
    setPhotoPreview(null);
  }

  updateStrengthUI();
  formOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => inputService.focus(), 350);
}

function applyFormCat(cat) {
  editCatInput.value = cat;
  const meta = CAT_META[cat] || { icon: '📁', key: cat };
  formCatIcon.textContent  = meta.icon;
  formCatBadge.textContent = meta.key;
}

function closeForm() {
  formOverlay.classList.remove('open');
  document.body.style.overflow = '';
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
        url:      inputUrl.value.trim(),
        username: inputUsername.value.trim(),
        password,
        note:     inputNote.value.trim(),
        category,
        photo:    currentPhotoDataUrl !== null ? currentPhotoDataUrl : passwords[idx].photo,
        updatedAt: Date.now(),
      };
      showToast('Updated ✓');
    }
  } else {
    passwords.unshift({
      id: uid(),
      service,
      url:      inputUrl.value.trim(),
      username: inputUsername.value.trim(),
      password,
      note:     inputNote.value.trim(),
      category,
      photo:    currentPhotoDataUrl || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    showToast('Saved ✓');
  }

  save();
  render();
  closeForm();
}

// ─── Detail sheet ─────────────────────────────────
function openModal(id) {
  const p = passwords.find(x => x.id === id);
  if (!p) return;
  currentModalId = id;
  modalPwVisible = false;

  const colorCls = iconColorClass(p.service);
  if (p.photo) {
    modalIcon.innerHTML = `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`;
    modalIcon.className = 'modal-service-icon';
  } else {
    modalIcon.textContent = getIconLetters(p.service);
    modalIcon.className   = `modal-service-icon ${colorCls}`;
  }

  modalService.textContent  = p.service;
  modalUrl.textContent      = p.url || '—';
  modalUsername.textContent = p.username || '—';
  modalPassword.textContent = '••••••••••';
  modalPassword.style.letterSpacing = '4px';
  modalPassword.dataset.real = p.password;
  updateEyeIcon(modalTogglePw, false);

  if (p.photo) {
    modalPhoto.src = p.photo;
    modalPhotoWrap.style.display = '';
  } else {
    modalPhotoWrap.style.display = 'none';
  }

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
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  currentModalId = null;
  modalPwVisible = false;
}

// ─── Export ───────────────────────────────────────
function exportData() {
  // export without photo data to keep size small (optional: include photos)
  const data = passwords.map(p => ({ ...p, photo: p.photo ? '[photo attached]' : null }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `passnote_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export complete ✓');
}

// ─── Copy ─────────────────────────────────────────
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} ✓`);
  } catch {
    // fallback for older mobile browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast(`${label} ✓`);
  }
}

// ─── Events ───────────────────────────────────────
function triggerNew() {
  openCatPicker(cat => openForm(null, cat));
}

btnAdd.addEventListener('click', triggerNew);
emptyAddBtn.addEventListener('click', triggerNew);
btnExport.addEventListener('click', exportData);

// Form
btnCloseForm.addEventListener('click', closeForm);
btnCancel.addEventListener('click', closeForm);
btnSave.addEventListener('click', saveEntry);

formOverlay.addEventListener('click', e => {
  if (e.target === formOverlay) closeForm();
});

// pw toggle form
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

// pw list delegation
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
      closeModal(); openForm(id);
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
  render();
});

// Detail modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

modalTogglePw.addEventListener('click', () => {
  modalPwVisible = !modalPwVisible;
  modalPassword.textContent = modalPwVisible ? modalPassword.dataset.real : '••••••••••';
  modalPassword.style.letterSpacing = modalPwVisible ? 'normal' : '4px';
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

// Keyboard (tablet with keyboard)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCatPicker(); closeModal(); closeForm(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault(); searchInput.focus(); searchInput.select();
  }
});

// ─── Init ─────────────────────────────────────────
render();
