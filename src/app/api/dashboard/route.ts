import { NextResponse } from 'next/server';

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
            const res = await fetch(`${sb.url}/rest/v1/${table}?select=${selectFields}&limit=${limit}&offset=${offset}`, { headers: sb.headers });
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
        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
        }

        // Fetch all tables concurrently using Promise.allSettled
        const [shipResult, bagResult, manResult, damResult, unsealResult, spaResult, spResult, spAllocResult] = await Promise.allSettled([
            fetchAllSupabaseRows('shipments', 'reference_number,sender_reference,mawb_reference,delivery_agent_code,bag_number,consignee_location_name,created_at,weight', sb),
            fetchAllSupabaseRows('outbound_lmd_bags', 'id,bag_number,mawb_ref,target_partner,destination_hub,status,parcel_count,total_weight,created_by,sealed_by,created_at,sealed_at', sb),
            fetchAllSupabaseRows('manifest_sessions', 'id,manifest_id,mawb_ref,status,total_bags,total_parcels,closed_by,created_at,closed_at', sb),
            fetchAllSupabaseRows('damaged_barcodes', 'id,barcode,reason,reported_by,created_at', sb),
            fetchAllSupabaseRows('bag_unsealing', 'id,bag_number,mawb_ref,status,unsealed_by,scanned_count,expected_count,created_at', sb),
            fetchAllSupabaseRows('service_provider_allocation', 'id', sb),
            fetchAllSupabaseRows('service_providers', 'id,name,code', sb),
            fetchAllSupabaseRows('service_provider_allocation', 'shipment_ref,service_provider', sb)
        ]);

        const shipData = shipResult.status === 'fulfilled' ? shipResult.value : [];
        const bagData = bagResult.status === 'fulfilled' ? bagResult.value : [];
        const manData = manResult.status === 'fulfilled' ? manResult.value : [];
        const damData = damResult.status === 'fulfilled' ? damResult.value : [];
        const unsealData = unsealResult.status === 'fulfilled' ? unsealResult.value : [];
        const spaData = spaResult.status === 'fulfilled' ? spaResult.value : [];
        const spData = spResult.status === 'fulfilled' ? spResult.value : [];
        const spAllocData = spAllocResult.status === 'fulfilled' ? spAllocResult.value : [];

        // Build Service Provider Map (id -> Normalized Name)
        const providerMap: Record<number, string> = {};
        spData.forEach((sp: any) => {
            const rawName = (sp.name || sp.code || '').trim();
            let normName = rawName || 'Other';
            if (rawName.toLowerCase().includes('pickme')) normName = 'PickMe';
            else if (rawName.toLowerCase().includes('domex')) normName = 'Domex';
            else if (rawName.toLowerCase().includes('pronto')) normName = 'Pronto';
            providerMap[sp.id] = normName;
        });

        // Build Shipment Ref -> Partner Name Map from service_provider_allocation
        const shipmentToPartnerMap: Record<string, string> = {};
        spAllocData.forEach((alloc: any) => {
            if (alloc.shipment_ref && alloc.service_provider) {
                const partnerName = providerMap[alloc.service_provider] || 'Other';
                shipmentToPartnerMap[alloc.shipment_ref] = partnerName;
            }
        });

        // 1. Shipments Metrics & Structured List
        let totalReceived = shipData.length;
        let totalSorted = 0;
        let partnerDistribution: Record<string, number> = { PickMe: 0, Domex: 0, Pronto: 0, Other: 0 };

        // Detailed per-partner metrics map
        const partnerDetailsMap: Record<string, { partnerName: string; totalParcels: number; allocatedParcels: number; pendingParcels: number; totalBags: number }> = {
            PickMe: { partnerName: 'PickMe', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Domex: { partnerName: 'Domex', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Pronto: { partnerName: 'Pronto', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Other: { partnerName: 'Other', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 }
        };

        const receivedParcels = shipData.map(s => {
            const isSorted = Boolean(s.bag_number && String(s.bag_number).trim() !== '');
            if (isSorted) totalSorted++;
            
            // Resolve LMD Courier Partner via service_provider_allocation table, fallback to delivery_agent_code
            let rawPartner = shipmentToPartnerMap[s.reference_number] || s.delivery_agent_code || '';
            let pName = 'Other';
            if (rawPartner.toLowerCase().includes('pickme')) pName = 'PickMe';
            else if (rawPartner.toLowerCase().includes('domex')) pName = 'Domex';
            else if (rawPartner.toLowerCase().includes('pronto')) pName = 'Pronto';
            else if (partnerDetailsMap[rawPartner]) pName = rawPartner;

            if (partnerDistribution[pName] !== undefined) {
                partnerDistribution[pName]++;
            } else {
                partnerDistribution['Other']++;
            }

            partnerDetailsMap[pName].totalParcels++;
            if (isSorted) {
                partnerDetailsMap[pName].allocatedParcels++;
            } else {
                partnerDetailsMap[pName].pendingParcels++;
            }

            return {
                referenceNumber: s.reference_number || 'N/A',
                senderReference: s.sender_reference || '-',
                mawbReference: s.mawb_reference || '-',
                deliveryAgentCode: pName,
                bagNumber: s.bag_number || '',
                consigneeLocation: s.consignee_location_name || 'N/A',
                weight: s.weight ? `${s.weight} kg` : '-',
                createdAt: s.created_at || new Date().toISOString(),
                isSorted
            };
        });

        const pendingParcels = totalReceived - totalSorted;

        // 2. Bags Metrics & Structured List
        let totalBagsCreated = bagData.length;
        let openBags = 0;
        let sealedBags = 0;
        let bagPartnerCounts: Record<string, number> = { PickMe: 0, Domex: 0, Pronto: 0, General: 0 };

        const bagsList = bagData.map(b => {
            const isSealed = b.status === 'SEALED';
            if (isSealed) sealedBags++;
            else openBags++;

            let p = b.target_partner || 'General';
            if (p.toLowerCase().includes('pickme')) p = 'PickMe';
            else if (p.toLowerCase().includes('domex')) p = 'Domex';
            else if (p.toLowerCase().includes('pronto')) p = 'Pronto';

            if (bagPartnerCounts[p] !== undefined) bagPartnerCounts[p]++;
            else bagPartnerCounts['General']++;

            let detailsPartner = p;
            if (detailsPartner === 'General' || !partnerDetailsMap[detailsPartner]) detailsPartner = 'Other';
            partnerDetailsMap[detailsPartner].totalBags++;

            return {
                id: b.id,
                bagNumber: b.bag_number || `BAG-${b.id}`,
                mawbRef: b.mawb_ref || '',
                targetPartner: p,
                destinationHub: b.destination_hub || p,
                status: b.status || 'OPEN',
                parcelCount: b.parcel_count || 0,
                totalWeight: b.total_weight || 0,
                createdBy: b.created_by || 'System',
                sealedBy: b.sealed_by || '-',
                createdAt: b.created_at || '',
                sealedAt: b.sealed_at || '-'
            };
        });

        const partnerDetails = Object.values(partnerDetailsMap);

        // 3. Manifest Metrics & Structured List
        let totalManifests = manData.length;
        let openManifests = 0;
        let closedManifests = 0;

        const manifestsList = manData.map(m => {
            const isClosed = m.status === 'CLOSED';
            if (isClosed) closedManifests++;
            else openManifests++;

            return {
                id: m.id,
                manifestId: m.manifest_id || `MNF-${m.id}`,
                mawbRef: m.mawb_ref || m.manifest_id || '',
                status: m.status || 'OPEN',
                totalBags: m.total_bags || 0,
                totalParcels: m.total_parcels || 0,
                closedBy: m.closed_by || '-',
                createdAt: m.created_at || '',
                closedAt: m.closed_at || '-'
            };
        });

        // Box Unsealings List
        const unsealedBoxesList = unsealData.map(u => ({
            id: u.id,
            mawbRef: u.mawb_ref || '',
            bagNumber: u.bag_number || 'Box',
            scannedCount: u.scanned_count || 0,
            expectedCount: u.expected_count || 0,
            unsealedBy: u.unsealed_by || 'Staff',
            status: u.status || 'Unsealed',
            createdAt: u.created_at || ''
        }));

        // 4. Exception Counts & Structured List
        let damagedLabelsCount = damData.length;
        let unsealedBoxesCount = unsealData.length;
        let discrepancyCount = 0;

        unsealData.forEach(u => {
            const st = (u.status || '').toLowerCase();
            if (st.includes('shortage') || st.includes('overage') || st.includes('discrepancy')) {
                discrepancyCount++;
            }
        });

        const exceptionsList = [
            ...damData.map(d => ({
                id: `dam-${d.id}`,
                type: 'Damaged Barcode',
                refNumber: d.barcode || 'N/A',
                details: d.reason || 'Label damaged / unreadable',
                reportedBy: d.reported_by || 'Operator',
                status: 'Damaged Label',
                scannedVsExpected: '-',
                createdAt: d.created_at || ''
            })),
            ...unsealData.map(u => ({
                id: `unseal-${u.id}`,
                type: `Unsealing ${u.status || 'Discrepancy'}`,
                refNumber: u.bag_number || 'Box',
                details: `MAWB: ${u.mawb_ref || 'N/A'}`,
                reportedBy: u.unsealed_by || 'Operator',
                status: u.status || 'Unsealed Box',
                scannedVsExpected: `${u.scanned_count || 0} / ${u.expected_count || 0}`,
                createdAt: u.created_at || ''
            }))
        ];

        // 5. Dispatch Allocations
        let totalDispatched = spaData.length;

        // 6. Aggregate Operator Productivity Breakdown
        const userProductivityMap: Record<string, { operator: string; scanned: number; bagsSealed: number; manifestsClosed: number }> = {};

        const addActivity = (opName: string, type: 'scan' | 'seal' | 'close') => {
            const cleanOp = (opName || '').trim();
            if (!cleanOp || cleanOp === 'System') return;
            if (!userProductivityMap[cleanOp]) {
                userProductivityMap[cleanOp] = { operator: cleanOp, scanned: 0, bagsSealed: 0, manifestsClosed: 0 };
            }
            if (type === 'scan') userProductivityMap[cleanOp].scanned++;
            if (type === 'seal') userProductivityMap[cleanOp].bagsSealed++;
            if (type === 'close') userProductivityMap[cleanOp].manifestsClosed++;
        };

        bagData.forEach(b => {
            if (b.sealed_by) addActivity(b.sealed_by, 'seal');
            if (b.created_by) addActivity(b.created_by, 'scan');
        });

        manData.forEach(m => {
            if (m.closed_by) addActivity(m.closed_by, 'close');
        });

        unsealData.forEach(u => {
            if (u.unsealed_by) {
                const cleanOp = u.unsealed_by.trim();
                if (!userProductivityMap[cleanOp]) {
                    userProductivityMap[cleanOp] = { operator: cleanOp, scanned: 0, bagsSealed: 0, manifestsClosed: 0 };
                }
                userProductivityMap[cleanOp].scanned += (u.scanned_count || 1);
            }
        });

        const userProductivity = Object.values(userProductivityMap).sort((a, b) => b.scanned - a.scanned);

        return NextResponse.json({
            success: true,
            dashboard: {
                totalReceived,
                totalSorted,
                pendingParcels,
                totalBagsCreated,
                openBags,
                sealedBags,
                totalManifests,
                openManifests,
                closedManifests,
                totalDispatched,
                exceptions: {
                    damagedLabelsCount,
                    unsealedBoxesCount,
                    discrepancyCount
                },
                partnerDistribution,
                bagPartnerCounts,
                partnerDetails,
                userProductivity,
                receivedParcels,
                bagsList,
                manifestsList,
                unsealedBoxesList,
                exceptionsList
            }
        });

    } catch (err: any) {
        console.error("Dashboard API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
