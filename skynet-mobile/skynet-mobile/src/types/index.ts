// Reused as-is from the web app's src/types.ts so both apps agree on the
// same API contracts served by the existing Next.js backend.

export interface SkyNetParcelData {
  trackingNumber: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAddress?: string;
  senderName?: string;
  senderAddress?: string;
  province: string;
  district: string;
  city: string;
  weight: number;
  value?: string;
  account?: string;
  apiSync?: string;
  goodsDesc?: string;
  mawbRef?: string;
  mawbCarrier?: string;
  mawbFlight?: string;
  mawbBags?: number;
  serviceType?: string;
  businessType?: string;
  senderReference?: string;
  _scannedVia?: string;
  isTemuScan?: boolean;
  scannedMethod?: string;
}

export interface AllocationResponse {
  success: boolean;
  parcel?: SkyNetParcelData;
  assignedZone?: string;
  assignedPartner?: string;
  error?: string;
  message?: string;
  reason?: string;
  validation?: 'CORRECT' | 'INCORRECT';
  missedFirstScan?: boolean;
}

export interface MawbSummary {
  mawb_reference: string;
  carrier?: string;
  declared_bags?: number;
}

export interface BagSummary {
  bagNumber: string;
  expectedCount: number;
}

export interface AuthUser {
  id: string | number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface OutboundLmdBag {
  bagNumber: string;
  mawbRef: string;
  targetPartner: string;
  destinationHub: string;
  status: 'OPEN' | 'SEALED';
  parcelCount: number;
  totalWeight: number;
  createdAt: string;
  operator: string;
  parcels: SkyNetParcelData[];
}

export type ScannedEntry = {
  id: string;
  trackingNumber: string;
  status: 'OK' | 'ERROR';
  message: string;
  timestamp: number;
};
