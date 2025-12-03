const normalizePreferences = (preferences) => {
    if (!Array.isArray(preferences)) return [];
    return preferences
        .filter((item) => item !== null && item !== undefined)
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean);
};

module.exports = { normalizePreferences };
