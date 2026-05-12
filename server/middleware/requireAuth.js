const { getTokenEntry, extractToken } = require('../routes/auth');

module.exports = function requireAuth(req, res, next) {
  const token = extractToken(req);
  const entry = getTokenEntry(token);
  if (!entry) {
    return res.status(401).json({ error: 'Unauthorised. Please log in.' });
  }
  req.user   = entry.user;
  req.school = entry.school;
  req.role   = entry.role;
  req.gasUrl = entry.gasUrl || '';
  next();
};
