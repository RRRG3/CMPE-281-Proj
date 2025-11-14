import { get, post, API_BASE } from './api.js';

(function () {
  const toast = window.showToast || (() => {});

  let deviceRows = [];

  // Load devices from API
  async function loadDevices() {
    try {
      const response = await get('/api/v1/devices');
      deviceRows = response.items.map(d => ({
        id: d.id,
        deviceId: d.device_id,
        tenant: d.tenant,
        location: d.location,
        type: d.type,
        status: d.status === 'online' ? 'success' : d.status === 'offline' ? 'danger' : 'warning',
        heartbeat: d.heartbeat,
        firmware: d.firmware
      }));
      renderKpis();
      renderDeviceTable();
    } catch (err) {
      console.error('Failed to load devices:', err);
      toast('Failed to load devices from server', 'error');
    }
  }

  function calculateKpis() {
    const total = deviceRows.length;
    const online = deviceRows.filter(d => d.status === 'success').length;
    const offline = deviceRows.filter(d => d.status === 'danger').length;
    const needsUpdate = deviceRows.filter(d => d.firmware !== 'v2.4.1').length;
    
    return [
      { label: 'Total Devices', value: total, trend: 'Across all homes', tone: '#10b981' },
      { label: 'Online Devices', value: online, trend: `${total ? Math.round(online/total*100) : 0}% availability`, tone: '#10b981' },
      { label: 'Offline Devices', value: offline, trend: offline > 0 ? '⚠ Requires attention' : 'All online', tone: offline > 0 ? '#ef4444' : '#10b981' },
      { label: 'Pending Updates', value: needsUpdate, trend: 'Firmware v2.4.1 available', tone: '#f59e0b' }
    ];
  }

  const networkStats = [
    { label: 'Active Connections', value: '340', tone: '#10b981' },
    { label: 'Messages/sec', value: '1,247', tone: '#3b82f6' },
    { label: 'Avg Latency', value: '42ms', tone: '#10b981' },
    { label: 'Failed Messages', value: '3', tone: '#ef4444' }
  ];

  function calculateFirmwareQueue() {
    const needsUpdate = deviceRows.filter(d => d.firmware !== 'v2.4.1').length;
    const upToDate = deviceRows.filter(d => d.firmware === 'v2.4.1').length;
    
    return [
      {
        title: 'v2.4.1 Production Rollout',
        description: `${needsUpdate} devices pending update`,
        status: needsUpdate > 0 ? 'In Progress' : 'Complete',
        completion: deviceRows.length > 0 ? Math.round((upToDate / deviceRows.length) * 100) : 100,
        accent: '#3b82f6'
      },
      {
        title: 'All Devices Up-to-Date',
        description: `${upToDate} devices on latest firmware`,
        status: 'Healthy',
        completion: 100,
        accent: '#10b981',
        success: true
      }
    ];
  }

  function renderKpis() {
    const grid = document.getElementById('iotKpiGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const kpis = calculateKpis();
    kpis.forEach((kpi) => {
      const card = document.createElement('article');
      card.className = 'kpi-card';
      card.style.borderColor = kpi.tone;
      card.innerHTML = `
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value" style="color: ${kpi.tone};">${kpi.value}</div>
        <div class="kpi-trend">${kpi.trend}</div>
      `;
      grid.appendChild(card);
    });
  }

  function renderDeviceTable(filteredDevices = deviceRows) {
    const tbody = document.querySelector('#deviceTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    filteredDevices.forEach((device) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="device-id">${device.deviceId}</td>
        <td>${device.tenant}</td>
        <td>${device.location}</td>
        <td>${device.type}</td>
        <td><span class="badge ${device.status}">${device.status === 'success' ? 'Online' : device.status === 'danger' ? 'Offline' : 'Warning'}</span></td>
        <td>${device.heartbeat}</td>
        <td>${device.firmware}</td>
        <td><button class="btn btn-secondary" data-device="${device.deviceId}" data-action="configure">Configure</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderNetworkStats() {
    const grid = document.getElementById('networkStats');
    if (!grid) return;
    grid.innerHTML = '';
    networkStats.forEach((stat) => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      box.innerHTML = `
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value" style="color:${stat.tone};">${stat.value}</div>
      `;
      grid.appendChild(box);
    });
  }

  function renderFirmwareQueue() {
    const list = document.getElementById('firmwareQueue');
    if (!list) return;
    list.innerHTML = '';
    const firmwareQueue = calculateFirmwareQueue();
    firmwareQueue.forEach((item) => {
      const card = document.createElement('div');
      card.className = `update-card ${item.success ? 'success' : ''}`;
      card.innerHTML = `
        <div class="update-header">
          <div>
            <div class="update-title">${item.title}</div>
            <div class="update-desc">${item.description}</div>
          </div>
          <span class="badge" style="background:${item.success ? '#d1fae5' : '#dbeafe'}; color:${item.success ? '#065f46' : '#1e40af'};">${item.status}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${item.success ? 'success' : ''}" style="width: ${item.completion}%;"></div>
        </div>
        <div class="progress-text">${item.completion}% complete</div>
      `;
      list.appendChild(card);
    });
  }

  function initNav() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    navItems.forEach((nav) => {
      nav.addEventListener('click', () => {
        const target = nav.dataset.section;
        navItems.forEach((btn) => btn.classList.toggle('active', btn === nav));
        sections.forEach((section) => {
          section.classList.toggle('hidden', section.dataset.section !== target);
        });
      });
    });
  }

  let currentConfigDevice = null;

  function initTableActions() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action="configure"]');
      if (!button) return;
      const deviceId = button.dataset.device;
      
      // Find the device in our local array
      const device = deviceRows.find(d => d.deviceId === deviceId);
      if (!device) return;
      
      // Store current device for configuration
      currentConfigDevice = device;
      
      // Open configuration dialog
      const configDialog = document.getElementById('configureDialog');
      const configDeviceIdEl = document.getElementById('configDeviceId');
      if (configDeviceIdEl) {
        configDeviceIdEl.textContent = deviceId;
      }
      
      if (configDialog?.showModal) {
        configDialog.showModal();
      } else {
        toast('Configuration dialog not supported in this browser', 'error');
      }
    });
  }

  function initGlobalButtons() {
    const dialog = document.getElementById('deviceDialog');
    const dialogForm = document.getElementById('deviceDialogForm');
    const filterDialog = document.getElementById('filterDialog');
    const filterDialogForm = document.getElementById('filterDialogForm');
    const configureDialog = document.getElementById('configureDialog');
    const configureDialogForm = document.getElementById('configureDialogForm');

    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        switch (action) {
          case 'filter':
            if (filterDialog?.showModal) filterDialog.showModal();
            break;
          case 'export':
            toast('Device registry exported to CSV.', 'success');
            break;
          case 'register':
            if (dialog?.showModal) dialog.showModal();
            break;
          case 'schedule-ota':
            toast('OTA batch scheduled for tonight at 02:00 AM.', 'success');
            break;
          case 'registry-search':
            performRegistrySearch();
            break;
          case 'refresh-network':
            refreshNetworkMetrics();
            break;
          case 'deploy-firmware':
            deployFirmware();
            break;
          default:
            break;
        }
      });
    });

    const commandCenter = document.getElementById('openCommandCenter');
    if (commandCenter) {
      commandCenter.addEventListener('click', () => {
        toast('Command Center: Real-time device monitoring dashboard', 'info');
        
        // Show a summary of current system status
        const online = deviceRows.filter(d => d.status === 'success').length;
        const offline = deviceRows.filter(d => d.status === 'danger').length;
        const warning = deviceRows.filter(d => d.status === 'warning').length;
        
        setTimeout(() => {
          toast(`System Status: ${online} online, ${warning} warning, ${offline} offline`, 'success');
        }, 1000);
        
        console.log('=== COMMAND CENTER ===');
        console.log(`Total Devices: ${deviceRows.length}`);
        console.log(`Online: ${online}`);
        console.log(`Warning: ${warning}`);
        console.log(`Offline: ${offline}`);
        console.log('Device List:', deviceRows);
        console.log('=====================');
      });
    }

    if (dialogForm) {
      dialogForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(dialogForm);
        const newDevice = {
          deviceId: formData.get('deviceId'),
          tenant: formData.get('tenant'),
          location: formData.get('location'),
          type: formData.get('type'),
          status: formData.get('status'),
          firmware: 'v2.4.1'
        };
        
        try {
          const response = await fetch(`${API_BASE}/api/v1/devices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDevice)
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to register device');
          }
          
          await loadDevices();
          toast(`${newDevice.deviceId} registered successfully.`, 'success');
          dialogForm.reset();
          dialog.close();
        } catch (err) {
          console.error('Device registration error:', err);
          toast(err.message || 'Failed to register device', 'error');
        }
      });

      dialogForm.addEventListener('reset', () => {
        dialog.close();
      });
    }

    if (filterDialogForm) {
        filterDialogForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(filterDialogForm);
            const type = formData.get('type');
            const status = formData.get('status');

            const filteredDevices = deviceRows.filter(device => {
                const typeMatch = type === 'all' || device.type === type;
                const statusMatch = status === 'all' || device.status === status;
                return typeMatch && statusMatch;
            });

            renderDeviceTable(filteredDevices);
            toast('Filter applied.', 'success');
            filterDialog.close();
        });

        filterDialogForm.addEventListener('reset', () => {
            renderDeviceTable();
            toast('Filter cleared.', 'info');
            filterDialog.close();
        });
    }

    // Configure device dialog
    if (configureDialogForm) {
        configureDialogForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            if (!currentConfigDevice) {
                toast('No device selected', 'error');
                return;
            }
            
            const formData = new FormData(configureDialogForm);
            const newConfig = {
                sensitivity: parseFloat(formData.get('sensitivity')),
                threshold: parseInt(formData.get('threshold')),
                mode: formData.get('mode'),
                sampleRate: parseInt(formData.get('sampleRate'))
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/v1/devices/${currentConfigDevice.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config: newConfig })
                });
                
                if (!response.ok) throw new Error('Failed to update configuration');
                
                await loadDevices(); // Reload devices to show updated config
                toast(`Configuration updated for ${currentConfigDevice.deviceId}`, 'success');
                console.log(`[config] Updated ${currentConfigDevice.deviceId}:`, newConfig);
                configureDialog.close();
                configureDialogForm.reset();
            } catch (err) {
                console.error('Configuration error:', err);
                toast('Failed to update configuration', 'error');
            }
        });

        configureDialogForm.addEventListener('reset', () => {
            configureDialog.close();
        });
    }
  }

  function performRegistrySearch() {
    const input = document.getElementById('registrySearch');
    const results = document.getElementById('registryResults');
    if (!input || !results) return;
    const term = input.value.trim();
    if (!term) {
      results.textContent = 'Enter a device ID or tenant to search the registry.';
      return;
    }
    const matches = deviceRows.filter((row) =>
      row.deviceId.toLowerCase().includes(term.toLowerCase()) ||
      row.tenant.toLowerCase().includes(term.toLowerCase())
    );
    if (matches.length === 0) {
      results.textContent = `No devices found for "${term}".`;
      toast('No devices matched your search.', 'warning');
      return;
    }
    results.innerHTML = matches
      .map((match) => `<div>• ${match.deviceId} — ${match.tenant} (${match.location})</div>`)
      .join('');
    toast(`${matches.length} device(s) found.`, 'success');
  }

  function refreshNetworkMetrics() {
    const container = document.getElementById('networkMetrics');
    if (!container) return;
    container.innerHTML = '';
    ['Packet loss 0.2%', 'Wi-Fi RSSI -63 dBm', 'MQTT reconnects: 2', 'Edge gateway uptime: 99.98%'].forEach((metric) => {
      const div = document.createElement('div');
      div.className = 'metric';
      div.textContent = metric;
      container.appendChild(div);
    });
    toast('Network metrics refreshed from CloudWatch.', 'success');
  }

  function deployFirmware() {
    const select = document.getElementById('firmwareVersion');
    const log = document.getElementById('firmwareLog');
    if (!select || !log) return;
    const version = select.value;
    const message = `[${new Date().toLocaleTimeString()}] Deployment queued for firmware v${version}.`;
    log.textContent = `${message}\n` + log.textContent;
    toast(`Firmware v${version} deployment queued.`, 'info');
  }

  function initConfigForm() {
    const form = document.getElementById('configForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      toast('Configuration payload published via AWS IoT Jobs.', 'success');
      form.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadDevices();
    renderNetworkStats();
    renderFirmwareQueue();
    initNav();
    initTableActions();
    initGlobalButtons();
    initConfigForm();
  });
})();
