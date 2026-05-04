/**
 * API client for the Tender Evaluation Platform backend.
 * Includes Clerk auth token injection.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000, // 2 min for OCR processing
});

// ── Auth Token Management ───────────────────────────────────────
let _getToken = null;

/**
 * Register the Clerk getToken function so API calls include auth headers.
 */
export function setAuthTokenGetter(fn) {
  _getToken = fn;
}

// Axios interceptor: attach Bearer token to every request
api.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // If token fetch fails, proceed without auth
      console.warn('Failed to get auth token:', e);
    }
  }
  return config;
});

// ── Tender Endpoints ────────────────────────────────────────────

export async function uploadTender(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload_tender', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });
  return res.data;
}

export async function extractCriteria(tenderId) {
  const res = await api.post(`/extract_criteria/${tenderId}`);
  return res.data;
}

export async function getTender(tenderId) {
  const res = await api.get(`/tender/${tenderId}`);
  return res.data;
}

export async function getTenders() {
  const res = await api.get(`/tenders`);
  return res.data;
}

export async function updateTenderTitle(tenderId, title) {
  const res = await api.patch(`/tender/${tenderId}`, { title });
  return res.data;
}

// ── Bidder Endpoints ────────────────────────────────────────────

export async function uploadBidderDocs(tenderId, files, bidderName, onProgress) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  if (bidderName) formData.append('bidder_name', bidderName);
  const res = await api.post(`/upload_bidder_docs/${tenderId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });
  return res.data;
}

export async function extractBidderData(tenderId, bidderId) {
  const res = await api.post(`/extract_bidder_data/${tenderId}/${bidderId}`);
  return res.data;
}

export async function getBidders(tenderId) {
  const res = await api.get(`/bidders/${tenderId}`);
  return res.data;
}

// ── Evaluation Endpoints ────────────────────────────────────────

export async function evaluateBidders(tenderId) {
  const res = await api.post(`/evaluate_bidders/${tenderId}`);
  return res.data;
}

export async function getEvaluation(tenderId) {
  const res = await api.get(`/evaluation/${tenderId}`);
  return res.data;
}

export async function overrideDecision(tenderId, bidderId, criterion, newDecision, reason) {
  const res = await api.post(`/override/${tenderId}/${bidderId}`, {
    criterion, new_decision: newDecision, reason,
  });
  return res.data;
}

// ── Report Endpoints ────────────────────────────────────────────

export function getJsonReportUrl(tenderId) {
  return `/api/report/${tenderId}/json`;
}

export function getPdfReportUrl(tenderId) {
  return `/api/report/${tenderId}/pdf`;
}

export async function getAuditLog(tenderId) {
  const url = tenderId ? `/audit_log/${tenderId}` : '/audit_log';
  const res = await api.get(url);
  return res.data;
}

export default api;
