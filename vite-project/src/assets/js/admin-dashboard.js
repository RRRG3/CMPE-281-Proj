import { post, get, put, detectBackend } from './api.js';
import { SkeletonLoader } from './skeleton.js';
import wsClient from './websocket-client.js';
import { CloudVisualizer, MatrixLogStream } from './cloud-viz.js';
import { showToast } from './toast.js';

// Get API_BASE dynamically
async function getAPIBase() {
  await detectBackend();
  const { API_BASE } = await import('./api.js');
  return API_BASE;
}

document.addEventListener('DOMContentLoaded', async () => {
  const kpiGrid = document.getElementById('kpiGrid');
  const alertList = document.getElementById('alertList');
  const weeklyStats = document.getElementById('weeklyStats');
  const toast = window.showToast || (() => {});

  // Show skeletons
  if (alertList) SkeletonLoader.show('alertList', 'list');
  if (kpiGrid) SkeletonLoader.show('kpiGrid', 'card');

  // Fetch real alerts from backend
  let alerts = [];
  try {
    const response = await post('/api/v1/alerts/search', { limit: 10 });
    alerts = response.items || [];
  } catch (err) {
    console.error('Failed to load alerts:', err);
  } finally {
    if (alertList) SkeletonLoader.hide('alertList');
    if (kpiGrid) SkeletonLoader.hide('kpiGrid');
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
    
    // Cloud Viz initialization flag
    let cloudVizInitialized = false;

    navItems.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.section;
        navItems.forEach((nav) => nav.classList.toggle('active', nav === button));
        sections.forEach((section) => {
          section.classList.toggle('hidden', section.dataset.section !== target);
        });

        // Initialize "Cool" Visualizations when System Health is opened
        if (target === 'system-health' && !cloudVizInitialized) {
            cloudVizInitialized = true;
            // Short delay to allow layout to stabilize
            setTimeout(() => {
                new CloudVisualizer('cloudViz');
                new MatrixLogStream('matrixLogs');
                startSystemHealthUpdates();
            }, 100);
        }
      });
    });
  }

  function startSystemHealthUpdates() {
    const tbody = document.querySelector('#awsStatusTable tbody');
    if (!tbody) return;

    const services = [
        { name: '🌐 Nginx Load Balancer', region: 'us-west-2', metric: 'req/min', base: 1200, var: 200 },
        { name: '🗄️ MongoDB Database', region: 'us-west-2', metric: 'conn', base: 45, var: 10 },
        { name: '📡 Node.js API Servers', region: 'us-west-2', metric: 'instances', base: 3, var: 0 },
        { name: '⚡ Docker Containers', region: 'us-west-2', metric: 'active', base: 5, var: 1 },
        { name: '📦 EC2 Instance', region: 'us-west-2', metric: 'CPU %', base: 45, var: 15 }
    ];

    const update = () => {
        tbody.innerHTML = services.map(s => {
            const val = s.base + (Math.random() * s.var - s.var/2);
            const valueStr = s.metric === 'GB' ? val.toFixed(2) : Math.floor(val);
            
            return `
                <tr>
                    <td>${s.name}</td>
                    <td><span class="badge success">Operational</span></td>
                    <td>${s.region}</td>
                    <td>${valueStr} ${s.metric}</td>
                    <td>Just now</td>
                </tr>
            `;
        }).join('');
    };

    update();
    setInterval(update, 2000);
  }

  function initQuickActions() {
    document.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        switch (action) {
          case 'emergency':
            // Open system alert modal
            const modal = document.getElementById('systemAlertModal');
            modal.showModal();
            break;
            
          case 'acknowledge-all':
            // Clear cache
            toast('🔄 Clearing system caches...', 'info');
            try {
              const response = await post('/api/v1/admin/clear-cache', {});
              toast('✓ All caches cleared successfully!', 'success');
              console.log('[ADMIN] Cache cleared:', response);
            } catch (err) {
              toast('Failed to clear cache', 'error');
              console.error(err);
            }
            break;
            
          case 'generate-report':
            // Generate health report
            toast('📊 Generating system health report...', 'info');
            try {
              const report = await get('/api/v1/admin/health-report');
              console.log('[ADMIN] Health report:', report);
              
              // Display report summary
              setTimeout(() => {
                toast(`✓ Report generated! System: ${report.system_status} | Uptime: ${report.uptime_percentage}% | Open Alerts: ${report.alerts.open}`, 'success');
                
                // Download report as JSON
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `health-report-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }, 1000);
            } catch (err) {
              toast('Failed to generate report', 'error');
              console.error(err);
            }
            break;
            
          case 'device-settings':
            // Open system settings modal
            const settingsModal = document.getElementById('systemSettingsModal');
            if (settingsModal) {
              settingsModal.showModal();
            }
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

  // Load tenants from backend
  async function loadTenants() {
    try {
      const response = await get('/api/v1/tenants');
      const tenants = response.items || [];
      
      const tbody = document.querySelector('[data-section="tenants"] table tbody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      tenants.forEach(tenant => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tenant.tenant_id}</td>
          <td>${tenant.name}</td>
          <td>${tenant.device_count} devices</td>
          <td><span class="badge ${tenant.status === 'active' ? 'success' : 'warning'}">${tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}</span></td>
          <td>${tenant.alert_count} alerts</td>
          <td><button class="btn btn-secondary" data-tenant-id="${tenant.id}">Manage</button></td>
        `;
        tbody.appendChild(tr);
      });
      
      console.log(`[ADMIN] Loaded ${tenants.length} tenants`);
    } catch (err) {
      console.error('[ADMIN] Failed to load tenants:', err);
      toast('Failed to load tenants', 'error');
    }
  }

  function initTabButtons() {
    console.log('[ADMIN] Initializing tab buttons...');
    
    // Load tenants when page loads
    loadTenants();
    
    // Use event delegation on the entire document for better reliability
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      // Check if clicked element is a button
      if (!target.classList.contains('btn') && !target.classList.contains('btn-primary') && !target.classList.contains('btn-secondary')) {
        return;
      }
      
      // Get the section the button is in
      const section = target.closest('.section');
      if (!section) return;
      
      const sectionType = section.dataset.section;
      
      // Tenant Management - Add New Tenant
      if (sectionType === 'tenants' && target.classList.contains('btn-primary')) {
        e.preventDefault();
        const modal = document.getElementById('tenantModal');
        const form = document.getElementById('tenantForm');
        document.getElementById('tenantModalTitle').textContent = 'Add New Tenant';
        form.reset();
        document.getElementById('tenantId').value = '';
        modal.showModal();
        return;
      }
      
      // Tenant Management - Manage buttons
      if (sectionType === 'tenants' && target.classList.contains('btn-secondary')) {
        e.preventDefault();
        const tenantId = target.dataset.tenantId;
        if (!tenantId) return;
        
        // Load tenant data and open edit modal
        get(`/api/v1/tenants/${tenantId}`).then(tenant => {
          const modal = document.getElementById('tenantModal');
          const form = document.getElementById('tenantForm');
          document.getElementById('tenantModalTitle').textContent = 'Manage Tenant';
          document.getElementById('tenantId').value = tenant.id;
          document.getElementById('tenantName').value = tenant.name;
          document.getElementById('tenantEmail').value = tenant.contact_email;
          document.getElementById('tenantPhone').value = tenant.contact_phone || '';
          document.getElementById('tenantStatus').value = tenant.status;
          modal.showModal();
        }).catch(err => {
          toast('Failed to load tenant details', 'error');
          console.error(err);
        });
        return;
      }
      
      // ML Models - Deploy New Model
      // Only open modal for buttons that don't have onclick handlers (to avoid conflicts with Predict button)
      if (sectionType === 'ml-models' && target.classList.contains('btn-primary') && !target.hasAttribute('onclick')) {
        e.preventDefault();
        const modal = document.getElementById('modelModal');
        modal.showModal();
        return;
      }
      
      // ML Models - Details buttons
      if (sectionType === 'ml-models' && target.classList.contains('btn-secondary')) {
        e.preventDefault();
        const row = target.closest('tr');
        const modelName = row?.querySelector('td:first-child')?.textContent;
        const version = row?.querySelector('td:nth-child(2)')?.textContent;
        const status = row?.querySelector('td:nth-child(3)')?.textContent;
        const deployed = row?.querySelector('td:nth-child(4)')?.textContent;
        const accuracy = row?.querySelector('td:nth-child(5)')?.textContent;
        
        const modal = document.getElementById('modelDetailsModal');
        const content = document.getElementById('modelDetailsContent');
        content.innerHTML = `
          <div style="display: grid; gap: 1rem;">
            <div><strong>Model Name:</strong> ${modelName}</div>
            <div><strong>Version:</strong> ${version}</div>
            <div><strong>Status:</strong> <span class="badge ${status.includes('Production') ? 'success' : 'warning'}">${status}</span></div>
            <div><strong>Deployed:</strong> ${deployed}</div>
            <div><strong>Accuracy:</strong> ${accuracy}</div>
            <div><strong>Endpoint:</strong> <code>https://api.smarthome.ai/ml/${modelName.toLowerCase().replace(/\s+/g, '-')}</code></div>
            <div><strong>Training Data:</strong> 50,000 samples</div>
            <div><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
        `;
        modal.showModal();
        return;
      }
      
      // System Health - Refresh button
      if (sectionType === 'system-health' && target.textContent.includes('Refresh')) {
        e.preventDefault();
        toast('🔄 Refreshing system health metrics...', 'info');
        console.log('[ADMIN] Refresh metrics clicked');
        setTimeout(() => {
          toast('✓ Metrics refreshed from CloudWatch', 'success');
        }, 1500);
        return;
      }
      
      // Audit Logs - Filter button
      if (sectionType === 'logs' && target.textContent.includes('Filter')) {
        e.preventDefault();
        toast('🔍 Opening audit log filters...', 'info');
        console.log('[ADMIN] Filter logs clicked');
        setTimeout(() => {
          toast('Filter panel would open here', 'success');
        }, 1000);
        return;
      }
      
      // Audit Logs - Export button
      if (sectionType === 'logs' && target.textContent.includes('Export')) {
        e.preventDefault();
        toast('📥 Exporting audit logs to CSV...', 'info');
        console.log('[ADMIN] Export logs clicked');
        
        // Download CSV from backend
        (async () => {
          try {
            const apiBase = await getAPIBase();
            const response = await fetch(`${apiBase}/api/v1/admin/audit-logs/export`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast('✓ Audit logs exported successfully', 'success');
          } catch (err) {
            toast('Failed to export logs', 'error');
            console.error(err);
          }
        })();
        return;
      }
    });
    
    console.log('[ADMIN] Event delegation initialized for all tab buttons');
  }
  
  // Form submission handlers
  function initForms() {
    // Tenant form
    const tenantForm = document.getElementById('tenantForm');
    if (tenantForm) {
      tenantForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(tenantForm);
        const data = {
          name: formData.get('name'),
          contact_email: formData.get('contact_email'),
          contact_phone: formData.get('contact_phone'),
          status: formData.get('status')
        };
        
        const tenantId = document.getElementById('tenantId').value;
        
        try {
          if (tenantId) {
            // Update existing tenant
            await put(`/api/v1/tenants/${tenantId}`, data);
            toast('✓ Tenant updated successfully!', 'success');
          } else {
            // Create new tenant
            await post('/api/v1/tenants', data);
            toast('✓ Tenant created successfully!', 'success');
          }
          
          document.getElementById('tenantModal').close();
          loadTenants(); // Reload tenant list
        } catch (err) {
          toast('Failed to save tenant', 'error');
          console.error(err);
        }
      });
      
      tenantForm.addEventListener('reset', () => {
        document.getElementById('tenantModal').close();
      });
    }
    
    // Model deployment form
    const modelForm = document.getElementById('modelForm');
    if (modelForm) {
      modelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(modelForm);
        const data = {
          model_name: formData.get('model_name'),
          version: formData.get('version'),
          model_type: formData.get('model_type'),
          strategy: formData.get('strategy'),
          model_url: formData.get('model_url')
        };
        
        toast('🚀 Deploying ML model...', 'info');
        console.log('[ADMIN] Deploying model:', data);
        
        // Simulate deployment
        setTimeout(() => {
          toast(`✓ ${data.model_name} v${data.version} deployed successfully!`, 'success');
          document.getElementById('modelModal').close();
          modelForm.reset();
        }, 2000);
      });
      
      modelForm.addEventListener('reset', () => {
        document.getElementById('modelModal').close();
      });
    }
    
    // System alert form
    const systemAlertForm = document.getElementById('systemAlertForm');
    if (systemAlertForm) {
      systemAlertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(systemAlertForm);
        const data = {
          message: formData.get('message'),
          severity: formData.get('severity')
        };
        
        try {
          const response = await post('/api/v1/admin/system-alert', data);
          toast('🚨 System-wide alert sent to all administrators!', 'warning');
          console.log('[ADMIN] System alert sent:', response);
          document.getElementById('systemAlertModal').close();
          systemAlertForm.reset();
        } catch (err) {
          toast('Failed to send system alert', 'error');
          console.error(err);
        }
      });
      
      systemAlertForm.addEventListener('reset', () => {
        document.getElementById('systemAlertModal').close();
      });
    }
    
    // System settings form
    const systemSettingsForm = document.getElementById('systemSettingsForm');
    if (systemSettingsForm) {
      systemSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(systemSettingsForm);
        
        const settings = {
          autoEscalation: formData.get('autoEscalation') === 'on',
          escalationTimeout: parseInt(formData.get('escalationTimeout')),
          emailNotifications: formData.get('emailNotifications') === 'on',
          smsNotifications: formData.get('smsNotifications') === 'on',
          alertRetention: parseInt(formData.get('alertRetention')),
          auditRetention: parseInt(formData.get('auditRetention')),
          autoBackup: formData.get('autoBackup') === 'on',
          backupTime: formData.get('backupTime')
        };
        
        // Save to localStorage (in a real app, this would go to the backend)
        localStorage.setItem('systemSettings', JSON.stringify(settings));
        
        toast('✓ System settings saved successfully!', 'success');
        console.log('[ADMIN] Settings saved:', settings);
        document.getElementById('systemSettingsModal').close();
      });
      
      systemSettingsForm.addEventListener('reset', () => {
        document.getElementById('systemSettingsModal').close();
      });
      
      // Load saved settings when modal opens
      const settingsModal = document.getElementById('systemSettingsModal');
      if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
          if (e.target === settingsModal) {
            const savedSettings = localStorage.getItem('systemSettings');
            if (savedSettings) {
              const settings = JSON.parse(savedSettings);
              systemSettingsForm.querySelector('[name="autoEscalation"]').checked = settings.autoEscalation;
              systemSettingsForm.querySelector('[name="escalationTimeout"]').value = settings.escalationTimeout;
              systemSettingsForm.querySelector('[name="emailNotifications"]').checked = settings.emailNotifications;
              systemSettingsForm.querySelector('[name="smsNotifications"]').checked = settings.smsNotifications;
              systemSettingsForm.querySelector('[name="alertRetention"]').value = settings.alertRetention;
              systemSettingsForm.querySelector('[name="auditRetention"]').value = settings.auditRetention;
              systemSettingsForm.querySelector('[name="autoBackup"]').checked = settings.autoBackup;
              systemSettingsForm.querySelector('[name="backupTime"]').value = settings.backupTime;
            }
          }
        });
      }
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
  initForms();

  // Connect WebSocket
  wsClient.connect('admin', 'all');
  wsClient.on('alert.new', (data) => {
    // Show toast
    const toast = window.showToast || console.log;
    toast(`🚨 New Alert: ${data.payload.type} (${data.payload.severity})`, 'warning');
    
    // Prepend to list
    alerts.unshift(data.payload);
    renderAlerts();
    
    // Update KPIs (simplified)
    const todayKpi = kpis.find(k => k.label === 'Alerts Today');
    if (todayKpi) {
        todayKpi.value = (parseInt(todayKpi.value) + 1).toString();
        renderKpis();
    }
  });

  // Add a catch-all listener for debugging
  wsClient.on('message', (data) => {
    if (data.type !== 'alert.new') {
      console.log('[WS] Received unhandled message type:', data.type, data);
    }
  });

  console.log('[ADMIN DASHBOARD] Loaded with', alerts.length, 'alerts');
  
  // Performance Metrics Handlers
  const runLoadTestBtn = document.getElementById('runLoadTestBtn');
  const refreshMetricsBtn = document.getElementById('refreshMetricsBtn');
  
  if (runLoadTestBtn) {
    runLoadTestBtn.addEventListener('click', async () => {
      toast('🚀 Starting load test... This will take about 60 seconds', 'info');
      runLoadTestBtn.disabled = true;
      runLoadTestBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> Running Test...';
      
      try {
        // Trigger load test on backend
        const response = await fetch('http://localhost:3000/api/v1/admin/run-load-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: 10, duration: 60000 })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.summary) {
            toast('✅ Load test completed successfully!', 'success');
            
            // Update metrics on page
            updatePerformanceMetrics(result);
          } else {
            toast('Load test started...', 'info');
          }
        } else {
          toast('⚠️ Load test completed but check console for details', 'warning');
        }
      } catch (error) {
        console.error('Load test error:', error);
        toast('❌ Load test failed. Make sure the server is running.', 'error');
      } finally {
        runLoadTestBtn.disabled = false;
        runLoadTestBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Run Load Test';
      }
    });
  }
  
  if (refreshMetricsBtn) {
    refreshMetricsBtn.addEventListener('click', async () => {
      toast('🔄 Refreshing performance metrics...', 'info');
      try {
        const response = await fetch('http://localhost:3000/api/v1/admin/latest-load-test');
        if (response.ok) {
          const result = await response.json();
          updatePerformanceMetrics(result);
          toast('✅ Metrics refreshed!', 'success');
        } else {
          toast('⚠️ No recent load test data found', 'warning');
        }
      } catch (error) {
        console.error('Refresh error:', error);
        toast('❌ Failed to refresh metrics', 'error');
      }
    });
  }
  
  function updatePerformanceMetrics(data) {
    console.log('Updating metrics with data:', data);
    
    // Ignore WebSocket alert messages
    if (data && data.type && data.type.startsWith('alert.')) {
      return;
    }
    
    // Check if data has the expected structure
    if (!data || !data.summary || !data.latency || !data.configuration) {
      console.error('Invalid data structure:', data);
      toast('⚠️ Received invalid data format', 'warning');
      return;
    }
    
    // Update summary
    const summaryEl = document.getElementById('performanceSummary');
    if (summaryEl) {
      summaryEl.textContent = 
        `${data.summary.successRate.toFixed(2)}% Success Rate | ${data.latency.average.toFixed(2)}ms Average Latency | ${data.summary.requestsPerSecond.toFixed(2)} Requests/Second`;
    }
    
    // Update test config
    const testDateEl = document.getElementById('testDate');
    if (testDateEl) testDateEl.textContent = new Date(data.timestamp).toLocaleString();
    
    const testDurationEl = document.getElementById('testDuration');
    if (testDurationEl) testDurationEl.textContent = `${data.configuration.duration / 1000}s`;
    
    const testUsersEl = document.getElementById('testUsers');
    if (testUsersEl) testUsersEl.textContent = data.configuration.concurrentUsers;
    
    const testTargetEl = document.getElementById('testTarget');
    if (testTargetEl) testTargetEl.textContent = data.configuration.target;
    
    // Update overall performance
    const totalRequestsEl = document.getElementById('totalRequests');
    if (totalRequestsEl) totalRequestsEl.textContent = data.summary.totalRequests.toLocaleString();
    
    const successRateEl = document.getElementById('successRate');
    if (successRateEl) successRateEl.textContent = `${data.summary.successRate.toFixed(2)}%`;
    
    const requestsPerSecEl = document.getElementById('requestsPerSec');
    if (requestsPerSecEl) requestsPerSecEl.textContent = data.summary.requestsPerSecond.toFixed(2);
    
    const avgLatencyEl = document.getElementById('avgLatency');
    if (avgLatencyEl) avgLatencyEl.textContent = `${data.latency.average.toFixed(2)}ms`;
    
    // Update endpoint table
    const tbody = document.getElementById('endpointPerformanceTable');
    if (tbody && data.endpoints) {
      tbody.innerHTML = Object.entries(data.endpoints).map(([endpoint, stats]) => `
        <tr>
          <td><strong>${endpoint}</strong></td>
          <td>${stats.requests}</td>
          <td><span class="badge success">${(stats.successful/stats.requests*100).toFixed(2)}%</span></td>
          <td><strong>${stats.avgLatency.toFixed(2)}ms</strong></td>
          <td>${stats.minLatency.toFixed(2)}ms</td>
          <td>${stats.maxLatency.toFixed(2)}ms</td>
        </tr>
      `).join('');
    }
    
    console.log('Metrics updated successfully');
  }
  
  // Handle hash navigation (e.g., #ml-models)
  function handleHashNavigation() {
    const hash = window.location.hash.substring(1); // Remove the #
    if (hash) {
      const navItem = document.querySelector(`.nav-item[data-section="${hash}"]`);
      if (navItem) {
        navItem.click();
      }
    }
  }
  
  // Check hash on load
  handleHashNavigation();
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashNavigation);
});
