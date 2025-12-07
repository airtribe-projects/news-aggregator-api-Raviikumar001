const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'news-aggregator-secret';
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const signToken = (payload, options = {}) => jwt.sign(payload, JWT_SECRET, { expiresIn: DEFAULT_EXPIRES_IN, ...options });
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        // Normalize errors so callers can make specific decisions
        const error = new Error(err.message || 'Invalid token');
        if (err.name === 'TokenExpiredError') {
            error.code = 'TOKEN_EXPIRED';
        } else {
            error.code = 'TOKEN_INVALID';
        }
        throw error;
    }
};

module.exports = {
    signToken,
    verifyToken
};
