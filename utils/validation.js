const { z } = require('zod');

// Reusable validators
const emailValidator = z.string().email('Valid email is required');
const passwordValidator = z.string().min(8, 'Password must be at least 8 characters');
const preferenceItem = z.string().min(1, 'Preferences must be non-empty strings');
const preferencesArray = z.array(preferenceItem).optional();
const nameValidator = z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or fewer')
    .refine((s) => !/[<>\n\r\t]/.test(s), 'Name contains invalid control characters'));

const registrationSchema = z.object({
    name: nameValidator,
    email: emailValidator,
    password: passwordValidator,
    preferences: preferencesArray
});

const loginSchema = z.object({
    email: emailValidator,
    password: passwordValidator
});

const preferencesSchema = z.object({
    preferences: preferencesArray
});

const searchKeywordSchema = z.string()
    .min(1, 'Keyword is required')
    .max(100, 'Keyword must be 100 characters or fewer')
    .refine((s) => !/[<>\n\r\t]/.test(s), 'Keyword contains invalid control characters');

const formatZodErrors = (error, contextName) => {
    if (!error || !error.errors) return [];
    return error.errors.map((entry) => ({
        path: (entry.path && entry.path.length) ? entry.path.join('.') : (contextName ? `<${contextName}.root>` : '<request.body>'),
        message: entry.message
    }));
};

const validateRegistration = (payload) => {
    try {
        const value = registrationSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error, 'registration') };
    }
};

const validateLogin = (payload) => {
    try {
        const value = loginSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error, 'login') };
    }
};

const validatePreferences = (payload) => {
    try {
        const value = preferencesSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error, 'preferences') };
    }
};

const validateSearchKeyword = (payload) => {
    try {
        const value = searchKeywordSchema.parse(payload);
        return { success: true, value };
    } catch (error) {
        return { success: false, errors: formatZodErrors(error, 'search') };
    }
};

module.exports = {
    validateRegistration,
    validateLogin,
    validatePreferences
    , validateSearchKeyword
};

module.exports.validators = {
    emailValidator,
    passwordValidator,
    preferenceItem,
    preferencesArray
};
module.exports.validators.nameValidator = nameValidator;
