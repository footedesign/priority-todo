const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Database Connection ---
const dbPath = path.resolve(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// --- Database Initialization ---

/**
 * Initializes the database by creating necessary tables if they don't already exist.
 * Uses db.serialize to ensure statements run sequentially.
 * Returns a Promise that resolves when setup is complete or rejects on error.
 */
const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create the 'tasks' table if it doesn't exist.
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT, -- Auto-incrementing primary key
          name TEXT NOT NULL,                   -- Name of the task (required)
          completed BOOLEAN DEFAULT FALSE,      -- Completion status (defaults to false)
          task_order INTEGER,                   -- Integer for manual ordering
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of creation
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- Timestamp of last update
        )
      `, (err) => {
        if (err) {
          return reject(new Error(`Error creating tasks table: ${err.message}`));
        }
        console.log('Tasks table checked/created successfully.');
      });

      // Create the 'task_order_history' table if it doesn't exist.
      db.run(`
        CREATE TABLE IF NOT EXISTS task_order_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT, -- Auto-incrementing primary key
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of the snapshot
          task_order_snapshot TEXT             -- JSON string representing the task order array at that time
        )
      `, (err) => {
        if (err) {
          return reject(new Error(`Error creating task_order_history table: ${err.message}`));
        }
        console.log('Task order history table checked/created successfully.');

        resolve();
      });
    });
  });
};

module.exports = {
  db,
  initDb,
};
