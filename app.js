/* ===========================
   PASS NOTE — app.js
   Firebase Firestore + Google Auth
   =========================== */
'use strict';

// ─── Firebase ────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBT0ynNx9trL5EjUvzPbEKXMhsnWjjn1hI",
  authDomain: "passnote-59bdf.firebaseapp.com",
  projectId: "passnote-59bdf",
  storageBucket: "passnote-59bdf.firebasestorage.app",
  messagingSenderId: "375207399421",
  appId: "1:375207399421:web:4bf2602e8579dd8d4a9394"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let unsubscribe = null; // Firestore listener

// ─── Category meta ────────────────────────────────
const CAT_COLORS = {
  Finance: '#16a34a',
  Website: '#2563eb',
  App:     '#7c3aed',
  OTT:    '#e11d48',
  Other:   '#5e6a82',
};

// ─── State ────────────────────────────────────────
let passwords     = [];
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
const inputUsername = $('inputUsername');
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

// auth
const loginOverlay = $('loginOverlay');
const loginPwInput = $('loginPwInput');
const btnLoginSubmit = $('btnLoginSubmit');
const loginError = $('loginError');
const APP_PIN = '1235';

// ─── Utils ────────────────────────────────────────
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

// ─── Auth ─────────────────────────────────────────
function showLogin() {
  loginOverlay.style.display = 'flex';
  document.querySelector('.header').style.display = 'none';
  document.querySelector('.filter-bar').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.querySelector('.search-bar-wrap').style.display = 'none';
}

function hideLogin() {
  loginOverlay.style.display = 'none';
  document.querySelector('.header').style.display = '';
  document.querySelector('.filter-bar').style.display = '';
  document.querySelector('.main').style.display = '';
  document.querySelector('.search-bar-wrap').style.display = '';
}

async function tryLogin() {
  const val = loginPwInput.value.trim();
  if (val === APP_PIN) {
    loginError.style.display = 'none';
    try {
      if (currentUser) {
        // Already signed in anonymously (cached), just unlock
        unlockApp(currentUser);
      } else {
        const cred = await signInAnonymously(auth);
        unlockApp(cred.user);
      }
    } catch (e) {
      console.error(e);
      showToast('Auth error');
    }
  } else {
    loginError.style.display = '';
    loginPwInput.value = '';
    loginPwInput.focus();
  }
}

btnLoginSubmit.addEventListener('click', tryLogin);
loginPwInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});


// ─── Firestore ────────────────────────────────────
function passwordsCol() {
  return collection(db, 'passwords');
}

function listenPasswords() {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(passwordsCol(), (snap) => {
    passwords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    passwords.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    render();
  }, (err) => {
    console.error('Firestore error:', err);
    showToast('Error: ' + err.message);
  });
}

async function saveEntry() {
  const service  = inputService.value.trim();
  const username = inputUsername.value.trim();
  const password = inputPassword.value.trim();
  const category = editCatInput.value || 'Other';

  if (!service)  { inputService.focus();  showToast('Name is required.'); return; }
  if (!password) { inputPassword.focus(); showToast('Password is required.'); return; }

  try {
    if (editingId) {
      const existing = passwords.find(p => p.id === editingId);
      const docRef = doc(db, 'passwords', editingId);
      await updateDoc(docRef, {
        service, username, password, category,
        photo: currentPhotoData !== null ? currentPhotoData : (existing?.photo || null),
        updatedAt: Date.now(),
      });
      showToast('Updated ✓');
    } else {
      await addDoc(passwordsCol(), {
        service, username, password, category,
        url: '', note: '',
        photo: currentPhotoData || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast('Saved ✓');
    }
  } catch (e) {
    console.error(e);
    showToast('Save failed');
  }

  closeForm();
}

// ─── Migrate localStorage → Firestore ─────────────
async function migrateLocalData() {
  const local = JSON.parse(localStorage.getItem('passnote_v2') || '[]');
  if (local.length === 0) return;

  const existingIds = new Set(passwords.map(p => p.service + '|' + p.password));
  let migrated = 0;

  for (const item of local) {
    const key = item.service + '|' + item.password;
    if (existingIds.has(key)) continue;
    try {
      const { id, ...data } = item;
      await addDoc(passwordsCol(), data);
      migrated++;
    } catch (e) {
      console.error('Migration error:', e);
    }
  }

  if (migrated > 0) {
    showToast(`${migrated} items migrated`);
  }
  localStorage.removeItem('passnote_v2');
}

// ─── Auth state listener ──────────────────────────
function unlockApp(user) {
  currentUser = user;
  sessionStorage.setItem('passnote_unlocked', '1');
  hideLogin();
  listenPasswords();
  setTimeout(() => migrateLocalData(), 1500);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Already unlocked this session?
    if (sessionStorage.getItem('passnote_unlocked') === '1') {
      unlockApp(user);
    } else {
      // Auth cached but PIN not entered yet — show login
      currentUser = user;
      showLogin();
    }
  } else {
    currentUser = null;
    sessionStorage.removeItem('passnote_unlocked');
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    passwords = [];
    render();
    showLogin();
  }
});

