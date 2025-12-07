require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const preferencesRoutes = require('./routes/preferencesRoutes');
const newsRoutes = require('./routes/newsRoutes');
const { startCacheRefresh, stopCacheRefresh, REFRESH_INTERVAL_MS } = require('./controllers/newsController');
const { _internal: { flushPersist, stopPersist } } = require('./utils/userStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));

app.use('/', authRoutes);
app.use('/', preferencesRoutes);
app.use('/', newsRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

if (require.main === module) {
    app.listen(PORT, (err) => {
        if (err) {
            return console.error('Server error', err);
        }
        console.log(`Server listening on port ${PORT}`);
        startCacheRefresh(REFRESH_INTERVAL_MS);
    });
}


const shutdown = async (signal) => {
    stopCacheRefresh();
    try {
        await flushPersist();
    } catch (err) {
        // ignore; already logged
    }
    stopPersist();
    console.log(`Shutting down due to ${signal || 'exit'}`);
};

process.on('SIGINT', () => { shutdown('SIGINT').catch(() => {}); });
process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => {}); });
// On normal exit, we can't reliably await async operations — just ensure timers are stopped.
process.on('exit', () => {
    stopCacheRefresh();
    stopPersist();
    console.log('Shutting down due to exit');
});

module.exports = app;
