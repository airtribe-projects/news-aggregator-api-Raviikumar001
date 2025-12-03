require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const { authenticate } = require('./utils/authMiddleware');
const { normalizePreferences } = require('./utils/normalizePreferences');
const { updateUserPreferences } = require('./utils/userStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));

app.use('/', authRoutes);   

const newsCache = new Map();
const CACHE_TTL_MS = 60 * 1000;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const buildNewsCacheKey = (preferences) => (preferences.length ? preferences.join('|') : 'default');

const fetchNews = async (preferences) => {
    if (!NEWS_API_KEY) {
        throw new Error('News API key not configured');
    }

    const cacheKey = buildNewsCacheKey(preferences);
    const cached = newsCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
        return cached.articles;
    }

    const query = preferences.length ? preferences.join(' OR ') : 'breaking news';
    const today = new Date().toISOString().split('T')[0];
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('from', today);
    url.searchParams.set('sortBy', 'popularity');
    url.searchParams.set('language', 'en');
    url.searchParams.set('apiKey', NEWS_API_KEY);
    url.searchParams.set('pageSize', '20');

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('News API request failed');
    }
    const data = await response.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    newsCache.set(cacheKey, { articles, updatedAt: now });
    return articles;
};

app.get('/news', authenticate, async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(200).json({ news: [], notice: 'NEWS_API_KEY is not configured; returning an empty result set for now.' });
    }

    try {
        const articles = await fetchNews(req.user.preferences);
        return res.status(200).json({ news: articles });
    } catch (error) {
        console.error('News fetch failed', error);
        return res.status(502).json({ error: 'Unable to reach external news provider' });
    }
});

app.get('/users/preferences', authenticate, (req, res) => {
    return res.status(200).json({ preferences: req.user.preferences });
});

app.put('/users/preferences', authenticate, (req, res) => {
    const { preferences } = req.body;
    const normalized = normalizePreferences(preferences);
    const updated = updateUserPreferences(req.user.email, normalized);
    return res.status(200).json({ preferences: updated ? updated.preferences : normalized });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

if (require.main === module) {
    app.listen(PORT, (err) => {
        if (err) {
            return console.error('Server error', err);
        }
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;