const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : '');

const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
};

const loadUsersFromDisk = () => {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            return {};
        }
        const contents = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(contents);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return {};
    } catch (error) {
        console.error('Unable to read user store', error);
        return {};
    }
};

const users = new Map(Object.entries(loadUsersFromDisk()));

const persistUsers = () => {
    try {
        ensureDataDir();
        const payload = Object.fromEntries(users);
        fs.writeFileSync(USERS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (error) {
        console.error('Unable to persist users', error);
    }
};

const findUserByEmail = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return users.get(normalized) || null;
};

const saveUser = (user) => {
    const normalizedEmail = normalizeEmail(user.email);
    const storedUser = {
        ...user,
        email: normalizedEmail
    };
    users.set(normalizedEmail, storedUser);
    persistUsers();
    return storedUser;
};

const updateUserPreferences = (email, preferences = []) => {
    const normalized = normalizeEmail(email);
    const user = users.get(normalized);
    if (!user) {
        return null;
    }
    const updatedUser = {
        ...user,
        preferences
    };
    users.set(normalized, updatedUser);
    persistUsers();
    return updatedUser;
};

module.exports = {
    findUserByEmail,
    saveUser,
    updateUserPreferences
};
