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

const isISODate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const determineEndpoint = (preferences = [], options = {}) => {
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
    const todayStr = new Date().toISOString().split('T')[0];

    // Parse options: prefer explicit from/to; otherwise `days`; default to 7 days
    let from = null;
    let to = null;
    if (isISODate(options.from) && isISODate(options.to)) {
        from = options.from;
        to = options.to;
    } else if (isISODate(options.from) && !options.to) {
        from = options.from;
        to = todayStr;
    } else if (Number(options.days) && Number(options.days) > 0) {
        const days = Math.max(1, Number(options.days));
        const d = new Date();
        const fromDt = new Date(d.getTime() - days * 24 * 60 * 60 * 1000);
        from = fromDt.toISOString().split('T')[0];
        to = todayStr;
    } else {
        // Default to 7 days
        const d = new Date();
        const fromDt = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000);
        from = fromDt.toISOString().split('T')[0];
        to = todayStr;
    }
    return {
        endpoint: '/everything',
        params: {
            q: query,
            from,
            to,
            sortBy: 'popularity',
            language: 'en',
            pageSize: 20
        },
        cacheSuffix: `search:${normalizedLower.length ? normalizedLower.join('|') : 'default'}:from:${from}:to:${to}`
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

const ensureArticlesForPreferences = async (preferences = [], options = {}) => {
    const { endpoint, params, cacheSuffix } = determineEndpoint(preferences, options);
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
        const options = {
            from: req.query.from,
            to: req.query.to,
            days: req.query.days
        };
        const { articles } = await ensureArticlesForPreferences(req.user.preferences, options);
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

const { validateSearchKeyword } = require('../utils/validation');

const searchNews = async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(503).json({ error: 'NEWS_API_KEY is required to search articles' });
    }

    const keywordRaw = req.params.keyword || '';
    const keyword = decodeURIComponent(String(keywordRaw)).trim();
    const validation = validateSearchKeyword(keyword);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid keyword', details: validation.errors });
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

let refreshTimer = null;

const startCacheRefresh = (intervalMs = REFRESH_INTERVAL_MS) => {
    if (!NEWS_API_KEY) return;
    if (process.env.NODE_ENV === 'test') return; 
    if (refreshTimer) return; 
    refreshTimer = setInterval(() => {
        refreshAllCaches().catch((error) => console.error('Periodic cache refresh failed', error));
    }, intervalMs);
    // Allow process to exit if this is the only thing left
    if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
};

const stopCacheRefresh = () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
};

module.exports = {
    getNewsForUser,
    markArticleRead,
    markArticleFavorite,
    getReadNews,
    getFavoriteNews,
    searchNews,
    startCacheRefresh,
    stopCacheRefresh,
    REFRESH_INTERVAL_MS
};
