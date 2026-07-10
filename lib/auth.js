// GOV.UK Notify clients send `Authorization: Bearer <jwt>` where the JWT is
// signed with the API key's secret. This mock doesn't have a real per-service
// secret to verify against, so it accepts any well-formed bearer/API-key
// header (keeping it a drop-in target for the real SDKs) and just extracts
// whatever identity info it can for display purposes.
function parseAuthHeader(header) {
  if (!header) return null;
  const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1] : header;
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return { raw: token, serviceId: payload.iss || null, issuedAt: payload.iat || null };
    } catch (err) {
      return { raw: token, serviceId: null, issuedAt: null };
    }
  }
  return { raw: token, serviceId: null, issuedAt: null };
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) {
    return res.status(401).json({
      errors: [
        {
          error: 'AuthError',
          message: 'Unauthorized: authentication token must be provided',
        },
      ],
      status_code: 401,
    });
  }
  req.notifyAuth = parseAuthHeader(header);
  next();
}

function maskToken(token) {
  if (!token) return null;
  if (token.length <= 12) return '****';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

module.exports = { requireAuth, parseAuthHeader, maskToken };
