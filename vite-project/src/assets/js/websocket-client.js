// WebSocket client for real-time alert updates
class AlertWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.isConnected = false;
    this.shouldReconnect = true;
  }

  connect(tenant_id, house_id) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = 3000; // Backend WebSocket port
    const url = `${protocol}//${host}:${port}/ws?tenant=${tenant_id || 't1'}&house=${house_id || 'h1'}`;

    console.log('[WS] Connecting to:', url);
    this.showConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.showConnectionStatus('connected');
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data);
          
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.showConnectionStatus('error');
      };

      this.ws.onclose = () => {
        console.log('[WS] Connection closed');
        this.isConnected = false;
        this.showConnectionStatus('disconnected');
        this.emit('disconnected', {});

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[WS] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(tenant_id, house_id), this.reconnectDelay);
        }
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.showConnectionStatus('error');
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[WS] Error in ${eventType} listener:`, err);
        }
      });
    }
  }

  showConnectionStatus(status) {
    let banner = document.getElementById('ws-status-banner');
    
    if (status === 'connected') {
      if (banner) banner.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ws-status-banner';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 0.75rem;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 9999;
        animation: slideDown 0.3s ease;
      `;
      document.body.appendChild(banner);
    }

    if (status === 'connecting') {
      banner.style.background = '#3b82f6';
      banner.style.color = 'white';
      banner.textContent = '🔄 Connecting to real-time updates...';
    } else if (status === 'disconnected') {
      banner.style.background = '#f59e0b';
      banner.style.color = 'white';
      banner.textContent = '⚠️ Reconnecting to real-time updates...';
    } else if (status === 'error') {
      banner.style.background = '#ef4444';
      banner.style.color = 'white';
      banner.textContent = '❌ Connection error. Retrying...';
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }
}

// Create global instance
const wsClient = new AlertWebSocketClient();

export default wsClient;
