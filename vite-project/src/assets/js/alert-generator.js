// Alert Generator - Allows manual generation of test alerts
import { post } from './api.js';
import { loadAlerts } from './alerts-list-enhanced.js';

const toast = window.showToast || console.log;

// Alert type configurations with descriptions
const alertTypes = {
  glass_break: { label: 'Glass Break', icon: '🔊', description: 'Broken glass detected' },
  smoke_alarm: { label: 'Smoke Alarm', icon: '🔥', description: 'Smoke detector triggered' },
  dog_bark: { label: 'Dog Bark', icon: '🐕', description: 'Pet activity detected' },
  fall: { label: 'Fall Detected', icon: '🚨', description: 'Potential fall incident' },
  no_motion: { label: 'No Motion', icon: '⏱️', description: 'No movement detected' },
  unusual_noise: { label: 'Unusual Noise', icon: '🔔', description: 'Unexpected sound detected' },
  door_open: { label: 'Door Open', icon: '🚪', description: 'Door opened unexpectedly' }
};

// Generate a random alert
async function generateRandomAlert() {
  const types = Object.keys(alertTypes);
  const randomType = types[Math.floor(Math.random() * types.length)];
  return generateAlert(randomType, 'auto');
}

// Generate a specific alert
async function generateAlert(type, severity = 'auto') {
  const currentTenant = window.currentTenant;
  
  if (!currentTenant) {
    toast('Please select a tenant first', 'error');
    return { success: false, error: 'No tenant selected' };
  }
  
  const alertConfig = alertTypes[type] || alertTypes.glass_break;
  
  const payload = {
    tenant_id: currentTenant.tenant_id,
    house_id: currentTenant.house_id || 'H-001',
    device_id: `DEV-${Math.floor(Math.random() * 100)}`,
    type: type,
    message: alertConfig.description,
    score: Math.random() * 0.5 + 0.5, // Random score between 0.5 and 1.0
    ts: new Date().toISOString()
  };
  
  // Add manual severity if not auto
  if (severity !== 'auto') {
    payload.severity = severity;
  }
  
  try {
    toast(`${alertConfig.icon} Generating ${alertConfig.label} alert...`, 'info');
    
    const response = await post('/api/v1/alerts/ingest', payload);
    
    if (response.id) {
      const severityText = response.severity.toUpperCase();
      toast(`✓ Alert generated: ${alertConfig.label} (${severityText})`, 'success');
      
      // Reload alerts to show the new one
      setTimeout(() => {
        loadAlerts();
        
        // Refresh the chart if we're on the dashboard
        if (window.refreshDashboardChart) {
          window.refreshDashboardChart();
        }
      }, 500);
      
      return { success: true, alert: response };
    } else {
      toast('Failed to generate alert', 'error');
      return { success: false, error: 'No alert ID returned' };
    }
  } catch (err) {
    console.error('[alert-generator] Error:', err);
    toast(`Error generating alert: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

// Clear all alerts
async function clearAllAlerts() {
  if (!confirm('Are you sure you want to delete ALL alerts? This action cannot be undone.')) {
    return { success: false, cancelled: true };
  }
  
  try {
    toast('🗑️ Clearing all alerts...', 'info');
    
    const response = await fetch('http://localhost:3000/api/v1/alerts/clear-all', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      toast(`✓ Cleared ${result.deleted} alerts`, 'success');
      
      // Reload alerts
      setTimeout(() => {
        loadAlerts();
      }, 500);
      
      return { success: true, deleted: result.deleted };
    } else {
      toast('Failed to clear alerts', 'error');
      return { success: false, error: 'Request failed' };
    }
  } catch (err) {
    console.error('[alert-generator] Clear error:', err);
    toast(`Error clearing alerts: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

// Initialize button handlers
function initAlertGenerator() {
  const genCustomBtn = document.getElementById('gen-custom');
  const clearAllBtn = document.getElementById('clear-all-alerts');
  const alertTypeSelect = document.getElementById('alert-type-select');
  const alertSeveritySelect = document.getElementById('alert-severity-select');
  
  if (genCustomBtn) {
    genCustomBtn.addEventListener('click', async () => {
      const currentTenant = window.currentTenant;
      
      if (!currentTenant) {
        toast('⚠️ Please select a tenant first', 'warning');
        return;
      }
      
      const type = alertTypeSelect?.value || 'glass_break';
      const severity = alertSeveritySelect?.value || 'auto';
      
      console.log(`[alert-generator] Generating alert for tenant: ${currentTenant.name} (${currentTenant.tenant_id})`);
      
      if (type === 'random') {
        await generateRandomAlert();
      } else {
        await generateAlert(type, severity);
      }
    });
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      await clearAllAlerts();
    });
  }
  
  console.log('[alert-generator] Initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlertGenerator);
} else {
  initAlertGenerator();
}

export { generateAlert, generateRandomAlert, clearAllAlerts, alertTypes };
