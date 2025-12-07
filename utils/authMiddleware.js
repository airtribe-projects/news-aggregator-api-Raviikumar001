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
