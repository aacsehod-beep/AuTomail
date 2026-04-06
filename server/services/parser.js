const XLSX = require('xlsx');

const SUBJECT_COLS  = [5, 8, 11, 14, 17, 20];
const PERCENT_COLS  = [7, 10, 13, 16, 19, 22];
const DEFAULT_START_ROW  = 9;  // Row 9: student data starts after row-8 subject header
const DEFAULT_NAME_COL   = 2;
const DEFAULT_EMAIL_COL  = 4;

/**
 * Normalise section names from a buffer.
 * Returns a map: { displayName → actualSheetName } and the workbook.
 * For CSV (single "Sheet1"), the display name is the filename without extension.
 */
function readWorkbook(buffer, originalFilename) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const map = {}; // displayName → actualSheetName

  if (wb.SheetNames.length === 1 && wb.SheetNames[0] === 'Sheet1' && originalFilename) {
    const label = originalFilename.replace(/\.[^.]+$/, '').trim();
    if (label) {
      map[label] = 'Sheet1';
      return { wb, map };
    }
  }
  wb.SheetNames.forEach(n => { map[n] = n; });
  return { wb, map };
}

/**
 * Parse an uploaded file buffer and return all section (sheet) names.
 * For CSV files, uses the filename (without extension) as the section name.
 */
function listSections(buffer, originalFilename) {
  const { map } = readWorkbook(buffer, originalFilename);
  return Object.keys(map);
}

/**
 * Load all students from selected sections.
 * mapping: { startRow, nameCol, emailCol }
 * originalFilename: used to resolve CSV "Sheet1" aliasing
 */
function loadRecipients(buffer, sections, mapping = {}, originalFilename) {
  const { wb, map } = readWorkbook(buffer, originalFilename);
  const startRow = Number(mapping.startRow || DEFAULT_START_ROW);
  const nameCol  = Number(mapping.nameCol  || DEFAULT_NAME_COL);
  const emailCol = Number(mapping.emailCol || DEFAULT_EMAIL_COL);
  const idxName  = nameCol  - 1;
  const idxEmail = emailCol - 1;

  const results = [];

  (sections || Object.keys(map)).forEach(displaySec => {
    const actualSec = map[displaySec] || displaySec;
    const ws = wb.Sheets[actualSec];
    if (!ws) return;

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    for (let r = startRow - 1; r < grid.length; r++) {
      const row   = grid[r];
      const email = String(row[idxEmail] || '').trim().toLowerCase();
      const name  = String(row[idxName]  || '').trim();
      const regNo = String(row[2]        || '').trim();
      if (email && isValidEmail(email)) {
        results.push({ name, email, regNo, section: displaySec });
      }
    }
  });

  return results;
}

/**
 * Load full attendance data for a section.
 * mapping: { startRow, nameCol, emailCol }
 * subjLayout: optional array of { nameCol, heldCol, attendedCol, pctCol } — overrides default SUBJECT_COLS/PERCENT_COLS
 */
