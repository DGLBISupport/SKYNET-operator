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
    initialManifest?: string;
    inboundManifest?: string;
    inboundBag?: string;
    initialBag?: string;
    bagNumber?: string;
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

export interface ZoneRule {
    zoneName: string;
    partners: {
        partnerCode: string; // e.g., "PickMe", "Domex"
        weightPercentage: number; // e.g., 70, 30
    }[];
}

export interface AllocationResponse {
    success: boolean;
    parcel?: SkyNetParcelData;
    assignedZone?: string;
    assignedPartner?: string;
    error?: string;
    missedFirstScan?: boolean;
}