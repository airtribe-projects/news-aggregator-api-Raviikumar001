# News Aggregator API

A Node.js/Express backend that authenticates users, stores their preferences, and fetches personalized news by integrating with the [NewsAPI](https://newsapi.org). Authentication uses bcrypt/JWT, preferences along with read/favorite metadata persist to a local JSON store, and the `/news` routes cache external responses (covering both `everything` and `top-headlines` flows).

## Features

- User registration/login with password hashing (`bcrypt`) and JWT issuance
- Preferences CRUD plus validation via shared `zod` schemas
- News fetching with caching, periodic refresh (every 5 minutes), and category-aware selection
- Read/favorite tracking for cached articles and keyword search inside cached datasets
- File-backed user storage (`data/users.json`) that is skipped when `NODE_ENV=test`

## Prerequisites

- Node.js v18+ and npm
- NewsAPI key (free tier is sufficient)

## Installation

```bash
git clone <repo>
cd news-aggregator-api-Raviikumar001
npm install
```

Copy the sample environment file:

```bash
cp .env.example .env
```

Then populate `NEWS_API_KEY`, `JWT_SECRET`, `PORT`, etc.

## Environment Variables

```
NEWS_API_KEY=your_newsapi_key
JWT_SECRET=super-secret-token
PORT=3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Launch the server with `node` (or `NODE_ENV=production npm start`). |
| `npm test` | Run the TAP-based test suite. The suite sets `NODE_ENV=test` so persistence is mocked.

## Authentication Endpoints

`Authorization: Bearer <token>` is required for all protected routes.

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/register` | Registers a user. Body: `{ name, email, password, preferences?: string[] }`. Password must be ≥8 chars. Returns `{ message }`. |
| POST | `/login`  | Logs in a user. Body: `{ email, password }`. Returns `{ token }`. |

## Preferences Endpoints

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/preferences` or `/users/preferences` | Returns `{ preferences: string[] }`. |
| PUT | `/preferences` or `/users/preferences` | Replace preferences with `{ preferences: string[] }`. Strings must be non-empty. |

## News Endpoints

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/news` | Returns cached news tailored to preferences. Uses `/top-headlines` when a preference matches a NewsAPI category; otherwise `everything`. Cache refreshes every 5 minutes. The response includes articles with an internal `id` (base64 of the URL). |
| POST | `/news/:id/read` | Marks article `id` as read. Updates persisted read list and returns `{ read: [...] }`. |
| POST | `/news/:id/favorite` | Marks article `id` as favorite. Returns `{ favorites: [...] }`. |
| GET | `/news/read` | Retrieves the authenticated user’s read articles. |
| GET | `/news/favorites` | Retrieves favorite articles. |
| GET | `/news/search/:keyword` | Searches the cached articles (matches in title, description, content, source). |

## Request Examples

1. Register

```bash
curl -s -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi", "email":"ravi@example.com", "password":"hunter2", "preferences":["technology","health"]}'
```

2. Login

```bash
curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi@example.com", "password":"hunter2"}'
```

3. Use token for protected route

```bash
curl -s http://localhost:3000/news \
  -H "Authorization: Bearer <token>"
```

4. Mark article read

```bash
curl -s -X POST http://localhost:3000/news/<articleId>/read \
  -H "Authorization: Bearer <token>"
```

4. Mark article faviourite

```bash
curl -X POST http://localhost:3000/news/<ARTICLE_ID>/favorite \
  -H "Authorization: Bearer <TOKEN>"
```
5. Get read articles
```bash
curl http://localhost:3000/news/read \
  -H "Authorization: Bearer <TOKEN>"
```

6. Get favorite articles
```bash
curl http://localhost:3000/news/favorites \
  -H "Authorization: Bearer <TOKEN>"
```

7.Search cached news 
```bash
curl http://localhost:3000/news/search/health \
  -H "Authorization: Bearer <TOKEN>"
```


## Storage

User data persists under `data/users.json`. Each entry stores `name`, `email`, `password` (hashed), `preferences`, `read` IDs, and `favorites`. The file is ignored by git and bypassed when `NODE_ENV=test`.

## Testing

```bash
npm test
```

## Running Locally

1. Start server: `npm start`
2. Register/login to get a JWT
3. Pass `Authorization: Bearer <token>` when requesting `/news`, `/preferences`, or `/news/:id/read`
4. Inspect `/news` responses for article `id` values needed for read/favorite calls