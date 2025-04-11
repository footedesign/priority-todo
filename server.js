#!/usr/bin/env node
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db/database');
const taskRoutes = require('./routes/tasks');

// --- App Initialization ---
const app = express();
const PORT = process.env.PORT || 4444;

// --- Middleware ---
app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter);

// --- API Routes ---
app.use('/api', taskRoutes);

// --- Basic Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error("Error occurred:", err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// --- Database Initialization and Server Start ---
db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
