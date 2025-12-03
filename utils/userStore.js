const users = new Map();

const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : '');

const findUserByEmail = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return users.get(normalized) || null;
};

const saveUser = (user) => {
    const normalizedEmail = normalizeEmail(user.email);
    users.set(normalizedEmail, user);
    return user;
};

const updateUserPreferences = (email, preferences = []) => {
    const normalized = normalizeEmail(email);
    const user = users.get(normalized);
    if (!user) {
        return null;
    }
    user.preferences = preferences;
    users.set(normalized, user);
    return user;
};

module.exports = {
    findUserByEmail,
    saveUser,
    updateUserPreferences
};
