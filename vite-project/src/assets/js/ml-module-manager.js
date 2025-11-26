/**
 * ML Module Manager Integration for Admin Dashboard
 */

// Configuration - dynamically determines API base URL
const ML_API_BASE = window.location.origin.replace(':5173', ':3000') + '/api/v1';
let mlAuthToken = localStorage.getItem('access_token');

// Sample inputs for each model
const mlSampleInputs = {
  'anomaly-detection': {
    deviceId: 'DEV-001',
    features: {
      cpu_usage_percent: 78,
      signal_strength: -45,
      heartbeat_interval_ms: 5000,
      memory_usage_percent: 70,
      error_count_1h: 5,
      restart_count_24h: 1,
      temperature_celsius: 60,
      uptime_hours: 100,
    },
  },
  'alert-classification': {
    deviceId: 'DEV-002',
    features: {
      signal_amplitude: 0.92,
      signal_pattern_length: 3.5,
      time_of_day: 14,
      day_of_week: 3,
      historical_alert_count_7d: 5,
      quiet_hours: false,
    },
  },
  'predictive-maintenance': {
    deviceId: 'DEV-003',
    features: {
      device_age_days: 365,
      total_uptime_hours: 8000,
      total_restarts: 50,
      avg_temperature_7d: 75,
      max_temperature_7d: 85,
      avg_cpu_usage_7d: 65,
      avg_memory_usage_7d: 70,
      error_rate_7d: 15,
      last_maintenance_days_ago: 90,
    },
  },
};

window.switchMLTab = function (tab, clickedElement) {
  document.querySelectorAll('.ml-tab').forEach((t) => {
    t.classList.remove('active');
    t.style.color = '#6b7280';
    t.style.borderBottomColor = 'transparent';
  });
  document.querySelectorAll('.ml-tab-content').forEach((c) => (c.style.display = 'none'));

  if (clickedElement) {
    clickedElement.classList.add('active');
    clickedElement.style.color = '#3b82f6';
    clickedElement.style.borderBottomColor = '#3b82f6';
  }

  document.getElementById(`ml-${tab}-content`).style.display = 'block';

  if (tab === 'models') loadMLModels();
  if (tab === 'predict') loadMLModelsForPredict();
  if (tab === 'performance') loadMLSystemStatus();
};

window.loadMLModels = async function () {
  const container = document.getElementById('ml-models-list');
  container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading models...</div>';

  try {
    const response = await fetch(`${ML_API_BASE}/ml/models`, {
      headers: { Authorization: `Bearer ${mlAuthToken}` },
    });

    if (!response.ok) throw new Error('Failed to load models');
    const data = await response.json();

    if (data.models.length === 0) {
      container.innerHTML = '<p style="color: #6b7280;">No models registered</p>';
      return;
    }

    let html = '<table class="table" style="width: 100%;"><thead><tr><th>Model Name</th><th>Type</th><th>Version</th><th>Status</th><th>Accuracy</th></tr></thead><tbody>';

    data.models.forEach((model) => {
      const statusClass = model.status === 'active' ? 'success' : 'warning';
      const accuracy = model.performance_metrics?.accuracy || '-';
      html += `<tr>
                <td><strong>${model.name}</strong></td>
                <td>${model.type.replace('_', ' ')}</td>
                <td>${model.version}</td>
                <td><span class="badge ${statusClass}">${model.status}</span></td>
                <td>${typeof accuracy === 'number' ? accuracy + '%' : accuracy}</td>
            </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px;">Error: ${error.message}</div>`;
  }
};

window.loadMLModelsForPredict = async function () {
  try {
    const response = await fetch(`${ML_API_BASE}/ml/models`, {
      headers: { Authorization: `Bearer ${mlAuthToken}` },
    });
    const data = await response.json();
    const select = document.getElementById('ml-predict-model');
    const metricsSelect = document.getElementById('ml-metrics-model');

    select.innerHTML = '<option value="">Select a model...</option>';
    metricsSelect.innerHTML = '<option value="">Select a model...</option>';

    data.models.forEach((model) => {
      select.innerHTML += `<option value="${model.model_id}">${model.name}</option>`;
      metricsSelect.innerHTML += `<option value="${model.model_id}">${model.name}</option>`;
    });

    if (data.models.length > 0) {
      select.value = data.models[0].model_id;
      loadMLSampleInput();
    }
  } catch (error) {
    console.error('Failed to load models:', error);
  }
};

window.loadMLSampleInput = function () {
  const modelId = document.getElementById('ml-predict-model').value;
  const inputTextarea = document.getElementById('ml-predict-input');
  if (modelId && mlSampleInputs[modelId]) {
    inputTextarea.value = JSON.stringify(mlSampleInputs[modelId], null, 2);
  }
};

window.makeMLPrediction = async function () {
  const modelId = document.getElementById('ml-predict-model').value;
  const inputText = document.getElementById('ml-predict-input').value.trim();
  const resultDiv = document.getElementById('ml-prediction-result');

  if (!modelId) {
    resultDiv.innerHTML = '<div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px;">Please select a model</div>';
    return;
  }

  try {
    const input = JSON.parse(inputText);
    if (!input.features) throw new Error('Input must contain a "features" object');

    resultDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Making prediction...</div>';

    const response = await fetch(`${ML_API_BASE}/ml/predict`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mlAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model_id: modelId, input }),
    });

    if (!response.ok) throw new Error('Prediction failed');
    const result = await response.json();

    let html = '<div style="background: #f0f9ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 1.5rem; margin-top: 1rem;"><h4 style="margin-bottom: 1rem; color: #1e40af; font-weight: 700;">✅ Prediction Result</h4>';
    html += `<div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #bfdbfe;"><span style="font-weight: 600; color: #1e40af;">Prediction:</span><span style="font-weight: 700; color: #1e3a8a; font-family: monospace;">${JSON.stringify(result.prediction)}</span></div>`;
    html += `<div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #bfdbfe;"><span style="font-weight: 600; color: #1e40af;">Confidence:</span><span style="font-weight: 700; color: #1e3a8a; font-family: monospace;">${(result.confidence * 100).toFixed(1)}%</span></div>`;
    html += `<div style="display: flex; justify-content: space-between; padding: 0.75rem 0;"><span style="font-weight: 600; color: #1e40af;">Processing Time:</span><span style="font-weight: 700; color: #1e3a8a; font-family: monospace;">${result.metadata.processingTimeMs}ms</span></div>`;
    html += '</div>';

    resultDiv.innerHTML = html;
  } catch (error) {
    resultDiv.innerHTML = `<div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px;"><strong>Error:</strong> ${error.message}</div>`;
  }
};

