import { apiGet } from './client';

export interface TrackingResult {
  success: boolean;
  notFound?: boolean;
  error?: string;
  query?: string;
  trackingNumber?: string;
  status?: string;
  destination?: string;
  // Sender / Receiver
  senderName?: string;
  senderAddress?: string;
  receiverName?: string;
  receiverAddress?: string;
  receiverPhone?: string;
  receiverEmail?: string;
  receiverReference?: string;
  senderReference?: string;
  // MAWB
  mawbRef?: string;
  mawbCarrier?: string;
  // Parcel specs
  weight?: string;
  deadWeight?: string;
  declaredValue?: string;
  codAmount?: string;
  // Logistics
  province?: string;
  bagNumber?: string;
  serviceProvider?: string;
  serviceProviderZone?: string;
  // Step dates (formatted strings)
  manifestDate?: string;
  zoneDate?: string;
  serviceProviderDate?: string;
  verificationDate?: string;
  dispatchDate?: string;
  currentStep?: number;
}

interface RawTrackingResponse {
  success: boolean;
  error?: string;
  notFound?: boolean;
  connoteNo?: string;
  status?: string;
  destination?: string;
  steps?: Array<{
    stepNumber: number;
    title: string;
    status: string;
    date?: string;
    time?: string;
    notes?: string;
  }>;
  senderInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    senderReference?: string;
  };
  receiverInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  manifestInfo?: Array<{
    docketNo?: string;
    carrier?: string;
  }>;
  shipmentInfo?: {
    weight?: string;
    deadWeight?: string;
    cubicWeight?: string;
    codAmount?: string;
    bagNo?: string;
    partner?: string;
  };
}

export async function trackParcel(query: string): Promise<TrackingResult> {
  try {
    const raw = await apiGet<RawTrackingResponse>(`/api/tracking?q=${encodeURIComponent(query)}`);

    if (!raw.success) {
      return {
        success: false,
        notFound: raw.notFound,
        error: raw.error || `No parcel found for "${query}".`,
      };
    }

    // Map steps to dates
    const steps = raw.steps || [];
    const getStepDate = (stepNum: number) => {
      const s = steps.find((st) => st.stepNumber === stepNum);
      if (!s || s.status === 'PENDING' || !s.date || s.date === '-') return undefined;
      return s.date + (s.time && s.time !== '-' ? ` ${s.time}` : '');
    };

    // Determine currentStep (first PENDING step)
    let currentStep = steps.length;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].status !== 'COMPLETED') {
        currentStep = i;
        break;
      }
    }

    const manifest = raw.manifestInfo?.[0];

    return {
      success: true,
      trackingNumber: raw.connoteNo || query,
      status: raw.status,
      destination: raw.destination,
      // Sender
      senderName: raw.senderInfo?.name,
      senderAddress: raw.senderInfo?.address,
      senderReference: raw.senderInfo?.senderReference,
      // Receiver
      receiverName: raw.receiverInfo?.name,
      receiverAddress: raw.receiverInfo?.address,
      receiverPhone: raw.receiverInfo?.phone,
      receiverEmail: raw.receiverInfo?.email,
      // MAWB
      mawbRef: manifest?.docketNo,
      mawbCarrier: manifest?.carrier,
      // Parcel specs
      weight: raw.shipmentInfo?.weight,
      deadWeight: raw.shipmentInfo?.deadWeight,
      declaredValue: raw.shipmentInfo?.cubicWeight,
      codAmount: raw.shipmentInfo?.codAmount,
      // Logistics
      province: raw.destination,
      bagNumber: raw.shipmentInfo?.bagNo,
      serviceProvider: raw.shipmentInfo?.partner,
      // Step dates
      manifestDate: getStepDate(1),
      zoneDate: getStepDate(2),
      serviceProviderDate: getStepDate(3),
      verificationDate: getStepDate(4),
      dispatchDate: getStepDate(5),
      currentStep,
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error.' };
  }
}
