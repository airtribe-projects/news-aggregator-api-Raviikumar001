const bcrypt = require('bcrypt');
const { signToken } = require('../utils/jwtService');
const { normalizePreferences } = require('../utils/normalizePreferences');
const { findUserByEmail, saveUser } = require('../utils/userStore');

const SALT_ROUNDS = 10;

const registerUser = async (req, res) => {
    const { name, email, password, preferences } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

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
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

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
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Login failed', error);
        return res.status(500).json({ error: 'Unable to login right now' });
    }
};

module.exports = {
    registerUser,
    loginUser
};
