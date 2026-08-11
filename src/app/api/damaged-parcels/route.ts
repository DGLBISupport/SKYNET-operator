import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface DamagedParcelRecord {
    id: number | string;
    createdAt: string;
    trackingNumber: string;
    temuBarcode?: string;
    mawbReference?: string;
    consigneeName?: string;
    assignedPartner?: string;
    assignedZone?: string;
    damageType: string;
    severity: string;
    imageUrl1: string;
    imageUrl2: string;
    remarks?: string;
    reportedBy: string;
    status: 'REPORTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DISCARDED' | 'RE_LABELLED';
}

// In-memory store for instant response & backup if Supabase table is pending
const memoryDamagedParcels: DamagedParcelRecord[] = [];

const getSupabaseConfig = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return {
        url,
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    };
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tracking = searchParams.get('trackingNumber');
        const status = searchParams.get('status');

        const sb = getSupabaseConfig();
        if (sb) {
            try {
                let query = `${sb.url}/rest/v1/damaged_parcels?select=*&order=created_at.desc`;
                if (tracking) {
                    query += `&tracking_number=ilike.*${encodeURIComponent(tracking)}*`;
                }
                if (status) {
                    query += `&status=eq.${encodeURIComponent(status)}`;
                }

                const res = await fetch(query, { headers: sb.headers });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const mapped: DamagedParcelRecord[] = data.map((item: any) => ({
                            id: item.id,
                            createdAt: item.created_at || new Date().toISOString(),
                            trackingNumber: item.tracking_number,
                            temuBarcode: item.temu_barcode,
                            mawbReference: item.mawb_reference,
                            consigneeName: item.consignee_name,
                            assignedPartner: item.assigned_partner,
                            assignedZone: item.assigned_zone,
                            damageType: item.damage_type,
                            severity: item.severity || 'Moderate',
                            imageUrl1: item.image_url_1,
                            imageUrl2: item.image_url_2,
                            remarks: item.remarks,
                            reportedBy: item.reported_by || 'System Operator',
                            status: item.status || 'REPORTED'
                        }));
                        // Merge with in-memory records if any missing
                        const allIds = new Set(mapped.map(m => String(m.id)));
                        const uniqueMemory = memoryDamagedParcels.filter(m => !allIds.has(String(m.id)));
                        return NextResponse.json({
                            success: true,
                            data: [...mapped, ...uniqueMemory]
                        });
                    }
                }
            } catch (err) {
                console.warn('[Damaged Parcels API] Supabase fetch error, fallback to memory:', err);
            }
        }

        // Fallback to in-memory store
        let filtered = memoryDamagedParcels;
        if (tracking) {
            filtered = filtered.filter(p => p.trackingNumber.toLowerCase().includes(tracking.toLowerCase()));
        }
        if (status) {
            filtered = filtered.filter(p => p.status === status);
        }

        return NextResponse.json({
            success: true,
            data: filtered
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            trackingNumber,
            temuBarcode,
            mawbReference,
            consigneeName,
            assignedPartner,
            assignedZone,
            damageType,
            severity,
            imageUrl1,
            imageUrl2,
            remarks,
            reportedBy
        } = body;

        // Validation
        if (!trackingNumber || !trackingNumber.trim()) {
            return NextResponse.json({ success: false, error: 'Tracking number is required.' }, { status: 400 });
        }
        if (!damageType) {
            return NextResponse.json({ success: false, error: 'Damage type/category is required.' }, { status: 400 });
        }
        if (!imageUrl1 || !imageUrl1.trim()) {
            return NextResponse.json({ success: false, error: 'Image 1 (Parcel Condition) is required.' }, { status: 400 });
        }
        if (!imageUrl2 || !imageUrl2.trim()) {
            return NextResponse.json({ success: false, error: 'Image 2 (Label / Barcode Condition) is required.' }, { status: 400 });
        }

        const newRecord: DamagedParcelRecord = {
            id: `dmg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
            trackingNumber: trackingNumber.trim(),
            temuBarcode: temuBarcode?.trim() || undefined,
            mawbReference: mawbReference?.trim() || undefined,
            consigneeName: consigneeName?.trim() || undefined,
            assignedPartner: assignedPartner?.trim() || undefined,
            assignedZone: assignedZone?.trim() || undefined,
            damageType,
            severity: severity || 'Moderate',
            imageUrl1,
            imageUrl2,
            remarks: remarks?.trim() || undefined,
            reportedBy: reportedBy?.trim() || 'System Operator',
            status: 'REPORTED'
        };

        // Save to Supabase if configured
        const sb = getSupabaseConfig();
        if (sb) {
            try {
                const sbPayload = {
                    tracking_number: newRecord.trackingNumber,
                    temu_barcode: newRecord.temuBarcode,
                    mawb_reference: newRecord.mawbReference,
                    consignee_name: newRecord.consigneeName,
                    assigned_partner: newRecord.assignedPartner,
                    assigned_zone: newRecord.assignedZone,
                    damage_type: newRecord.damageType,
                    severity: newRecord.severity,
                    image_url_1: newRecord.imageUrl1,
                    image_url_2: newRecord.imageUrl2,
                    remarks: newRecord.remarks,
                    reported_by: newRecord.reportedBy,
                    status: newRecord.status
                };

                const dbRes = await fetch(`${sb.url}/rest/v1/damaged_parcels`, {
                    method: 'POST',
                    headers: sb.headers,
                    body: JSON.stringify(sbPayload)
                });

                if (dbRes.ok) {
                    const saved = await dbRes.json();
                    if (Array.isArray(saved) && saved.length > 0) {
                        newRecord.id = saved[0].id;
                        newRecord.createdAt = saved[0].created_at || newRecord.createdAt;
                    }
                } else {
                    console.warn('[Damaged Parcels API] Supabase insert warning:', await dbRes.text());
                }
            } catch (err) {
                console.warn('[Damaged Parcels API] Supabase insert error, saved to memory fallback:', err);
            }
        }

        // Save to in-memory list
        memoryDamagedParcels.unshift(newRecord);

        return NextResponse.json({
            success: true,
            message: 'Damaged parcel report saved successfully.',
            data: newRecord
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
    }
}
