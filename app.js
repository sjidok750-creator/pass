/* ===========================
   PASS NOTE — app.js
   =========================== */

'use strict';

// ─── State ───────────────────────────────────────
let passwords = JSON.parse(localStorage.getItem('passnote_v1') || '[]');
let editingId = null;
let currentFilter = '전체';
let searchQuery = '';
let modalPwVisible = false;
let formPwVisible = false;
let currentModalId = null;

// ─── DOM refs ─────────────────────────────────────
const formPanel     = document.getElementById('formPanel');
const formTitle     = document.getElementById('formTitle');
const editIdInput   = document.getElementById('editId');
const inputService  = document.getElementById('inputService');
const inputUrl      = document.getElementById('inputUrl');
const inputUsername = document.getElementById('inputUsername');
const inputPassword = document.getElementById('inputPassword');
const inputNote     = document.getElementById('inputNote');
const pwStrengthFill  = document.getElementById('pwStrengthFill');
const pwStrengthLabel = document.getElementById('pwStrengthLabel');
const categoryChips = document.getElementById('categoryChips');
const btnAdd        = document.getElementById('btnAdd');
const btnCloseForm  = document.getElementById('btnCloseForm');
const btnCancel     = document.getElementById('btnCancel');
const btnSave       = document.getElementById('btnSave');
const btnTogglePw   = document.getElementById('btnTogglePw');
const btnExport     = document.getElementById('btnExport');
const pwList        = document.getElementById('pwList');
const emptyState    = document.getElementById('emptyState');
const filterTabs    = document.getElementById('filterTabs');
const statTotal     = document.getElementById('statTotal');
const statCategory  = document.getElementById('statCategory');
const statCategoryLabel = document.getElementById('statCategoryLabel');
const statWeakNum   = document.getElementById('statWeakNum');
const statWeak      = document.getElementById('statWeak');
const searchInput   = document.getElementById('searchInput');
const searchClear   = document.getElementById('searchClear');
const searchCount   = document.getElementById('searchCount');
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalIcon     = document.getElementById('modalIcon');
const modalService  = document.getElementById('modalService');
const modalUrl      = document.getElementById('modalUrl');
const modalUsername = document.getElementById('modalUsername');
const modalPassword = document.getElementById('modalPassword');
const modalNote     = document.getElementById('modalNote');
const modalNoteField = document.getElementById('modalNoteField');
const modalCat      = document.getElementById('modalCat');
const modalDate     = document.getElementById('modalDate');
const modalTogglePw = document.getElementById('modalTogglePw');
const btnModalEdit  = document.getElementById('btnModalEdit');
const btnModalDelete = document.getElementById('btnModalDelete');
const toast         = document.getElementById('toast');

// ─── Utilities ────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function save() {
  localStorage.setItem('passnote_v1', JSON.stringify(passwords));
}

function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function getSelectedCat() {
  const active = categoryChips.querySelector('.chip.active');
  return active ? active.dataset.cat : '일반';
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

// ─── Password Strength ────────────────────────────
function measureStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 20,  label: '매우 약함', color: '#ef4444' };
  if (score === 2) return { score: 40,  label: '약함',     color: '#f97316' };
  if (score === 3) return { score: 60,  label: '보통',     color: '#eab308' };
  if (score === 4) return { score: 80,  label: '강함',     color: '#22c55e' };
  return               { score: 100, label: '매우 강함', color: '#16a34a' };
}

function isWeak(pw) {
  return measureStrength(pw).score <= 40;
}

function updateStrengthUI() {
  const pw = inputPassword.value;
  const { score, label, color } = measureStrength(pw);
  pwStrengthFill.style.width = pw ? score + '%' : '0';
  pwStrengthFill.style.background = color;
  pwStrengthLabel.textContent = label;
  pwStrengthLabel.style.color = color;
}

