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

tap.test('POST /users/login with wrong password', async (t) => {
    const response = await server.post('/users/login').send({
        email: mockUser.email,
        password: 'wrongpassword'
    });
    t.equal(response.status, 401);
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