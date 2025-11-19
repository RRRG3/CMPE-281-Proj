// Enhanced alerts list with WebSocket, bulk actions, and state-based buttons
import { post, get } from './api.js';
import alertSounds from './alert-sounds.js';
import wsClient from './websocket-client.js';
import {
  acknowledgeAlert,
  escalateAlert,
  resolveAlert,
  deleteAlert,
  bulkAcknowledgeAlerts,
  getAvailableActions,
  getSeverityBadge,
  getStatusBadge
} from './alert-actions.js';

let alerts = [];
let selectedAlerts = new Set();
const tbody = document.querySelector('#alerts-tbody');
const countEl = document.querySelector('#alerts-count');
const toast = window.showToast || console.log;

// ARIA live region for accessibility
function createAriaLiveRegion() {
  if (!document.getElementById('alert-live-region')) {
    const liveRegion = document.createElement('div');
    liveRegion.id = 'alert-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }
}

function announceToScreenReader(message) {
  const liveRegion = document.getElementById('alert-live-region');
  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

// Create row HTML with checkboxes and action buttons
function rowHtml(alert) {
  const actions = getAvailableActions(alert);
  const actionButtons = [];

  if (actions.includes('acknowledge')) {
    actionButtons.push(`
      <button class="btn btn-sm btn-success action-ack" data-id="${alert.id}" 
              aria-label="Acknowledge alert">
        ✓ Ack
      </button>
    `);
  }

  if (actions.includes('escalate')) {
    actionButtons.push(`
      <button class="btn btn-sm btn-warning action-escalate" data-id="${alert.id}"
              aria-label="Escalate alert">
        ⚠️ Escalate
      </button>
    `);
  }

  if (actions.includes('resolve')) {
    actionButtons.push(`
      <button class="btn btn-sm btn-primary action-resolve" data-id="${alert.id}"
              aria-label="Resolve alert">
        ✓ Resolve
      </button>
    `);
  }

  const isNew = alert.status === 'new' || alert.status === 'open';
  const rowClass = isNew ? 'alert-row-new' : '';

  return `
  <tr data-id="${alert.id}" class="${rowClass}" role="row">
    <td>
      <input type="checkbox" class="alert-checkbox" data-id="${alert.id}" 
             aria-label="Select alert ${alert.id}">
    </td>
    <td>${new Date(alert.ts || alert.created_at).toLocaleString()}</td>
    <td>${alert.type.replace(/_/g, ' ')}</td>
    <td>${alert.house_id}</td>
    <td>${getSeverityBadge(alert.severity)}</td>
    <td>${getStatusBadge(alert.status || alert.state)}</td>
    <td>
      <div class="alert-actions">
        ${actionButtons.join('')}
        <a href="alert-detail.html?id=${alert.id}" class="btn btn-sm btn-secondary"
           aria-label="View alert details">
          View
        </a>
      </div>
    </td>
  </tr>`;
}

// Update or insert row
function upsertRow(alert) {
  const existing = tbody.querySelector(`tr[data-id="${alert.id}"]`);
  if (existing) {
    existing.outerHTML = rowHtml(alert);
  } else {
    tbody.insertAdjacentHTML('afterbegin', rowHtml(alert));
  }
  updateCount();
  
  // Update alerts array
  const index = alerts.findIndex(a => a.id === alert.id);
  if (index >= 0) {
    alerts[index] = alert;
  } else {
    alerts.unshift(alert);
  }
}

// Remove row
function removeRow(alertId) {
  const row = tbody.querySelector(`tr[data-id="${alertId}"]`);
  if (row) {
    row.remove();
    alerts = alerts.filter(a => a.id !== alertId);
    selectedAlerts.delete(alertId);
    updateCount();
    updateBulkActionsBar();
  }
}

// Update count
function updateCount() {
  const count = tbody.querySelectorAll('tr').length;
  if (countEl) countEl.textContent = count;
}

// Load alerts
async function loadAlerts() {
  try {
    const currentTenant = window.currentTenant;
    const searchParams = { limit: 100 };
    
    if (currentTenant?.tenant_id) {
      searchParams.tenant_id = currentTenant.tenant_id;
      console.log(`[alerts-list] Loading alerts for tenant: ${currentTenant.name}`);
    }
    
    const response = await post('/api/v1/alerts/search', searchParams);
    alerts = response.items || [];
    
    if (tbody) {
      tbody.innerHTML = alerts.map(rowHtml).join('');
      updateCount();
    }
    
    console.log(`[alerts-list] Loaded ${alerts.length} alerts`);
  } catch (err) {
    console.error('[alerts-list] Failed to load alerts:', err);
    toast('Failed to load alerts', 'error');
  }
}

// Handle acknowledge action
async function handleAcknowledge(alertId) {
  const result = await acknowledgeAlert(alertId);
  
  if (result.success) {
    toast('Alert acknowledged successfully', 'success');
    announceToScreenReader('Alert acknowledged');
    
    // Update the alert in the list
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      upsertRow(alert);
    }
  } else {
    if (result.error === 'conflict') {
      toast(result.message, 'warning');
      // Reload the specific alert
      await reloadAlert(alertId);
    } else {
      toast(result.message, 'error');
    }
  }
}

// Handle escalate action
async function handleEscalate(alertId) {
  const note = prompt('Enter escalation note (optional):');
  if (note === null) return; // User cancelled
  
  const result = await escalateAlert(alertId, 'current_user', note);
  
  if (result.success) {
    toast('Alert escalated successfully', 'success');
    announceToScreenReader('Alert escalated');
    
    // Update the alert in the list
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'escalated';
      upsertRow(alert);
    }
  } else {
    if (result.error === 'conflict') {
      toast(result.message, 'warning');
      await reloadAlert(alertId);
    } else {
      toast(result.message, 'error');
    }
  }
}

