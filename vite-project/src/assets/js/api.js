// Smart Backend Detection - Tries LOCAL first (faster), then EC2
const EC2_BACKEND = 'http://18.226.181.94:3000';
const LOCAL_BACKEND = 'http://localhost:3000';

let API_BASE = LOCAL_BACKEND; // Start with local
let WS_BASE = 'ws://localhost:3000/ws';
let usingAWS = false;
let backendChecked = false;
let detectionPromise = null;

async function detectBackend() {
  if (backendChecked) return;
  
  // If detection is already in progress, wait for it
  if (detectionPromise) {
    await detectionPromise;
    return;
  }
  
  detectionPromise = (async () => {
    console.log('🔍 Detecting available backend...');
    
    // Try LOCAL first (faster for development)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`${LOCAL_BACKEND}/api/v1/alerts/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1 }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        API_BASE = LOCAL_BACKEND;
        WS_BASE = 'ws://localhost:3000/ws';
        usingAWS = false;
        backendChecked = true;
        console.log('✅ Using LOCAL backend (localhost:3000)');
        return;
      }
    } catch (err) {
      console.log('⚠️ Local backend not available, trying EC2...');
    }
    
    // Fallback to EC2
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${EC2_BACKEND}/api/v1/alerts/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1 }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        API_BASE = EC2_BACKEND;
        WS_BASE = 'ws://18.226.181.94:3000/ws';
        usingAWS = true;
        backendChecked = true;
        console.log(' Using AWS EC2 backend (18.226.181.94:3000)');
        return;
      }
    } catch (err) {
      console.error(' EC2 backend also not available!');
    }
    
    // Default to local if both fail
    API_BASE = LOCAL_BACKEND;
    WS_BASE = 'ws://localhost:3000/ws';
    usingAWS = false;
    backendChecked = true;
    console.warn(' No backend responded, defaulting to LOCAL. Please start the backend server.');
  })();
  
  await detectionPromise;
}

export { API_BASE, WS_BASE, usingAWS, detectBackend };

export async function post(path, body) {
  await detectBackend();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get(path) {
  await detectBackend();
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function del(path) {
  await detectBackend();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function wsUrl() {
  return WS_BASE;
}

export function getBackendInfo() {
  return {
    apiBase: API_BASE,
    wsBase: WS_BASE,
    isLocal: !usingAWS,
    isAWS: usingAWS
  };
}
