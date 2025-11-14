const isLocal = window.location.hostname === 'localhost';

// EC2 Backend IP: 18.117.159.76
export const API_BASE = isLocal 
  ? 'http://localhost:3000'
  : 'http://18.117.159.76:3000';

export const WS_BASE = isLocal 
  ? 'ws://localhost:3000/ws'
  : 'ws://18.117.159.76:3000/ws';

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
  return WS_BASE;
}
