export interface SkyNetParcelData {
    trackingNumber: string;
    recipientName: string;
    province: string;
    district: string;
    city: string;
    weight: number;
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
}