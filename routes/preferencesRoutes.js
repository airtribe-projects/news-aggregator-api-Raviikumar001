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
        // Log masked email and request context to aid debugging without exposing PII
        const maskEmail = (email = '') => {
            if (!email || typeof email !== 'string') return '';
            const atIndex = email.indexOf('@');
            if (atIndex <= 1) return '***@' + email.slice(atIndex + 1);
            const local = email.slice(0, atIndex);
            const domain = email.slice(atIndex + 1);
            const first = local[0];
            const last = local.length > 1 ? local[local.length - 1] : '';
            const maskedLocal = local.length <= 2 ? first + '*' : `${first}${'*'.repeat(Math.max(1, local.length - 2))}${last}`;
            return `${maskedLocal}@${domain}`;
        };

        const masked = maskEmail(req.user.email);
        console.warn(`preferencesRoutes: Failed to update preferences for user not found - email: ${masked}, ip: ${req.ip || 'unknown'}`);
        return res.status(404).json({ error: 'User not found' });
    }
    req.user.preferences = updated.preferences;
    return res.status(200).json({ preferences: updated.preferences });
};

router.get(['/preferences', '/users/preferences'], authenticate, handleGetPreferences);
router.put(['/preferences', '/users/preferences'], authenticate, handlePutPreferences);

module.exports = router;
