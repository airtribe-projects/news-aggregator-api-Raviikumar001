const bcrypt = require('bcrypt');
const { signToken } = require('../utils/jwtService');
const { normalizePreferences } = require('../utils/normalizePreferences');
const { findUserByEmail, saveUser } = require('../utils/userStore');
const { validateRegistration, validateLogin } = require('../utils/validation');

const SALT_ROUNDS = 10;

const registerUser = async (req, res) => {
    const validation = validateRegistration(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid registration payload', details: validation.errors });
    }

    const { name, email, password, preferences } = validation.value;
    if (findUserByEmail(email)) {
        return res.status(409).json({ error: 'User with that email already exists' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = {
            name,
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            preferences: normalizePreferences(preferences)
        };
        saveUser(user);
        return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Signup failed', error);
        return res.status(500).json({ error: 'Unable to create user right now' });
    }
};

const loginUser = async (req, res) => {
    const validation = validateLogin(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid login payload', details: validation.errors });
    }

    const { email, password } = validation.value;
    const user = findUserByEmail(email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = signToken({ email: user.email, name: user.name });
        const safeUser = {
            id: user.email,
            email: user.email,
            name: user.name,
            preferences: Array.isArray(user.preferences) ? user.preferences : []
        };
        return res.status(200).json({ token, user: safeUser });
    } catch (error) {
        console.error('Login failed', error);
        return res.status(500).json({ error: 'Unable to login right now' });
    }
};

module.exports = {
    registerUser,
    loginUser
};
