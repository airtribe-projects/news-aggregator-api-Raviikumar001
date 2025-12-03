const express = require('express');
const { authenticate } = require('../utils/authMiddleware');
const { normalizePreferences } = require('../utils/normalizePreferences');
const { updateUserPreferences } = require('../utils/userStore');

const router = express.Router();

const handleGetPreferences = (req, res) => {
    return res.status(200).json({ preferences: req.user.preferences });
};

const handlePutPreferences = (req, res) => {
    const normalized = normalizePreferences(req.body.preferences);
    const updated = updateUserPreferences(req.user.email, normalized);
    if (!updated) {
        return res.status(404).json({ error: 'User not found' });
    }
    req.user.preferences = updated.preferences;
    return res.status(200).json({ preferences: updated.preferences });
};

router.get(['/preferences', '/users/preferences'], authenticate, handleGetPreferences);
router.put(['/preferences', '/users/preferences'], authenticate, handlePutPreferences);

module.exports = router;
