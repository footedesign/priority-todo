const express = require('express');
const router = express.Router();
const validator = require('validator');
const { db } = require('../db/database');
const { verifyPin } = require('../middleware/auth');

// --- Routes ---

/**
 * GET /api/tasks
 * Retrieves all tasks from the database, ordered by their specified task_order,
 * and then by their ID as a secondary sort criterion.
 */
router.get('/tasks', (req, res, next) => {
  const sql = `SELECT * FROM tasks ORDER BY task_order ASC, id ASC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching tasks:", err.message);
      return next(err);
    }

    res.json({ tasks: rows });
  });
});

/**
 * POST /api/tasks
 * Creates a new task. PIN verification is handled by the frontend's edit lock state.
 * It calculates the next available task_order and inserts the new task.
 */
router.post('/tasks', verifyPin, (req, res, next) => {
  const { name } = req.body;

  // --- Input Validation ---
  if (!name || typeof name !== 'string' || validator.isEmpty(name.trim())) {
    return res.status(400).json({ message: 'Task name is required and cannot be empty.' });
  }
  if (!validator.isLength(name.trim(), { min: 1, max: 255 })) {
    return res.status(400).json({ message: 'Task name must be between 1 and 255 characters.' });
  }
  // Basic sanitization (escape potentially harmful HTML characters)
  const sanitizedName = validator.escape(name.trim());
  // --- End Input Validation ---


  // Determine the next task_order value
  const findMaxOrderSql = `SELECT MAX(task_order) as max_order FROM tasks`;
  db.get(findMaxOrderSql, [], (err, row) => {
    if (err) {
        console.error("Error finding max task order:", err.message);
        return next(err);
    }

    // If table is empty or max_order is NULL, start at 1, otherwise increment max
    const nextOrder = (row && row.max_order !== null) ? row.max_order + 1 : 1;

    // Insert the new task with the calculated order using the sanitized name
    const insertSql = `INSERT INTO tasks (name, task_order, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    const params = [sanitizedName, nextOrder]; // Use sanitizedName

    db.run(insertSql, params, function(err) {
      if (err) {
        console.error("Error inserting task:", err.message);
        return next(err);
      }
      // Respond with success message and the newly created task object
      res.status(201).json({
        message: 'Task created successfully',
        task: {
          id: this.lastID,
          name: sanitizedName,
          completed: false,
          task_order: nextOrder,
        }
      });
    });
  });
});

/**
 * GET /api/tasks/:id
 * Retrieves a specific task by its ID.
 */
router.get('/tasks/:id', (req, res, next) => {
  const { id } = req.params;

  // --- Input Validation ---
  if (!id || !validator.isInt(id, { min: 1 })) {
    return res.status(400).json({ message: 'Invalid Task ID provided.' });
  }
  const taskId = parseInt(id, 10);
  // --- End Input Validation ---

  const sql = "SELECT * FROM tasks WHERE id = ?";
   db.get(sql, [taskId], (err, row) => {
    if (err) {
      console.error(`Error fetching task ${taskId}:`, err.message);
      return next(err);
    }
    if (row) {
      res.json({ task: row });
    } else {
      res.status(404).json({ message: `Task with id ${taskId} not found` });
    }
  });
});

/**
 * PUT /api/tasks/:id
 * Updates an existing task (name, completed status, or task_order).
 * PIN verification is handled by the frontend's edit lock state.
 */
