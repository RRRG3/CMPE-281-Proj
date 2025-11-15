// Alert action handlers with state-based button rules
import { post, del } from './api.js';

// Get available actions based on alert state/status
export function getAvailableActions(alert) {
  const status = alert.status || alert.state || 'open';
  const actions = [];

  switch (status.toLowerCase()) {
    case 'new':
    case 'open':
      actions.push('acknowledge', 'escalate');
      break;
    case 'acknowledged':
    case 'acked':
      actions.push('resolve');
      break;
    case 'escalated':
      actions.push('acknowledge', 'resolve');
      break;
    case 'resolved':
      // No actions available
      break;
    default:
      actions.push('acknowledge');
  }

  return actions;
}

// Acknowledge alert
export async function acknowledgeAlert(alertId, actor = 'current_user') {
  try {
    const response = await post(`/api/v1/alerts/${alertId}/ack`, { actor });
    return { success: true, data: response };
  } catch (error) {
    if (error.status === 409) {
      return { 
        success: false, 
        error: 'conflict',
        message: 'Alert already acknowledged or resolved. Refreshing...' 
      };
    }
    return { 
      success: false, 
      error: 'unknown',
      message: error.message || 'Failed to acknowledge alert' 
    };
  }
}

// Escalate alert
export async function escalateAlert(alertId, actor = 'current_user', note = '') {
  try {
    const response = await post(`/api/v1/alerts/${alertId}/escalate`, { actor, note });
    return { success: true, data: response };
  } catch (error) {
    if (error.status === 409) {
      return { 
        success: false, 
        error: 'conflict',
        message: 'Alert state has changed. Refreshing...' 
      };
    }
    return { 
      success: false, 
      error: 'unknown',
      message: error.message || 'Failed to escalate alert' 
    };
  }
}

// Resolve alert
export async function resolveAlert(alertId, actor = 'current_user', note = '') {
  if (!note || note.trim() === '') {
    return {
      success: false,
      error: 'validation',
      message: 'Resolution note is required'
    };
  }

  try {
    const response = await post(`/api/v1/alerts/${alertId}/resolve`, { actor, note });
    return { success: true, data: response };
  } catch (error) {
    if (error.status === 422) {
      return { 
        success: false, 
        error: 'validation',
        message: 'Resolution note is required' 
      };
    }
    if (error.status === 409) {
      return { 
        success: false, 
        error: 'conflict',
        message: 'Alert already resolved. Refreshing...' 
      };
    }
    return { 
      success: false, 
      error: 'unknown',
      message: error.message || 'Failed to resolve alert' 
    };
  }
}

// Delete alert
export async function deleteAlert(alertId) {
  try {
    const data = await del(`/api/v1/alerts/${alertId}`);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: 'unknown',
      message: error.message || 'Failed to delete alert' 
    };
  }
}

// Bulk acknowledge alerts
export async function bulkAcknowledgeAlerts(alertIds, actor = 'current_user') {
  const results = {
    success: [],
    failed: [],
    total: alertIds.length
  };

  for (const alertId of alertIds) {
    const result = await acknowledgeAlert(alertId, actor);
    if (result.success) {
      results.success.push(alertId);
    } else {
      results.failed.push({ alertId, error: result.message });
    }
  }

  return results;
}

// Create action buttons based on alert state
export function createActionButtons(alert, callbacks = {}) {
  const actions = getAvailableActions(alert);
  const buttons = [];

  if (actions.includes('acknowledge')) {
    const ackBtn = document.createElement('button');
    ackBtn.className = 'btn btn-sm btn-success';
    ackBtn.textContent = '✓ Acknowledge';
    ackBtn.onclick = () => callbacks.onAcknowledge?.(alert);
    buttons.push(ackBtn);
  }

  if (actions.includes('escalate')) {
    const escalateBtn = document.createElement('button');
    escalateBtn.className = 'btn btn-sm btn-warning';
    escalateBtn.textContent = '⚠️ Escalate';
    escalateBtn.onclick = () => callbacks.onEscalate?.(alert);
    buttons.push(escalateBtn);
  }

  if (actions.includes('resolve')) {
    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'btn btn-sm btn-primary';
    resolveBtn.textContent = '✓ Resolve';
    resolveBtn.onclick = () => callbacks.onResolve?.(alert);
    buttons.push(resolveBtn);
  }

  return buttons;
}

// Get severity badge HTML
export function getSeverityBadge(severity) {
  const badges = {
    critical: '<span class="badge badge-danger">🔴 Critical</span>',
    high: '<span class="badge badge-warning">🟠 High</span>',
    medium: '<span class="badge badge-info">🟡 Medium</span>',
    low: '<span class="badge badge-success">🟢 Low</span>'
  };
  return badges[severity?.toLowerCase()] || badges.low;
}

// Get status badge HTML
export function getStatusBadge(status) {
  const badges = {
    new: '<span class="badge badge-info">New</span>',
    open: '<span class="badge badge-info">Open</span>',
    acknowledged: '<span class="badge badge-success">Acknowledged</span>',
    acked: '<span class="badge badge-success">Acknowledged</span>',
    escalated: '<span class="badge badge-warning">Escalated</span>',
    resolved: '<span class="badge badge-secondary">Resolved</span>'
  };
  return badges[status?.toLowerCase()] || badges.open;
}
