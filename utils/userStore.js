const fs = require('fs');
const path = require('path');
const { validators } = require('./validation');
const { emailValidator, nameValidator } = validators;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : '');

const isTestEnvironment = process.env.NODE_ENV === 'test';

const ensureDataDir = async () => {
    try {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
        // If mkdir fails, we still want to log it; caller will handle errors
        console.error('Unable to ensure data directory', err);
        throw err;
    }
};

const loadUsersFromDisk = () => {
    if (isTestEnvironment) {
        return {};
    }

    try {
        const contents = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(contents);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return {};
    } catch (error) {
        // If file does not exist, return an empty object; otherwise log error and return empty
        if (error && error.code === 'ENOENT') {
            return {};
        }
        console.error('Unable to read user store', error);
        return {};
    }
};

const users = new Map(Object.entries(loadUsersFromDisk()));

// Debounced persist to avoid many quick writes to disk
const PERSIST_DEBOUNCE_MS = Number(process.env.PERSIST_DEBOUNCE_MS) || 200;
let persistTimer = null;
const safeStringify = (obj) => {
    try {
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        // Avoid noisy test logs when intentionally passing cyclic objects during tests
        if (!isTestEnvironment) console.error('Unable to stringify users for persistence', error);
        return null;
    }
};

const flushPersist = async () => {
    if (isTestEnvironment) return;
    try {
        await ensureDataDir();
        const payload = Object.fromEntries(users);
        const body = safeStringify(payload);
        if (body === null) {
            // skip writing if serialization failed
            return;
        }
        await fs.promises.writeFile(USERS_FILE, body, 'utf-8');
    } catch (error) {
        console.error('Unable to persist users', error);
    }
};

const schedulePersist = (debounceMs = PERSIST_DEBOUNCE_MS) => {
    if (isTestEnvironment) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
        try {
            await flushPersist();
        } catch (err) {
            console.error('Scheduled persist error', err);
        }
        persistTimer = null;
    }, debounceMs);
    if (typeof persistTimer.unref === 'function') persistTimer.unref();
};

const stopPersist = () => {
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
};

const ensureUserCollections = (user = {}) => ({
    ...user,
    preferences: Array.isArray(user.preferences) ? user.preferences : [],
    readArticles: Array.isArray(user.readArticles) ? user.readArticles : [],
    favoriteArticles: Array.isArray(user.favoriteArticles) ? user.favoriteArticles : []
});

const findUserByEmail = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const stored = users.get(normalized);
    return stored ? ensureUserCollections(stored) : null;
};

const saveUser = (user) => {
    // Validate provided user object before saving
    if (!user || typeof user !== 'object') {
        throw new Error('Invalid user object');
    }
    try {
        // Validate email format
        emailValidator.parse(user.email);
    } catch (err) {
        throw new Error('Invalid email');
    }
    if (user.name !== undefined && user.name !== null) {
        try {
            nameValidator.parse(user.name);
        } catch (err) {
            throw new Error('Invalid name');
        }
    }
    const normalizedEmail = normalizeEmail(user.email);
    const storedUser = {
        ...ensureUserCollections(user),
        email: normalizedEmail
    };
        users.set(normalizedEmail, storedUser);
        // schedule writing to disk (debounced)
        schedulePersist();
    return storedUser;
};

const updateUserPreferences = (email, preferences = []) => {
    const normalized = normalizeEmail(email);
    const user = users.get(normalized);
    if (!user) {
        return null;
    }
    const updatedUser = ensureUserCollections({
        ...user,
        preferences
    });
        users.set(normalized, updatedUser);
        // schedule writing to disk (debounced)
        schedulePersist();
    return updatedUser;
};

const addArticleToCollection = (email, article, collectionKey) => {
    const normalized = normalizeEmail(email);
    const existingUser = users.get(normalized);
    if (!existingUser || !article || !article.id) {
        return null;
    }

    const user = ensureUserCollections(existingUser);

    const snapshot = {
        id: article.id,
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        publishedAt: article.publishedAt
    };

    const collection = Array.isArray(user[collectionKey]) ? [...user[collectionKey]] : [];

    const filtered = collection.filter((entry) => entry.id !== snapshot.id);
    const newCollection = [snapshot, ...filtered];

    const updatedUser = ensureUserCollections({
        ...user,
        [collectionKey]: newCollection
    });
        users.set(normalized, updatedUser);
        schedulePersist();
    return updatedUser[collectionKey];
};

const getUserCollection = (email, collectionKey) => {
    const user = findUserByEmail(email);
    return user ? user[collectionKey] : [];
};

const addReadArticle = (email, article) => addArticleToCollection(email, article, 'readArticles');
const addFavoriteArticle = (email, article) => addArticleToCollection(email, article, 'favoriteArticles');
const getReadArticles = (email) => getUserCollection(email, 'readArticles');
const getFavoriteArticles = (email) => getUserCollection(email, 'favoriteArticles');

module.exports = {
    findUserByEmail,
    saveUser,
    updateUserPreferences,
    addReadArticle,
    addFavoriteArticle,
    getReadArticles,
    getFavoriteArticles
};
module.exports._internal = {
    flushPersist,
    schedulePersist,
    stopPersist
};
module.exports._internal.safeStringify = safeStringify;
