const express = require('express');
const { authenticate } = require('../utils/authMiddleware');
const { normalizePreferences } = require('../utils/normalizePreferences');
const { updateUserPreferences } = require('../utils/userStore');
const { validatePreferences } = require('../utils/validation');

const router = express.Router();

const handleGetPreferences = (req, res) => {
    return res.status(200).json({ preferences: req.user.preferences || [] });
};

const handlePutPreferences = (req, res) => {
    const validation = validatePreferences(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid preferences payload', details: validation.errors });
    }

    const normalized = normalizePreferences(validation.value.preferences || []);
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
