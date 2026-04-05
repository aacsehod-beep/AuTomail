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
 */
function loadAttendanceData(buffer, displaySection, mapping = {}, originalFilename) {
  const { wb, map } = readWorkbook(buffer, originalFilename);
  const actualSec = map[displaySection] || displaySection;
  const ws = wb.Sheets[actualSec];
  if (!ws) throw new Error(`Sheet "${displaySection}" not found`);

  const grid      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const startRow  = Number(mapping.startRow || DEFAULT_START_ROW);
  const nameCol   = Number(mapping.nameCol  || DEFAULT_NAME_COL);
  const emailCol  = Number(mapping.emailCol || DEFAULT_EMAIL_COL);
  const idxName   = nameCol  - 1;
  const idxEmail  = emailCol - 1;

  // Row 7 (index 6) — week/period info: first non-empty cell
  const weekRow  = grid[6] || [];
  const weekInfo = weekRow.find(v => String(v).trim()) || 'Current Week';

  // Row 8 (index 7) — subject names at SUBJECT_COLS
  const headerRow  = grid[7] || [];
  const subjNames  = SUBJECT_COLS.map(c => String(headerRow[c - 1] || '').trim());

  // Rows from startRow onwards — student data
  const students = {};
  for (let r = startRow - 1; r < grid.length; r++) {
    const row   = grid[r];
    const email = String(row[idxEmail] || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;

    const name  = String(row[idxName] || '').trim();
    const regNo = String(row[2]       || '').trim();
    const subjectsData = subjNames.map((name, i) => ({
      name,
      percent: toNumber(row[PERCENT_COLS[i] - 1]),
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

module.exports = {
  listSections,
  loadRecipients,
  loadAttendanceData,
  filterBelowThreshold,
  isValidEmail,
  SUBJECT_COLS,
  PERCENT_COLS,
};
