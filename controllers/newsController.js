const axios = require('axios');
const { normalizePreferences } = require('../utils/normalizePreferences');
const {
    addReadArticle,
    addFavoriteArticle,
    getReadArticles,
    getFavoriteArticles
} = require('../utils/userStore');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CACHE_TTL_MS = 60 * 1000;
const newsCache = new Map();
const TOP_HEADLINE_CATEGORIES = new Set(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']);
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const axiosClient = axios.create({
    baseURL: 'https://newsapi.org/v2',
    timeout: 8000,
    headers: {
        Accept: 'application/json'
    }
});

const createArticleId = (article) => {
    const sourceValue = article.url || `${article.title || 'article'}-${article.publishedAt || Date.now()}`;
    return Buffer.from(sourceValue).toString('base64url');
};

const attachArticleIds = (articles) =>
    articles.map((article) => ({
        ...article,
        id: article.id || createArticleId(article)
    }));

const determineEndpoint = (preferences = []) => {
    const normalized = normalizePreferences(preferences);
    const normalizedLower = normalized.map((preference) => preference.toLowerCase());
    const headlineCategory = normalizedLower.find((pref) => TOP_HEADLINE_CATEGORIES.has(pref));

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

    const query = normalizedLower.length ? normalizedLower.join(' OR ') : 'breaking news';
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
        cacheSuffix: `search:${normalizedLower.length ? normalizedLower.join('|') : 'default'}`
    };
};

const buildCacheKey = (endpoint, cacheSuffix) => `${endpoint}:${cacheSuffix}`;

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

const ensureArticlesForPreferences = async (preferences = []) => {
    const { endpoint, params, cacheSuffix } = determineEndpoint(preferences);
    const cacheKey = buildCacheKey(endpoint, cacheSuffix);
    const cached = newsCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
        return { articles: cached.articles, endpoint, params, cacheKey };
    }

    const freshArticles = await fetchNewsFromApi(endpoint, params);
    const articlesWithIds = attachArticleIds(freshArticles);
    newsCache.set(cacheKey, {
        articles: articlesWithIds,
        endpoint,
        params,
        updatedAt: now
    });

    return { articles: articlesWithIds, endpoint, params, cacheKey };
};

const getNewsForUser = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(200).json({
            news: [],
            notice: 'NEWS_API_KEY is not configured; returning an empty result set for now.'
        });
    }

    try {
        const { articles } = await ensureArticlesForPreferences(req.user.preferences);
        return res.status(200).json({ news: articles });
    } catch (error) {
        console.error('News fetch failed', error);
        const message = (error.response && error.response.data && error.response.data.message)
            ? error.response.data.message
            : 'Unable to reach external news provider';
        return res.status(502).json({ error: message });
    }
};

const findArticleById = async (preferences, articleId) => {
    const { articles } = await ensureArticlesForPreferences(preferences);
    return articles.find((article) => article.id === articleId) || null;
};

const markArticleRead = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(503).json({ error: 'NEWS_API_KEY is required to mark articles' });
    }

    const article = await findArticleById(req.user.preferences, req.params.id);

    if (!article) {
        return res.status(404).json({ error: 'Article not found in the cache' });
    }

    const updated = addReadArticle(req.user.email, article);
    req.user.readArticles = updated || [];
    return res.status(200).json({ read: req.user.readArticles });
};

const markArticleFavorite = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(503).json({ error: 'NEWS_API_KEY is required to mark articles' });
    }

    const article = await findArticleById(req.user.preferences, req.params.id);
    if (!article) {
        return res.status(404).json({ error: 'Article not found in the cache' });
    }

    const updated = addFavoriteArticle(req.user.email, article);
    req.user.favoriteArticles = updated || [];
    return res.status(200).json({ favorites: req.user.favoriteArticles });
};

const getReadNews = (req, res) => {
    const items = getReadArticles(req.user.email);
    return res.status(200).json({ read: items });
};

const getFavoriteNews = (req, res) => {
    const items = getFavoriteArticles(req.user.email);
    return res.status(200).json({ favorites: items });
};

const searchNews = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(503).json({ error: 'NEWS_API_KEY is required to search articles' });
    }

    const keyword = (req.params.keyword || '').trim();
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required for searching' });
    }

    const { articles } = await ensureArticlesForPreferences(req.user.preferences);
    const lowerKeyword = keyword.toLowerCase();
    const results = articles.filter((article) => {
        const haystack = [article.title, article.description, article.content, article.author, article.source?.name]
            .filter(Boolean)
            .map((value) => value.toLowerCase());
        return haystack.some((field) => field.includes(lowerKeyword));
    });

    return res.status(200).json({ keyword, results });
};

const refreshCachedEntry = async (cacheKey, entry) => {
    try {
        const freshArticles = await fetchNewsFromApi(entry.endpoint, entry.params);
        const articlesWithIds = attachArticleIds(freshArticles);
        newsCache.set(cacheKey, {
            ...entry,
            articles: articlesWithIds,
            updatedAt: Date.now()
        });
    } catch (error) {
        console.error(`Cache refresh failed for ${cacheKey}`, error.message || error);
    }
};

const refreshAllCaches = async () => {
    const entries = Array.from(newsCache.entries());
    for (const [cacheKey, entry] of entries) {
        await refreshCachedEntry(cacheKey, entry);
    }
};

if (NEWS_API_KEY) {
    setInterval(() => {
        refreshAllCaches().catch((error) => console.error('Periodic cache refresh failed', error));
    }, REFRESH_INTERVAL_MS);
}

module.exports = {
    getNewsForUser,
    markArticleRead,
    markArticleFavorite,
    getReadNews,
    getFavoriteNews,
    searchNews
};
