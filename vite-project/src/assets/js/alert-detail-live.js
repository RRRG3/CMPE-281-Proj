import { get, post } from './api.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const metaEl = document.querySelector('#alert-meta');
const historyEl = document.querySelector('#alert-history');

function getAlertIcon(type, severity) {
  if (type === 'glass_break') return '🔊';
  if (type === 'smoke_alarm') return '🔥';
  if (type === 'dog_bark') return '🐕';
  if (severity === 'critical') return '🚨';
  if (severity === 'high') return '⚠️';
  return '📢';
}

function getAlertTitle(type) {
  return type.replace(/_/g, ' ').toUpperCase();
}

async function refresh() {
  if (!id) {
    console.warn('No alert ID provided in URL');
    return;
  }
  
  try {
    const { alert, history } = await get(`/api/v1/alerts/${id}`);
    
    // Update the top banner section
    const alertBanner = document.querySelector('.alert-header-info h2');
    const alertMeta = document.querySelector('.alert-header-info .alert-meta');
    const alertTimestamp = document.querySelector('#alertTimestamp');
    const alertIcon = document.querySelector('.alert-icon-large');
    const alertStatus = document.querySelector('#alertStatus');
    
    if (alertBanner) {
      alertBanner.textContent = `${getAlertTitle(alert.type)} - ${alert.house_id}`;
    }
    
    if (alertMeta) {
      alertMeta.innerHTML = `
        <strong>Location:</strong> ${alert.house_id} |
        <strong>Device:</strong> ${alert.device_id} |
        <strong>Severity:</strong> ${alert.severity}
      `;
    }
    
    if (alertTimestamp) {
      alertTimestamp.textContent = `📅 ${new Date(alert.ts).toLocaleString()}`;
    }
    
    if (alertIcon) {
      alertIcon.textContent = getAlertIcon(alert.type, alert.severity);
    }
    
    if (alertStatus) {
      const statusText = alertStatus.querySelector('.status-text');
      if (alert.status === 'acknowledged') {
        alertStatus.dataset.status = 'acknowledged';
        if (statusText) statusText.textContent = `Acknowledged by ${alert.acknowledged_by || 'user'}`;
      } else if (alert.status === 'resolved') {
        alertStatus.dataset.status = 'resolved';
        if (statusText) statusText.textContent = `Resolved by ${alert.resolved_by || 'user'}`;
      } else {
        alertStatus.dataset.status = 'unacknowledged';
        if (statusText) statusText.textContent = 'Awaiting acknowledgement';
      }
    }
    
    // Update the live detail section
    metaEl.innerHTML = `
      <div><b>Type:</b> ${alert.type}</div>
      <div><b>Severity:</b> ${alert.severity}</div>
      <div><b>Status:</b> ${alert.status}</div>
      <div><b>Message:</b> ${alert.message || ''}</div>
      <div><b>Created:</b> ${new Date(alert.ts).toLocaleString()}</div>
    `;
    historyEl.innerHTML = history.map(h =>
      `<li>[${new Date(h.ts).toLocaleTimeString()}] ${h.action} — ${h.actor} ${h.note ? '('+h.note+')' : ''}</li>`
    ).join('');
  } catch (err) {
    console.error('Failed to load alert:', err);
    if (metaEl) {
      metaEl.innerHTML = '<p style="color: red;">Failed to load alert details. Please check the alert ID.</p>';
    }
  }
}

document.querySelector('#btn-ack')?.addEventListener('click', async () => {
  if (!id) return;
  await post(`/api/v1/alerts/${id}/ack`, { actor: 'rusheek' });
  await refresh();
});
document.querySelector('#btn-resolve')?.addEventListener('click', async () => {
  if (!id) return;
  await post(`/api/v1/alerts/${id}/resolve`, { actor: 'rusheek' });
  await refresh();
});

// Update back button based on referrer
const backBtn = document.querySelector('.back-btn');
if (backBtn && document.referrer) {
  if (document.referrer.includes('admin-dashboard')) {
    backBtn.href = 'admin-dashboard.html';
  } else if (document.referrer.includes('owner-dashboard')) {
    backBtn.href = 'owner-dashboard.html';
  }
}

refresh();