// Handle resolve action
async function handleResolve(alertId) {
  showResolveModal(alertId);
}

// Show resolve modal
function showResolveModal(alertId) {
  const modal = document.createElement('div');
  modal.className = 'resolve-modal';
  modal.innerHTML = `
    <div class="resolve-modal-content" role="dialog" aria-labelledby="resolve-modal-title" aria-modal="true">
      <div class="resolve-modal-header">
        <h3 id="resolve-modal-title" class="resolve-modal-title">Resolve Alert</h3>
        <button class="resolve-modal-close" aria-label="Close modal">×</button>
      </div>
      <div class="resolve-modal-body">
        <label for="resolve-note">Resolution Note *</label>
        <textarea id="resolve-note" placeholder="Describe how the alert was resolved..." 
                  aria-required="true" required></textarea>
        <div class="resolve-modal-error" id="resolve-error" role="alert"></div>
      </div>
      <div class="resolve-modal-footer">
        <button class="btn btn-secondary resolve-cancel">Cancel</button>
        <button class="btn btn-primary resolve-submit">Resolve Alert</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus on textarea
  const textarea = modal.querySelector('#resolve-note');
  textarea.focus();
  
  // Close handlers
  const closeModal = () => {
    modal.remove();
  };
  
  modal.querySelector('.resolve-modal-close').onclick = closeModal;
  modal.querySelector('.resolve-cancel').onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  // Submit handler
  modal.querySelector('.resolve-submit').onclick = async () => {
    const note = textarea.value.trim();
    const errorEl = modal.querySelector('#resolve-error');
    
    if (!note) {
      errorEl.textContent = 'Resolution note is required';
      textarea.focus();
      return;
    }
    
    const result = await resolveAlert(alertId, 'current_user', note);
    
    if (result.success) {
      toast('Alert resolved successfully', 'success');
      announceToScreenReader('Alert resolved');
      closeModal();
      
      // Update the alert in the list
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.status = 'resolved';
        upsertRow(alert);
      }
    } else {
      if (result.error === 'validation') {
        errorEl.textContent = result.message;
        textarea.focus();
      } else if (result.error === 'conflict') {
        toast(result.message, 'warning');
        closeModal();
        await reloadAlert(alertId);
      } else {
        errorEl.textContent = result.message;
      }
    }
  };
  
  // Keyboard support
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// Reload specific alert
async function reloadAlert(alertId) {
  try {
    const response = await get(`/api/v1/alerts/${alertId}`);
    if (response.alert) {
      upsertRow(response.alert);
    }
  } catch (err) {
    console.error('[alerts-list] Failed to reload alert:', err);
  }
}

// Handle checkbox selection
function handleCheckboxChange(checkbox) {
  const alertId = checkbox.dataset.id;
  if (checkbox.checked) {
    selectedAlerts.add(alertId);
  } else {
    selectedAlerts.delete(alertId);
  }
  updateBulkActionsBar();
}

// Update bulk actions bar
function updateBulkActionsBar() {
  let bar = document.getElementById('bulk-actions-bar');
  
  if (selectedAlerts.size === 0) {
    if (bar) bar.remove();
    return;
  }
  
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulk-actions-bar';
    bar.className = 'bulk-actions-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Bulk actions');
    document.body.appendChild(bar);
  }
  
  bar.innerHTML = `
    <span class="bulk-actions-count">${selectedAlerts.size} selected</span>
    <button class="btn btn-success bulk-ack" id="bulk-ack-btn">
      ✓ Acknowledge All
    </button>
    <button class="btn btn-danger bulk-delete" id="bulk-delete-btn">
      🗑️ Delete Selected
    </button>
    <button class="btn btn-secondary bulk-clear" id="bulk-clear-btn">
      Clear Selection
    </button>
  `;
  
  // Bulk acknowledge handler
  bar.querySelector('#bulk-ack-btn').onclick = async () => {
    const alertIds = Array.from(selectedAlerts);
    toast(`Acknowledging ${alertIds.length} alerts...`, 'info');
    
    const results = await bulkAcknowledgeAlerts(alertIds);
    
    if (results.success.length > 0) {
      toast(`${results.success.length} alerts acknowledged`, 'success');
      announceToScreenReader(`${results.success.length} alerts acknowledged`);
      
      // Update alerts in the list
      results.success.forEach(alertId => {
        const alert = alerts.find(a => a.id === alertId);
        if (alert) {
          alert.status = 'acknowledged';
          upsertRow(alert);
        }
      });
    }
    
    if (results.failed.length > 0) {
      toast(`${results.failed.length} alerts failed to acknowledge`, 'warning');
    }
    
    // Clear selection
    selectedAlerts.clear();
    updateBulkActionsBar();
    
    // Uncheck all checkboxes
    tbody.querySelectorAll('.alert-checkbox').forEach(cb => cb.checked = false);
  };
  
  // Bulk delete handler
  bar.querySelector('#bulk-delete-btn').onclick = async () => {
    const alertIds = Array.from(selectedAlerts);
    
    if (!confirm(`Are you sure you want to delete ${alertIds.length} alert(s)? This action cannot be undone.`)) {
      return;
    }
    
    toast(`Deleting ${alertIds.length} alerts...`, 'info');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const alertId of alertIds) {
      const result = await deleteAlert(alertId);
      if (result.success) {
        successCount++;
        removeRow(alertId);
      } else {
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast(`${successCount} alert(s) deleted successfully`, 'success');
      announceToScreenReader(`${successCount} alerts deleted`);
    }
    
    if (failCount > 0) {
      toast(`${failCount} alert(s) failed to delete`, 'error');
    }
    
    // Clear selection
    selectedAlerts.clear();
    updateBulkActionsBar();
  };
  
  // Clear selection handler
  bar.querySelector('#bulk-clear-btn').onclick = () => {
    selectedAlerts.clear();
    updateBulkActionsBar();
    tbody.querySelectorAll('.alert-checkbox').forEach(cb => cb.checked = false);
  };
}

// Event delegation for action buttons and checkboxes
if (tbody) {
  tbody.addEventListener('click', async (e) => {
    const target = e.target;
    
    // Checkbox
    if (target.classList.contains('alert-checkbox')) {
      handleCheckboxChange(target);
      return;
    }
    
    // Acknowledge button
    if (target.classList.contains('action-ack')) {
      const alertId = target.dataset.id;
      await handleAcknowledge(alertId);
      return;
    }
    
    // Escalate button
    if (target.classList.contains('action-escalate')) {
      const alertId = target.dataset.id;
      await handleEscalate(alertId);
      return;
    }
    
    // Resolve button
    if (target.classList.contains('action-resolve')) {
      const alertId = target.dataset.id;
      await handleResolve(alertId);
      return;
    }
  });
}

// WebSocket integration
function setupWebSocket() {
  const currentTenant = window.currentTenant;
  if (!currentTenant) {
    console.warn('[alerts-list] No tenant selected, skipping WebSocket');
    return;
  }
  
  wsClient.connect(currentTenant.tenant_id, currentTenant.tenant_id);
  
  // Handle new alerts
  wsClient.on('alert.new', (data) => {
    console.log('[alerts-list] New alert received:', data);
    if (data.alert) {
      upsertRow(data.alert);
      alertSounds.playAlertSound(data.alert.severity);
      toast(`New ${data.alert.severity} alert: ${data.alert.type}`, 'warning');
      announceToScreenReader(`New ${data.alert.severity} alert received`);
    }
  });
  
  // Handle acknowledged alerts
  wsClient.on('alert.acked', (data) => {
    console.log('[alerts-list] Alert acknowledged:', data);
    if (data.alert) {
      upsertRow(data.alert);
    }
  });
  
  // Handle escalated alerts
  wsClient.on('alert.escalated', (data) => {
    console.log('[alerts-list] Alert escalated:', data);
    if (data.alert) {
      upsertRow(data.alert);
    }
  });
  
  // Handle resolved alerts
  wsClient.on('alert.resolved', (data) => {
    console.log('[alerts-list] Alert resolved:', data);
    if (data.alert) {
      upsertRow(data.alert);
    }
  });
  
  // Handle deleted alerts
  wsClient.on('alert.deleted', (data) => {
    console.log('[alerts-list] Alert deleted:', data);
    if (data.id) {
      removeRow(data.id);
      toast('Alert deleted', 'info');
    }
  });
}

// Initialize
createAriaLiveRegion();
loadAlerts();

// Setup WebSocket after a short delay to allow tenant to load
setTimeout(() => {
  setupWebSocket();
}, 1000);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  wsClient.disconnect();
});

export { loadAlerts, upsertRow, removeRow };
