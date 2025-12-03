// Enhanced alert detail page with history timeline and state-based actions
import { get } from './api.js';
import {
  acknowledgeAlert,
  escalateAlert,
  resolveAlert,
  getAvailableActions,
  getSeverityBadge,
  getStatusBadge
} from './alert-actions.js';
import alertSounds from './alert-sounds.js';

const toast = window.showToast || console.log;
let currentAlert = null;

// Get alert ID from URL
function getAlertIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Load alert details
async function loadAlertDetail() {
  const alertId = getAlertIdFromUrl();
  if (!alertId) {
    toast('No alert ID provided', 'error');
    return;
  }

  try {
    const response = await get(`/api/v1/alerts/${alertId}`);
    currentAlert = response.alert;
    const history = response.history || [];

    renderAlertHeader(currentAlert);
    renderAlertInfo(currentAlert);
    renderAlertTimeline(currentAlert, history);
    renderActionButtons(currentAlert);
    
    // Setup audio player
    const playAudioBtn = document.getElementById('playAudio');
    if (playAudioBtn) {
      playAudioBtn.addEventListener('click', () => {
        if (currentAlert && currentAlert.type) {
          alertSounds.playForType(currentAlert.type);
          
          // Visual feedback
          const originalText = playAudioBtn.textContent;
          playAudioBtn.textContent = '🔊 Playing...';
          playAudioBtn.disabled = true;
          
          setTimeout(() => {
            playAudioBtn.textContent = originalText;
            playAudioBtn.disabled = false;
          }, 2000);
        }
      });
    }
    
    console.log('[alert-detail] Loaded alert:', currentAlert);
  } catch (err) {
    console.error('[alert-detail] Failed to load alert:', err);
    toast('Failed to load alert details', 'error');
  }
}

