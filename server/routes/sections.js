const router  = require('express').Router();
const parser  = require('../services/parser');

const ALLOWED_SHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
]);
const ALLOWED_SHEET_EXTS = /\.(xlsx|xls|csv)$/i;

function isAllowedSheet(f) {
  return ALLOWED_SHEET_MIMES.has(f.mimetype) || ALLOWED_SHEET_EXTS.test(f.name);
}

// POST /api/sections  — upload xlsx, get sheet names
router.post('/', (req, res) => {
  try {
    if (!req.files?.sheet) return res.status(400).json({ error: 'No file uploaded' });
    const file     = req.files.sheet;
    if (!isAllowedSheet(file)) {
      return res.status(400).json({ error: 'Invalid file type. Only .xlsx, .xls, .csv allowed.' });
    }
    const buffer   = file.data;
    const filename = file.name || '';
    const sections = parser.listSections(buffer, filename);
    res.json({ sections });
  } catch (err) {
    console.error('[POST /api/sections] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

module.exports = router;
