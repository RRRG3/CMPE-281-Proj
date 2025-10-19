(function () {
  const toast = window.showToast || (() => {});

  const timelineEvents = [
    {
      title: '🔴 Sound Pattern Detected',
      description: 'ML model detected fall sound pattern with 87% confidence. Audio signature matches trained emergency patterns.',
      time: '21:32:03 PDT',
      tone: '#ef4444'
    },
    {
      title: '🤖 ML Classification Complete',
      description: 'TensorFlow model v2.4.1 classified event as "Fall Emergency" via SageMaker inference endpoint.',
      time: '21:32:05 PDT (2.1s latency)',
      tone: '#f59e0b'
    },
    {
      title: '📧 Notifications Sent',
      description: 'Emergency alerts sent via SNS to family members and emergency contacts. SMS, Email, and Push notifications delivered successfully.',
      time: '21:32:08 PDT',
      tone: '#3b82f6'
    },
    {
      title: '✅ Alert Acknowledged',
      description: 'Alert acknowledged by: John Doe (House Owner). Status: Family member on-site, situation under control.',
      time: '21:35:42 PDT',
      tone: '#10b981'
    }
  ];

  const infoEntries = [
    { label: 'Alert ID', value: 'ALT-789XYZ' },
    { label: 'Severity Level', value: 'HIGH - Emergency' },
    { label: 'Alert Type', value: 'Fall Detection' },
    { label: 'Response Time (P95)', value: '2.1 seconds' },
    { label: 'Current Status', value: 'Awaiting acknowledgement' }
  ];

  const notificationRecipients = [
    { icon: '📧', text: 'Email sent to family@example.com', delivered: true },
    { icon: '📱', text: 'SMS sent to +1-555-0123', delivered: true },
    { icon: '🔔', text: 'Push notification to mobile app', delivered: true },
    { icon: '💬', text: 'WebSocket real-time alert', delivered: true }
  ];

  function renderTimeline() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    timeline.innerHTML = '';
    timelineEvents.forEach((event) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML = `
        <span class="timeline-dot" style="color: ${event.tone};"></span>
        <div class="timeline-card" style="border-color: ${event.tone};">
            <div class="timeline-title">${event.title}</div>
            <div class="timeline-desc">${event.description}</div>
            <div class="timeline-time">${event.time}</div>
        </div>
      `;
      timeline.appendChild(item);
    });
  }

  function renderInfo() {
    const infoGrid = document.getElementById('alertInfo');
    if (!infoGrid) return;
    infoGrid.innerHTML = '';
    infoEntries.forEach((entry) => {
      const dt = document.createElement('dt');
      dt.textContent = entry.label;
      const dd = document.createElement('dd');
      dd.textContent = entry.value;
      infoGrid.append(dt, dd);
    });
  }

  function renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    list.innerHTML = '';
    notificationRecipients.forEach((recipient) => {
      const item = document.createElement('div');
      item.className = 'notification-item delivered';
      item.innerHTML = `
        <span class="notif-icon">${recipient.icon}</span>
        <span class="notif-text">${recipient.text}</span>
        <span class="notif-check">✓</span>
      `;
      list.appendChild(item);
    });
  }

  function renderWaveform() {
    const container = document.getElementById('waveform');
    if (!container) return;
    container.innerHTML = `
      <svg viewBox="0 0 800 120" role="img" aria-label="Audio waveform visualization">
        <path d="M 0 60 Q 50 40 100 60 T 200 60 Q 250 30 300 60 T 400 60 Q 450 80 500 60 T 600 60 Q 650 45 700 60 T 800 60"
              stroke="#3b82f6" stroke-width="3" fill="none"></path>
        <path d="M 0 60 Q 50 75 100 60 T 200 60 Q 250 85 300 60 T 400 60 Q 450 50 500 60 T 600 60 Q 650 70 700 60 T 800 60"
              stroke="#3b82f6" stroke-width="3" fill="none" opacity="0.5"></path>
        <rect x="250" y="10" width="120" height="100" fill="rgba(239, 68, 68, 0.1)" rx="8"></rect>
        <text x="310" y="105" text-anchor="middle" font-size="12" fill="#ef4444" font-weight="bold">Fall Event</text>
      </svg>
    `;
  }

  function initActions() {
    const status = document.getElementById('alertStatus');
    const infoGrid = document.getElementById('alertInfo');
    const actions = document.querySelectorAll('.action-btn');
    const exportButton = document.getElementById('exportAlert');

    const updateStatus = (text, tone) => {
      if (!status) return;
      status.dataset.status = tone;
      status.querySelector('.status-text').textContent = text;
    };

    actions.forEach((button) => {
      button.addEventListener('click', () => {
        const { action } = button.dataset;
        switch (action) {
          case 'acknowledge':
            updateStatus('Alert acknowledged by John Doe', 'acknowledged');
            if (infoGrid) {
              const statusEntry = infoGrid.querySelector('dd:last-child');
              if (statusEntry) statusEntry.textContent = 'Acknowledged by John Doe';
            }
            toast('Alert acknowledged successfully.', 'success');
            break;
          case 'share':
            toast('Alert shared with family contacts.', 'info');
            break;
          case 'download':
            toast('Audio clip download started.', 'success');
            break;
          case 'call':
            updateStatus('Emergency services contacted', 'escalated');
            toast('Dialling emergency services...', 'warning');
            break;
          default:
            toast('Action completed.', 'success');
        }
      });
    });

    if (exportButton) {
      exportButton.addEventListener('click', () => {
        toast('Exporting alert as PDF report...', 'info');
      });
    }
  }

  function initAudio() {
    const playButton = document.getElementById('playAudio');
    if (!playButton) return;

    let audioContext;
    let isPlaying = false;

    const playTone = async () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.setValueAtTime(440, now + 0.4);
      oscillator.frequency.setValueAtTime(880, now + 0.8);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.0, now + 1.2);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 1.2);

      oscillator.addEventListener('ended', () => {
        isPlaying = false;
        playButton.classList.remove('playing');
        playButton.textContent = '▶️ Play Audio Clip (3.2 seconds)';
      });
    };

    playButton.addEventListener('click', async () => {
      if (isPlaying) return;
      isPlaying = true;
      playButton.classList.add('playing');
      playButton.textContent = '⏸️ Playing emergency audio';
      toast('Playing synthesised audio sample...', 'info');
      try {
        await playTone();
      } catch (error) {
        toast('Unable to play audio: ' + error.message, 'error');
        isPlaying = false;
        playButton.classList.remove('playing');
        playButton.textContent = '▶️ Play Audio Clip (3.2 seconds)';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTimeline();
    renderInfo();
    renderNotifications();
    renderWaveform();
    initActions();
    initAudio();
  });
})();
