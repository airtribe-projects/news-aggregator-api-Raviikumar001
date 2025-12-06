const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');

const router = express.Router();

router.post(['/register', '/users/signup', '/users/register'], registerUser);
router.post(['/login', '/users/login'], loginUser);

module.exports = router;

