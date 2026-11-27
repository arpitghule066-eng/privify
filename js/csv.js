// @ts-check
/**
 * @file CSV parsing, stringification, and formula neutralization.
 * Pure functions — no DOM, no side effects. RFC 4180 compliant.
 * @module csv
 */

/**
 * Parse a CSV string into a 2D array of strings.
 * @param {string} text - CSV content.
 * @returns {string[][]} Rows of fields.
 */
export function parseCSV(text) {
  const state = { rows: [], row: [], field: '', inQuotes: false };

  for (let i = 0; i < text.length; i++) {
    i = stepCSV(text, i, state);
  }

  if (state.field.length > 0 || state.row.length > 0) {
    state.row.push(state.field);
    state.rows.push(state.row);
  }
  return state.rows;
}

/**
 * Advance CSV parser by one character.
 * @param {string} text - CSV input.
 * @param {number} i - Current index.
 * @param {{ rows: string[][], row: string[], field: string, inQuotes: boolean }} state
 * @returns {number} Updated index.
 */
function stepCSV(text, i, state) {
  const ch = text[i];
  if (state.inQuotes) {
    if (ch === '"' && text[i + 1] === '"') {
      state.field += '"';
      return i + 1;
    }
    if (ch === '"') state.inQuotes = false;
    else state.field += ch;
    return i;
  }

  if (ch === '"') { state.inQuotes = true; return i; }
  if (ch === ',') { state.row.push(state.field); state.field = ''; return i; }
  if (ch === '\r' || ch === '\n') {
    state.row.push(state.field);
    state.rows.push(state.row);
    state.row = [];
    state.field = '';
    return (ch === '\r' && text[i + 1] === '\n') ? i + 1 : i;
  }
  state.field += ch;
  return i;
}

/**
 * Stringify a 2D array into a CSV string (RFC 4180).
 * @param {string[][]} rows - Rows of fields.
 * @returns {string} CSV text.
 */
export function stringifyCSV(rows) {
  return rows.map(row =>
    row.map(field => {
      if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    }).join(',')
  ).join('\r\n');
}

/**
 * Neutralize CSV formula injection by prefixing dangerous cells.
 * Cells starting with =, @, \t, \r, or +/- followed by a non-digit get a leading '.
 * @param {string[][]} rows - Parsed CSV rows.
 * @returns {string[][]} Sanitized rows.
 */
export function neutralizeFormulas(rows) {
  return rows.map(row =>
    row.map(field => {
      if (field.length === 0) return field;
      const first = field[0];
      if (first === '=' || first === '@' || first === '\t' || first === '\r') {
        return "'" + field;
      }
      if ((first === '+' || first === '-') && field.length > 1 && !/\d/.test(field[1])) {
        return "'" + field;
      }
      return field;
    })
  );
}
