const router = require('express').Router();
const parser = require('../services/parser');

// POST /api/recipients
router.post('/', (req, res) => {
  try {
    if (!req.files?.sheet) return res.status(400).json({ error: 'No file uploaded' });

    const file         = req.files.sheet;
    const buffer       = file.data;
    const filename     = file.name || '';
    const sections     = JSON.parse(req.body.sections  || '[]');
    const mapping      = JSON.parse(req.body.mapping   || '{}');
    const filterLow    = req.body.filterLow === 'true';
    const threshold    = Number(req.body.threshold || 75);

    if (!sections.length) return res.status(400).json({ error: 'No sections selected' });

    let recipients = parser.loadRecipients(buffer, sections, mapping, filename);

    if (filterLow) {
      recipients = parser.filterBelowThreshold(buffer, recipients, threshold, mapping, filename);
    }

    res.json({ recipients, total: recipients.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
