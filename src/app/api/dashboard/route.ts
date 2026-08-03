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
        const [shipResult, bagResult, manResult, damResult, unsealResult, spaResult, spResult, spAllocResult, mawbResult] = await Promise.allSettled([
            fetchAllSupabaseRows('shipments', 'reference_number,sender_reference,mawb_reference,delivery_agent_code,bag_number,consignee_location_name,created_at,weight', sb),
            fetchAllSupabaseRows('outbound_lmd_bags', 'id,bag_number,mawb_ref,target_partner,destination_hub,status,parcel_count,total_weight,created_by,sealed_by,created_at,sealed_at', sb),
            fetchAllSupabaseRows('manifest_sessions', 'id,manifest_id,mawb_ref,status,total_bags,total_parcels,closed_by,created_at,closed_at', sb),
            fetchAllSupabaseRows('damaged_barcodes', 'id,barcode,reason,reported_by,created_at', sb),
            fetchAllSupabaseRows('bag_unsealing', 'id,bag_number,mawb_ref,status,unsealed_by,scanned_count,expected_count,created_at,scanned_parcels', sb),
            fetchAllSupabaseRows('service_provider_allocation', 'id', sb),
            fetchAllSupabaseRows('service_providers', 'id,name,code', sb),
            fetchAllSupabaseRows('service_provider_allocation', 'shipment_ref,service_provider,unsealed,scan_status,mawb_ref', sb),
            fetchAllSupabaseRows('mawb', 'id,mawb_reference,carrier,declared_bags,declared_wt,mawb_created,shipper_name,notes', sb)
        ]);

        const shipData = shipResult.status === 'fulfilled' ? shipResult.value : [];
        const bagData = bagResult.status === 'fulfilled' ? bagResult.value : [];
        const manData = manResult.status === 'fulfilled' ? manResult.value : [];
        const damData = damResult.status === 'fulfilled' ? damResult.value : [];
        const unsealData = unsealResult.status === 'fulfilled' ? unsealResult.value : [];
        const spaData = spaResult.status === 'fulfilled' ? spaResult.value : [];
        const spData = spResult.status === 'fulfilled' ? spResult.value : [];
        const spAllocData = spAllocResult.status === 'fulfilled' ? spAllocResult.value : [];
        const mawbData = mawbResult.status === 'fulfilled' ? mawbResult.value : [];

        // Build UUID -> MAWB reference string lookup map (shipments.mawb_reference stores mawb.id as UUID)
        const mawbUuidToRef: Record<string, string> = {};
        mawbData.forEach((m: any) => {
            if (m.id && m.mawb_reference) {
                mawbUuidToRef[String(m.id).trim().toLowerCase()] = m.mawb_reference.trim();
            }
        });

        // Build Service Provider Map (id -> Normalized Name)
        const providerMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex' };
        spData.forEach((sp: any) => {
            const rawName = (sp.name || sp.code || '').trim();
            let normName = rawName || 'Other';
            if (rawName.toLowerCase().includes('pickme')) normName = 'PickMe';
            else if (rawName.toLowerCase().includes('domex')) normName = 'Domex';
            else if (rawName.toLowerCase().includes('pronto')) normName = 'Pronto';
            providerMap[sp.id] = normName;
        });

        // Build set of parcel reference numbers that have completed 1st scan (from bag_unsealing scanned_parcels)
        const unsealedParcelRefsSet = new Set<string>();
        unsealData.forEach((u: any) => {
            if (u.scanned_parcels && Array.isArray(u.scanned_parcels)) {
                u.scanned_parcels.forEach((p: any) => {
                    if (typeof p === 'string' && p.trim()) {
                        unsealedParcelRefsSet.add(p.trim().toLowerCase());
                    } else if (p && typeof p === 'object') {
                        const trk = p.trackingNumber || p.referenceNumber || p.refNumber;
                        if (trk) unsealedParcelRefsSet.add(String(trk).trim().toLowerCase());
                    }
                });
            }
        });

        // Build Shipment Ref -> Partner Name + Scan Status Map from service_provider_allocation
        const shipmentToPartnerMap: Record<string, string> = {};
        const shipmentToScanStatusMap: Record<string, { firstScanDone: boolean; scanStatus: string; unsealed: boolean }> = {};

        spAllocData.forEach((alloc: any) => {
            if (alloc.shipment_ref && alloc.service_provider) {
                const spNum = Number(alloc.service_provider);
                const partnerName = providerMap[spNum] || providerMap[alloc.service_provider] || 'Other';
                shipmentToPartnerMap[alloc.shipment_ref] = partnerName;
                shipmentToPartnerMap[String(alloc.shipment_ref).trim().toLowerCase()] = partnerName;
            }
            if (alloc.shipment_ref) {
                const refLower = String(alloc.shipment_ref).trim().toLowerCase();
                // Store the raw scan_status exactly from service_provider_allocation
                const scanObj = {
                    firstScanDone: alloc.scan_status === '1ST_SCAN_DONE',
                    unsealed: alloc.unsealed === true,
                    scanStatus: alloc.scan_status || 'PENDING'
                };
                shipmentToScanStatusMap[alloc.shipment_ref] = scanObj;
                shipmentToScanStatusMap[refLower] = scanObj;
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
            const refLower = String(s.reference_number || '').trim().toLowerCase();
            const scanInfo = shipmentToScanStatusMap[s.reference_number] || shipmentToScanStatusMap[refLower];

            // Parcels Sorted = STRICTLY only parcels where service_provider_allocation.scan_status = '1ST_SCAN_DONE'
            const isSorted = scanInfo?.scanStatus === '1ST_SCAN_DONE';
            if (isSorted) totalSorted++;

            // Allocation Status Stage Breakdown:
            // Stage 2: 2nd Scan Done
            // Stage 1: 1st Scan Done (scan_status = '1ST_SCAN_DONE' in service_provider_allocation)
            // Stage 0: Pending 1st Scan
            let allocationStage: 'PENDING_1ST_SCAN' | '1ST_SCAN_DONE' | '2ND_SCAN_DONE' = 'PENDING_1ST_SCAN';
            let allocationStatusLabel = 'Pending 1st Scan';

            if (scanInfo?.scanStatus === '2ND_SCAN_DONE' || scanInfo?.scanStatus === 'COMPLETED' || scanInfo?.scanStatus === 'ALLOCATED') {
                allocationStage = '2ND_SCAN_DONE';
                allocationStatusLabel = '2nd Scan Done';
            } else if (scanInfo?.scanStatus === '1ST_SCAN_DONE') {
                allocationStage = '1ST_SCAN_DONE';
                allocationStatusLabel = '1st Scan Done';
            }

            // Resolve LMD Courier Partner strictly via service_provider_allocation table
            let rawPartner = shipmentToPartnerMap[s.reference_number] || shipmentToPartnerMap[refLower] || s.delivery_agent_code || '';
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

            // Resolve UUID stored in shipments.mawb_reference to the real MAWB reference string
            const rawMawbRef = s.mawb_reference || '';
            const isUuidRef = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMawbRef.trim());
            const resolvedMawbRef = isUuidRef
                ? (mawbUuidToRef[rawMawbRef.trim().toLowerCase()] || '-')
                : (rawMawbRef.trim() || '-');

            return {
                referenceNumber: s.reference_number || 'N/A',
                senderReference: s.sender_reference || '-',
                mawbReference: resolvedMawbRef,
                deliveryAgentCode: pName,
                bagNumber: s.bag_number || '',
                consigneeLocation: s.consignee_location_name || 'N/A',
                weight: s.weight ? `${s.weight} kg` : '-',
                createdAt: s.created_at || new Date().toISOString(),
                isSorted,
                firstScanDone: isSorted,
                scanStatus: scanInfo?.scanStatus || (isSorted ? '1ST_SCAN_DONE' : 'PENDING_1ST_SCAN'),
                allocationStage,
                allocationStatusLabel,
                status: scanInfo?.scanStatus || allocationStatusLabel
            };
        });

        // Pending Parcels = Total Received - Parcels Sorted
        const pendingParcels = totalReceived - totalSorted;

        // 2. Bags Metrics & Structured List
        let totalBagsCreated = bagData.length;
        let openBags = 0;
        let sealedBags = 0;
        let bagPartnerCounts: Record<string, number> = { PickMe: 0, Domex: 0, Pronto: 0, General: 0 };

        const bagsList = bagData.map(b => {
            const isSealed = b.status === 'SEALED' || b.status === 'CLOSED';
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

        const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        const isValidMawbRef = (ref: any) => {
            if (!ref || typeof ref !== 'string') return false;
            const clean = ref.trim();
            if (clean === '' || clean === '-' || clean.toUpperCase() === 'N/A' || clean.startsWith('MNF-')) return false;
            if (isUuid(clean)) return false;
            return true;
        };

        let totalManifests = manData.length;
        let openManifests = 0;
        let closedManifests = 0;

        const manifestsList = manData.map(m => {
            const isClosed = String(m.status || '').toUpperCase() === 'CLOSED';
            if (isClosed) closedManifests++;
            else openManifests++;

            const cleanMawb = isValidMawbRef(m.mawb_ref) ? m.mawb_ref.trim() : (isValidMawbRef(m.manifest_id) ? m.manifest_id.trim() : '');

            return {
                id: m.id,
                manifestId: m.manifest_id || m.mawb_ref || `MNF-${m.id}`,
                mawbRef: cleanMawb,
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
            createdAt: u.created_at || '',
            scannedParcels: u.scanned_parcels || []
        }));

        // 4. Exception Counts & Structured List according to database
        let damagedLabelsCount = damData.length;
        let unsealedBoxesCount = unsealData.length;
        let discrepancyCount = 0;

        unsealData.forEach(u => {
            const isDiscrepancy = (u.discrepancy && u.discrepancy !== 0) ||
                (u.scanned_count !== undefined && u.expected_count !== undefined && u.scanned_count !== u.expected_count) ||
                (u.status && (u.status.toLowerCase().includes('shortage') || u.status.toLowerCase().includes('overage') || u.status.toLowerCase().includes('discrepancy')));
            if (isDiscrepancy) {
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

        const mawbTableList = mawbData
            .filter((m: any) => isValidMawbRef(m.mawb_reference))
            .map((m: any) => ({
                mawbReference: m.mawb_reference.trim(),
                carrier: m.carrier || 'N/A',
                declaredBags: m.declared_bags || 0,
                declaredWeight: m.declared_wt || 0,
                createdAt: m.mawb_created || '',
                shipperName: m.shipper_name || '',
                notes: m.notes || ''
            }));

        const mawbWiseMap: Record<string, { mawbReference: string; totalReceived: number; totalSorted: number; pendingParcels: number; sortedParcels: any[]; receivedParcels: any[] }> = {};

        receivedParcels.forEach((p: any) => {
            const mawb = (p.mawbReference && p.mawbReference !== '-' && p.mawbReference.trim() !== '') ? p.mawbReference.trim() : 'UNASSIGNED';
            if (!mawbWiseMap[mawb]) {
                mawbWiseMap[mawb] = {
                    mawbReference: mawb,
                    totalReceived: 0,
                    totalSorted: 0,
                    pendingParcels: 0,
                    sortedParcels: [],
                    receivedParcels: []
                };
            }
            mawbWiseMap[mawb].totalReceived++;
            mawbWiseMap[mawb].receivedParcels.push(p);
            if (p.isSorted) {
                mawbWiseMap[mawb].totalSorted++;
                mawbWiseMap[mawb].sortedParcels.push(p);
            } else {
                mawbWiseMap[mawb].pendingParcels++;
            }
        });

        const mawbWiseSummary = Object.values(mawbWiseMap).sort((a, b) => a.mawbReference.localeCompare(b.mawbReference));

        return NextResponse.json({
            success: true,
            dashboard: {
                totalReceived,
                totalSorted,
                pendingParcels,
                totalBagsCreated,
                openBags,
                sealedBags,
                totalManifests: Math.max(totalManifests, mawbTableList.length),
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
                mawbWiseSummary,
                bagsList,
                manifestsList,
                mawbTableList,
                unsealedBoxesList,
                exceptionsList
            }
        });

    } catch (err: any) {
        console.error("Dashboard API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
