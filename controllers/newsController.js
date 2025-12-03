const axios = require('axios');

const { normalizePreferences } = require('../utils/normalizePreferences');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CACHE_TTL_MS = 60 * 1000;
const newsCache = new Map();

const TOP_HEADLINE_CATEGORIES = new Set(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']);

const buildCacheKey = (endpoint, cacheSuffix) => `${endpoint}:${cacheSuffix}`;

const axiosClient = axios.create({
    baseURL: 'https://newsapi.org/v2',
    timeout: 8000,
    headers: {
        'Accept': 'application/json'
    }
});

const determineEndpoint = (preferences = []) => {
    const normalized = normalizePreferences(preferences).map((preference) => preference.toLowerCase());
    const headlineCategory = normalized.find((pref) => TOP_HEADLINE_CATEGORIES.has(pref));

    if (headlineCategory) {
        return {
            endpoint: '/top-headlines',
            params: {
                category: headlineCategory,
                country: 'us',
                pageSize: 20
            },
            cacheSuffix: `category:${headlineCategory}`
        };
    }

    const query = normalized.length ? normalized.join(' OR ') : 'breaking news';
    const today = new Date().toISOString().split('T')[0];

    return {
        endpoint: '/everything',
        params: {
            q: query,
            from: today,
            sortBy: 'popularity',
            language: 'en',
            pageSize: 20
        },
        cacheSuffix: `search:${normalized.length ? normalized.join('|') : 'default'}`
    };
};

const fetchNewsFromApi = async (endpoint, params) => {
    if (!NEWS_API_KEY) {
        throw new Error('Missing NEWS_API_KEY');
    }

    const response = await axiosClient.get(endpoint, {
        params,
        headers: {
            'X-Api-Key': NEWS_API_KEY
        }
    });

    if (response?.data?.status !== 'ok') {
        throw new Error(response?.data?.message || 'Invalid response from the news provider');
    }

    return Array.isArray(response.data.articles) ? response.data.articles : [];
};

const getNewsForUser = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(200).json({
            news: [],
            notice: 'NEWS_API_KEY is not configured; returning an empty result set for now.'
        });
    }

    const preferences = req.user.preferences || [];
    const { endpoint, params, cacheSuffix } = determineEndpoint(preferences);
    const cacheKey = buildCacheKey(endpoint, cacheSuffix);
    const cached = newsCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
        return res.status(200).json({ news: cached.articles });
    }

    try {
        const articles = await fetchNewsFromApi(endpoint, params);
        newsCache.set(cacheKey, { articles, updatedAt: now });
        return res.status(200).json({ news: articles });
    } catch (error) {
        console.error('News fetch failed', error);
        const message = (error.response && error.response.data && error.response.data.message)
            ? error.response.data.message
            : 'Unable to reach external news provider';
        return res.status(502).json({ error: message });
    }
};

module.exports = { getNewsForUser };
