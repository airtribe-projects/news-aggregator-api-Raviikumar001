const MAX_PREF_LENGTH = 100;
const MAX_PREF_COUNT = 50;
const containsControl = (s) => /[<>\n\r\t]/.test(s);

const normalizePreferences = (preferences) => {
    if (!Array.isArray(preferences)) return [];

    const cleaned = preferences
        .filter((item) => item !== null && item !== undefined)
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !containsControl(item))
        .map((item) => item.toLowerCase())
        .filter((item) => item.length <= MAX_PREF_LENGTH);

    // Deduplicate while preserving order and cap count
    const set = new Set();
    const deduped = [];
    for (const p of cleaned) {
        if (!set.has(p)) {
            set.add(p);
            deduped.push(p);
            if (deduped.length >= MAX_PREF_COUNT) break;
        }
    }
    return deduped;
};

module.exports = { normalizePreferences };
