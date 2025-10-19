(function () {
  const toast = window.showToast || (() => {});

  const kpis = [
    { label: 'Total Devices', value: 347, trend: 'Across 42 homes', tone: '#10b981' },
    { label: 'Online Devices', value: 340, trend: '98.0% availability', tone: '#10b981' },
    { label: 'Offline Devices', value: 7, trend: '⚠ Requires attention', tone: '#ef4444' },
    { label: 'Pending Updates', value: 23, trend: 'Firmware v2.4.1 available', tone: '#f59e0b' }
  ];

  const deviceRows = [
    {
      deviceId: 'DEV-LR-001',
      tenant: 'Johnson Residence (T-001)',
      location: 'Living Room',
      type: 'Audio Sensor',
      status: 'success',
      heartbeat: '30 seconds ago',
      firmware: 'v2.4.1'
    },
    {
      deviceId: 'DEV-BED-002',
      tenant: 'Johnson Residence (T-001)',
      location: 'Bedroom',
      type: 'Video Camera',
      status: 'success',
      heartbeat: '1 minute ago',
      firmware: 'v2.4.1'
    },
    {
      deviceId: 'DEV-KIT-003',
      tenant: 'Johnson Residence (T-001)',
      location: 'Kitchen',
      type: 'Audio/Motion',
      status: 'danger',
      heartbeat: '2 hours ago',
      firmware: 'v2.3.8'
    },
    {
      deviceId: 'DEV-GV-104',
      tenant: 'Green Valley Senior (T-002)',
      location: 'Common Area',
      type: 'Multi-Sensor',
      status: 'success',
      heartbeat: '15 seconds ago',
      firmware: 'v2.4.0'
    },
    {
      deviceId: 'DEV-GV-105',
      tenant: 'Green Valley Senior (T-002)',
      location: 'Room 101',
      type: 'Audio Sensor',
      status: 'warning',
      heartbeat: '5 minutes ago',
      firmware: 'v2.2.5'
    },
    {
      deviceId: 'DEV-SR-201',
      tenant: 'Sunrise Assisted (T-003)',
      location: 'Building A',
      type: 'Video Camera',
      status: 'success',
      heartbeat: '45 seconds ago',
      firmware: 'v2.4.1'
    },
    {
      deviceId: 'DEV-SR-202',
      tenant: 'Sunrise Assisted (T-003)',
      location: 'Building B',
      type: 'Multi-Sensor',
      status: 'success',
      heartbeat: '22 seconds ago',
      firmware: 'v2.4.1'
    },
    {
      deviceId: 'DEV-OT-301',
      tenant: 'Oak Tree Manor (T-004)',
      location: 'Main Hall',
      type: 'Audio Sensor',
      status: 'danger',
      heartbeat: '3 hours ago',
      firmware: 'v2.3.5'
    }
  ];

  const networkStats = [
    { label: 'Active Connections', value: '340', tone: '#10b981' },
    { label: 'Messages/sec', value: '1,247', tone: '#3b82f6' },
    { label: 'Avg Latency', value: '42ms', tone: '#10b981' },
    { label: 'Failed Messages', value: '3', tone: '#ef4444' }
  ];

  const firmwareQueue = [
    {
      title: 'v2.4.1 Production Rollout',
      description: '23 devices pending update',
      status: 'In Progress',
      completion: 65,
      accent: '#3b82f6'
    },
    {
      title: 'v2.5.0 Canary Group',
      description: '5 devices testing new version',
      status: 'Healthy',
      completion: 100,
      accent: '#10b981',
      success: true
    }
  ];

  function renderKpis() {
    const grid = document.getElementById('iotKpiGrid');
    if (!grid) return;
    grid.innerHTML = '';
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

  function renderDeviceTable() {
    const tbody = document.querySelector('#deviceTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    deviceRows.forEach((device) => {
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

  function initTableActions() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action="configure"]');
      if (!button) return;
      const deviceId = button.dataset.device;
      toast(`Opening configuration for ${deviceId}`, 'info');
    });
  }

  function initGlobalButtons() {
    const dialog = document.getElementById('deviceDialog');
    const dialogForm = document.getElementById('deviceDialogForm');

    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        switch (action) {
          case 'filter':
            toast('Filter controls opened.', 'info');
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
        toast('Launching real-time command center...', 'info');
      });
    }

    if (dialogForm) {
      dialogForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(dialogForm);
        const rawStatus = (formData.get('status') || '').toLowerCase();
        const statusMapping = {
          online: 'success',
          offline: 'danger',
          warning: 'warning'
        };
        const normalizedStatus = statusMapping[rawStatus] || 'warning';

        const newDevice = {
          deviceId: formData.get('deviceId'),
          tenant: formData.get('tenant'),
          location: formData.get('location'),
          type: formData.get('type'),
          status: normalizedStatus,
          heartbeat: 'Just registered',
          firmware: 'v2.4.1'
        };
        deviceRows.unshift(newDevice);
        renderDeviceTable();
        toast(`${newDevice.deviceId} registered successfully.`, 'success');
        dialogForm.reset();
        dialog.close();
      });

      dialogForm.addEventListener('reset', () => {
        dialog.close();
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

  document.addEventListener('DOMContentLoaded', () => {
    renderKpis();
    renderDeviceTable();
    renderNetworkStats();
    renderFirmwareQueue();
    initNav();
    initTableActions();
    initGlobalButtons();
    initConfigForm();
  });
})();