window.loadMLSystemStatus = async function () {
  const container = document.getElementById('ml-system-status');
  try {
    const response = await fetch(`${ML_API_BASE}/ml/status`, {
      headers: { Authorization: `Bearer ${mlAuthToken}` },
    });
    const data = await response.json();

    let html = '<div class="stats-grid">';
    html += `<div class="stat-box"><div class="stat-label">Status</div><div class="stat-value" style="color: #10b981;">${data.status}</div></div>`;
    html += `<div class="stat-box"><div class="stat-label">Total Models</div><div class="stat-value">${data.total_models}</div></div>`;
    html += `<div class="stat-box"><div class="stat-label">Loaded Models</div><div class="stat-value">${data.loaded_models}</div></div>`;
    html += '</div>';

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px;">Error: ${error.message}</div>`;
  }
};

window.loadMLMetrics = async function () {
  const modelId = document.getElementById('ml-metrics-model').value;
  const container = document.getElementById('ml-model-metrics');

  if (!modelId) {
    container.innerHTML = '<p style="color: #6b7280;">Select a model to view performance metrics</p>';
    return;
  }

  container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading metrics...</div>';

  try {
    const response = await fetch(`${ML_API_BASE}/ml/models/${modelId}/metrics`, {
      headers: { Authorization: `Bearer ${mlAuthToken}` },
    });
    const data = await response.json();

    let html = '<div class="stats-grid">';
    html += `<div class="stat-box"><div class="stat-label">Total Predictions</div><div class="stat-value">${data.total_predictions}</div></div>`;
    if (data.accuracy) html += `<div class="stat-box"><div class="stat-label">Accuracy</div><div class="stat-value">${data.accuracy}%</div></div>`;
    html += `<div class="stat-box"><div class="stat-label">Avg Latency</div><div class="stat-value">${data.avg_latency_ms}ms</div></div>`;
    html += `<div class="stat-box"><div class="stat-label">Throughput</div><div class="stat-value">${data.throughput.toFixed(2)}/s</div></div>`;
    html += '</div>';

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 1rem; border-radius: 6px;">Error: ${error.message}</div>`;
  }
};

// Auto-load models when ML Models section becomes visible
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      const mlSection = document.querySelector('[data-section="ml-models"]');
      if (mlSection && !mlSection.classList.contains('hidden')) {
        loadMLModels();
      }
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const mlSection = document.querySelector('[data-section="ml-models"]');
  if (mlSection) {
    observer.observe(mlSection, { attributes: true });
  }
});
