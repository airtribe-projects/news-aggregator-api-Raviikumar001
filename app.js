require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const preferencesRoutes = require('./routes/preferencesRoutes');
const newsRoutes = require('./routes/newsRoutes');
const { startCacheRefresh, stopCacheRefresh, REFRESH_INTERVAL_MS } = require('./controllers/newsController');

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


const shutdown = (signal) => {
    stopCacheRefresh();
    console.log(`Shutting down due to ${signal || 'exit'}`);
    // Allow any other listeners to run; don't forcibly exit here
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => shutdown('exit'));

module.exports = app;
