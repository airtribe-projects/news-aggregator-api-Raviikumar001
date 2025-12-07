const tap = require('tap');
const supertest = require('supertest');
const app = require('../app');
const server = supertest(app);

const mockUser = {
    name: 'Clark Kent',
    email: 'clark@superman.com',
    password: 'Krypt()n8',
    preferences:['movies', 'comics']
};

let token = '';

// Auth tests

tap.test('POST /users/signup', async (t) => { 
    const response = await server.post('/users/signup').send(mockUser);
    t.equal(response.status, 200);
    t.end();
});

tap.test('POST /users/signup with missing email', async (t) => {
    const response = await server.post('/users/signup').send({
        name: mockUser.name,
        password: mockUser.password
    });
    t.equal(response.status, 400);
    t.end();
});

tap.test('POST /users/signup with invalid email', async (t) => {
    const response = await server.post('/users/signup').send({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'Krypt()n8'
    });
    t.equal(response.status, 400);
    t.end();
});

tap.test('POST /users/signup with short name', async (t) => {
    const response = await server.post('/users/signup').send({
        name: 'A',
        email: 'shortname@example.com',
        password: 'Krypt()n8',
        preferences: ['movies']
    });
    t.equal(response.status, 400);
    t.end();
});

tap.test('POST /users/signup with control chars in name', async (t) => {
    const response = await server.post('/users/signup').send({
        name: '<script>',
        email: 'controlchars@example.com',
        password: 'Krypt()n8'
    });
    t.equal(response.status, 400);
    t.end();
});

tap.test('POST /users/signup name trimming', async (t) => {
    const response = await server.post('/users/signup').send({
        name: '  Lucy  ',
        email: 'lucy@example.com',
        password: 'Krypt()n8'
    });
    t.equal(response.status, 200);
    t.end();
});

tap.test('_internal.safeStringify handles cyclic objects', async (t) => {
    const { _internal } = require('../utils/userStore');
    const cyclic = { a: 1 };
    // create cycle
    cyclic.self = cyclic;
    const result = _internal.safeStringify(cyclic);
    t.equal(result, null);
    t.end();
});

tap.test('POST /users/login', async (t) => { 
    const response = await server.post('/users/login').send({
        email: mockUser.email,
        password: mockUser.password
    });
    t.equal(response.status, 200);
    t.hasOwnProp(response.body, 'token');
    token = response.body.token;
    t.end();
});

tap.test('GET /news handles bearer header with multiple spaces', async (t) => {
        // Insert multiple spaces between Bearer and token
        const res = await server
            .get('/news')
            .set('Authorization', `Bearer    ${token}`)
            .expect(200);
        t.ok(Array.isArray(res.body.news), 'News array present');
        t.end();
});

tap.test('GET /news handles leading/trailing whitespace', async (t) => {
        // Surround header with additional whitespace
        const res = await server
            .get('/news')
            .set('Authorization', `   Bearer ${token}   `)
            .expect(200);
        t.ok(Array.isArray(res.body.news), 'News array present');
        t.end();
});

tap.test('GET /news rejects malformed Authorization header (no space)', async (t) => {
        const res = await server
            .get('/news')
            .set('Authorization', `Bearer${token}`)
            .expect(401);
        t.same(res.body, { error: 'Authorization header missing or malformed' });
        t.end();
});

tap.test('GET /news rejects missing token after bearer', async (t) => {
        const res = await server
            .get('/news')
            .set('Authorization', 'Bearer    ')
            .expect(401);
        // HTTP frameworks often trim header values; this may appear as bare 'Bearer',
        // so either 'Token missing' (if token whitespace preserved) or 'Authorization header missing or malformed'
        t.ok(res.body.error === 'Token missing' || res.body.error === 'Authorization header missing or malformed');
        t.end();
});

tap.test('POST /users/login with wrong password', async (t) => {
    const response = await server.post('/users/login').send({
        email: mockUser.email,
        password: 'wrongpassword'
    });
    t.equal(response.status, 401);
    t.end();
});

tap.test('POST /users/login with short password (validation)', async (t) => {
    const response = await server.post('/users/login').send({
        email: mockUser.email,
        password: 'abc'
    });
    t.equal(response.status, 400);
    t.end();
});

// Preferences tests

