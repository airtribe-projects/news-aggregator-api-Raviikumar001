const { verifyToken } = require('./jwtService');
const { findUserByEmail } = require('./userStore');

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token missing' });
    }

    try {
        const payload = verifyToken(token);
        const user = findUserByEmail(payload.email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { authenticate };
