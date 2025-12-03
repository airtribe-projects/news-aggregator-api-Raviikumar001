const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/users/signup', registerUser);
router.post('/users/login', loginUser);

module.exports = router;
