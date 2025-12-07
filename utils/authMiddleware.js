const { verifyToken } = require('./jwtService');
const { findUserByEmail } = require('./userStore');

const authenticate = (req, res, next) => {
    // Do not trim the header entirely: trim token only after extraction so we can
    // distinguish `Bearer` (no space) from `Bearer    ` (spaces but no token).
    const authHeader = req.headers.authorization || '';
    // Capture the token component after the whitespace(s); if no match, it's malformed
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }
    // Extract token from capture group and trim surrounding whitespace
    const token = match[1].trim();
    if (!token) {
        return res.status(401).json({ error: 'Token missing' });
    }

    try {
        const payload = verifyToken(token);
        const user = findUserByEmail(payload.email);
        if (!user) {
            // Log masked email and request context for debugging without exposing PII
            const maskEmail = (email = '') => {
                if (!email || typeof email !== 'string') return '';
                const atIndex = email.indexOf('@');
                if (atIndex <= 1) return '***@' + email.slice(atIndex + 1);
                const local = email.slice(0, atIndex);
                const domain = email.slice(atIndex + 1);
                const first = local[0];
                const last = local.length > 1 ? local[local.length - 1] : '';
                const maskedLocal = local.length <= 2 ? first + '*' : `${first}${'*'.repeat(Math.max(1, local.length - 2))}${last}`;
                return `${maskedLocal}@${domain}`;
            };
            const masked = maskEmail(payload.email);
            console.warn(`authMiddleware: token validated but user not found - email: ${masked}, ip: ${req.ip || 'unknown'}`);
            return res.status(401).json({ error: 'User not found for token' });
        }
        req.user = user;
        next();
    } catch (error) {
        if (error && error.code === 'TOKEN_EXPIRED') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { authenticate };
