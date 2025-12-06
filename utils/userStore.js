const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : '');

const isTestEnvironment = process.env.NODE_ENV === 'test';

const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
};

const loadUsersFromDisk = () => {
    if (isTestEnvironment) {
        return {};
    }

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
    if (isTestEnvironment) {
        return;
    }
    try {
        ensureDataDir();
        const payload = Object.fromEntries(users);
        fs.writeFileSync(USERS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (error) {
        console.error('Unable to persist users', error);
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
    const normalizedEmail = normalizeEmail(user.email);
    const storedUser = {
        ...ensureUserCollections(user),
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
    const updatedUser = ensureUserCollections({
        ...user,
        preferences
    });
    users.set(normalized, updatedUser);
    persistUsers();
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
    const existingIndex = collection.findIndex((entry) => entry.id === snapshot.id);
    if (existingIndex !== -1) {
        collection.splice(existingIndex, 1);
    }
    collection.unshift(snapshot);

    const updatedUser = ensureUserCollections({
        ...user,
        [collectionKey]: collection
    });
    users.set(normalized, updatedUser);
    persistUsers();
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