router.put('/tasks/:id', verifyPin, (req, res, next) => {
  const { id } = req.params;
  const { name, completed, task_order } = req.body;

  // --- Input Validation ---
  // Validate ID from params
  if (!id || !validator.isInt(id, { min: 1 })) {
    return res.status(400).json({ message: 'Invalid Task ID provided.' });
  }
  const taskId = parseInt(id, 10);

  // Validate that at least one field to update is provided
  if (typeof completed === 'undefined' && typeof name === 'undefined' && typeof task_order === 'undefined') {
      return res.status(400).json({ message: 'No update fields provided (name, completed, or task_order)' });
  }

  // Dynamically build the UPDATE SQL query based on provided fields
  let sql = 'UPDATE tasks SET ';
  const params = [];
  const updates = [];
  let sanitizedName = null;

  // Add fields to the update query if they exist in the request body, with validation
  if (typeof completed !== 'undefined') {
      if (typeof completed !== 'boolean') {
          return res.status(400).json({ message: 'Invalid value for completed status (must be true or false).' });
      }
      const isCompleted = completed ? 1 : 0;
      updates.push('completed = ?');
      params.push(isCompleted);
      // If marking as completed, set task_order to NULL
      if (isCompleted === 1) {
          updates.push('task_order = NULL');
      }
      // Note: We are NOT automatically re-assigning task_order if un-completing (isCompleted === 0).
      // The user can manually reorder it if desired via drag-and-drop.
  }
  if (typeof name !== 'undefined') {
      if (typeof name !== 'string' || validator.isEmpty(name.trim())) {
          return res.status(400).json({ message: 'Task name cannot be empty.' });
      }
      if (!validator.isLength(name.trim(), { min: 1, max: 255 })) {
          return res.status(400).json({ message: 'Task name must be between 1 and 255 characters.' });
      }
      sanitizedName = validator.escape(name.trim());
      updates.push('name = ?');
      params.push(sanitizedName);
  }
   if (typeof task_order !== 'undefined') {
      // Allow null for task_order if explicitly provided (e.g., if un-completing and setting order)
      // But if not null, validate it's a positive integer
      if (task_order !== null && (typeof task_order !== 'number' || !validator.isInt(String(task_order), { min: 1 }))) {
          return res.status(400).json({ message: 'task_order must be null or a positive integer.' });
      }
      updates.push('task_order = ?');
      params.push(task_order);
  }
  // --- End Input Validation ---

  // Always update the 'updated_at' timestamp
  updates.push('updated_at = CURRENT_TIMESTAMP');

  // Join the update parts and add the WHERE clause using the validated taskId
  sql += updates.join(', ');
  sql += ' WHERE id = ?';
  params.push(taskId);

  db.run(sql, params, function(err) {
    if (err) {
      console.error(`Error updating task ${taskId}:`, err.message);
      return next(err);
    }
    // Check if any row was actually updated
    if (this.changes === 0) {
        return res.status(404).json({ message: `Task with id ${taskId} not found or no changes made` });
    }
    // Fetch the updated task data to return in the response
    const fetchSql = "SELECT * FROM tasks WHERE id = ?";
    db.get(fetchSql, [taskId], (err, row) => {
        if (err) {
            console.error(`Error fetching updated task ${taskId}:`, err.message);
            // The update likely succeeded, but fetching failed. Log and inform the user.
            return res.status(200).json({ message: `Task ${taskId} updated, but failed to fetch the updated record.` });
        }
         if (!row) {
             // Should not happen if this.changes > 0
             return res.status(404).json({ message: `Task with id ${taskId} not found after update attempt.` });
         }
        // Ensure the returned name is the sanitized one if it was updated
        if (sanitizedName !== null) {
            row.name = sanitizedName;
        }
        res.json({ message: `Task ${taskId} updated successfully`, task: row });
    });
  });
});

/**
 * DELETE /api/tasks/:id
 * Deletes a specific task by its ID.
 */
router.delete('/tasks/:id', verifyPin, (req, res, next) => {
  const { id } = req.params;

  // --- Input Validation ---
  if (!id || !validator.isInt(id, { min: 1 })) {
    return res.status(400).json({ message: 'Invalid Task ID provided.' });
  }
  const taskId = parseInt(id, 10);
  // --- End Input Validation ---

  const sql = 'DELETE FROM tasks WHERE id = ?';

  db.run(sql, [taskId], function(err) {
    if (err) {
      console.error(`Error deleting task ${taskId}:`, err.message);
      return next(err);
    }
    // Check if a row was actually deleted
    if (this.changes === 0) {
        return res.status(404).json({ message: `Task with id ${taskId} not found` });
    }
    res.status(200).json({ message: `Task ${taskId} deleted successfully` });
  });
});

// --- Timeline and Order Endpoints ---

/**
 * GET /api/history
 * Retrieves the history of task order changes from the task_order_history table.
 * Parses the stored JSON string snapshot back into an array for each entry.
 */
