const encoder = new TextEncoder();

export function randomToken(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(data);
}

export function makeAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return raw.match(/.{1,4}/g).join('-');
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  let value = '';
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemBytes(pem) {
  const compact = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(compact);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function signBody(body, privateKeyPem) {
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyBody(body, signature, publicKeyPem) {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey('spki', pemBytes(publicKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const bytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes, encoder.encode(body));
  } catch { return false; }
}