tap.test('GET /users/preferences', async (t) => {
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 200);
    t.hasOwnProp(response.body, 'preferences');
    t.same(response.body.preferences, mockUser.preferences);
    t.end();
});

tap.test('GET /users/preferences without token', async (t) => {
    const response = await server.get('/users/preferences');
    t.equal(response.status, 401);
    t.end();
});

tap.test('GET /users/preferences with expired token', async (t) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'news-aggregator-secret';
    // sign token that expires almost immediately
    const expiredToken = jwt.sign({ email: mockUser.email, name: mockUser.name }, secret, { expiresIn: '1ms' });
    // wait so token expires
    await new Promise((resolve) => setTimeout(resolve, 20));
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${expiredToken}`);
    t.equal(response.status, 401);
    t.equal(response.body.error, 'Token expired');
    t.end();
});

tap.test('GET /users/preferences with token for unknown user', async (t) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'news-aggregator-secret';
    const ghostToken = jwt.sign({ email: 'ghost@example.com', name: 'Ghost' }, secret, { expiresIn: '1h' });
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${ghostToken}`);
    t.equal(response.status, 401);
    t.equal(response.body.error, 'User not found for token');
    t.end();
});

tap.test('PUT /users/preferences with token for unknown user should return 401', async (t) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'news-aggregator-secret';
    const ghostToken = jwt.sign({ email: 'ghost2@example.com', name: 'Ghost' }, secret, { expiresIn: '1h' });
    const response = await server.put('/users/preferences').set('Authorization', `Bearer ${ghostToken}`).send({ preferences: ['movies'] });
    t.equal(response.status, 401);
    t.equal(response.body.error, 'User not found for token');
    t.end();
});

tap.test('Default JWT_EXPIRES_IN from env used on signToken', async (t) => {
    // Temporarily set env var and re-require the jwtService to pick it up
    const prev = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '1ms';
    const jwtServicePath = require.resolve('../utils/jwtService');
    delete require.cache[jwtServicePath];
    const { signToken } = require('../utils/jwtService');
    const token = signToken({ email: mockUser.email, name: mockUser.name });
    // Give it a moment to expire
    await new Promise((resolve) => setTimeout(resolve, 20));
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 401);
    t.equal(response.body.error, 'Token expired');
    // Restore env and clear module cache
    process.env.JWT_EXPIRES_IN = prev;
    delete require.cache[jwtServicePath];
    t.end();
});

tap.test('PUT /users/preferences', async (t) => {
    const response = await server.put('/users/preferences').set('Authorization', `Bearer ${token}`).send({
        preferences: ['movies', 'comics', 'games']
    });
    t.equal(response.status, 200);
});

tap.test('Check PUT /users/preferences', async (t) => {
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 200);
    t.same(response.body.preferences, ['movies', 'comics', 'games']);
    t.end();
});

tap.test('PUT /users/preferences normalization', async (t) => {
    const response = await server.put('/users/preferences').set('Authorization', `Bearer ${token}`).send({
        preferences: ['  Movies  ', 'MOVIES', '\n\t', 'sports', '123', 'COMICS']
    });
    t.equal(response.status, 200);
    t.end();
});

tap.test('Check PUT /users/preferences normalization result', async (t) => {
    const response = await server.get('/users/preferences').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 200);
    // Should normalize: trim, lowercase, dedupe numbers & strings, remove invalid entries
    t.same(response.body.preferences, ['movies', 'sports', '123', 'comics']);
    t.end();
});

// News tests

tap.test('GET /news', async (t) => {
    const response = await server.get('/news').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 200);
    t.hasOwnProp(response.body, 'news');
    t.end();
});

tap.test('GET /news without token', async (t) => {
    const response = await server.get('/news');
    t.equal(response.status, 401);
    t.end();
});

// Search tests
tap.test('GET /news/search/:keyword', async (t) => {
    const response = await server.get('/news/search/health').set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 200);
    t.hasOwnProp(response.body, 'results');
    t.end();
});

tap.test('GET /news/search/:keyword too long', async (t) => {
    const longKeyword = 'a'.repeat(101);
    const response = await server.get(`/news/search/${longKeyword}`).set('Authorization', `Bearer ${token}`);
    t.equal(response.status, 400);
    t.end();
});



tap.teardown(() => {
    process.exit(0);
});