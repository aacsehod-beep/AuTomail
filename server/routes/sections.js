const router  = require('express').Router();
const parser  = require('../services/parser');

// POST /api/sections  — upload xlsx, get sheet names
router.post('/', (req, res) => {
  try {
    if (!req.files?.sheet) return res.status(400).json({ error: 'No file uploaded' });
    const file     = req.files.sheet;
    const buffer   = file.data;
    const filename = file.name || '';
    const sections = parser.listSections(buffer, filename);
    res.json({ sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