function loadAttendanceData(buffer, displaySection, mapping = {}, originalFilename, subjLayout) {
  const { wb, map } = readWorkbook(buffer, originalFilename);
  const actualSec = map[displaySection] || displaySection;
  const ws = wb.Sheets[actualSec];
  if (!ws) throw new Error(`Sheet "${displaySection}" not found`);

  const grid           = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const startRow        = Number(mapping.startRow        || DEFAULT_START_ROW);
  const nameCol         = Number(mapping.nameCol         || DEFAULT_NAME_COL);
  const emailCol        = Number(mapping.emailCol        || DEFAULT_EMAIL_COL);
  const weekInfoRow     = Number(mapping.weekInfoRow     || 7);   // row that contains the period/week label
  const subjectHdrRow   = Number(mapping.subjectHdrRow   || 8);   // row that contains subject names
  const idxName   = nameCol  - 1;
  const idxEmail  = emailCol - 1;

  // Week / period info — first non-empty cell in the configured row
  const weekRow  = grid[weekInfoRow - 1] || [];
  const weekInfo = weekRow.find(v => String(v).trim()) || 'Current Period';

  // Resolve subject layout: use custom subjLayout if provided, else fall back to default columns
  const layout = (Array.isArray(subjLayout) && subjLayout.length > 0)
    ? subjLayout.map(s => ({
        nameCol:      Number(s.nameCol)     || 5,
        heldCol:      Number(s.heldCol)     || 6,
        attendedCol:  Number(s.attendedCol) || 7,
        pctCol:       Number(s.pctCol)      || 7,
      }))
    : SUBJECT_COLS.map((c, i) => ({
        nameCol:     c,
        heldCol:     c + 1,
        attendedCol: c + 2,
        pctCol:      PERCENT_COLS[i],
      }));

  // Subject names — read from the configured header row
  const headerRow = grid[subjectHdrRow - 1] || [];
  const subjNames = layout.map(s => String(headerRow[s.nameCol - 1] || '').trim());

  // Rows from startRow onwards — student data
  const students = {};
  for (let r = startRow - 1; r < grid.length; r++) {
    const row   = grid[r];
    const email = String(row[idxEmail] || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;

    const name  = String(row[idxName] || '').trim();
    const regNo = String(row[2]       || '').trim();
    const subjectsData = layout.map((s, i) => ({
      name:     subjNames[i] || `Subject ${i + 1}`,
      percent:  toNumber(row[s.pctCol - 1]),
      held:     toNumber(row[s.heldCol - 1]),
      attended: toNumber(row[s.attendedCol - 1]),
    }));

    students[email] = { name, regNo, subjects: subjectsData };
  }

  return { weekInfo, subjects: subjNames, students };
}

/**
 * Filter recipients whose any subject attendance is below threshold.
 */
function filterBelowThreshold(buffer, recipients, threshold, mapping = {}, originalFilename) {
  const { wb, map } = readWorkbook(buffer, originalFilename);
  const startRow = Number(mapping.startRow || DEFAULT_START_ROW);
  const emailCol = Number(mapping.emailCol || DEFAULT_EMAIL_COL);
  const idxEmail = emailCol - 1;

  const sectionCache = {};

  return recipients.filter(rec => {
    const displaySec = rec.section;
    if (!sectionCache[displaySec]) {
      const actualSec = map[displaySec] || displaySec;
      const ws = wb.Sheets[actualSec];
      sectionCache[displaySec] = ws
        ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        : [];
    }
    const grid = sectionCache[displaySec];

    for (let r = startRow - 1; r < grid.length; r++) {
      const row   = grid[r];
      const email = String(row[idxEmail] || '').trim().toLowerCase();
      if (email !== rec.email) continue;

      return PERCENT_COLS.some(col => {
        const pct = toNumber(row[col - 1]);
        return pct > 0 && pct < threshold;
      });
    }
    return false;
  });
}

// ---------- Helpers ----------
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toNumber(v) {
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
}

/**
 * Parse a fee sheet and return per-student fee details.
 * feeMapping: { startRow, nameCol, emailCol, regNoCol, feeItems: [{ label, amountCol, dueDateCol, markOverdue }] }
 * Returns: Map  email.toLowerCase() → { name, regNo, feeDetails: [{ label, amount, dueDate, overdue }] }
 */
function loadFeeData(buffer, originalFilename, feeMapping = {}) {
  const { wb } = readWorkbook(buffer, originalFilename);
  // Use first sheet
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No sheet found in the uploaded fee file.');

  const grid      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const startRow  = Number(feeMapping.startRow  || 2);
  const nameCol   = Number(feeMapping.nameCol   || 1);
  const emailCol  = Number(feeMapping.emailCol  || 2);
  const regNoCol  = Number(feeMapping.regNoCol  || 3);
  const feeItems  = Array.isArray(feeMapping.feeItems) ? feeMapping.feeItems : [];

  const result = new Map(); // email → { name, regNo, feeDetails }

  for (let r = startRow - 1; r < grid.length; r++) {
    const row   = grid[r];
    const email = String(row[emailCol - 1] || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;

    const name  = String(row[nameCol  - 1] || '').trim();
    const regNo = String(row[regNoCol - 1] || '').trim();

    const feeDetails = feeItems
      .map(item => {
        const amount = toNumber(row[(item.amountCol || 0) - 1]);
        if (amount <= 0) return null; // skip items with no amount
        const dueDateRaw = item.dueDateCol > 0 ? String(row[item.dueDateCol - 1] || '').trim() : '';
        return {
          label:   item.label || 'Fee',
          amount,
          dueDate: dueDateRaw,
          overdue: item.markOverdue ? true : false,
        };
      })
      .filter(Boolean);

    if (feeDetails.length > 0) {
      result.set(email, { name: name || email, regNo, feeDetails });
    }
  }

  return result;
}

module.exports = {
  listSections,
  loadRecipients,
  loadAttendanceData,
  filterBelowThreshold,
  loadFeeData,
  isValidEmail,
  SUBJECT_COLS,
  PERCENT_COLS,
};
