/**
 * Middleware function to verify a PIN provided in the request header.
 * This is used to protect certain API endpoints (e.g., creating/editing tasks).
 */
const verifyPin = (req, res, next) => {
  const providedPin = req.headers['x-pin'];

  const correctPin = process.env.APP_PIN;

  // Check if the client provided a PIN in the header.
  if (!providedPin) {
    return res.status(401).json({ message: 'PIN required for this action. Please include it in the \'x-pin\' header.' });
  }

  // Compare the provided PIN with the correct PIN from environment variables.
  if (providedPin !== correctPin) {
    return res.status(403).json({ message: 'Invalid PIN provided.' });
  }

  next();
};

module.exports = { verifyPin };
