// Behind Render's proxy every socket comes from the proxy, so per-visitor limits
// have to read the forwarded address. Elsewhere that header can be forged: ignore it.
export function clientAddress(request) {
  const forwarded = process.env.RENDER === 'true' ? String(request.headers['x-forwarded-for'] || '').split(',')[0].trim() : ''
  return forwarded || request.socket.remoteAddress || ''
}
