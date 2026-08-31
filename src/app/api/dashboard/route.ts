import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getSupabaseConfig = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

    while (hasMore && attempts < 100) {
        attempts++;
        try {
            const res = await fetch(`${sb.url}/rest/v1/${table}?select=${selectFields}&limit=${limit}&offset=${offset}`, {
                headers: sb.headers,
                cache: 'no-store'
            });
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
        // NOTE: service_provider_allocation is fetched only once (full fields).
        //       totalDispatched is derived from spAllocData.length — no duplicate count-only fetch needed.
        const [shipResult, bagResult, manResult, damResult, unsealResult, spResult, spAllocResult, mawbResult, omResult, usersResult, bagItemsResult] = await Promise.allSettled([
            fetchAllSupabaseRows('shipments', 'reference_number,sender_reference,mawb_reference,delivery_agent_code,bag_number,consignee_location_name,created_at,weight', sb),
            fetchAllSupabaseRows('outbound_lmd_bags', 'id,bag_number,new_manifest_reference,target_partner,destination_hub,status,parcel_count,total_weight,created_by,opened_by,opened_at,sealed_by,sealed_at,closed_by,closed_at,created_at,parcels', sb),
            fetchAllSupabaseRows('manifest_sessions', 'id,manifest_id,mawb_ref,status,total_bags,total_parcels,closed_by,created_at,closed_at', sb),
            fetchAllSupabaseRows('damaged_barcodes', 'id,barcode,reason,reported_by,created_at', sb),
            fetchAllSupabaseRows('bag_unsealing', 'id,bag_number,mawb_ref,status,unsealed_by,scanned_count,expected_count,scanned_parcels,created_at', sb),
            fetchAllSupabaseRows('service_providers', 'id,name,code', sb),
            fetchAllSupabaseRows('service_provider_allocation', 'shipment_ref,service_provider,unsealed,scan_status,mawb_ref,created_at,updated_at', sb),
            fetchAllSupabaseRows('mawb', 'mawb_reference,carrier,declared_bags,declared_wt,mawb_created,shipper_name,notes,has_service_providers_allocated', sb),
            fetchAllSupabaseRows('outbound_manifests', 'id,manifest_reference,bag_numbers,total_bags,total_parcels,status,closed_at,closed_by,opened_by', sb),
            fetchAllSupabaseRows('users', 'id,first_name,last_name,email,username,role,status', sb),
            fetchAllSupabaseRows('outbound_lmd_bag_items', 'id,bag_number,shipment_ref,weight,created_at,scanned_by', sb)
        ]);

        const shipData = shipResult.status === 'fulfilled' ? shipResult.value : [];
        const bagData = bagResult.status === 'fulfilled' ? bagResult.value : [];
        const manData = manResult.status === 'fulfilled' ? manResult.value : [];
        const damData = damResult.status === 'fulfilled' ? damResult.value : [];
        const unsealData = unsealResult.status === 'fulfilled' ? unsealResult.value : [];
        const spData = spResult.status === 'fulfilled' ? spResult.value : [];
        const spAllocData = spAllocResult.status === 'fulfilled' ? spAllocResult.value : [];
        const mawbData = mawbResult.status === 'fulfilled' ? mawbResult.value : [];
        const omBags = omResult.status === 'fulfilled' ? omResult.value : [];
        const usersData = usersResult.status === 'fulfilled' ? usersResult.value : [];
        const bagItemsData = bagItemsResult.status === 'fulfilled' ? bagItemsResult.value : [];

        // Build MAWB reference lookup map
        const mawbUuidToRef: Record<string, string> = {};
        const mawbCreatedMap: Record<string, string> = {};
        mawbData.forEach((m: any) => {
            const dateVal = m.mawb_created || '';
            if (m.mawb_reference) {
                const refKey = m.mawb_reference.trim().toLowerCase();
                mawbUuidToRef[refKey] = m.mawb_reference.trim();
                if (dateVal) mawbCreatedMap[refKey] = dateVal;
            }
        });

        // Build Service Provider Map (id -> Normalized Name)
        const providerMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'SITREK' };
        spData.forEach((sp: any) => {
            const rawName = (sp.name || sp.code || '').trim();
            let normName = rawName || 'Other';
            if (rawName.toLowerCase().includes('pickme')) normName = 'PickMe';
            else if (rawName.toLowerCase().includes('domex')) normName = 'Domex';
            else if (rawName.toLowerCase().includes('sitrek')) normName = 'SITREK';
            else if (rawName.toLowerCase().includes('pronto')) normName = 'Pronto';
            providerMap[sp.id] = normName;
        });

        // scanned_parcels is no longer fetched from bag_unsealing (heavy JSON column, not used by UI).
        // First-scan status is derived entirely from service_provider_allocation.unsealed / scan_status.

        // Build Shipment Ref -> Partner Name + Scan Status Map from service_provider_allocation
        const shipmentToPartnerMap: Record<string, string> = {};
        const shipmentToScanStatusMap: Record<string, { firstScanDone: boolean; secondScanDone: boolean; scanStatus: string; unsealed: boolean; createdAt?: string; updatedAt?: string }> = {};

        spAllocData.forEach((alloc: any) => {
            if (alloc.shipment_ref && alloc.service_provider) {
                const spNum = Number(alloc.service_provider);
                const partnerName = providerMap[spNum] || providerMap[alloc.service_provider] || 'Other';
                shipmentToPartnerMap[alloc.shipment_ref] = partnerName;
                shipmentToPartnerMap[String(alloc.shipment_ref).trim().toLowerCase()] = partnerName;
            }
            if (alloc.shipment_ref) {
                const refLower = String(alloc.shipment_ref).trim().toLowerCase();
                const statusStr = (alloc.scan_status || '').toUpperCase();
                const is1st = alloc.unsealed === true || statusStr === '1ST_SCAN_DONE' || statusStr === '2ND_SCAN_DONE' || statusStr === 'VERIFIED' || statusStr === 'DISPATCHED' || statusStr === 'COMPLETED';
                const is2nd = statusStr === '2ND_SCAN_DONE' || statusStr === 'VERIFIED' || statusStr === 'DISPATCHED' || statusStr === 'COMPLETED';

                const scanObj = {
                    firstScanDone: is1st,
                    secondScanDone: is2nd,
                    unsealed: alloc.unsealed === true,
                    scanStatus: alloc.scan_status || 'ALLOCATED',
                    createdAt: alloc.created_at || '',
                    updatedAt: alloc.updated_at || ''
                };
                shipmentToScanStatusMap[alloc.shipment_ref] = scanObj;
                shipmentToScanStatusMap[refLower] = scanObj;
            }
        });

        // 1. Shipments Metrics & Structured List
        let totalReceived = shipData.length;
        let totalSorted = 0;
        let partnerDistribution: Record<string, number> = { PickMe: 0, Domex: 0, SITREK: 0, Pronto: 0, Other: 0 };

        // Detailed per-partner metrics map
        const partnerDetailsMap: Record<string, { partnerName: string; totalParcels: number; allocatedParcels: number; pendingParcels: number; totalBags: number }> = {
            PickMe: { partnerName: 'PickMe', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Domex: { partnerName: 'Domex', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            SITREK: { partnerName: 'SITREK', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Pronto: { partnerName: 'Pronto', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 },
            Other: { partnerName: 'Other', totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 }
        };

        const receivedParcels = shipData.map(s => {
            const refLower = String(s.reference_number || '').trim().toLowerCase();
            const scanInfo = shipmentToScanStatusMap[s.reference_number] || shipmentToScanStatusMap[refLower];

            // Allocation Status Stage Breakdown:
            // Stage 2: 2nd Scan Done (2ND_SCAN_DONE, VERIFIED, DISPATCHED, COMPLETED)
            // Stage 1: 1st Scan Done (scan_status = '1ST_SCAN_DONE', unsealed = true, or in bag_unsealing)
            // Stage 0: Pending 1st Scan (ALLOCATED, PENDING, or no scan record yet)
            let allocationStage: 'PENDING_1ST_SCAN' | '1ST_SCAN_DONE' | '2ND_SCAN_DONE' = 'PENDING_1ST_SCAN';
            let allocationStatusLabel = 'Pending 1st Scan';

            if (scanInfo?.secondScanDone) {
                allocationStage = '2ND_SCAN_DONE';
                allocationStatusLabel = '2nd Scan Done';
            } else if (scanInfo?.firstScanDone || scanInfo?.unsealed) {
                allocationStage = '1ST_SCAN_DONE';
                allocationStatusLabel = '1st Scan Done';
            } else {
                allocationStage = 'PENDING_1ST_SCAN';
                allocationStatusLabel = 'Pending 1st Scan';
            }

            // Parcels Sorted = Parcels that have completed 1st scan or 2nd scan
            const isSorted = allocationStage === '1ST_SCAN_DONE' || allocationStage === '2ND_SCAN_DONE';
            if (isSorted) totalSorted++;

            // Resolve LMD Courier Partner strictly via service_provider_allocation table
            let rawPartner = shipmentToPartnerMap[s.reference_number] || shipmentToPartnerMap[refLower] || s.delivery_agent_code || '';
            let pName = 'Other';
            if (rawPartner.toLowerCase().includes('pickme')) pName = 'PickMe';
            else if (rawPartner.toLowerCase().includes('domex')) pName = 'Domex';
            else if (rawPartner.toLowerCase().includes('sitrek')) pName = 'SITREK';
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

            // Resolve real Received Date: shipments created_at -> allocation created_at -> MAWB created date -> empty string (no fake today date)
            const resolvedCreatedAt = s.created_at || scanInfo?.createdAt || (resolvedMawbRef !== '-' ? mawbCreatedMap[resolvedMawbRef.toLowerCase()] : '') || (rawMawbRef ? mawbCreatedMap[rawMawbRef.toLowerCase()] : '') || '';

            return {
                referenceNumber: s.reference_number || 'N/A',
                senderReference: s.sender_reference || '-',
                mawbReference: resolvedMawbRef,
                deliveryAgentCode: pName,
                bagNumber: s.bag_number || '',
                consigneeLocation: s.consignee_location_name || 'N/A',
                weight: s.weight ? `${s.weight} g` : '-',
                createdAt: resolvedCreatedAt,
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
        let bagPartnerCounts: Record<string, number> = { PickMe: 0, Domex: 0, SITREK: 0, Pronto: 0, General: 0 };

        const bagsList = bagData.map(b => {
            const isSealed = b.status === 'SEALED' || b.status === 'CLOSED';
            if (isSealed) sealedBags++;
            else openBags++;

            let p = b.target_partner || 'General';
            if (p.toLowerCase().includes('pickme')) p = 'PickMe';
            else if (p.toLowerCase().includes('domex')) p = 'Domex';
            else if (p.toLowerCase().includes('sitrek')) p = 'SITREK';
            else if (p.toLowerCase().includes('pronto')) p = 'Pronto';

            if (bagPartnerCounts[p] !== undefined) bagPartnerCounts[p]++;
            else bagPartnerCounts['General']++;

            let detailsPartner = p;
            if (detailsPartner === 'General' || !partnerDetailsMap[detailsPartner]) detailsPartner = 'Other';
            partnerDetailsMap[detailsPartner].totalBags++;

            // Resolve manifest reference: prefer FK join, fallback to legacy mawb_ref
            const resolvedManifestRef = (() => {
                if (b.new_manifest_reference) {
                    // new FK — look up in outbound_manifests data if available
                    const omRow = (omBags || []).find((m: any) => Number(m.id) === Number(b.new_manifest_reference));
                    return omRow?.manifest_reference || b.mawb_ref || '';
                }
                return b.mawb_ref || '';
            })();
            return {
                id: b.id,
                bagNumber: b.bag_number || `BAG-${b.id}`,
                mawbRef: resolvedManifestRef,
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
            scannedParcels: [] // field removed from fetch (heavy JSON, not consumed by UI)
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

        // 5. Dispatch Allocations — count comes from spAllocData (no separate fetch needed)
        let totalDispatched = spAllocData.length;

        // 6. Aggregate Operator Productivity Breakdown (Day-Wise & All-Time)
        interface CanonicalUser {
            id: number | string;
            first_name: string;
            last_name: string;
            username: string;
            email: string;
            role: string;
            status: string;
            displayName: string;
        }

        const canonicalUsers: CanonicalUser[] = [];
        const userLookup = new Map<string, CanonicalUser>();

        usersData.forEach((u: any) => {
            const fn = (u.first_name || '').trim();
            const ln = (u.last_name || '').trim();
            const un = (u.username || '').trim();
            const em = (u.email || '').trim();
            const fullName = [fn, ln].filter(Boolean).join(' ').trim();
            const displayName = fullName || un || em || `User #${u.id}`;

            const userObj: CanonicalUser = {
                id: u.id,
                first_name: fn || displayName,
                last_name: ln,
                username: un,
                email: em,
                role: u.role || 'Operator',
                status: u.status || 'ACTIVE',
                displayName
            };
            canonicalUsers.push(userObj);

            if (u.id !== undefined && u.id !== null) {
                userLookup.set(String(u.id), userObj);
            }
            if (un) {
                userLookup.set(un.toLowerCase(), userObj);
            }
            if (em) {
                userLookup.set(em.toLowerCase(), userObj);
            }
            if (fullName) {
                userLookup.set(fullName.toLowerCase(), userObj);
            }
            if (fn) {
                if (!userLookup.has(fn.toLowerCase())) userLookup.set(fn.toLowerCase(), userObj);
            }
        });

        const resolveOperatorUser = (rawVal: any): CanonicalUser => {
            if (rawVal === undefined || rawVal === null || rawVal === '') {
                return {
                    id: 'unassigned-operator',
                    first_name: 'Unassigned Staff',
                    last_name: '',
                    username: 'staff',
                    email: 'staff@skynet.lk',
                    role: 'Operator',
                    status: 'ACTIVE',
                    displayName: 'Unassigned Staff'
                };
            }
            const str = String(rawVal).trim();
            if (str === 'System' || str === 'System Operator' || str === '-' || str === 'Unknown') {
                return {
                    id: 'system-operator',
                    first_name: 'System Operator',
                    last_name: '',
                    username: 'system',
                    email: 'system@skynet.lk',
                    role: 'System',
                    status: 'ACTIVE',
                    displayName: 'System Operator'
                };
            }
            const lower = str.toLowerCase();
            if (userLookup.has(lower)) return userLookup.get(lower)!;
            if (userLookup.has(str)) return userLookup.get(str)!;

            for (const u of canonicalUsers) {
                if (u.first_name.toLowerCase() === lower || u.username.toLowerCase() === lower) {
                    return u;
                }
                if (u.displayName.toLowerCase().includes(lower) || lower.includes(u.displayName.toLowerCase())) {
                    return u;
                }
            }

            const synthUser: CanonicalUser = {
                id: `op-${str}`,
                first_name: str,
                last_name: '',
                username: str.toLowerCase().replace(/\s+/g, '_'),
                email: `${str.toLowerCase().replace(/[^a-z0-9]/g, '.')}@skynet.lk`,
                role: 'Operator',
                status: 'ACTIVE',
                displayName: str
            };
            userLookup.set(lower, synthUser);
            canonicalUsers.push(synthUser);
            return synthUser;
        };

        const parseValidIsoDate = (primary?: string | null, fallback?: string | null): string => {
            if (primary && typeof primary === 'string' && primary.includes('-')) {
                const d = new Date(primary);
                if (!isNaN(d.getTime())) return primary;
            }
            if (fallback && typeof fallback === 'string') {
                const d = new Date(fallback);
                if (!isNaN(d.getTime())) return fallback;
            }
            return '';
        };

        const getColomboDate = (dateStr?: string | null, fallbackDate?: string | null): string => {
            const validIso = parseValidIsoDate(dateStr, fallbackDate);
            if (!validIso) return '';
            try {
                const d = new Date(validIso);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
            } catch {
                return '';
            }
        };

        interface OperatorDailyStats {
            userId: string | number;
            operator: string;
            username: string;
            firstName: string;
            lastName: string;
            email: string;
            role: string;
            isActive: boolean;
            firstScanCount: number;      // 1st Scan (Inbound parcels unsealed)
            secondScanCount: number;     // 2nd Scan (Outbound LMD bag parcel items)
            inboundBagsUnsealed: number; // Inbound bags unsealed
            outboundBagsOpened: number;  // Outbound bags opened
            outboundBagsClosed: number;  // Outbound bags sealed/closed
            manifestsClosed: number;     // Manifest sessions closed
            totalScans: number;          // firstScanCount + secondScanCount
            totalActions: number;        // total operational activity score
            lastActiveAt?: string;
            scanned: number;             // backward compatibility
            bagsSealed: number;          // backward compatibility
        }

        const dateMap: Record<string, Record<string, OperatorDailyStats>> = { 'ALL': {} };

        const getOrCreateStats = (dateKey: string, user: CanonicalUser): OperatorDailyStats => {
            if (!dateMap[dateKey]) dateMap[dateKey] = {};
            const opKey = String(user.id || user.displayName).toLowerCase();
            if (!dateMap[dateKey][opKey]) {
                dateMap[dateKey][opKey] = {
                    userId: user.id,
                    operator: user.displayName,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    role: user.role,
                    isActive: user.status === 'ACTIVE' || user.status === undefined,
                    firstScanCount: 0,
                    secondScanCount: 0,
                    inboundBagsUnsealed: 0,
                    outboundBagsOpened: 0,
                    outboundBagsClosed: 0,
                    manifestsClosed: 0,
                    totalScans: 0,
                    totalActions: 0,
                    scanned: 0,
                    bagsSealed: 0
                };
            }
            return dateMap[dateKey][opKey];
        };

        const recordOpActivity = (
            dateStr: string | null | undefined,
            rawOperator: any,
            counts: {
                firstScan?: number;
                secondScan?: number;
                inboundUnseal?: number;
                outboundOpen?: number;
                outboundClose?: number;
                manifestClose?: number;
            },
            timestamp?: string,
            fallbackDate?: string
        ) => {
            const user = resolveOperatorUser(rawOperator);
            if (!user) return;
            const colomboDate = getColomboDate(dateStr || timestamp, fallbackDate);

            const apply = (dKey: string) => {
                const stats = getOrCreateStats(dKey, user);
                if (counts.firstScan) stats.firstScanCount += counts.firstScan;
                if (counts.secondScan) stats.secondScanCount += counts.secondScan;
                if (counts.inboundUnseal) stats.inboundBagsUnsealed += counts.inboundUnseal;
                if (counts.outboundOpen) stats.outboundBagsOpened += counts.outboundOpen;
                if (counts.outboundClose) stats.outboundBagsClosed += counts.outboundClose;
                if (counts.manifestClose) stats.manifestsClosed += counts.manifestClose;

                stats.totalScans = stats.firstScanCount + stats.secondScanCount;
                stats.scanned = stats.totalScans;
                stats.bagsSealed = stats.outboundBagsClosed;
                stats.totalActions = stats.firstScanCount + stats.secondScanCount + stats.inboundBagsUnsealed + stats.outboundBagsOpened + stats.outboundBagsClosed + stats.manifestsClosed;

                const validTime = parseValidIsoDate(timestamp, fallbackDate);
                if (validTime) {
                    if (!stats.lastActiveAt || new Date(validTime) > new Date(stats.lastActiveAt)) {
                        stats.lastActiveAt = validTime;
                    }
                }
            };

            if (colomboDate) {
                apply(colomboDate);
            }
            apply('ALL');
        };

        // 1. Process Inbound Unsealing & 1st Scans (bag_unsealing)
        unsealData.forEach((u: any) => {
            const uDate = u.created_at;
            const uOp = u.unsealed_by || 'Staff';
            const sCount = Number(u.scanned_count) || 0;

            // Inbound master bag unsealed count (1 bag unsealed by uOp)
            recordOpActivity(uDate, uOp, { inboundUnseal: 1 }, uDate, uDate);

            let parsedParcels = u.scanned_parcels;
            if (typeof parsedParcels === 'string') {
                try { parsedParcels = JSON.parse(parsedParcels); } catch { parsedParcels = []; }
            }

            if (Array.isArray(parsedParcels) && parsedParcels.length > 0) {
                // Credit every individual unsealed parcel to its operator
                parsedParcels.forEach((p: any) => {
                    const pOp = (p && typeof p === 'object')
                        ? (p.unsealedBy || p.unsealed_by || p.operator || p.scannedBy || p.scanned_by || uOp)
                        : uOp;
                    const pTime = (p && typeof p === 'object')
                        ? parseValidIsoDate(p.scannedAt || p.scanned_at || p.unsealed_at || p.created_at, uDate)
                        : uDate;
                    recordOpActivity(pTime, pOp, { firstScan: 1 }, pTime, uDate);
                });
            } else if (sCount > 0) {
                // Fallback to scanned_count if scanned_parcels array was not serialized
                recordOpActivity(uDate, uOp, { firstScan: sCount }, uDate, uDate);
            }
        });

        // 2. Process Outbound Parcel 2nd Scans (outbound_lmd_bag_items + outbound_lmd_bags.parcels)
        const countedBagItems = new Set<string>();

        // (a) Outbound bag items table (primary 2nd scan table)
        bagItemsData.forEach((it: any) => {
            const itOp = it.scanned_by || 'Staff';
            const itTime = it.created_at;
            const ref = String(it.shipment_ref || '').trim();
            const bagNum = String(it.bag_number || '').trim();
            if (ref && bagNum) {
                countedBagItems.add(`${bagNum}_${ref}`.toLowerCase());
            }
            recordOpActivity(itTime, itOp, { secondScan: 1 }, itTime);
        });

        // (b) Outbound LMD Bags: Open, Closed/Sealed, and any bag parcels not already in bag_items
        bagData.forEach((b: any) => {
            const bagNum = String(b.bag_number || '').trim();

            // Outbound Bag Opened / Created
            const openTime = b.opened_at || b.created_at;
            const openOp = b.opened_by || b.created_by;
            if (openOp && openOp !== 'Unknown') {
                recordOpActivity(openTime, openOp, { outboundOpen: 1 }, openTime);
            }

            // Outbound Bag Sealed / Closed
            const isClosed = b.status === 'SEALED' || b.status === 'CLOSED' || !!b.sealed_at || !!b.closed_at;
            if (isClosed) {
                const closeTime = b.closed_at || b.sealed_at || b.created_at;
                const closeOp = b.closed_by || b.sealed_by || b.created_by || b.opened_by;
                if (closeOp && closeOp !== 'Unknown') {
                    recordOpActivity(closeTime, closeOp, { outboundClose: 1 }, closeTime);
                }
            }

            // Fallback parcel scans from parcels JSONB (if not already counted in bagItemsData)
            let bagParcels = b.parcels;
            if (typeof bagParcels === 'string') {
                try { bagParcels = JSON.parse(bagParcels); } catch { bagParcels = []; }
            }
            if (Array.isArray(bagParcels)) {
                bagParcels.forEach((p: any) => {
                    let trk = '';
                    let pOp = '';
                    let pTime = '';
                    if (typeof p === 'string') {
                        trk = p.trim();
                    } else if (p && typeof p === 'object') {
                        trk = String(p.trackingNumber || p.referenceNumber || p.scannedBarcode || p.reference_number || '').trim();
                        pOp = p.scannedBy || p.operator || p.scanned_by;
                        pTime = p.scannedAt || p.timestamp || p.scanned_at || '';
                    }
                    if (trk && bagNum) {
                        const key = `${bagNum}_${trk}`.toLowerCase();
                        if (!countedBagItems.has(key)) {
                            countedBagItems.add(key);
                            const finalOp = pOp || b.sealed_by || b.created_by || b.opened_by || 'Staff';
                            const finalTime = pTime || b.sealed_at || b.created_at || b.opened_at;
                            recordOpActivity(finalTime, finalOp, { secondScan: 1 }, finalTime);
                        }
                    }
                });
            }
        });

        // 4. Process Closed Manifests
        manData.forEach((m: any) => {
            if (m.status === 'CLOSED' && m.closed_by) {
                const closeTime = m.closed_at || m.created_at;
                recordOpActivity(closeTime, m.closed_by, { manifestClose: 1 }, closeTime);
            }
        });

        omBags.forEach((om: any) => {
            if (om.status === 'CLOSED' && om.closed_by) {
                const closeTime = om.closed_at || om.created_at;
                recordOpActivity(closeTime, om.closed_by, { manifestClose: 1 }, closeTime);
            }
        });

        // 5. Build final per-date structures and day KPIs
        const userProductivityByDate: Record<string, OperatorDailyStats[]> = {};
        const userProductivityKPIs: Record<string, {
            totalFirstScans: number;
            totalSecondScans: number;
            totalInboundBagsUnsealed: number;
            totalOutboundBagsOpened: number;
            totalOutboundBagsClosed: number;
            totalManifestsClosed: number;
            activeOperatorsCount: number;
            totalOperators: number;
        }> = {};

        const allDates = Object.keys(dateMap).filter(d => d !== 'ALL').sort((a, b) => b.localeCompare(a));
        const todayColombo = getColomboDate(new Date().toISOString());
        if (!allDates.includes(todayColombo)) {
            allDates.unshift(todayColombo);
            dateMap[todayColombo] = {};
        }

        const datesToProcess = ['ALL', ...allDates];

        datesToProcess.forEach(dKey => {
            const currentOpMap = dateMap[dKey] || {};

            canonicalUsers.forEach(u => {
                const opKey = String(u.id || u.displayName).toLowerCase();
                if (!currentOpMap[opKey]) {
                    currentOpMap[opKey] = {
                        userId: u.id,
                        operator: u.displayName,
                        username: u.username,
                        firstName: u.first_name,
                        lastName: u.last_name,
                        email: u.email,
                        role: u.role,
                        isActive: u.status === 'ACTIVE' || u.status === undefined,
                        firstScanCount: 0,
                        secondScanCount: 0,
                        inboundBagsUnsealed: 0,
                        outboundBagsOpened: 0,
                        outboundBagsClosed: 0,
                        manifestsClosed: 0,
                        totalScans: 0,
                        totalActions: 0,
                        scanned: 0,
                        bagsSealed: 0
                    };
                }
            });

            const list = Object.values(currentOpMap).sort((a, b) => {
                if (b.totalScans !== a.totalScans) return b.totalScans - a.totalScans;
                if (b.totalActions !== a.totalActions) return b.totalActions - a.totalActions;
                return a.operator.localeCompare(b.operator);
            });

            userProductivityByDate[dKey] = list;

            let totalFirstScans = 0;
            let totalSecondScans = 0;
            let totalInboundBagsUnsealed = 0;
            let totalOutboundBagsOpened = 0;
            let totalOutboundBagsClosed = 0;
            let totalManifestsClosed = 0;
            let activeOperatorsCount = 0;

            list.forEach(op => {
                totalFirstScans += op.firstScanCount;
                totalSecondScans += op.secondScanCount;
                totalInboundBagsUnsealed += op.inboundBagsUnsealed;
                totalOutboundBagsOpened += op.outboundBagsOpened;
                totalOutboundBagsClosed += op.outboundBagsClosed;
                totalManifestsClosed += op.manifestsClosed;
                if (op.totalActions > 0) activeOperatorsCount++;
            });

            userProductivityKPIs[dKey] = {
                totalFirstScans,
                totalSecondScans,
                totalInboundBagsUnsealed,
                totalOutboundBagsOpened,
                totalOutboundBagsClosed,
                totalManifestsClosed,
                activeOperatorsCount,
                totalOperators: list.length
            };
        });

        const userProductivity = userProductivityByDate['ALL'] || [];
        const availableProductivityDates = allDates;

        const mawbTableList = mawbData
            .filter((m: any) => {
                if (!isValidMawbRef(m.mawb_reference)) return false;
                const isAllocated = m.has_service_providers_allocated === true || m.has_service_providers_allocated === 'true';
                if (!isAllocated) return false;
                if (m.mawb_type && String(m.mawb_type).trim().toLowerCase() === 'outbound') return false;
                return true;
            })
            .map((m: any) => ({
                mawbReference: m.mawb_reference.trim(),
                carrier: m.carrier || 'N/A',
                declaredBags: m.declared_bags || 0,
                declaredWeight: m.declared_wt || 0,
                createdAt: m.mawb_created || '',
                shipperName: m.shipper_name || '',
                notes: m.notes || '',
                hasServiceProvidersAllocated: true,
                mawbType: m.mawb_type || 'INBOUND'
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
                userProductivityByDate,
                userProductivityKPIs,
                availableProductivityDates,
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
