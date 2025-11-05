import { post, wsUrl } from './api.js';

const tbody = document.querySelector('#alerts-tbody');
const countEl = document.querySelector('#alerts-count');

function rowHtml(a) {
  const pill = s => `<span class="pill pill-${s}">${s}</span>`;
  return `
  <tr data-id="${a.id}">
    <td>${new Date(a.ts).toLocaleString()}</td>
    <td>${a.type}</td>
    <td>${a.house_id}</td>
    <td>${pill(a.severity)}</td>
    <td>${pill(a.status)}</td>
    <td><a href="alert-detail.html?id=${a.id}">View</a></td>
  </tr>`;
}

function upsertRow(a) {
  const existing = tbody.querySelector(`tr[data-id="${a.id}"]`);
  if (existing) {
    existing.outerHTML = rowHtml(a);
  } else {
    tbody.insertAdjacentHTML('afterbegin', rowHtml(a));
  }
  countEl.textContent = tbody.querySelectorAll('tr').length;
}

async function load() {
  const { items } = await post('/api/v1/alerts/search', { limit: 100 });
  tbody.innerHTML = items.map(rowHtml).join('');
  countEl.textContent = items.length;
}
load();

// WebSocket live updates
const ws = new WebSocket(wsUrl());
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'alert.created' || msg.type === 'alert.updated') upsertRow(msg.payload);
};

// Demo generators
document.querySelector('#gen-glass')?.addEventListener('click', () =>
  post('/api/v1/alerts/ingest', { type: 'glass_break', message: 'Glass shatter in living room' })
);
document.querySelector('#gen-smoke')?.addEventListener('click', () =>
  post('/api/v1/alerts/ingest', { type: 'smoke_alarm', message: 'Smoke detected in kitchen' })
);
document.querySelector('#gen-dog')?.addEventListener('click', () =>
  post('/api/v1/alerts/ingest', { type: 'dog_bark', message: 'Dog barking at backyard' })
);

// Simple filters (optional)
document.querySelector('#filter-status')?.addEventListener('change', async (e) => {
  const status = e.target.value || undefined;
  const { items } = await post('/api/v1/alerts/search', { status, limit: 100 });
  tbody.innerHTML = items.map(rowHtml).join('');
  countEl.textContent = items.length;
});
