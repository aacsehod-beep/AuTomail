const { isValidToken, extractToken } = require('../routes/auth');

module.exports = function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorised. Please log in.' });
  }
  next();
};
