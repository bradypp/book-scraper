const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const { AppError } = require('./utils/appError');
const rateLimiter = require('./config/rateLimiter');
const errorHandler = require('./controllers/errorHandler');

// Start express app
const app = express();

// Set security HTTP headers
app.use(helmet());

// TODO: change url
// Implement CORS
app.use(
    cors({
        origin: 'https://localhost:3000',
        optionsSuccessStatus: 200,
        credentials: true,
    }),
);
app.options('*', cors());

// Logger middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting middlewares
if (process.env.NODE_ENV === 'production') {
    app.use('/api', rateLimiter({ maxAttempts: 200, windowMinutes: 15 }));
}

// Body-parsing & cookie parsing middlewares
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection & XSS
app.use(mongoSanitize());
app.use(xss());

// Routes
// app.use('/api/v1/route', router);

// Unhandled route handler
app.all('*', (req, res, next) =>
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404)),
);

// Global error handling middleware
app.use(errorHandler);

module.exports = app;
