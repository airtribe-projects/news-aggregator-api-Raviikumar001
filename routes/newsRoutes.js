const express = require('express');
const { authenticate } = require('../utils/authMiddleware');
const { getNewsForUser } = require('../controllers/newsController');

const router = express.Router();

router.get('/news', authenticate, getNewsForUser);

module.exports = router;
