/**
 * Formatting and utility helpers.
 */

export function getDecisionLabel(decision) {
  switch (decision) {
    case 'PASS': return '✅ PASS';
    case 'FAIL': return '❌ FAIL';
    case 'NEED_REVIEW': return '⚠️ REVIEW';
    default: return decision;
  }
}

export function getDecisionClass(decision) {
  switch (decision) {
    case 'PASS': return 'badge-pass';
    case 'FAIL': return 'badge-fail';
    case 'NEED_REVIEW': return 'badge-review';
    default: return '';
  }
}

export function getConfidenceClass(confidence) {
  if (confidence >= 0.9) return 'confidence-high';
  if (confidence >= 0.75) return 'confidence-medium';
  return 'confidence-low';
}

export function formatConfidence(confidence) {
  return `${(confidence * 100).toFixed(0)}%`;
}

export function getTypeIcon(type) {
  switch (type) {
    case 'financial': return '💰';
    case 'technical': return '🔧';
    case 'compliance': return '📋';
    default: return '📄';
  }
}

export function getTypeLabel(type) {
  switch (type) {
    case 'financial': return 'Financial';
    case 'technical': return 'Technical';
    case 'compliance': return 'Compliance';
    default: return type;
  }
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Tender naming ────────────────────────────────────────────────
// Map our seeded sample filenames → realistic display titles.
const KNOWN_TITLES = {
  'CRPF_IT_2025-26_001_Network_Infrastructure':
    'CRPF/IT/2025-26/001 — Supply & Commissioning of IT Equipment and Network Infrastructure',
  'CRPF_MT_2025-26_004_Bullet_Proof_Vehicles':
    'CRPF/MT/2025-26/004 — Procurement of Bullet Proof Vehicles (BPV) — Phase III',
  'CRPF_COMM_2025-26_012_Tactical_Comms':
    'CRPF/COMM/2025-26/012 — Tactical Encrypted Communication Sets',
  'CRPF_CIV_2025-26_003_Barracks_Hyderabad':
    'CRPF/CIV/2025-26/003 — Construction of New Barracks Block, Group Centre Hyderabad',
  'sample_tender_crpf':
    'CRPF/IT/2025-26/001 — Supply & Commissioning of IT Equipment and Network Infrastructure',
};

/**
 * Display-friendly title for a tender.  Order of preference:
 *   1. tender.title (set via PATCH /tender/:id)
 *   2. known sample mapping (filename without extension)
 *   3. nicely de-snaked filename
 */
export function tenderDisplayTitle(tender) {
  if (!tender) return 'Untitled tender';
  if (tender.title && tender.title.trim()) return tender.title.trim();

  const raw = tender.filename || '';
  const stem = raw.replace(/\.[^.]+$/, '');
  if (KNOWN_TITLES[stem]) return KNOWN_TITLES[stem];

  // Beautify: replace _ and - with spaces, collapse whitespace, capitalize words
  const beautified = stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return beautified || 'Untitled tender';
}

/**
 * Short tender number / id parsed out of filename or title (e.g. "CRPF/IT/2025-26/001").
 */
export function tenderNumber(tender) {
  const t = tenderDisplayTitle(tender);
  const m = t.match(/[A-Z]{2,}\/[A-Z0-9/_-]+/);
  return m ? m[0] : null;
}
