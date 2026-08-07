import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getSupabaseConfig = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return {
        url,
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        }
    };
};

async function fetchAllSupabaseRows(table: string, selectFields: string, sb: { url: string; headers: Record<string, string> }) {
    let allRows: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    let attempts = 0;

    while (hasMore && attempts < 10) {
        attempts++;
        try {
            const res = await fetch(`${sb.url}/rest/v1/${table}?select=${selectFields}&order=id.asc&limit=${limit}&offset=${offset}`, { headers: sb.headers });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    allRows.push(...data);
                    if (data.length < limit) {
                        hasMore = false;
                    } else {
                        offset += limit;
                    }
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        } catch (e) {
            console.error(`Error fetching table ${table}:`, e);
            hasMore = false;
        }
    }
    return allRows;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
        }

        const [spaResult, unsealResult, outboundResult, providerResult] = await Promise.allSettled([
            fetchAllSupabaseRows('service_provider_allocation', 'id,shipment_ref,service_provider,unsealed,scan_status,created_at,updated_at,mapped_zone', sb),
            fetchAllSupabaseRows('bag_unsealing', 'id,bag_number,created_at,scanned_count,scanned_parcels', sb),
            fetchAllSupabaseRows('outbound_lmd_bags', 'id,bag_number,mawb_ref,target_partner,destination_hub,status,parcel_count,total_weight,created_by,sealed_by,created_at,sealed_at', sb),
            fetchAllSupabaseRows('service_providers', 'id,name,code', sb)
        ]);

        const spaData = spaResult.status === 'fulfilled' ? spaResult.value : [];
        const unsealData = unsealResult.status === 'fulfilled' ? unsealResult.value : [];
        const outboundData = outboundResult.status === 'fulfilled' ? outboundResult.value : [];
        const providerData = providerResult.status === 'fulfilled' ? providerResult.value : [];

        // Build robust provider ID / Code / Name -> normalized partner name map
        const providerIdMap: Record<string | number, string> = { 1: 'PickMe', 2: 'Domex' };
        providerData.forEach((sp: any) => {
            const rawName = (sp.name || sp.code || '').trim();
            let norm = 'Other';
            if (rawName.toLowerCase().includes('pickme')) norm = 'PickMe';
            else if (rawName.toLowerCase().includes('domex')) norm = 'Domex';
            else if (rawName.toLowerCase().includes('pronto')) norm = 'Pronto';
            
            if (sp.id) {
                providerIdMap[sp.id] = norm;
                providerIdMap[String(sp.id)] = norm;
            }
            if (sp.code) providerIdMap[String(sp.code).trim().toLowerCase()] = norm;
            if (sp.name) providerIdMap[String(sp.name).trim().toLowerCase()] = norm;
        });

        const resolvePartnerName = (spVal: any): string => {
            if (spVal === null || spVal === undefined || spVal === '') return 'Other';
            const strVal = String(spVal).trim();
            const lowerVal = strVal.toLowerCase();

            if (providerIdMap[strVal]) return providerIdMap[strVal];
            if (providerIdMap[lowerVal]) return providerIdMap[lowerVal];

            if (lowerVal.includes('pickme') || lowerVal === '1') return 'PickMe';
            if (lowerVal.includes('domex') || lowerVal === '2') return 'Domex';
            if (lowerVal.includes('pronto')) return 'Pronto';

            return 'Other';
        };

        // Filter rows by date string (YYYY-MM-DD), checking local timezone (Asia/Colombo) & UTC
        const isTargetDate = (dateStr?: string | null) => {
            if (!dateStr) return false;
            try {
                const str = String(dateStr).trim();
                if (str.startsWith(dateParam)) return true;

                const d = new Date(str);
                if (isNaN(d.getTime())) return false;

                const colomboDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
                if (colomboDate === dateParam) return true;

                const utcDate = d.toISOString().split('T')[0];
                return utcDate === dateParam;
            } catch {
                return false;
            }
        };

        // Calculations
        let totalScannedAll = 0;
        let unsealed1stScanDone = 0;
        let verified2ndScanDone = 0;
        let pickMeScanned = 0;
        let domexScanned = 0;
        let prontoScanned = 0;
        let otherScanned = 0;

        const processedRefsOnDate = new Set<string>();

        // Process service_provider_allocation rows
        spaData.forEach((alloc: any) => {
            const isCreatedOnDate = isTargetDate(alloc.created_at);
            const isUpdatedOnDate = isTargetDate(alloc.updated_at);
            const hasActivityOnDate = isCreatedOnDate || isUpdatedOnDate;

            if (hasActivityOnDate) {
                const ref = alloc.shipment_ref || String(alloc.id);
                if (ref) processedRefsOnDate.add(ref);

                const statusStr = (alloc.scan_status || '').toUpperCase();
                const is1stScan = alloc.unsealed === true || statusStr === '1ST_SCAN_DONE' || statusStr === '2ND_SCAN_DONE';
                const is2ndScan = statusStr === '2ND_SCAN_DONE' || statusStr === 'VERIFIED' || statusStr === 'DISPATCHED';

                if (is1stScan || is2ndScan) {
                    totalScannedAll++;
                }

                if (is1stScan) {
                    unsealed1stScanDone++;
                }

                if (is2ndScan) {
                    verified2ndScanDone++;
                }

                // Partner breakdown for scanned/allocated items
                const partnerName = resolvePartnerName(alloc.service_provider);

                if (partnerName === 'PickMe') {
                    pickMeScanned++;
                } else if (partnerName === 'Domex') {
                    domexScanned++;
                } else if (partnerName === 'Pronto') {
                    prontoScanned++;
                } else {
                    otherScanned++;
                }
            }
        });

        // Add scanned parcels from bag_unsealing on selected date if not already counted
        unsealData.forEach((u: any) => {
            if (isTargetDate(u.created_at)) {
                if (Array.isArray(u.scanned_parcels)) {
                    u.scanned_parcels.forEach((p: any) => {
                        const trk = typeof p === 'string' ? p : (p?.trackingNumber || p?.referenceNumber);
                        if (trk && !processedRefsOnDate.has(trk)) {
                            processedRefsOnDate.add(trk);
                            totalScannedAll++;
                            unsealed1stScanDone++;
                        }
                    });
                }
            }
        });

        // Format Outbound LMD Bags filtered for selected date (falling back to all if none created today)
        const dateFilteredBags = outboundData.filter((b: any) => isTargetDate(b.created_at) || isTargetDate(b.sealed_at));
        const bagsToReturn = dateFilteredBags.length > 0 ? dateFilteredBags : outboundData;

        const outboundBags = bagsToReturn.map((b: any) => ({
            id: b.id,
            bagNumber: b.bag_number,
            mawbRef: b.mawb_ref || 'N/A',
            targetPartner: resolvePartnerName(b.target_partner),
            destinationHub: b.destination_hub || 'General Hub',
            parcelCount: b.parcel_count || 0,
            totalWeight: b.total_weight || 0,
            status: b.status || 'OPEN',
            createdAt: b.created_at
        }));

        return NextResponse.json({
            success: true,
            selectedDate: dateParam,
            stats: {
                totalScannedAll,
                unsealed1stScanDone,
                verified2ndScanDone,
                pickMeScanned,
                domexScanned,
                prontoScanned,
                otherScanned
            },
            outboundBags
        });

    } catch (e: any) {
        console.error("Error in /api/dispatch-verify-stats:", e);
        return NextResponse.json({ success: false, error: e.message || 'Failed to fetch dispatch verification stats' }, { status: 500 });
    }
}