// Render alert header
function renderAlertHeader(alert) {
  const headerTitle = document.querySelector('.header-title h1');
  const alertBanner = document.querySelector('.alert-header-info h2');
  const alertMeta = document.querySelector('.alert-meta');
  const alertTimestamp = document.getElementById('alertTimestamp');
  const alertStatus = document.getElementById('alertStatus');

  const title = `${alert.type.replace(/_/g, ' ').toUpperCase()} - ${alert.house_id}`;
  
  if (headerTitle) headerTitle.textContent = `Alert Detail - ${title}`;
  if (alertBanner) alertBanner.textContent = title;
  
  if (alertMeta) {
    alertMeta.innerHTML = `
      <strong>Location:</strong> ${alert.house_id} |
      <strong>Device:</strong> ${alert.device_id} |
      <strong>Severity:</strong> ${getSeverityBadge(alert.severity)}
    `;
  }
  
  if (alertTimestamp) {
    const date = new Date(alert.ts || alert.created_at);
    alertTimestamp.textContent = `📅 ${date.toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }
  
  if (alertStatus) {
    const status = alert.status || alert.state || 'open';
    alertStatus.innerHTML = `
      <span class="status-dot status-${status}"></span>
      <span class="status-text">${getStatusText(status)}</span>
    `;
  }
}

// Get status text
function getStatusText(status) {
  const texts = {
    new: 'Awaiting acknowledgement',
    open: 'Awaiting acknowledgement',
    acknowledged: 'Acknowledged - Awaiting resolution',
    acked: 'Acknowledged - Awaiting resolution',
    escalated: 'Escalated - Requires immediate attention',
    resolved: 'Resolved'
  };
  return texts[status?.toLowerCase()] || 'Unknown status';
}

// Render alert info
function renderAlertInfo(alert) {
  const alertInfo = document.getElementById('alertInfo');
  if (!alertInfo) return;

  alertInfo.innerHTML = `
    <dt>Alert ID</dt>
    <dd><code>${alert.id}</code></dd>
    
    <dt>Type</dt>
    <dd>${alert.type.replace(/_/g, ' ')}</dd>
    
    <dt>Severity</dt>
    <dd>${getSeverityBadge(alert.severity)}</dd>
    
    <dt>Status</dt>
    <dd>${getStatusBadge(alert.status || alert.state)}</dd>
    
    <dt>House ID</dt>
    <dd>${alert.house_id}</dd>
    
    <dt>Device ID</dt>
    <dd>${alert.device_id}</dd>
    
    <dt>Tenant ID</dt>
    <dd>${alert.tenant_id}</dd>
    
    <dt>Score</dt>
    <dd>${alert.score ? (alert.score * 100).toFixed(1) + '%' : 'N/A'}</dd>
    
    <dt>Message</dt>
    <dd>${alert.message || 'No message'}</dd>
    
    <dt>Occurred At</dt>
    <dd>${new Date(alert.occurred_at || alert.ts).toLocaleString()}</dd>
    
    <dt>Created At</dt>
    <dd>${new Date(alert.created_at).toLocaleString()}</dd>
    
    ${alert.acknowledged_at ? `
      <dt>Acknowledged At</dt>
      <dd>${new Date(alert.acknowledged_at).toLocaleString()}</dd>
      <dt>Acknowledged By</dt>
      <dd>${alert.acknowledged_by || 'Unknown'}</dd>
    ` : ''}
    
    ${alert.escalated_at ? `
      <dt>Escalated At</dt>
      <dd>${new Date(alert.escalated_at).toLocaleString()}</dd>
      <dt>Escalation Level</dt>
      <dd>${alert.escalation_level || 'N/A'}</dd>
    ` : ''}
    
    ${alert.resolved_at ? `
      <dt>Resolved At</dt>
      <dd>${new Date(alert.resolved_at).toLocaleString()}</dd>
      <dt>Resolved By</dt>
      <dd>${alert.resolved_by || 'Unknown'}</dd>
    ` : ''}
  `;
}

// Render alert timeline
function renderAlertTimeline(alert, history) {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  const events = [];

  // Add creation event
  events.push({
    time: new Date(alert.created_at),
    icon: '🔔',
    title: 'Alert Created',
    description: `${alert.type.replace(/_/g, ' ')} alert detected`,
    type: 'created'
  });

  // Add history events
  history.forEach(h => {
    const eventTypes = {
      ack: { icon: '✓', title: 'Acknowledged', type: 'ack' },
      escalate: { icon: '⚠️', title: 'Escalated', type: 'escalate' },
      resolve: { icon: '✓', title: 'Resolved', type: 'resolve' }
    };

    const eventType = eventTypes[h.action] || { icon: '📝', title: h.action, type: 'other' };

    events.push({
      time: new Date(h.ts),
      icon: eventType.icon,
      title: eventType.title,
      description: h.note || `By ${h.actor}`,
      type: eventType.type,
      actor: h.actor
    });
  });

  // Sort by time (newest first)
  events.sort((a, b) => b.time - a.time);

  // Render timeline
  timeline.innerHTML = events.map(event => `
    <div class="timeline-item timeline-${event.type}">
      <div class="timeline-icon">${event.icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${event.title}</div>
        <div class="timeline-description">${event.description}</div>
        <div class="timeline-time">${event.time.toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

// Render action buttons based on alert state
function renderActionButtons(alert) {
  const actionGrid = document.querySelector('.action-grid');
  if (!actionGrid) return;

  const actions = getAvailableActions(alert);
  const buttons = [];

  if (actions.includes('acknowledge')) {
    buttons.push(`
      <button class="action-btn primary" data-action="acknowledge">
        ✓ Acknowledge Alert
      </button>
    `);
  }

  if (actions.includes('escalate')) {
    buttons.push(`
      <button class="action-btn emergency" data-action="escalate">
        ⚠️ Escalate Alert
      </button>
    `);
  }

  if (actions.includes('resolve')) {
    buttons.push(`
      <button class="action-btn primary" data-action="resolve">
        ✓ Resolve Alert
      </button>
    `);
  }

  // Always show these buttons
  buttons.push(`
    <button class="action-btn secondary" data-action="share">
      📤 Share with Family
    </button>
    <button class="action-btn secondary" data-action="download">
      💾 Download Details
    </button>
  `);

  actionGrid.innerHTML = buttons.join('');

  // Add event listeners
  actionGrid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
}

// Handle action button clicks
async function handleAction(action) {
  if (!currentAlert) return;

  switch (action) {
    case 'acknowledge':
      await handleAcknowledge();
      break;
    case 'escalate':
      await handleEscalate();
      break;
    case 'resolve':
      await handleResolve();
      break;
    case 'share':
      toast('Share functionality coming soon', 'info');
      break;
    case 'download':
      downloadAlertDetails();
      break;
    default:
      console.log('Unknown action:', action);
  }
}

// Handle acknowledge
async function handleAcknowledge() {
  const result = await acknowledgeAlert(currentAlert.id);
  
  if (result.success) {
    toast('Alert acknowledged successfully', 'success');
    // Reload the page to show updated state
    setTimeout(() => location.reload(), 1000);
  } else {
    toast(result.message, 'error');
    if (result.error === 'conflict') {
      setTimeout(() => location.reload(), 2000);
    }
  }
}

// Handle escalate
async function handleEscalate() {
  const note = prompt('Enter escalation note (optional):');
  if (note === null) return;
  
  const result = await escalateAlert(currentAlert.id, 'current_user', note);
  
  if (result.success) {
    toast('Alert escalated successfully', 'success');
    setTimeout(() => location.reload(), 1000);
  } else {
    toast(result.message, 'error');
    if (result.error === 'conflict') {
      setTimeout(() => location.reload(), 2000);
    }
  }
}

// Handle resolve
async function handleResolve() {
  showResolveModal();
}

// Show resolve modal
function showResolveModal() {
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
  
  const textarea = modal.querySelector('#resolve-note');
  textarea.focus();
  
  const closeModal = () => modal.remove();
  
  modal.querySelector('.resolve-modal-close').onclick = closeModal;
  modal.querySelector('.resolve-cancel').onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  modal.querySelector('.resolve-submit').onclick = async () => {
    const note = textarea.value.trim();
    const errorEl = modal.querySelector('#resolve-error');
    
    if (!note) {
      errorEl.textContent = 'Resolution note is required';
      textarea.focus();
      return;
    }
    
    const result = await resolveAlert(currentAlert.id, 'current_user', note);
    
    if (result.success) {
      toast('Alert resolved successfully', 'success');
      closeModal();
      setTimeout(() => location.reload(), 1000);
    } else {
      if (result.error === 'validation') {
        errorEl.textContent = result.message;
        textarea.focus();
      } else if (result.error === 'conflict') {
        toast(result.message, 'warning');
        closeModal();
        setTimeout(() => location.reload(), 2000);
      } else {
        errorEl.textContent = result.message;
      }
    }
  };
}

// Download alert details
function downloadAlertDetails() {
  const data = {
    alert: currentAlert,
    exported_at: new Date().toISOString(),
    exported_by: 'current_user'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alert-${currentAlert.id}-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast('Alert details downloaded', 'success');
}

// Initialize
loadAlertDetail();
