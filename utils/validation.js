const { z } = require('zod');

const registrationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    preferences: z.array(z.string().min(1)).optional()
});

const loginSchema = z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(5, 'Password must be at least 5 characters')
});

const preferencesSchema = z.object({
    preferences: z.array(z.string().min(1, 'Preferences must be non-empty strings')).optional()
});

const searchKeywordSchema = z.string()
    .min(1, 'Keyword is required')
    .max(100, 'Keyword must be 100 characters or fewer')
    .refine((s) => !/[<>\n\r\t]/.test(s), 'Keyword contains invalid control characters');

const formatZodErrors = (error) => {
    if (!error || !error.errors) return [];
    return error.errors.map((entry) => ({
        path: entry.path.join('.') || '<root>',
        message: entry.message
    }));
};

const validateRegistration = (payload) => {
    try {
        const value = registrationSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error) };
    }
};

const validateLogin = (payload) => {
    try {
        const value = loginSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error) };
    }
};

const validatePreferences = (payload) => {
    try {
        const value = preferencesSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error) };
    }
};

const validateSearchKeyword = (payload) => {
    try {
        const value = searchKeywordSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error) };
    }
};

module.exports = {
    validateRegistration,
    validateLogin,
    validatePreferences
    , validateSearchKeyword
};
