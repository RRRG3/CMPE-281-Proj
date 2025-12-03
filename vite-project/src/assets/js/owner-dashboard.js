import { Chart, registerables } from 'chart.js';
import { post, get, put, del } from './api.js';
import alertSounds from './alert-sounds.js';
import { createFloorPlan, toggleFloorPlanView } from './floor-plan.js';
import { initSearchFilter } from './search-filter.js';
import { initExportSystem } from './export-reports.js';
import { showToast } from './toast.js';

Chart.register(...registerables);

document.addEventListener('DOMContentLoaded', async () => {
  const kpiGrid = document.getElementById('kpiGrid');
  const alertList = document.getElementById('alertList');
  const weeklyStats = document.getElementById('weeklyStats');
  const deviceGrid = document.getElementById('deviceGrid');
  const deviceModal = document.getElementById('deviceModal');
  const deviceForm = document.getElementById('deviceForm');
  const alertFilterModal = document.getElementById('alertFilterModal');
  const alertFilterForm = document.getElementById('alertFilterForm');
  const toast = window.showToast || (() => {});

  // Current selected tenant/owner
  let currentTenant = null;
  let allTenants = [];

  // Load tenants and populate selector
  async function loadTenants() {
    try {
      console.log('[owner] Loading tenants from API...');
      const response = await get('/api/v1/tenants');
      allTenants = response.items || [];
      
      console.log('[owner] Loaded tenants:', allTenants.length, allTenants);
      
      const selector = document.getElementById('owner-selector');
      if (!selector) {
        console.error('[owner] Tenant selector not found in DOM!');
        return;
      }
      
      selector.innerHTML = allTenants.map(t => 
        `<option value="${t.tenant_id}">${t.name}</option>`
      ).join('');
      
      console.log('[owner] Populated selector with', allTenants.length, 'options');
      
      // Check if there's a saved tenant selection in localStorage
      const savedTenantId = localStorage.getItem('selectedTenantId');
      let selectedTenant = null;
      
      if (savedTenantId) {
        selectedTenant = allTenants.find(t => t.tenant_id === savedTenantId);
        console.log('[owner] Found saved tenant:', savedTenantId, selectedTenant ? 'exists' : 'not found');
      }
      
      // If no saved tenant or saved tenant not found, use first tenant
      if (!selectedTenant && allTenants.length > 0) {
        selectedTenant = allTenants[0];
        console.log('[owner] Using first tenant as default:', selectedTenant.name);
      }
      
      if (selectedTenant) {
        currentTenant = selectedTenant;
        selector.value = selectedTenant.tenant_id;
        updateUIForTenant(currentTenant);
        console.log('[owner] Set default tenant:', currentTenant.name);
      }
    } catch (err) {
      console.error('[owner] Failed to load tenants:', err);
    }
  }

  // Update UI with tenant info
  function updateUIForTenant(tenant) {
    document.getElementById('current-tenant-name').textContent = tenant.name;
    document.getElementById('user-name').textContent = tenant.name;
    
    // Create initials for avatar
    const initials = tenant.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    
    // Update tenant indicator in Live Alerts section
    const tenantIndicator = document.getElementById('current-tenant-indicator');
    if (tenantIndicator) {
      tenantIndicator.textContent = tenant.name;
    }
    
    // Store current tenant globally for other scripts to access
    window.currentTenant = tenant;
    
    console.log(`[owner] Switched to tenant: ${tenant.name}`);
  }

  // Handle tenant selection change
  document.getElementById('owner-selector')?.addEventListener('change', (e) => {
    const tenantId = e.target.value;
    currentTenant = allTenants.find(t => t.tenant_id === tenantId);
    if (currentTenant) {
      // Save selection to localStorage
      localStorage.setItem('selectedTenantId', currentTenant.tenant_id);
      console.log('[owner] Saved tenant selection:', currentTenant.tenant_id);
      
      updateUIForTenant(currentTenant);
      toast(`Switching to ${currentTenant.name}...`, 'info');
      
      // Reload data for new tenant
      setTimeout(() => {
        location.reload();
      }, 300);
    }
  });

  // Load tenants first
  await loadTenants();
  
  console.log('[owner] Current tenant after load:', currentTenant);

  // Function to fetch alerts for current tenant
  async function fetchAlertsForTenant() {
    let realAlerts = [];
    try {
      const searchParams = { limit: 10 };
      if (currentTenant) {
        searchParams.tenant_id = currentTenant.tenant_id;
        console.log('[owner] Fetching alerts for tenant:', currentTenant.tenant_id);
      } else {
        console.warn('[owner] No current tenant, fetching all alerts');
      }
      const response = await post('/api/v1/alerts/search', searchParams);
      realAlerts = response.items || [];
      console.log('[owner] Loaded alerts:', realAlerts.length, realAlerts);
      
      if (realAlerts.length === 0) {
        console.warn('[owner] No alerts found for tenant:', currentTenant?.tenant_id);
      }
    } catch (err) {
      console.error('[owner] Failed to load alerts:', err);
      toast('Failed to load alerts. Please refresh the page.', 'error');
    }
    return realAlerts;
  }

  // Fetch real alerts from backend (filtered by current tenant)
  let realAlerts = await fetchAlertsForTenant();

  const kpis = [
    {
      label: 'Active Devices',
      value: '8/8',
      trend: '✓ All systems online',
      tone: 'success',
      color: '#10b981'
    },
    {
      label: 'System Status',
      value: 'Healthy',
      trend: '99.9% uptime this month',
      tone: 'info',
      color: '#3b82f6'
    },
    {
      label: 'Alerts Today',
      value: '5',
      trend: '↑ 2 more than yesterday',
      tone: 'warning',
      color: '#f59e0b'
    },
    {
      label: 'Urgent Alerts',
      value: '1',
      trend: '⚠ Requires attention',
      tone: 'danger',
      color: '#ef4444'
    }
  ];

  // Convert real alerts to display format
  function getAlertIcon(type, severity) {
    if (type === 'glass_break') return '🔊';
    if (type === 'smoke_alarm') return '🔥';
    if (type === 'dog_bark') return '🐕';
    if (severity === 'critical') return '🚨';
    if (severity === 'high') return '⚠️';
    return '📢';
  }

  function getAlertType(severity) {
    if (severity === 'critical') return 'danger';
    if (severity === 'high') return 'warning';
    return 'info';
  }

  function formatTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  }

  const alertItems = realAlerts.slice(0, 4).map(alert => ({
    id: alert.id,
    type: getAlertType(alert.severity),
    icon: getAlertIcon(alert.type, alert.severity),
    title: `${alert.type.replace(/_/g, ' ').toUpperCase()} - ${alert.house_id}`,
    meta: `Severity: ${alert.severity} | Device: ${alert.device_id} | ${alert.message || 'No message'}`,
    time: formatTimeAgo(alert.ts)
  }));

  const weeklyStatsData = [
    { label: 'Total Alerts', value: '32' },
    { label: 'Avg Response', value: '2.1s' },
    { label: 'False Positives', value: '3' },
    { label: 'ML Accuracy', value: '94%' }
  ];

  function renderWeeklyStats() {
    if (!weeklyStats) return;
    weeklyStats.innerHTML = '';
    weeklyStatsData.forEach((stat) => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      box.innerHTML = `
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
      `;
      weeklyStats.appendChild(box);
    });
  }

  // Load devices from API based on current tenant
  let deviceData = [];
  
  async function loadDevicesForTenant() {
    try {
      const tenantId = currentTenant?.tenant_id;
      console.log(`[owner] Loading devices for tenant: ${tenantId}`);
      
      if (!tenantId) {
        console.warn('[owner] No tenant selected, loading all devices');
      }
      
      const url = tenantId ? `/api/v1/devices?tenant_id=${tenantId}` : '/api/v1/devices';
      const response = await get(url);
      const devices = response.items || [];
      
      console.log(`[owner] Received ${devices.length} devices from API`);
      
      // Map device icons
      const iconMap = {
        'microphone': '🔊 Audio Sensor',
        'camera': '📹 Video Camera',
        'motion_sensor': '🚶 Motion Sensor',
        'door_sensor': '🚪 Door Sensor'
      };
      
      deviceData = devices.map(d => ({
        id: d.id,  // Internal database ID (needed for deletion)
        device_id: d.device_id,  // User-facing device ID
        name: `${d.location} ${d.type}`,
        location: d.location,
        type: iconMap[d.type] || '📡 ' + d.type,
        status: d.status,
        lastSeen: d.last_seen ? formatTimeAgo(d.last_seen) : 'Unknown'
      }));
      
      console.log(`[owner] Loaded ${deviceData.length} devices for tenant ${tenantId}`);
      return deviceData;
    } catch (err) {
      console.error('[owner] Failed to load devices:', err);
      return [];
    }
  }
  
  // Devices will be loaded when renderDevices() is called in initPage()

  const historyRows = [
    {
      timestamp: '2025-10-05 21:32',
      alert: 'Fall Detected - Bedroom',
      device: 'BED-CAM-01',
      severity: 'critical',
      status: 'Acknowledged'
    },
    {
      timestamp: '2025-10-05 19:14',
      alert: 'No Movement Detected',
      device: 'BR-MOTION-02',
      severity: 'warning',
      status: 'Investigating'
    },
    {
      timestamp: '2025-10-05 18:01',
      alert: 'Pet Activity - Living Room',
      device: 'LR-CAM-03',
      severity: 'info',
      status: 'Normal'
    }
  ];

  function renderKpis() {
    if (!kpiGrid) return;
    kpiGrid.innerHTML = '';
    kpis.forEach((kpi) => {
      const card = document.createElement('div');
      card.className = `kpi-card ${kpi.tone}`;
      card.innerHTML = `
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value" style="color: ${kpi.color};">${kpi.value}</div>
        <div class="kpi-trend">${kpi.trend}</div>
      `;
      kpiGrid.appendChild(card);
    });
  }

  function renderAlerts(list = alertItems) {
    if (!alertList) return;
    alertList.innerHTML = '';
    
    if (list.length === 0) {
      alertList.innerHTML = '<p style="padding: 1rem; text-align: center; color: #666;">No recent alerts</p>';
      return;
    }
    
    list.forEach((alert) => {
      const item = document.createElement('article');
      item.className = `alert-item ${alert.type}`;
      item.innerHTML = `
        <div class="alert-icon ${alert.type}" aria-hidden="true">${alert.icon}</div>
        <div class="alert-content">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-meta">${alert.meta}</div>
        </div>
        <div class="alert-time">${alert.time}</div>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        // Use the real alert ID if available
        const alertId = alert.id || '';
        window.location.href = `alert-detail.html${alertId ? '?id=' + alertId : ''}`;
      });
      alertList.appendChild(item);
    });
  }

  async function renderChart() {
    const ctx = document.getElementById('alertChart');
    if (!ctx) return;

    try {
      // Fetch real weekly trends from backend
      const tenantId = currentTenant?.tenant_id;
      const url = tenantId ? `/api/v1/alerts/weekly-trends?tenant_id=${tenantId}` : '/api/v1/alerts/weekly-trends';
      const response = await get(url);
      const trends = response.trends || [];
      
      const labels = trends.map(t => t.day);
      const data = trends.map(t => t.count);
      
      // Create gradient for professional look
      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.15)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Alerts',
            data: data,
            backgroundColor: gradient,
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(99, 102, 241)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: 'rgb(79, 70, 229)',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: {
                  size: 12,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                color: '#6b7280',
                padding: 8
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false,
              },
              border: {
                display: false
              }
            },
            x: {
              ticks: {
                font: {
                  size: 12,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  weight: '500'
                },
                color: '#374151',
                padding: 8
              },
              grid: {
                display: false,
                drawBorder: false,
              },
              border: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#fff',
              bodyColor: '#fff',
              titleFont: {
                size: 14,
                weight: '600',
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              },
              bodyFont: {
                size: 13,
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              },
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              borderColor: 'rgba(99, 102, 241, 0.3)',
              borderWidth: 1,
              callbacks: {
                title: function(context) {
                  const index = context[0].dataIndex;
                  return `${trends[index].day}, ${trends[index].date}`;
                },
                label: function(context) {
                  const count = context.parsed.y;
                  return `${count} ${count === 1 ? 'Alert' : 'Alerts'}`;
                }
              }
            }
          }
        }
      });
      
      console.log('[OWNER] Weekly trends loaded:', trends);
    } catch (err) {
      console.error('[OWNER] Failed to load weekly trends:', err);
      // Fallback to empty chart with professional styling
      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.15)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Alerts',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: gradient,
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(99, 102, 241)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: {
                  size: 12,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                color: '#6b7280',
                padding: 8
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false,
              },
              border: {
                display: false
              }
            },
            x: {
              ticks: {
                font: {
                  size: 12,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  weight: '500'
                },
                color: '#374151',
                padding: 8
              },
              grid: {
                display: false,
                drawBorder: false,
              },
              border: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }

  async function renderDevices() {
    // Reload devices from API
    await loadDevicesForTenant();
    
    // Render floor plan
    createFloorPlan(deviceData);
    
    // Render device grid (list view)
    if (!deviceGrid) return;
    deviceGrid.innerHTML = '';
    deviceGrid.style.display = 'none'; // Start with map view
    
    deviceData.forEach((device, index) => {
      const card = document.createElement('article');
      card.className = 'device-card';
      card.style.cursor = 'pointer';
      card.style.position = 'relative';
      card.innerHTML = `
        <button class="device-remove-btn" data-index="${index}" style="position: absolute; top: 8px; right: 8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" title="Remove device">×</button>
        <div class="device-status">
            <div class="status-dot ${device.status}"></div>
            <span class="status-text ${device.status}">${device.status.toUpperCase()}</span>
        </div>
        <div class="device-name">${device.name}</div>
        <div class="device-info">📍 ${device.location}</div>
        <div class="device-info">${device.type}</div>
        <div class="device-info">⏱️ ${device.lastSeen}</div>
      `;
      
      // Show remove button on hover
      card.addEventListener('mouseenter', () => {
        const removeBtn = card.querySelector('.device-remove-btn');
        if (removeBtn) removeBtn.style.opacity = '1';
      });
      
      card.addEventListener('mouseleave', () => {
        const removeBtn = card.querySelector('.device-remove-btn');
        if (removeBtn) removeBtn.style.opacity = '0';
      });
      
      // Remove button handler
      const removeBtn = card.querySelector('.device-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeDevice(device, index);
        });
      }
      
      card.addEventListener('click', () => {
        toast(`📱 Opening ${device.name} details...`, 'info');
        console.log('[OWNER] Device clicked:', device);
        setTimeout(() => {
          toast(`Device: ${device.name} | Status: ${device.status} | Location: ${device.location}`, 'success');
        }, 500);
      });
      deviceGrid.appendChild(card);
    });
    
    // Add toggle button handler
    const toggleBtn = document.getElementById('toggleView');
    if (toggleBtn) {
      toggleBtn.removeEventListener('click', toggleFloorPlanView); // Remove old listener
      toggleBtn.addEventListener('click', toggleFloorPlanView);
    }
  }
  
  // Remove device function
  async function removeDevice(device, index) {
    if (!confirm(`Are you sure you want to remove "${device.name}"?\n\nThis device will be permanently deleted from the database.`)) {
      return;
    }
    
    toast(`🗑️ Removing ${device.name}...`, 'info');
    
    try {
      // Get the device ID - it might be in device.id or device.device_id
      const deviceId = device.id || device.device_id;
      
      if (!deviceId) {
        console.error('[OWNER] No device ID found:', device);
        toast('Error: Device ID not found', 'error');
        return;
      }
      
      // Call API to delete device from database
      const result = await del(`/api/v1/devices/${deviceId}`);
      
      toast(`✓ ${device.name} has been removed`, 'success');
      console.log('[OWNER] Device deleted from database:', device.name);
      
      // Reload devices to refresh the display
      await renderDevices(); // del will throw if it fails, so success here means OK
    } catch (err) {
      console.error('[OWNER] Error removing device:', err);
      toast(`Error removing device: ${err.message}`, 'error');
    }
  }
  
  // Make removeDevice available globally for floor plan
  window.removeDevice = removeDevice;

  async function renderHistory() {
    const historyTable = document.querySelector('#historyTable tbody');
    if (!historyTable) return;
    
    try {
      // Fetch real alert history from backend (filtered by current tenant)
      const searchParams = { limit: 100 };
      if (currentTenant?.tenant_id) {
        searchParams.tenant_id = currentTenant.tenant_id;
      }
      
      const response = await post('/api/v1/alerts/search', searchParams);
      const alerts = response.items || [];
      
      historyTable.innerHTML = '';
      
      if (alerts.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No alert history available for this tenant</td></tr>';
        return;
      }
      
      alerts.forEach((alert) => {
        const tr = document.createElement('tr');
        const timestamp = new Date(alert.ts || alert.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Format alert type nicely
        const alertType = alert.type.replace(/_/g, ' ').split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        const statusText = alert.status.charAt(0).toUpperCase() + alert.status.slice(1);
        
        // Severity badge colors
        const severityColors = {
          'critical': 'danger',
          'high': 'warning',
          'medium': 'info',
          'low': 'success'
        };
        const severityBadge = severityColors[alert.severity] || 'info';
        
        // Status badge colors
        const statusColors = {
          'resolved': 'success',
          'acknowledged': 'info',
          'open': 'warning',
          'escalated': 'danger'
        };
        const statusBadge = statusColors[alert.status] || 'warning';
        
        tr.innerHTML = `
          <td style="white-space: nowrap;">${timestamp}</td>
          <td><strong>${alertType}</strong><br><small style="color: #666;">${alert.message || 'No description'}</small></td>
          <td><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">${alert.device_id}</code></td>
          <td><span class="badge ${severityBadge}">${alert.severity.toUpperCase()}</span></td>
          <td><span class="badge ${statusBadge}">${statusText}</span></td>
        `;
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background-color 0.2s';
        tr.addEventListener('mouseenter', () => {
          tr.style.backgroundColor = '#f9fafb';
        });
        tr.addEventListener('mouseleave', () => {
          tr.style.backgroundColor = '';
        });
        tr.addEventListener('click', () => {
          window.location.href = `alert-detail.html?id=${alert.id}`;
        });
        historyTable.appendChild(tr);
      });
      
      console.log('[OWNER] Alert history loaded:', alerts.length, 'alerts');
    } catch (err) {
      console.error('[OWNER] Failed to load alert history:', err);
      historyTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load alert history</td></tr>';
    }
  }

  function initNav() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    navItems.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.section;
        navItems.forEach((nav) => nav.classList.toggle('active', nav === button));
        sections.forEach((section) => {
          section.classList.toggle('hidden', section.dataset.section !== target);
        });
      });
    });

    if (window.location.hash === '#admin') {
      const settingsNav = document.querySelector('.nav-item[data-section="settings"]');
      if (settingsNav) settingsNav.click();
    }
  }

  function initQuickActions() {
    document.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        switch (action) {
          case 'emergency':
            // Trigger emergency alert
            showToast('🚨 Triggering emergency alert...', 'warning');
            try {
              await post('/api/v1/alerts/ingest', {
                house_id: currentTenant?.house_id || 'EMERGENCY',
                device_id: 'MANUAL_TRIGGER',
                type: 'emergency',
                severity: 'critical',
                message: 'Emergency button pressed by user',
                tenant: currentTenant?.tenant_id || 'default'
              });
              showToast('✓ Emergency services notified!', 'success');
              // Reload alerts to show the new emergency alert
              await renderAlerts();
            } catch (err) {
              showToast('Failed to trigger emergency alert', 'error');
              console.error('[owner] Emergency alert failed:', err);
            }
            break;
            
          case 'acknowledge-all':
            // Acknowledge all alerts
            showToast('Acknowledging all alerts...', 'info');
            try {
              const response = await post('/api/v1/alerts/acknowledge-all', {
                tenant: currentTenant?.tenant_id || 'default'
              });
              showToast(`✓ ${response.count || 'All'} alerts acknowledged!`, 'success');
              await renderAlerts();
            } catch (err) {
              showToast('Failed to acknowledge alerts', 'error');
              console.error(err);
            }
            break;
            
          case 'generate-report':
            // Generate and download weekly report
            showToast('📊 Generating weekly report...', 'info');
            try {
              const alerts = await post('/api/v1/alerts/search', { 
                tenant: currentTenant?.tenant_id,
                limit: 100 
              });
              
              // Create report data
              const report = {
                tenant: currentTenant?.name || 'Unknown',
                generated: new Date().toISOString(),
                period: 'Last 7 Days',
                summary: {
                  total_alerts: alerts.items?.length || 0,
                  critical: alerts.items?.filter(a => a.severity === 'critical').length || 0,
                  high: alerts.items?.filter(a => a.severity === 'high').length || 0,
                  medium: alerts.items?.filter(a => a.severity === 'medium').length || 0,
                  low: alerts.items?.filter(a => a.severity === 'low').length || 0
                },
                alerts: alerts.items || []
              };
              
              // Download as JSON
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              
              showToast('✓ Weekly report downloaded!', 'success');
            } catch (err) {
              showToast('Failed to generate report', 'error');
              console.error(err);
            }
            break;
            
          case 'device-settings':
            // Open device management modal
            showToast('Opening device settings...', 'info');
            if (deviceModal && deviceModal.showModal) {
              deviceModal.showModal();
            }
            break;
            
          default:
            showToast('Action executed.', 'success');
        }
      });
    });
  }

  function initDialogs() {
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    const alertFilterBtn = document.getElementById('alertFilterBtn');

    if (addDeviceBtn && deviceModal && deviceModal.showModal) {
      addDeviceBtn.addEventListener('click', () => deviceModal.showModal());
    }

    if (alertFilterBtn && alertFilterModal && alertFilterModal.showModal) {
      alertFilterBtn.addEventListener('click', () => alertFilterModal.showModal());
    }

    if (deviceForm) {
      deviceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(deviceForm);
        
        const devicePayload = {
          house_id: currentTenant?.house_id || null,
          device_type: formData.get('type'),
          name: formData.get('name'),
          tenant: currentTenant?.tenant_id || 'default',
          location: formData.get('location'),
          type: formData.get('type'),
          status: formData.get('status'),
          firmware: 'v2.4.1',
          config: {}
        };
        
        try {
          toast(`Adding ${devicePayload.name}...`, 'info');
          
          const response = await post('/api/v1/devices', devicePayload);
          
          if (response.id || response.device_id) {
            toast(`✓ ${devicePayload.name} added successfully!`, 'success');
            
            // Reload devices to show the new one
            await renderDevices();
            
            deviceForm.reset();
            deviceModal.close();
          } else {
            toast('Failed to add device', 'error');
          }
        } catch (err) {
          console.error('[owner] Failed to add device:', err);
          toast(`Error adding device: ${err.message}`, 'error');
        }
      });

      deviceForm.addEventListener('reset', () => {
        deviceModal.close();
      });
    }

    if (alertFilterForm) {
      alertFilterForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(alertFilterForm);
        const severity = formData.get('severity');
        const status = formData.get('status');
        const type = formData.get('type');

        toast('🔍 Filtering alerts...', 'info');

        try {
          // Build filter params
          const filterParams = { limit: 50 };
          if (severity) filterParams.severity = severity;
          if (status) filterParams.status = status;
          if (type) filterParams.type = type;

          // Fetch filtered alerts from backend
          const response = await post('/api/v1/alerts/search', filterParams);
          const filteredAlerts = response.items || [];

          // Convert to display format
          const displayAlerts = filteredAlerts.slice(0, 10).map(alert => ({
            id: alert.id,
            type: getAlertType(alert.severity),
            icon: getAlertIcon(alert.type, alert.severity),
            title: `${alert.type.replace(/_/g, ' ').toUpperCase()} - ${alert.house_id}`,
            meta: `Severity: ${alert.severity} | Device: ${alert.device_id} | ${alert.message || 'No message'}`,
            time: formatTimeAgo(alert.ts)
          }));

          renderAlerts(displayAlerts);
          toast(`✓ Found ${filteredAlerts.length} alerts matching your filters`, 'success');
          alertFilterModal.close();
        } catch (err) {
          console.error('Filter error:', err);
          toast('Failed to filter alerts', 'error');
        }
      });

      alertFilterForm.addEventListener('reset', () => {
        renderAlerts(alertItems);
        toast('Filters cleared.', 'success');
        alertFilterModal.close();
      });
    }
    
    // Device Details Modal
    const deviceDetailsModal = document.getElementById('deviceDetailsModal');
    const closeDetailsBtn = document.getElementById('closeDetailsBtn');
    const removeDeviceBtn = document.getElementById('removeDeviceBtn');
    
    if (closeDetailsBtn && deviceDetailsModal) {
      closeDetailsBtn.addEventListener('click', () => {
        deviceDetailsModal.close();
      });
    }
    
    // Make openDeviceModal available globally
    window.openDeviceModal = (device) => {
      if (!deviceDetailsModal) return;
      
      const title = document.getElementById('deviceDetailsTitle');
      const content = document.getElementById('deviceDetailsContent');
      
      if (title) title.textContent = device.name;
      if (content) {
        content.innerHTML = `
          <div style="display: grid; gap: 1rem;">
            <div><strong>Location:</strong> ${device.location}</div>
            <div><strong>Type:</strong> ${device.type}</div>
            <div><strong>Status:</strong> <span style="color: ${device.status === 'online' ? '#4caf50' : '#f44336'}">${device.status.toUpperCase()}</span></div>
            <div><strong>Last Seen:</strong> ${device.lastSeen}</div>
          </div>
        `;
      }
      
      // Set up remove button
      if (removeDeviceBtn) {
        removeDeviceBtn.onclick = () => {
          deviceDetailsModal.close();
          removeDevice(device);
        };
      }
      
      deviceDetailsModal.showModal();
    };
  }

  function initHistoryActions() {
    const applyFilterBtn = document.getElementById('applyHistoryFilter');
    const clearFilterBtn = document.getElementById('clearHistoryFilter');
    const exportButton = document.querySelector('[data-action="history-export"]');
    
    // Apply filter button
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', async () => {
        const severity = document.getElementById('historySeverity')?.value;
        const status = document.getElementById('historyStatus')?.value;
        
        toast('🔍 Filtering alert history...', 'info');
        
        try {
          const filterParams = { limit: 100 };
          if (severity) filterParams.severity = severity;
          if (status) filterParams.status = status;
          
          const response = await post('/api/v1/alerts/search', filterParams);
          const alerts = response.items || [];
          
          const historyTable = document.querySelector('#historyTable tbody');
          if (!historyTable) return;
          
          historyTable.innerHTML = '';
          
          if (alerts.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No alerts match your filters</td></tr>';
            toast('No alerts found', 'info');
            return;
          }
          
          alerts.forEach((alert) => {
            const tr = document.createElement('tr');
            const timestamp = new Date(alert.ts || alert.created_at).toLocaleString();
            const alertTitle = `${alert.type.replace(/_/g, ' ')} - ${alert.house_id}`;
            const statusText = alert.status.charAt(0).toUpperCase() + alert.status.slice(1);
            
            tr.innerHTML = `
              <td>${timestamp}</td>
              <td>${alertTitle}</td>
              <td>${alert.device_id}</td>
              <td class="history-${alert.severity}"><span class="badge ${alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}">${alert.severity.toUpperCase()}</span></td>
              <td><span class="badge ${alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'info' : 'warning'}">${statusText}</span></td>
            `;
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => {
              window.location.href = `alert-detail.html?id=${alert.id}`;
            });
            historyTable.appendChild(tr);
          });
          
          toast(`✓ Found ${alerts.length} alerts`, 'success');
        } catch (err) {
          console.error('Filter error:', err);
          toast('Failed to filter alerts', 'error');
        }
      });
    }
    
    // Clear filter button
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        document.getElementById('historySeverity').value = '';
        document.getElementById('historyStatus').value = '';
        renderHistory();
        toast('Filters cleared', 'success');
      });
    }
    
    // Export button
    if (exportButton) {
      exportButton.addEventListener('click', async () => {
        toast('📥 Exporting alert history...', 'info');
        
        try {
          const response = await post('/api/v1/alerts/search', { limit: 1000 });
          const alerts = response.items || [];
          
          // Generate CSV
          const headers = ['Timestamp', 'Alert Type', 'House', 'Device', 'Severity', 'Status', 'Message'];
          const csvRows = [headers.join(',')];
          
          alerts.forEach(alert => {
            const row = [
              new Date(alert.ts || alert.created_at).toLocaleString(),
              alert.type.replace(/_/g, ' '),
              alert.house_id,
              alert.device_id,
              alert.severity,
              alert.status,
              alert.message || ''
            ].map(val => `"${val}"`);
            csvRows.push(row.join(','));
          });
          
          const csv = csvRows.join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `alert-history-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          
          toast('✓ Alert history exported successfully', 'success');
        } catch (err) {
          console.error('Export error:', err);
          toast('Failed to export alerts', 'error');
        }
      });
    }
  }

  async function renderReports() {
    try {
      // Fetch stats from backend
      const tenantId = currentTenant?.tenant_id;
      const statsUrl = tenantId ? `/api/v1/alerts/stats?tenant_id=${tenantId}` : '/api/v1/alerts/stats';
      const stats = await get(statsUrl);
      
      // Render KPI cards
      const reportsKpiGrid = document.getElementById('reportsKpiGrid');
      if (reportsKpiGrid) {
        const kpis = [
          {
            label: 'Total Alerts',
            value: stats.totalAlerts || 0,
            trend: `${stats.recentAlerts || 0} in last 24h`,
            color: '#3b82f6'
          },
          {
            label: 'Open Alerts',
            value: stats.openCount || 0,
            trend: 'Requires attention',
            color: '#f59e0b'
          },
          {
            label: 'Avg Response Time',
            value: `${Math.floor((stats.mttaSec || 0) / 60)}m`,
            trend: 'Time to acknowledge',
            color: '#10b981'
          },
          {
            label: 'Resolution Time',
            value: `${Math.floor((stats.mttrSec || 0) / 60)}m`,
            trend: 'Time to resolve',
            color: '#8b5cf6'
          }
        ];
        
        reportsKpiGrid.innerHTML = '';
        kpis.forEach(kpi => {
          const card = document.createElement('div');
          card.className = 'kpi-card';
          card.innerHTML = `
            <div class="kpi-label">${kpi.label}</div>
            <div class="kpi-value" style="color: ${kpi.color};">${kpi.value}</div>
            <div class="kpi-trend">${kpi.trend}</div>
          `;
          reportsKpiGrid.appendChild(card);
        });
      }
      
      // Render Severity Chart
      const severityCtx = document.getElementById('severityChart');
      if (severityCtx) {
        // Destroy existing chart if it exists
        const existingChart = Chart.getChart(severityCtx);
        if (existingChart) {
          existingChart.destroy();
        }
        
        const severityData = stats.bySeverity || {};
        
        // Always show all four severity levels, even if count is 0
        const allSeverities = ['critical', 'high', 'medium', 'low'];
        const labels = allSeverities.map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const data = allSeverities.map(s => severityData[s] || 0);
        const colors = {
          'critical': '#ef4444',  // Red
          'high': '#f59e0b',      // Orange
          'medium': '#3b82f6',    // Blue
          'low': '#10b981'        // Green
        };
        const backgroundColors = allSeverities.map(s => colors[s]);
        
        new Chart(severityCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: backgroundColors,
              borderWidth: 3,
              borderColor: '#fff',
              hoverOffset: 8,
              hoverBorderWidth: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  padding: 15,
                  font: {
                    size: 13,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    weight: '500'
                  },
                  color: '#374151',
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: {
                  size: 14,
                  weight: '600',
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                bodyFont: {
                  size: 13,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }
      
      // Render Alert Types Chart
      const response = await post('/api/v1/alerts/search', { limit: 100 });
      const alerts = response.items || [];
      
      const typesCtx = document.getElementById('typesChart');
      if (typesCtx && alerts.length > 0) {
        // Destroy existing chart if it exists
        const existingTypesChart = Chart.getChart(typesCtx);
        if (existingTypesChart) {
          existingTypesChart.destroy();
        }
        
        const typeCounts = {};
        alerts.forEach(alert => {
          const type = alert.type.replace(/_/g, ' ');
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        new Chart(typesCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(typeCounts),
            datasets: [{
              label: 'Alert Count',
              data: Object.values(typeCounts),
              backgroundColor: 'rgba(99, 102, 241, 0.8)',
              borderColor: 'rgb(99, 102, 241)',
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(79, 70, 229, 0.9)',
              hoverBorderColor: 'rgb(79, 70, 229)',
              hoverBorderWidth: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  },
                  color: '#6b7280',
                  padding: 8
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false,
                },
                border: {
                  display: false
                }
              },
              x: {
                ticks: {
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    weight: '500'
                  },
                  color: '#374151',
                  padding: 8
                },
                grid: {
                  display: false,
                  drawBorder: false,
                },
                border: {
                  display: false
                }
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: {
                  size: 14,
                  weight: '600',
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                bodyFont: {
                  size: 13,
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
                callbacks: {
                  label: function(context) {
                    const value = context.parsed.y;
                    return `${value} ${value === 1 ? 'Alert' : 'Alerts'}`;
                  }
                }
              }
            }
          }
        });
      }
      
      // Render Response Metrics
      const responseMetrics = document.getElementById('responseMetrics');
      if (responseMetrics) {
        const metrics = [
          { label: 'Mean Time to Acknowledge', value: `${Math.floor((stats.mttaSec || 0) / 60)} minutes` },
          { label: 'Mean Time to Resolve', value: `${Math.floor((stats.mttrSec || 0) / 60)} minutes` },
          { label: 'Critical Alerts', value: (stats.bySeverity?.critical || 0).toString() },
          { label: 'Resolved Alerts', value: (stats.byState?.resolved || 0).toString() }
        ];
        
        responseMetrics.innerHTML = '';
        metrics.forEach(metric => {
          const box = document.createElement('div');
          box.className = 'stat-box';
          box.innerHTML = `
            <div class="stat-label">${metric.label}</div>
            <div class="stat-value">${metric.value}</div>
          `;
          responseMetrics.appendChild(box);
        });
      }
      
      console.log('[OWNER] Reports rendered successfully');
    } catch (err) {
      console.error('[OWNER] Failed to render reports:', err);
      toast('Failed to load reports data', 'error');
    }
  }

  function initReports() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshReports');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        toast('🔄 Refreshing reports...', 'info');
        renderReports();
      });
    }
    
    // Report generation buttons
    document.querySelectorAll('.report-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const report = card.dataset.report;
        toast(`📊 Generating ${report} report...`, 'info');
        
        try {
          if (report === 'monthly') {
            // Monthly Summary Report - Past 30 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            const response = await post('/api/v1/alerts/search', { limit: 1000 });
            const allAlerts = response.items || [];
            
            // Filter alerts for the past 30 days
            const monthlyAlerts = allAlerts.filter(alert => {
              const alertDate = new Date(alert.ts || alert.created_at);
              return alertDate >= startDate && alertDate <= endDate;
            });
            
            const tenantId = currentTenant?.tenant_id;
            const statsUrl = tenantId ? `/api/v1/alerts/stats?tenant_id=${tenantId}` : '/api/v1/alerts/stats';
            const stats = await get(statsUrl);
            
            // Aggregate by severity
            const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
            monthlyAlerts.forEach(alert => {
              if (bySeverity.hasOwnProperty(alert.severity)) {
                bySeverity[alert.severity]++;
              }
            });
            
            // Aggregate by type
            const byType = {};
            monthlyAlerts.forEach(alert => {
              const type = alert.type || 'unknown';
              byType[type] = (byType[type] || 0) + 1;
            });
            
            // Aggregate by status
            const byStatus = { open: 0, acknowledged: 0, resolved: 0 };
            monthlyAlerts.forEach(alert => {
              if (byStatus.hasOwnProperty(alert.status)) {
                byStatus[alert.status]++;
              }
            });
            
            const reportData = {
              report_type: 'monthly_summary',
              generated_at: new Date().toISOString(),
              period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                days: 30
              },
              summary: {
                total_alerts: monthlyAlerts.length,
                alerts_by_severity: bySeverity,
                alerts_by_type: byType,
                alerts_by_status: byStatus
              },
              metrics: {
                mean_time_to_acknowledge_minutes: Math.floor((stats.mttaSec || 0) / 60),
                mean_time_to_resolve_minutes: Math.floor((stats.mttrSec || 0) / 60)
              },
              alerts: monthlyAlerts
            };
            
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `monthly-summary-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            toast('✓ Monthly summary report generated successfully', 'success');
            
          } else if (report === 'weekly') {
            // Weekly Report - Past 7 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            const response = await post('/api/v1/alerts/search', { limit: 1000 });
            const allAlerts = response.items || [];
            
            // Filter alerts for the past 7 days
            const weeklyAlerts = allAlerts.filter(alert => {
              const alertDate = new Date(alert.ts || alert.created_at);
              return alertDate >= startDate && alertDate <= endDate;
            });
            
            // Get weekly trends
            let weeklyTrends = [];
            try {
              const tenantId = currentTenant?.tenant_id;
              const trendsUrl = tenantId ? `/api/v1/alerts/weekly-trends?tenant_id=${tenantId}` : '/api/v1/alerts/weekly-trends';
              const trendsResponse = await get(trendsUrl);
              weeklyTrends = trendsResponse.trends || [];
            } catch (err) {
              console.warn('Failed to fetch weekly trends, using fallback', err);
            }
            
            // Create daily breakdown
            const dailyBreakdown = [];
            for (let i = 6; i >= 0; i--) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];
              const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
              
              const dayAlerts = weeklyAlerts.filter(alert => {
                const alertDate = new Date(alert.ts || alert.created_at);
                return alertDate.toISOString().split('T')[0] === dateStr;
              });
              
              dailyBreakdown.push({
                date: dateStr,
                day: dayName,
                count: dayAlerts.length
              });
            }
            
            // Aggregate by severity
            const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
            weeklyAlerts.forEach(alert => {
              if (bySeverity.hasOwnProperty(alert.severity)) {
                bySeverity[alert.severity]++;
              }
            });
            
            // Aggregate by type
            const byType = {};
            weeklyAlerts.forEach(alert => {
              const type = alert.type || 'unknown';
              byType[type] = (byType[type] || 0) + 1;
            });
            
            const reportData = {
              report_type: 'weekly_report',
              generated_at: new Date().toISOString(),
              period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                days: 7
              },
              daily_breakdown: dailyBreakdown,
              summary: {
                total_alerts: weeklyAlerts.length,
                alerts_by_severity: bySeverity,
                alerts_by_type: byType
              },
              alerts: weeklyAlerts
            };
            
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            toast('✓ Weekly report generated successfully', 'success');
            
          } else if (report === 'performance') {
            // Performance Report
            const tenantId = currentTenant?.tenant_id;
            const statsUrl = tenantId ? `/api/v1/alerts/stats?tenant_id=${tenantId}` : '/api/v1/alerts/stats';
            const stats = await get(statsUrl);
            
            // Get all alerts for type breakdown
            const response = await post('/api/v1/alerts/search', { limit: 1000 });
            const alerts = response.items || [];
            
            // Aggregate by type
            const byType = {};
            alerts.forEach(alert => {
              const type = alert.type || 'unknown';
              byType[type] = (byType[type] || 0) + 1;
            });
            
            const reportData = {
              report_type: 'performance_report',
              generated_at: new Date().toISOString(),
              metrics: {
                mean_time_to_acknowledge_seconds: stats.mttaSec || 0,
                mean_time_to_resolve_seconds: stats.mttrSec || 0,
                total_alerts: stats.totalAlerts || 0,
                open_alerts: stats.openCount || 0,
                resolved_alerts: stats.byState?.resolved || 0
              },
              breakdown: {
                by_severity: stats.bySeverity || {},
                by_status: stats.byState || {},
                by_type: byType
              },
              system_health: {
                uptime_percentage: 99.9,
                active_devices: 8
              }
            };
            
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            toast('✓ Performance report generated successfully', 'success');
            
          } else if (report === 'export') {
            // Export all data
            const response = await post('/api/v1/alerts/search', { limit: 1000 });
            const alerts = response.items || [];
            const tenantId = currentTenant?.tenant_id;
            const statsUrl = tenantId ? `/api/v1/alerts/stats?tenant_id=${tenantId}` : '/api/v1/alerts/stats';
            const stats = await get(statsUrl);
            
            const reportData = {
              generated_at: new Date().toISOString(),
              summary: stats,
              alerts: alerts
            };
            
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            toast('✓ Full report exported successfully', 'success');
          }
        } catch (err) {
          console.error('Report generation error:', err);
          toast('Failed to generate report', 'error');
        }
      });
    });
    
    // Render reports when tab is opened
    const reportsTab = document.querySelector('[data-section="reports"]');
    if (reportsTab) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (!reportsTab.classList.contains('hidden')) {
            renderReports();
          }
        });
      });
      observer.observe(reportsTab, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function initLiveAlerts() {
    const simulateButton = document.querySelector('[data-action="simulate-live"]');
    const stream = document.getElementById('liveAlertStream');
    if (!simulateButton || !stream) return;

    simulateButton.addEventListener('click', () => {
      const now = new Date();
      const item = document.createElement('div');
      item.className = 'live-alert-item';
      item.innerHTML = `<strong>${now.toLocaleTimeString()}</strong> — Emergency button pressed in Kitchen.`;
      stream.prepend(item);
      toast('New live alert received.', 'warning');
    });
  }

  function initSettingsForm() {
    const settingsForm = document.getElementById('settingsForm');
    if (!settingsForm) return;
    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      toast('Preferences saved securely.', 'success');
    });
  }

  function initHeaderActions() {
    const soundToggle = document.getElementById('soundToggle');
    const notificationButton = document.getElementById('notificationButton');
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    // Sound toggle button
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        const enabled = alertSounds.toggle();
        soundToggle.textContent = enabled ? '🔊' : '🔇';
        soundToggle.title = enabled ? 'Click to mute alert notification sounds' : 'Click to unmute alert notification sounds';
        soundToggle.setAttribute('aria-label', enabled ? 'Alert Sounds: ON' : 'Alert Sounds: OFF');
        toast(enabled ? '🔊 Alert notification sounds enabled' : '🔇 Alert notification sounds muted', 'info');
        
        // Play a test sound when enabling
        if (enabled) {
          setTimeout(() => alertSounds.playAlertSound('low'), 200);
        }
      });
    }

    if (notificationButton) {
      notificationButton.addEventListener('click', async () => {
        try {
          // Fetch recent alerts
          const response = await post('/api/v1/alerts/search', { limit: 5, status: 'open' });
          const recentAlerts = response.items || [];
          
          if (recentAlerts.length === 0) {
            toast('📬 No new notifications', 'info');
            return;
          }
          
          // Show notifications in a modal or toast
          const notificationText = recentAlerts.map((alert, i) => 
            `${i + 1}. ${alert.type.replace(/_/g, ' ')} - ${alert.severity} (${formatTimeAgo(alert.ts)})`
          ).join('\n');
          
          toast(`🔔 ${recentAlerts.length} Recent Alerts:\n${recentAlerts[0].type.replace(/_/g, ' ')} - ${recentAlerts[0].severity}`, 'info');
          
          // Navigate to Live Alerts tab
          setTimeout(() => {
            const liveAlertsTab = document.querySelector('[data-section="live-alerts"]');
            const liveAlertsNav = document.querySelector('.nav-item[data-section="live-alerts"]');
            if (liveAlertsNav) liveAlertsNav.click();
          }, 1500);
        } catch (err) {
          console.error('Failed to load notifications:', err);
          toast('Failed to load notifications', 'error');
        }
      });
    }

    if (userMenuToggle && userDropdown) {
      const toggleDropdown = () => {
        userDropdown.classList.toggle('visible');
      };

      userMenuToggle.addEventListener('click', toggleDropdown);
      userMenuToggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleDropdown();
        }
      });

      document.addEventListener('click', (event) => {
        if (!userMenuToggle.contains(event.target) && !userDropdown.contains(event.target)) {
          userDropdown.classList.remove('visible');
        }
      });
      
      // Handle dropdown menu actions
      const dropdownLinks = userDropdown.querySelectorAll('a');
      dropdownLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const action = link.dataset.action;
          
          if (action === 'profile') {
            e.preventDefault();
            userDropdown.classList.remove('visible');
            toast('👤 Opening profile settings...', 'info');
            setTimeout(() => {
              // Navigate to Settings tab
              const settingsNav = document.querySelector('.nav-item[data-section="settings"]');
              if (settingsNav) settingsNav.click();
            }, 500);
          } else if (action === 'support') {
            e.preventDefault();
            userDropdown.classList.remove('visible');
            toast('💬 Opening support portal...', 'info');
            setTimeout(() => {
              toast('📧 Contact support at: support@smarthome.com\n📞 Call: 1-800-SMART-HOME', 'success');
            }, 1000);
          }
          // logout action will use the href naturally
        });
      });
    }
  }

  async function initPage() {
    if (!kpiGrid) return; // guard for other pages
    renderKpis();
    renderAlerts();
    renderWeeklyStats();
    renderChart();
    await renderDevices(); // Wait for devices to load from API
    renderHistory();
    initNav();
    initQuickActions();
    initDialogs();
    initHistoryActions();
    initReports();
    initLiveAlerts();
    initSettingsForm();
    initHeaderActions();
  }

  initPage();
});


// ============================================
// FEATURE INTEGRATION: Charts, Search, Export
// ============================================

// Initialize search & filter for alert history
let searchFilterSystem = null;

// Listen for section changes to initialize search when needed
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', async () => {
      const section = item.dataset.section;
      
      // Initialize search/filter when alert history section is shown
      if (section === 'alert-history' && !searchFilterSystem) {
        // Fetch alert history data
        try {
          const searchParams = { limit: 100 };
          if (window.currentTenant?.tenant_id) {
            searchParams.tenant_id = window.currentTenant.tenant_id;
          }
          
          const response = await post('/api/v1/alerts/search', searchParams);
          const alerts = response.items || [];
          
          // Transform alerts for search
          const searchData = alerts.map(alert => ({
            id: alert.id,
            timestamp: new Date(alert.ts || alert.created_at).toLocaleString(),
            alert: alert.type.replace(/_/g, ' ').toUpperCase(),
            device: alert.device_id,
            severity: alert.severity,
            status: alert.status,
            message: alert.message || '',
            type: alert.type
          }));
          
          // Store for export
          window.alertHistoryData = searchData;
          
          // Initialize search/filter
          searchFilterSystem = initSearchFilter(
            searchData,
            ['alert', 'device', 'severity', 'status', 'message', 'type']
          );
          
          // Listen for search results
          document.addEventListener('searchResults', (e) => {
            updateHistoryTable(e.detail);
          });
          
        } catch (err) {
          console.error('[owner] Failed to initialize search:', err);
        }
      }
    });
  });
});

// Update history table with search results
function updateHistoryTable(results) {
  const historyTable = document.querySelector('#historyTable tbody');
  if (!historyTable) return;
  
  historyTable.innerHTML = '';
  
  if (results.length === 0) {
    historyTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No results found</td></tr>';
    return;
  }
  
  results.forEach((alert) => {
    const tr = document.createElement('tr');
    
    // Severity badge colors
    const severityColors = {
      'critical': 'danger',
      'high': 'warning',
      'medium': 'info',
      'low': 'success'
    };
    const severityBadge = severityColors[alert.severity] || 'info';
    
    // Status badge colors
    const statusColors = {
      'resolved': 'success',
      'acknowledged': 'info',
      'open': 'warning',
      'escalated': 'danger'
    };
    const statusBadge = statusColors[alert.status] || 'warning';
    
    tr.innerHTML = `
      <td style="white-space: nowrap;">${alert.timestamp}</td>
      <td><strong>${alert.alert}</strong><br><small style="color: #666;">${alert.message || 'No description'}</small></td>
      <td><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">${alert.device}</code></td>
      <td><span class="badge ${severityBadge}">${alert.severity.toUpperCase()}</span></td>
      <td><span class="badge ${statusBadge}">${alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}</span></td>
    `;
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      window.location.href = `alert-detail.html?id=${alert.id}`;
    });
    historyTable.appendChild(tr);
  });
}

// Initialize export system
const { exportManager } = initExportSystem();

// Store chart data for export
window.alertTrendsData = [];

// Update alert trends data when chart is rendered
async function updateAlertTrendsData() {
  try {
    const tenantId = window.currentTenant?.tenant_id;
    const url = tenantId ? `/api/v1/alerts/weekly-trends?tenant_id=${tenantId}` : '/api/v1/alerts/weekly-trends';
    const response = await get(url);
    const trends = response.trends || [];
    
    window.alertTrendsData = trends.map(t => ({
      Day: t.day,
      Date: t.date,
      'Alert Count': t.count
    }));
  } catch (err) {
    console.error('[owner] Failed to load trends for export:', err);
  }
}

// Call this after chart is rendered
setTimeout(updateAlertTrendsData, 1000);

console.log('[owner] Advanced features initialized: Charts, Search, Export');
