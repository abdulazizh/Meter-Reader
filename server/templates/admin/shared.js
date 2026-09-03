let readers = [];

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showSuccess(message) {
  const alert = document.getElementById('successAlert');
  alert.textContent = message;
  alert.classList.add('show');
  setTimeout(() => alert.classList.remove('show'), 3000);
}

function showError(message) {
  const alert = document.getElementById('errorAlert');
  alert.textContent = message;
  alert.classList.add('show');
  setTimeout(() => alert.classList.remove('show'), 3000);
}

async function handleLogout() {
  if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
  try {
    const response = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include'
    });
    if (response.ok) {
      window.location.href = '/admin/login';
    } else {
      showError('فشل تسجيل الخروج');
    }
  } catch (error) {
    showError('حدث خطأ في الاتصال');
  }
}

async function fetchReaders() {
  try {
    const response = await fetch('/api/admin/readers', {
      credentials: 'include'
    });
    readers = await response.json();
    return readers;
  } catch (error) {
    showError('فشل تحميل القراء');
    return [];
  }
}

function updateReaderSelects(ids) {
  const options = readers.map(r => `<option value="${r.id}">${r.displayName}</option>`).join('');
  (ids || []).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">جميع القراء</option>' + options;
  });
}

function updateSortIndicators(tableId, field, dir) {
  const table = document.getElementById(tableId);
  if (!table) return;
  table.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (th.dataset.sort === field) {
      th.classList.add(dir);
    }
  });
}

function urlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
