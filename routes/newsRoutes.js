const express = require('express');
const { authenticate } = require('../utils/authMiddleware');
const {
	getNewsForUser,
	markArticleRead,
	markArticleFavorite,
	getReadNews,
	getFavoriteNews,
	searchNews
} = require('../controllers/newsController');

const router = express.Router();

router.get('/news', authenticate, getNewsForUser);
router.post('/news/:id/read', authenticate, markArticleRead);
router.post('/news/:id/favorite', authenticate, markArticleFavorite);
router.get('/news/read', authenticate, getReadNews);
router.get('/news/favorites', authenticate, getFavoriteNews);
router.get('/news/search/:keyword', authenticate, searchNews);

module.exports = router;
