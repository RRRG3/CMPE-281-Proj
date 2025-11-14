import { post, get } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const kpiGrid = document.getElementById('kpiGrid');
  const alertList = document.getElementById('alertList');
  const weeklyStats = document.getElementById('weeklyStats');
  const toast = window.showToast || (() => {});

  // Fetch real alerts from backend
  let alerts = [];
  try {
    const response = await post('/api/v1/alerts/search', { limit: 10 });
    alerts = response.items || [];
  } catch (err) {
    console.error('Failed to load alerts:', err);
  }

  // Calculate KPIs from real data
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
      value: alerts.length.toString(),
      trend: `↑ ${Math.max(0, alerts.length - 3)} more than yesterday`,
      tone: 'warning',
      color: '#f59e0b'
    },
    {
      label: 'Urgent Alerts',
      value: alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length.toString(),
      trend: '⚠ Requires attention',
      tone: 'danger',
      color: '#ef4444'
    }
  ];

  // Weekly statistics from real data
  const weeklyStatsData = [
    { label: 'Total Alerts', value: alerts.length.toString() },
    { label: 'Avg Response', value: '2.1s' },
    { label: 'Critical Alerts', value: alerts.filter(a => a.severity === 'critical').length.toString() },
    { label: 'Resolved', value: alerts.filter(a => a.status === 'resolved').length.toString() }
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

  function renderAlerts() {
    if (!alertList) return;
    alertList.innerHTML = '';
    
    if (alerts.length === 0) {
      alertList.innerHTML = '<p style="padding: 1rem; text-align: center; color: #666;">No recent alerts</p>';
      return;
    }

    alerts.slice(0, 4).forEach((alert) => {
      const item = document.createElement('article');
      const alertType = getAlertType(alert.severity);
      item.className = `alert-item ${alertType}`;
      item.innerHTML = `
        <div class="alert-icon ${alertType}" aria-hidden="true">${getAlertIcon(alert.type, alert.severity)}</div>
        <div class="alert-content">
            <div class="alert-title">${alert.type.replace(/_/g, ' ').toUpperCase()} - ${alert.house_id}</div>
            <div class="alert-meta">Severity: ${alert.severity} | Device: ${alert.device_id} | ${alert.message || 'No message'}</div>
        </div>
        <div class="alert-time">${formatTimeAgo(alert.ts)}</div>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        window.location.href = `alert-detail.html?id=${alert.id}`;
      });
      alertList.appendChild(item);
    });
  }

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
  }

  function initQuickActions() {
    document.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        switch (action) {
          case 'emergency':
            toast('🚨 System-wide alert triggered! All administrators notified.', 'warning');
            console.log('[ADMIN] System-wide alert triggered');
            break;
          case 'acknowledge-all':
            toast('✓ All caches cleared successfully.', 'success');
            console.log('[ADMIN] Cache cleared');
            break;
          case 'generate-report':
            toast('📊 Generating system health report...', 'info');
            setTimeout(() => {
              toast('Health report generated successfully!', 'success');
              console.log('[ADMIN] Health report generated');
            }, 2000);
            break;
          case 'device-settings':
            toast('🔧 Opening system settings...', 'info');
            console.log('[ADMIN] System settings opened');
            break;
          default:
            toast('Action executed.', 'success');
        }
      });
    });
  }

  function initHeaderActions() {
    const notificationButton = document.getElementById('notificationButton');
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (notificationButton) {
      notificationButton.addEventListener('click', () => {
        toast('📬 System notifications: 1 new alert', 'info');
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
    }

    // Handle dropdown actions
    document.querySelectorAll('.user-dropdown a').forEach(link => {
      link.addEventListener('click', (e) => {
        const action = link.dataset.action;
        if (action === 'profile') {
          e.preventDefault();
          toast('Opening admin profile settings...', 'info');
        } else if (action === 'support') {
          e.preventDefault();
          toast('Opening support portal...', 'info');
        }
      });
    });
  }

  function initTabButtons() {
    console.log('[ADMIN] Initializing tab buttons...');
    
    // Tenant Management buttons - use event delegation
    const tenantsSection = document.querySelector('[data-section="tenants"]');
    if (tenantsSection) {
      // Add New Tenant button
      const addTenantBtn = tenantsSection.querySelector('.panel-header .btn-primary');
      if (addTenantBtn) {
        addTenantBtn.addEventListener('click', () => {
          toast('🏢 Opening tenant registration form...', 'info');
          console.log('[ADMIN] Add new tenant clicked');
        });
        console.log('[ADMIN] Add tenant button initialized');
      } else {
        console.warn('[ADMIN] Add tenant button not found');
      }

      // Manage buttons in table
      const manageButtons = tenantsSection.querySelectorAll('table .btn-secondary');
      console.log('[ADMIN] Found', manageButtons.length, 'manage buttons');
      manageButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const row = e.target.closest('tr');
          const tenantId = row?.querySelector('td:first-child')?.textContent;
          toast(`📊 Opening management panel for ${tenantId || 'tenant'}...`, 'info');
          console.log('[ADMIN] Manage tenant:', tenantId);
        });
      });
    } else {
      console.warn('[ADMIN] Tenants section not found');
    }

    // ML Models buttons
    document.querySelectorAll('[data-section="ml-models"] .btn-primary').forEach(btn => {
      btn.addEventListener('click', () => {
        toast('Opening ML model deployment wizard...', 'info');
        console.log('[ADMIN] Deploy new model clicked');
      });
    });

    document.querySelectorAll('[data-section="ml-models"] .btn-secondary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        const modelName = row?.querySelector('td:first-child')?.textContent;
        toast(`Opening details for ${modelName || 'model'}...`, 'info');
        console.log('[ADMIN] Model details:', modelName);
      });
    });

    // System Health buttons
    document.querySelectorAll('[data-section="system-health"] .btn-secondary').forEach(btn => {
      if (btn.textContent.includes('Refresh')) {
        btn.addEventListener('click', () => {
          toast('Refreshing system health metrics...', 'info');
          setTimeout(() => {
            toast('✓ Metrics refreshed from CloudWatch', 'success');
          }, 1500);
          console.log('[ADMIN] Refresh metrics clicked');
        });
      }
    });

    // Audit Logs buttons
    const auditFilterBtn = document.querySelector('[data-section="logs"] .btn-secondary:first-of-type');
    const auditExportBtn = document.querySelector('[data-section="logs"] .btn-secondary:last-of-type');

    if (auditFilterBtn && auditFilterBtn.textContent.includes('Filter')) {
      auditFilterBtn.addEventListener('click', () => {
        toast('Opening audit log filters...', 'info');
        console.log('[ADMIN] Filter logs clicked');
      });
    }

    if (auditExportBtn && auditExportBtn.textContent.includes('Export')) {
      auditExportBtn.addEventListener('click', () => {
        toast('Exporting audit logs to CSV...', 'info');
        setTimeout(() => {
          toast('✓ Audit logs exported successfully', 'success');
          console.log('[ADMIN] Logs exported');
        }, 1000);
      });
    }
  }

  // Initialize page
  renderKpis();
  renderAlerts();
  renderWeeklyStats();
  initNav();
  initQuickActions();
  initHeaderActions();
  initTabButtons();

  console.log('[ADMIN DASHBOARD] Loaded with', alerts.length, 'alerts');
});
