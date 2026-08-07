import { apiGet, apiPost } from './client';
import { AllocationResponse, BagSummary, MawbSummary } from '../types';

// ── GET helpers ──────────────────────────────────────────────────────────

export function getMawbs() {
  return apiGet<{ success: boolean; mawbs: MawbSummary[]; error?: string }>(
    '/api/allocate?mawbs=true'
  );
}

export function getBagsForMawb(mawbRef: string) {
  return apiGet<{ success: boolean; bags: BagSummary[]; error?: string }>(
    `/api/allocate?getBags=true&mawbRef=${encodeURIComponent(mawbRef)}`
  );
}

// ── STAGE 1: Box Unsealing (1st scan) ───────────────────────────────────

export function scanFirstStage(params: {
  trackingNumber: string;
  mawbRef: string;
  bagNumber: string;
  operator: string;
  overrideBag?: boolean;
  registerExtra?: boolean;
  extraNote?: string;
}) {
  return apiPost<AllocationResponse>('/api/allocate', {
    ...params,
    stage: 'first',
  });
}

export function finishBag(params: {
  mawbRef: string;
  bagNumber: string;
  expectedCount: number;
  scannedCount: number;
  status?: 'COUNTED' | 'DISCREPANCY';
  operator: string;
  scannedParcels: unknown[];
}) {
  return apiPost<{ success: boolean; error?: string }>('/api/allocate', {
    ...params,
    stage: 'finish-bag',
  });
}

// ── STAGE 2: LMD Verification & Allocation (2nd scan) ───────────────────

export function scanSecondStage(params: {
  trackingNumber: string;
  targetMawb?: string;
  targetPartner?: string;
  operator: string;
}) {
  return apiPost<AllocationResponse>('/api/allocate', {
    ...params,
    stage: 'second',
  });
}
