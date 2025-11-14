const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

// For local development, use localhost:3000
// For production, replace with your EC2 IP: 'http://YOUR_EC2_IP' or 'http://YOUR_EC2_IP:3000'
export const API_BASE = isLocal ? 'http://localhost:3000' : 'http://localhost:3000'; // TODO: Replace with EC2 IP after deployment

export async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function wsUrl() {
  if (isLocal) return 'ws://localhost:3000/ws';
  // For production, replace with your EC2 IP
  return 'ws://localhost:3000/ws'; // TODO: Replace with EC2 IP after deployment
}