// ─── Highlight ────────────────────────────────────
function highlight(text, query) {
  if (!query) return escHtml(text);
  const escaped = escHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Filter / Search ──────────────────────────────
function getFiltered() {
  let list = passwords;

  if (currentFilter !== '전체') {
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

// ─── Render ───────────────────────────────────────
function render() {
  const filtered = getFiltered();

  // stats
  statTotal.textContent = passwords.length;
  const weakCount = passwords.filter(p => isWeak(p.password)).length;
  statWeakNum.textContent = weakCount;
  statWeak.style.display = weakCount > 0 ? 'flex' : 'none';

  if (currentFilter !== '전체') {
    const catCount = passwords.filter(p => p.category === currentFilter).length;
    statCategory.textContent = catCount;
    statCategoryLabel.textContent = currentFilter;
  } else {
    const cats = [...new Set(passwords.map(p => p.category))];
    statCategory.textContent = cats.length;
    statCategoryLabel.textContent = '카테고리';
  }

  // search count
  if (searchQuery) {
    searchCount.textContent = `${filtered.length}개 결과`;
  } else {
    searchCount.textContent = '';
  }

  // empty
  if (filtered.length === 0) {
    pwList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  pwList.style.display = 'flex';
  emptyState.style.display = 'none';

  pwList.innerHTML = filtered.map(p => {
    const letters = getIconLetters(p.service);
    const colorCls = iconColorClass(p.service);
    const svcHtml = highlight(p.service, searchQuery);
    const userHtml = p.username ? highlight(p.username, searchQuery) : '<span style="color:var(--text-3)">—</span>';

    return `
      <div class="pw-card" data-id="${p.id}" tabindex="0" role="button" aria-label="${escHtml(p.service)} 비밀번호">
        <div class="pw-card-icon ${colorCls}">${letters}</div>
        <div class="pw-card-info">
          <div class="pw-card-service">${svcHtml}</div>
          <div class="pw-card-username">${userHtml}</div>
        </div>
        <div class="pw-card-meta">
          <span class="pw-cat-badge cat-${p.category}">${p.category}</span>
          <div class="pw-card-actions">
            <button class="btn-card-action" data-action="copy" data-id="${p.id}" title="비밀번호 복사">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 10V2h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn-card-action" data-action="edit" data-id="${p.id}" title="수정">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn-card-action danger" data-action="delete" data-id="${p.id}" title="삭제">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Form ─────────────────────────────────────────
function openForm(id = null) {
  editingId = id;

  if (id) {
    const p = passwords.find(x => x.id === id);
    if (!p) return;
    formTitle.textContent = '비밀번호 수정';
    editIdInput.value = id;
    inputService.value  = p.service;
    inputUrl.value      = p.url || '';
    inputUsername.value = p.username || '';
    inputPassword.value = p.password;
    inputNote.value     = p.note || '';
    // select category
    categoryChips.querySelectorAll('.chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.cat === p.category);
    });
    // restore pw visibility
    inputPassword.type = 'password';
    formPwVisible = false;
    updateEyeIcon(btnTogglePw, false);
  } else {
    formTitle.textContent = '새 비밀번호 추가';
    editIdInput.value = '';
    inputService.value = '';
    inputUrl.value = '';
    inputUsername.value = '';
    inputPassword.value = '';
    inputNote.value = '';
    categoryChips.querySelectorAll('.chip').forEach((chip, i) => {
      chip.classList.toggle('active', i === 0);
    });
    inputPassword.type = 'password';
    formPwVisible = false;
    updateEyeIcon(btnTogglePw, false);
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
  const service = inputService.value.trim();
  const password = inputPassword.value;

  if (!service) { inputService.focus(); showToast('서비스명을 입력하세요.'); return; }
  if (!password) { inputPassword.focus(); showToast('비밀번호를 입력하세요.'); return; }

  const category = getSelectedCat();

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
      showToast('수정되었습니다 ✓');
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
    showToast('저장되었습니다 ✓');
  }

  save();
  render();
  closeForm();
}

// ─── Toggle eye ───────────────────────────────────
function updateEyeIcon(btn, visible) {
  const open   = btn.querySelector('.eye-open');
  const closed = btn.querySelector('.eye-closed');
  if (open)   open.style.display   = visible ? 'none' : '';
  if (closed) closed.style.display = visible ? ''     : 'none';
}

// ─── Modal ────────────────────────────────────────
function openModal(id) {
  const p = passwords.find(x => x.id === id);
  if (!p) return;
  currentModalId = id;
  modalPwVisible = false;

  const letters = getIconLetters(p.service);
  const colorCls = iconColorClass(p.service);
  modalIcon.textContent = letters;
  modalIcon.className = `modal-service-icon ${colorCls}`;

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

  modalCat.textContent  = p.category;
  modalCat.className    = `modal-cat-badge cat-${p.category}`;
  modalDate.textContent = formatDate(p.createdAt);

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  currentModalId = null;
  modalPwVisible = false;
}

// ─── Export (JSON) ────────────────────────────────
function exportData() {
  const data = JSON.stringify(passwords, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `passnote_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('내보내기 완료 ✓');
}

// ─── Copy to clipboard ────────────────────────────
async function copyText(text, label = '복사') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} 완료 ✓`);
  } catch {
    showToast('복사 실패 — 권한을 확인하세요.');
  }
}

// ─── Event bindings ───────────────────────────────

// Add button
btnAdd.addEventListener('click', () => openForm());

// Close / cancel form
btnCloseForm.addEventListener('click', closeForm);
btnCancel.addEventListener('click', closeForm);

// Save
btnSave.addEventListener('click', saveEntry);

// Enter to save
[inputService, inputUrl, inputUsername, inputPassword].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEntry();
  });
});

// Password toggle (form)
btnTogglePw.addEventListener('click', () => {
  formPwVisible = !formPwVisible;
  inputPassword.type = formPwVisible ? 'text' : 'password';
  updateEyeIcon(btnTogglePw, formPwVisible);
});

// Password strength meter
inputPassword.addEventListener('input', updateStrengthUI);

// Category chip select
categoryChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
});

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
      copyText(p.password, '비밀번호');
    } else if (action.dataset.action === 'edit') {
      closeModal();
      openForm(id);
    } else if (action.dataset.action === 'delete') {
      if (confirm(`"${p.service}" 항목을 삭제할까요?`)) {
        passwords = passwords.filter(x => x.id !== id);
        save();
        render();
        showToast('삭제되었습니다.');
      }
    }
    return;
  }

  // click on card -> open modal
  const card = e.target.closest('.pw-card');
  if (card) {
    openModal(card.dataset.id);
  }
});

// Keyboard on card
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

// Cmd/Ctrl+K to focus search
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === 'Escape') {
    closeModal();
    closeForm();
  }
});

// Modal close
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Modal password toggle
modalTogglePw.addEventListener('click', () => {
  modalPwVisible = !modalPwVisible;
  modalPassword.textContent = modalPwVisible
    ? modalPassword.dataset.real
    : '••••••••••';
  modalPassword.style.letterSpacing = modalPwVisible ? 'normal' : '3px';
  updateEyeIcon(modalTogglePw, modalPwVisible);
});

// Modal copy buttons
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const p = passwords.find(x => x.id === currentModalId);
    if (!p) return;
    if (target === 'password') copyText(p.password, '비밀번호');
    if (target === 'username') copyText(p.username || '', '아이디');
  });
});

// Modal edit
btnModalEdit.addEventListener('click', () => {
  const id = currentModalId;
  closeModal();
  openForm(id);
});

// Modal delete
btnModalDelete.addEventListener('click', () => {
  const p = passwords.find(x => x.id === currentModalId);
  if (!p) return;
  if (confirm(`"${p.service}" 항목을 삭제할까요?`)) {
    passwords = passwords.filter(x => x.id !== currentModalId);
    save();
    render();
    closeModal();
    showToast('삭제되었습니다.');
  }
});

// Export
btnExport.addEventListener('click', exportData);

// ─── Init ─────────────────────────────────────────
render();

// ─── Demo data (only if empty) ────────────────────
if (passwords.length === 0) {
  const demos = [
    { service: 'Google',   url: 'https://google.com',   username: 'user@gmail.com',     password: 'G00gl3#Secure!2024', category: '일반',   note: '개인 구글 계정' },
    { service: 'GitHub',   url: 'https://github.com',   username: 'devuser',            password: 'gh_token_abc123!',   category: '업무',   note: '' },
    { service: 'Netflix',  url: 'https://netflix.com',  username: 'user@email.com',     password: 'N3tfl1x#pass',       category: '소셜',   note: '가족 공유 계정' },
    { service: 'Toss',     url: 'https://toss.im',      username: '010-1234-5678',      password: 'Toss@2024!',         category: '금융',   note: '' },
    { service: 'Coupang',  url: 'https://coupang.com',  username: 'shopper@email.com',  password: 'c0up@ngPass',        category: '쇼핑',   note: '로켓배송 계정' },
    { service: 'Steam',    url: 'https://store.steampowered.com', username: 'gamer_id', password: 'st3Am!game',         category: '게임',   note: '' },
  ];
  passwords = demos.map(d => ({
    ...d,
    id: uid(),
    createdAt: Date.now() - Math.floor(Math.random() * 1e8),
    updatedAt: Date.now(),
  }));
  save();
  render();
}
