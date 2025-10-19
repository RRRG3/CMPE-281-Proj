(function () {
  const kpiGrid = document.getElementById('kpiGrid');
  const alertList = document.getElementById('alertList');
  const weeklyStats = document.getElementById('weeklyStats');
  const deviceGrid = document.getElementById('deviceGrid');
  const deviceModal = document.getElementById('deviceModal');
  const deviceForm = document.getElementById('deviceForm');
  const alertFilterModal = document.getElementById('alertFilterModal');
  const alertFilterForm = document.getElementById('alertFilterForm');
  const toast = window.showToast || (() => {});

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

  const alertItems = [
    {
      type: 'warning',
      icon: '🔊',
      title: 'Unusual Noise Pattern - Kitchen',
      meta: 'ML Confidence: 72% | Device: KITCHEN-MIC-02 | Audio recorded',
      time: '1 hour ago'
    },
    {
      type: 'info',
      icon: '🐕',
      title: 'Pet Activity Detected - Living Room',
      meta: 'Normal pattern | Device: LR-CAM-03 | No action required',
      time: '3 hours ago'
    },
    {
      type: 'info',
      icon: '🚪',
      title: 'Door Opened - Main Entrance',
      meta: 'Expected time window | Device: DOOR-SENSOR-01',
      time: '5 hours ago'
    },
    {
      type: 'warning',
      icon: '📱',
      title: 'No Movement Detected - 2+ Hours',
      meta: 'Bedroom zone | AI behavioral monitoring active',
      time: '6 hours ago'
    }
  ];

  const weeklyStatsData = [
    { label: 'Total Alerts', value: '32' },
    { label: 'Avg Response', value: '2.1s' },
    { label: 'False Positives', value: '3' },
    { label: 'ML Accuracy', value: '94%' }
  ];

  const deviceData = [
    {
      name: 'Living Room Audio',
      location: 'Living Room',
      type: '🔊 Audio Sensor',
      status: 'online',
      lastSeen: '1 min ago'
    },
    {
      name: 'Bedroom Camera',
      location: 'Bedroom',
      type: '📹 Video Camera',
      status: 'online',
      lastSeen: '30 sec ago'
    },
    {
      name: 'Kitchen Sensor',
      location: 'Kitchen',
      type: '🔊 Audio/Motion',
      status: 'offline',
      lastSeen: 'Offline: 2 hours'
    },
    {
      name: 'Bathroom Motion',
      location: 'Bathroom',
      type: '🚶 Motion Sensor',
      status: 'online',
      lastSeen: 'Last seen: 5 min ago'
    },
    {
      name: 'Entrance Camera',
      location: 'Main Entrance',
      type: '📹 Video Camera',
      status: 'online',
      lastSeen: 'Last seen: 15 sec ago'
    },
    {
      name: 'Garage Door Sensor',
      location: 'Garage',
      type: '🚪 Door Sensor',
      status: 'online',
      lastSeen: 'Last seen: 2 min ago'
    },
    {
      name: 'Hallway Motion',
      location: 'Hallway',
      type: '🚶 Motion Sensor',
      status: 'online',
      lastSeen: 'Last seen: 45 sec ago'
    },
    {
      name: 'Backyard Camera',
      location: 'Backyard',
      type: '📹 Video Camera',
      status: 'online',
      lastSeen: 'Last seen: 20 sec ago'
    }
  ];

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
      item.addEventListener('click', () => {
        window.location.href = 'alert-detail.html';
      });
      alertList.appendChild(item);
    });
  }

  function renderStats() {
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

  function renderDevices() {
    if (!deviceGrid) return;
    deviceGrid.innerHTML = '';
    deviceData.forEach((device) => {
      const card = document.createElement('article');
      card.className = 'device-card';
      card.innerHTML = `
        <div class="device-status">
            <div class="status-dot ${device.status}"></div>
            <span class="status-text ${device.status}">${device.status.toUpperCase()}</span>
        </div>
        <div class="device-name">${device.name}</div>
        <div class="device-info">📍 ${device.location}</div>
        <div class="device-info">${device.type}</div>
        <div class="device-info">⏱️ ${device.lastSeen}</div>
      `;
      card.addEventListener('click', () => toast(`${device.name} details opened`, 'success'));
      deviceGrid.appendChild(card);
    });
  }

  function renderHistory() {
    const historyTable = document.querySelector('#historyTable tbody');
    if (!historyTable) return;
    historyTable.innerHTML = '';
    historyRows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.timestamp}</td>
        <td>${row.alert}</td>
        <td>${row.device}</td>
        <td class="history-${row.severity}">${row.severity.toUpperCase()}</td>
        <td>${row.status}</td>
      `;
      historyTable.appendChild(tr);
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

    if (window.location.hash === '#admin') {
      const settingsNav = document.querySelector('.nav-item[data-section="settings"]');
      if (settingsNav) settingsNav.click();
    }
  }

  function initQuickActions() {
    document.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        switch (action) {
          case 'emergency':
            toast('Connecting to emergency response line...', 'warning');
            break;
          case 'acknowledge-all':
            toast('All alerts acknowledged.', 'success');
            break;
          case 'generate-report':
            toast('Weekly report is being generated.', 'info');
            break;
          case 'device-settings':
            toast('Opening device settings...', 'info');
            break;
          default:
            toast('Action executed.', 'success');
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
      deviceForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(deviceForm);
        const newDevice = {
          name: formData.get('name'),
          location: formData.get('location'),
          type: formData.get('type'),
          status: formData.get('status'),
          lastSeen: formData.get('status') === 'online' ? 'Just now' : 'Offline: just added'
        };
        deviceData.unshift(newDevice);
        renderDevices();
        toast(`${newDevice.name} added to your home.`, 'success');
        deviceForm.reset();
        deviceModal.close();
      });

      deviceForm.addEventListener('reset', () => {
        deviceModal.close();
      });
    }

    if (alertFilterForm) {
      alertFilterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(alertFilterForm);
        const severity = formData.get('severity');
        const room = formData.get('room')?.toLowerCase();
        const acknowledgedOnly = formData.get('acknowledged');

        const filtered = alertItems.filter((alert) => {
          const severityMatch = !severity || alert.type === severity;
          const roomMatch = !room || alert.title.toLowerCase().includes(room);
          const ackMatch = !acknowledgedOnly || alert.title.includes('Acknowledged');
          return severityMatch && roomMatch && ackMatch;
        });

        renderAlerts(filtered);
        toast(`${filtered.length} alerts match your filters.`, 'info');
        alertFilterModal.close();
      });

      alertFilterForm.addEventListener('reset', () => {
        renderAlerts();
        toast('Filters cleared.', 'success');
        alertFilterModal.close();
      });
    }
  }

  function initHistoryActions() {
    const exportButton = document.querySelector('[data-action="history-export"]');
    if (exportButton) {
      exportButton.addEventListener('click', () => {
        toast('Alert history exported to CSV.', 'success');
      });
    }
  }

  function initReports() {
    document.querySelectorAll('.report-card').forEach((card) => {
      card.addEventListener('click', () => {
        const report = card.dataset.report;
        toast(`Generating ${report} report...`, 'info');
      });
    });
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
    const notificationButton = document.getElementById('notificationButton');
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (notificationButton) {
      notificationButton.addEventListener('click', () => {
        toast('Latest notifications opened.', 'info');
      });
    }

    if (userMenuToggle && userDropdown) {
      const toggleDropdown = () => {
        const isHidden = userDropdown.hasAttribute('hidden');
        if (isHidden) {
          userDropdown.removeAttribute('hidden');
        } else {
          userDropdown.setAttribute('hidden', '');
        }
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
          userDropdown.setAttribute('hidden', '');
        }
      });
    }
  }

  function initPage() {
    if (!kpiGrid) return; // guard for other pages
    renderKpis();
    renderAlerts();
    renderStats();
    renderDevices();
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

  document.addEventListener('DOMContentLoaded', initPage);
})();