router.get('/history', (req, res, next) => {
  const sql = `SELECT timestamp, task_order_snapshot FROM task_order_history ORDER BY timestamp ASC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching task order history:", err.message);
      return next(err);
    }
    // Process rows: parse the JSON string in 'task_order_snapshot'
    const history = rows.map(row => {
        try {
            const snapshot = JSON.parse(row.task_order_snapshot || '[]');
            return {
                timestamp: row.timestamp,
                task_order_snapshot: snapshot
            };
        } catch (parseError) {
            console.error(`Error parsing task_order_snapshot for history entry (Timestamp: ${row.timestamp}):`, parseError);
            return {
                timestamp: row.timestamp,
                task_order_snapshot: []
            };
        }
    });
    res.json({ history: history });
  });
});


/**
 * POST /api/tasks/order
 * Updates the task_order for multiple tasks based on the provided array of task IDs.
 * Also saves a snapshot of the new order to the task_order_history table.
 * Uses a database transaction to ensure all updates succeed or fail together.
 */
router.post('/tasks/order', verifyPin, (req, res, next) => {
  const { taskOrder } = req.body;

  // --- Input Validation ---
  if (!taskOrder || !Array.isArray(taskOrder)) {
     return res.status(400).json({ message: 'taskOrder must be provided as an array of task IDs.' });
  }

  // Validate each ID in the array
  const validatedTaskIds = [];
  for (const id of taskOrder) {
    // Ensure it's a number and a positive integer
    if (typeof validator.toInt(id) !== 'number' || !validator.isInt(String(id), { min: 1 })) {
      return res.status(400).json({ message: `Invalid Task ID found in taskOrder array: ${id}. All IDs must be positive integers.` });
    }
    validatedTaskIds.push(id);
  }
  // --- End Input Validation ---


  // Filter out any potential IDs that might correspond to completed tasks (precautionary)
  // The main logic relies on the WHERE clause in the UPDATE statement.
  // We only save the order of tasks that were actually updated (non-completed).

  // Use a transaction to ensure atomicity (all updates succeed or all fail)
  db.serialize(() => {
    db.run('BEGIN TRANSACTION;', (err) => {
        if (err) return next(err);

        let transactionError = null;
        const successfullyOrderedIds = []; // Keep track of IDs whose order was set

        // Create an array of Promises, one for each task order update using validatedTaskIds
        const updatePromises = validatedTaskIds.map((taskId, index) => {
            return new Promise((resolve, reject) => {
                const order = index + 1;
                // IMPORTANT: Only update tasks where task_order is NOT NULL (i.e., not completed)
                const sql = 'UPDATE tasks SET task_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND task_order IS NOT NULL';
                db.run(sql, [order, taskId], function(err) {
                    if (err) {
                        console.error(`Error updating order for task ${taskId}:`, err.message);
                        transactionError = err;
                        return reject(err);
                    }
                    // If the update succeeded (this.changes > 0), it means the task was active and its order was set.
                    if (this.changes > 0) {
                         successfullyOrderedIds.push(taskId);
                    } else {
                         // Task might be completed (task_order IS NULL) or doesn't exist. Log this.
                         console.warn(`Task with id ${taskId} not updated during order set (might be completed or deleted).`);
                    }
                    resolve();
                });
            });
        });

        // Wait for all update promises
        Promise.all(updatePromises)
            .then(() => {
                if (transactionError) {
                    throw transactionError;
                }

                // All task orders updated successfully (or skipped completed tasks), now save the history snapshot
                // Only include the IDs of tasks that were actually ordered (non-completed)
                const snapshot = JSON.stringify(successfullyOrderedIds);
                const historySql = 'INSERT INTO task_order_history (task_order_snapshot, timestamp) VALUES (?, CURRENT_TIMESTAMP)';

                db.run(historySql, [snapshot], function(err) {
                    if (err) {
                        console.error('Error saving task order history:', err.message);
                        transactionError = err;
                        throw transactionError;
                    }

                    // If history saved successfully, commit the transaction
                    db.run('COMMIT;', (commitErr) => {
                        if (commitErr) {
                            console.error("Commit error:", commitErr);
                            return next(commitErr);
                        }

                        console.log('Task order updated and history saved successfully.');
                        res.status(200).json({ message: 'Task order updated successfully' });
                    });
                });
            })
            .catch(err => {
                console.error("Error during task order update/history save, rolling back transaction:", err.message);
                db.run('ROLLBACK;', rollbackErr => {
                    if (rollbackErr) {
                        console.error("Rollback error:", rollbackErr);
                    }
                    return next(err);
                });
            });
    });
  });
});


/**
 * POST /api/verify-pin
 * Verifies the provided PIN against the one stored in environment variables.
 * Used by the frontend to unlock editing capabilities.
 */
router.post('/verify-pin', verifyPin, (req, res) => {
  // If verifyPin middleware passes (doesn't call next(err) or send a response),
  // the PIN is correct.
  res.status(200).json({ success: true, message: 'PIN verified successfully.' });
});


module.exports = router;
