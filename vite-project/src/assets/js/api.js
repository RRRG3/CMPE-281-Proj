const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = isLocal ? 'http://localhost:5174' : ''; // '' means same-origin behind Nginx

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
  if (isLocal) return 'ws://localhost:5174/ws';
  const proto = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  return `${proto}${location.host}/ws`;
}