// ─── Filter / Sort ────────────────────────────────
function getFiltered() {
  let list = [...passwords];
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
    const idHtml   = p.username ? highlight(p.username, searchQuery) : '<span class="card-empty">—</span>';

    const dotHtml = p.photo
      ? `<img src="${p.photo}" class="card-dot-photo" alt="" />`
      : `<span class="card-color-dot" style="background:${color}"></span>`;

    return `
      <div class="pw-card" data-id="${p.id}" role="button" tabindex="0">
        <div class="card-row-top">
          ${dotHtml}
          <span class="card-name">${nameHtml}</span>
        </div>
        <div class="card-row-bot">
          <span class="card-id">${idHtml}</span>
          <span class="card-sep">·</span>
          <span class="card-pw">${escHtml(p.password)}</span>
          <button class="btn-copy-card" data-action="copy-both" data-id="${p.id}" aria-label="Copy">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
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

// ─── ID Presets ───────────────────────────────────
const idPresets = $('idPresets');

inputUsername.addEventListener('focus', () => {
  idPresets.style.display = 'flex';
});

inputUsername.addEventListener('blur', () => {
  setTimeout(() => { idPresets.style.display = 'none'; }, 150);
});

idPresets.addEventListener('click', e => {
  const chip = e.target.closest('.id-preset-chip');
  if (!chip) return;
  inputUsername.value = chip.dataset.id;
  idPresets.style.display = 'none';
  inputPassword.focus();
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
    inputUsername.value    = p.username || '';
    inputPassword.value    = p.password;
    setActiveCat(p.category);
    setPhoto(p.photo || null);
  } else {
    formTitle.textContent  = 'New Entry';
    editIdInput.value      = '';
    inputService.value     = '';
    inputUsername.value    = '';
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
  $('modalUpdated').textContent = formatDate(p.updatedAt || p.createdAt);

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

// ─── Export PDF ───────────────────────────────────
function exportData() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `pass${yy}${mm}${dd}.pdf`;

  // Build PDF content as HTML table
  let rows = '';
  passwords.forEach(p => {
    rows += `<tr>
      <td>${escHtml(p.service)}</td>
      <td>${escHtml(p.category || '')}</td>
      <td>${escHtml(p.username || '')}</td>
      <td>${escHtml(p.password)}</td>
      <td>${formatDate(p.updatedAt || p.createdAt)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: 'Pretendard', sans-serif; padding: 20px; font-size: 11px; }
      h2 { font-size: 16px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f2f2f2; font-weight: 600; }
      td:nth-child(4) { font-family: monospace; color: #d93030; }
    </style>
  </head><body>
    <h2>PassNote — ${yy}.${mm}.${dd}</h2>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>ID / Email</th><th>Password</th><th>Updated</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  const printWin = window.open('', '_blank', 'width=800,height=600');
  printWin.document.write(html);
  printWin.document.close();
  printWin.onload = () => {
    printWin.document.title = filename;
    printWin.print();
  };
  showToast('PDF export ✓');
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
    if (action.dataset.action === 'copy-pw')   copyText(p.password, 'Password copied');
    if (action.dataset.action === 'copy-id')   copyText(p.username || p.service, 'ID copied');
    if (action.dataset.action === 'copy-both') {
      const text = [p.username || p.service, p.password].filter(Boolean).join('\n');
      copyText(text, 'Copied');
    }
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

btnModalDelete.addEventListener('click', async () => {
  const p = passwords.find(x => x.id === currentModalId);
  if (!p) return;
  if (confirm(`Delete "${p.service}"?`)) {
    try {
      const docRef = doc(db, 'passwords', currentModalId);
      await deleteDoc(docRef);
      showToast('Deleted.');
    } catch (e) {
      console.error(e);
      showToast('Delete failed');
    }
    closeModal();
  }
});

// keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeForm(); }
});

// ─── Init ─────────────────────────────────────────
render();
