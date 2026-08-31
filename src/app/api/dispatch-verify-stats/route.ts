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

    while (hasMore && attempts < 10) {
        attempts++;
        try {
            const res = await fetch(`${sb.url}/rest/v1/${table}?select=${selectFields}&order=id.asc&limit=${limit}&offset=${offset}`, {
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
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
        }

        const [spaResult, unsealResult, outboundResult, providerResult, outboundManifestResult, bagItemsResult, shipResult, usersResult] = await Promise.allSettled([
            fetchAllSupabaseRows('service_provider_allocation', 'id,shipment_ref,mawb_ref,service_provider,unsealed,scan_status,created_at,updated_at,mapped_zone', sb),
            fetchAllSupabaseRows('bag_unsealing', 'id,bag_number,mawb_ref,created_at,scanned_count,scanned_parcels,unsealed_by', sb),
            fetchAllSupabaseRows('outbound_lmd_bags', 'id,bag_number,target_partner,destination_hub,status,parcel_count,total_weight,created_by,sealed_by,created_at,sealed_at,new_manifest_reference,parcels', sb),
            fetchAllSupabaseRows('service_providers', 'id,name,code', sb),
            fetchAllSupabaseRows('outbound_manifests', 'id,manifest_reference,service_provider,total_parcels,bag_numbers', sb),
            fetchAllSupabaseRows('outbound_lmd_bag_items', 'id,bag_number,shipment_ref,weight,created_at,scanned_by', sb),
            fetchAllSupabaseRows('shipments', 'reference_number,sender_reference,sender_reference_2,alternate_reference,bag_number', sb),
            fetchAllSupabaseRows('users', 'id,username,first_name,last_name,email', sb)
        ]);

        const spaData = spaResult.status === 'fulfilled' ? spaResult.value : [];
        const unsealData = unsealResult.status === 'fulfilled' ? unsealResult.value : [];
        const outboundData = outboundResult.status === 'fulfilled' ? outboundResult.value : [];
        const providerData = providerResult.status === 'fulfilled' ? providerResult.value : [];
        const outboundManifestData = outboundManifestResult.status === 'fulfilled' ? outboundManifestResult.value : [];
        const bagItemsData = bagItemsResult.status === 'fulfilled' ? bagItemsResult.value : [];
        const shipData = shipResult.status === 'fulfilled' ? shipResult.value : [];
        const usersData = usersResult.status === 'fulfilled' ? usersResult.value : [];

        // Build Users Map for resolving scanned_by / unsealed_by operator names
        const usersMap = new Map<string, string>();
        usersData.forEach((u: any) => {
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
            const displayName = fullName || u.username || u.email || `User #${u.id}`;
            if (u.id !== undefined && u.id !== null) {
                usersMap.set(String(u.id), displayName);
            }
            if (u.username) {
                usersMap.set(String(u.username).toLowerCase(), displayName);
            }
        });

        const resolveUserName = (val: any): string => {
            if (val === undefined || val === null || val === '') return '';
            const strVal = String(val).trim();
            if (usersMap.has(strVal)) return usersMap.get(strVal)!;
            if (usersMap.has(strVal.toLowerCase())) return usersMap.get(strVal.toLowerCase())!;
            return strVal;
        };

        // Bidirectional maps for Temu <-> Skynet barcode resolution
        const temuToSkynetMap = new Map<string, string>();
        const skynetToTemuMap = new Map<string, string>();

        shipData.forEach((s: any) => {
            const skynetRef = (s.reference_number || '').trim();
            if (!skynetRef) return;
            const skynetLower = skynetRef.toLowerCase();

            const temuRefs = [
                s.sender_reference,
                s.sender_reference_2,
                s.alternate_reference
            ].map(r => (r || '').trim()).filter(Boolean);

            temuRefs.forEach(tRef => {
                const tLower = tRef.toLowerCase();
                if (tLower !== skynetLower) {
                    temuToSkynetMap.set(tLower, skynetRef);
                    if (!skynetToTemuMap.has(skynetLower)) {
                        skynetToTemuMap.set(skynetLower, tRef);
                    }
                }
            });
        });

        const getCanonicalTracking = (refStr: string): string => {
            if (!refStr) return '';
            const clean = refStr.trim();
            const lower = clean.toLowerCase();
            return temuToSkynetMap.get(lower) || clean;
        };

        const getTemuBarcode = (canonicalRefStr: string, rawRefStr?: string): string => {
            if (!canonicalRefStr) return '';
            const lower = canonicalRefStr.toLowerCase();
            if (skynetToTemuMap.has(lower)) {
                return skynetToTemuMap.get(lower)!;
            }
            if (rawRefStr && rawRefStr.trim().toLowerCase() !== lower) {
                return rawRefStr.trim();
            }
            return '';
        };

        // Build robust provider ID / Code / Name -> normalized partner name map
        const providerIdMap: Record<string | number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'SITREK' };
        providerData.forEach((sp: any) => {
            const rawName = (sp.name || sp.code || '').trim();
            let norm = 'Other';
            if (rawName.toLowerCase().includes('pickme')) norm = 'PickMe';
            else if (rawName.toLowerCase().includes('domex')) norm = 'Domex';
            else if (rawName.toLowerCase().includes('sitrek')) norm = 'SITREK';
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
            if (lowerVal.includes('sitrek') || lowerVal === '3') return 'SITREK';
            if (lowerVal.includes('pronto')) return 'Pronto';

            return 'Other';
        };

        // Build Outbound Manifest ID -> Reference string map
        const omIdMap: Record<number, string> = {};
        outboundManifestData.forEach((om: any) => {
            if (om.id && om.manifest_reference) {
                omIdMap[om.id] = om.manifest_reference;
            }
        });

        // Build Bag Number -> Outbound Manifest Reference map
        const bagToOmMap = new Map<string, string>();
        outboundData.forEach((b: any) => {
            if (b.bag_number) {
                const bNum = String(b.bag_number).trim();
                const omRef = (b.new_manifest_reference && omIdMap[b.new_manifest_reference]) ? omIdMap[b.new_manifest_reference] : '';
                if (omRef) bagToOmMap.set(bNum, omRef);
            }
        });
        outboundManifestData.forEach((om: any) => {
            if (om.manifest_reference && Array.isArray(om.bag_numbers)) {
                om.bag_numbers.forEach((bNum: any) => {
                    if (bNum) bagToOmMap.set(String(bNum).trim(), om.manifest_reference);
                });
            }
        });

        // Build Parcel Shipment Ref -> Outbound Bag Number & Outbound Manifest Reference maps
        const shipmentToBagMap = new Map<string, string>();
        const shipmentToOmMap = new Map<string, string>();
        const mawbPartnerToManifestMap = new Map<string, string>();

        // 1. Populate from outbound_lmd_bag_items table
        bagItemsData.forEach((item: any) => {
            if (item.shipment_ref && item.bag_number) {
                const trk = String(item.shipment_ref).trim();
                const bNum = String(item.bag_number).trim();
                shipmentToBagMap.set(trk, bNum);
                const omRef = bagToOmMap.get(bNum);
                if (omRef) shipmentToOmMap.set(trk, omRef);
            }
        });

        // 2. Populate from outbound_lmd_bags parcels jsonb
        outboundData.forEach((b: any) => {
            const bNum = (b.bag_number || '').trim();
            const inboundMawb = (b.mawb_ref || '').trim();
            const partnerName = resolvePartnerName(b.target_partner);
            const omRef = (b.new_manifest_reference && omIdMap[b.new_manifest_reference]) ? omIdMap[b.new_manifest_reference] : (bagToOmMap.get(bNum) || '');

            if (omRef && inboundMawb && partnerName) {
                mawbPartnerToManifestMap.set(`${inboundMawb}_${partnerName}`, omRef);
            }

            if (Array.isArray(b.parcels)) {
                b.parcels.forEach((p: any) => {
                    const trk = typeof p === 'string' ? p.trim() : (p?.trackingNumber || p?.referenceNumber || '').trim();
                    if (trk) {
                        if (!shipmentToBagMap.has(trk) && bNum) shipmentToBagMap.set(trk, bNum);
                        if (!shipmentToOmMap.has(trk) && omRef) shipmentToOmMap.set(trk, omRef);
                    }
                });
            }
        });

        // Maps for scan timestamps & operators
        const firstScanMap = new Map<string, { time: string; operator: string }>();
        const secondScanMap = new Map<string, { time: string; operator: string; bagNumber?: string }>();

        // 1. Populate firstScanMap from bag_unsealing
        unsealData.forEach((u: any) => {
            const uOp = resolveUserName(u.unsealed_by) || 'Staff';
            const uTime = u.created_at;
            let parsedParcels = u.scanned_parcels;
            if (typeof parsedParcels === 'string') {
                try {
                    parsedParcels = JSON.parse(parsedParcels);
                } catch {
                    parsedParcels = [];
                }
            }

            if (Array.isArray(parsedParcels)) {
                parsedParcels.forEach((p: any) => {
                    let rawTrk = '';
                    let objSkynet = '';
                    let objTemu = '';
                    let pOp = '';
                    let pTime = '';

                    if (typeof p === 'string') {
                        rawTrk = p.trim();
                    } else if (p && typeof p === 'object') {
                        objSkynet = (p.skynetTrackingNumber || p.skynet_tracking_number || '').trim();
                        objTemu = (p.senderReference || p.sender_reference || p.temuBarcode || p.temu_barcode || '').trim();
                        rawTrk = (p.trackingNumber || p.tracking_number || p.referenceNumber || p.reference_number || objSkynet || objTemu).trim();
                        pOp = resolveUserName(p.unsealedBy || p.unsealed_by || p.operator || p.scannedBy || p.scanned_by);
                        pTime = p.timestamp || p.scannedAt || p.scanned_at || p.unsealed_at || p.created_at || '';
                    }

                    if (!rawTrk) return;
                    const canonical = objSkynet ? objSkynet : getCanonicalTracking(rawTrk);
                    const temu = objTemu || getTemuBarcode(canonical, rawTrk);
                    const finalOp = pOp || uOp;
                    const finalTime = pTime || uTime;

                    const entry = { time: finalTime, operator: finalOp };
                    firstScanMap.set(canonical.toLowerCase(), entry);
                    if (temu) firstScanMap.set(temu.toLowerCase(), entry);
                    if (rawTrk) firstScanMap.set(rawTrk.toLowerCase(), entry);
                });
            }
        });

        // Also populate firstScanMap from shipments linked to unsealed bags
        shipData.forEach((s: any) => {
            const bagNum = (s.bag_number || '').trim();
            if (!bagNum) return;
            const matchingUnseal = unsealData.find(u => (u.bag_number || '').trim().toLowerCase() === bagNum.toLowerCase());
            if (matchingUnseal) {
                const canonical = getCanonicalTracking((s.reference_number || '').trim());
                const temu = getTemuBarcode(canonical, s.sender_reference);
                const entry = { time: matchingUnseal.created_at, operator: resolveUserName(matchingUnseal.unsealed_by) || 'Staff' };
                if (canonical && !firstScanMap.has(canonical.toLowerCase())) firstScanMap.set(canonical.toLowerCase(), entry);
                if (temu && !firstScanMap.has(temu.toLowerCase())) firstScanMap.set(temu.toLowerCase(), entry);
            }
        });

        // 2. Populate secondScanMap from outbound_lmd_bag_items
        bagItemsData.forEach((it: any) => {
            const rawTrk = (it.shipment_ref || '').trim();
            if (!rawTrk) return;
            const canonical = getCanonicalTracking(rawTrk);
            const temu = getTemuBarcode(canonical, rawTrk);
            const itOp = resolveUserName(it.scanned_by) || 'Staff';
            const itTime = it.created_at;
            const entry = { time: itTime, operator: itOp, bagNumber: it.bag_number };
            secondScanMap.set(canonical.toLowerCase(), entry);
            if (temu) secondScanMap.set(temu.toLowerCase(), entry);
            if (rawTrk) secondScanMap.set(rawTrk.toLowerCase(), entry);
        });

        // Populate secondScanMap from outbound_lmd_bags.parcels
        outboundData.forEach((b: any) => {
            const bagOp = resolveUserName(b.sealed_by || b.created_by) || 'Staff';
            const bagTime = b.sealed_at || b.created_at;
            if (Array.isArray(b.parcels)) {
                b.parcels.forEach((p: any) => {
                    let rawTrk = '';
                    let pOp = '';
                    let pTime = '';
                    if (typeof p === 'string') {
                        rawTrk = p.trim();
                    } else if (p && typeof p === 'object') {
                        rawTrk = (p.trackingNumber || p.referenceNumber || p.scannedBarcode || p.reference_number || '').trim();
                        pOp = resolveUserName(p.scannedBy || p.operator || p.scanned_by);
                        pTime = p.scannedAt || p.timestamp || p.scanned_at || '';
                    }
                    if (!rawTrk) return;
                    const canonical = getCanonicalTracking(rawTrk);
                    const temu = getTemuBarcode(canonical, rawTrk);
                    const finalOp = pOp || bagOp;
                    const finalTime = pTime || bagTime;
                    const entry = { time: finalTime, operator: finalOp, bagNumber: b.bag_number };

                    if (!secondScanMap.has(canonical.toLowerCase())) secondScanMap.set(canonical.toLowerCase(), entry);
                    if (temu && !secondScanMap.has(temu.toLowerCase())) secondScanMap.set(temu.toLowerCase(), entry);
                    if (rawTrk && !secondScanMap.has(rawTrk.toLowerCase())) secondScanMap.set(rawTrk.toLowerCase(), entry);
                });
            }
        });

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
        let sitrekScanned = 0;
        let prontoScanned = 0;
        let otherScanned = 0;

        const processedRefsOnDate = new Set<string>();

        const markParcelProcessed = (canonical: string, temu: string, raw: string) => {
            if (canonical) processedRefsOnDate.add(canonical.toLowerCase());
            if (temu) processedRefsOnDate.add(temu.toLowerCase());
            if (raw) processedRefsOnDate.add(raw.toLowerCase());
        };

        const isParcelProcessed = (canonical: string, temu: string, raw: string): boolean => {
            return (
                (!!canonical && processedRefsOnDate.has(canonical.toLowerCase())) ||
                (!!temu && processedRefsOnDate.has(temu.toLowerCase())) ||
                (!!raw && processedRefsOnDate.has(raw.toLowerCase()))
            );
        };

        // Manifest Breakdown Table Grouping Map & Individual Scanned Parcels List
        const manifestGroupMap = new Map<string, {
            inboundMawb: string;
            outboundManifests: Set<string>;
            dailyScanned: number;
            unsealedCount: number;
            verifiedCount: number;
            pickMeScanned: number;
            domexScanned: number;
            sitrekScanned: number;
            prontoScanned: number;
        }>();

        const scannedParcels: Array<{
            id: string | number;
            trackingNumber: string;
            senderReference?: string;
            temuBarcode?: string;
            inboundMawb: string;
            outboundBag: string;
            outboundManifest: string;
            unsealed: boolean;
            verified: boolean;
            firstScanTime?: string | null;
            firstScannedBy?: string | null;
            secondScanTime?: string | null;
            secondScannedBy?: string | null;
            scannedBy?: string | null;
            scanStatus: string;
            serviceProvider: string;
            scannedAt: string;
        }> = [];

        const getOrCreateManifestGroup = (rawMawb?: string | null) => {
            const inboundMawb = (rawMawb && typeof rawMawb === 'string' && rawMawb.trim()) ? rawMawb.trim() : 'UNASSIGNED';
            if (!manifestGroupMap.has(inboundMawb)) {
                manifestGroupMap.set(inboundMawb, {
                    inboundMawb,
                    outboundManifests: new Set<string>(),
                    dailyScanned: 0,
                    unsealedCount: 0,
                    verifiedCount: 0,
                    pickMeScanned: 0,
                    domexScanned: 0,
                    sitrekScanned: 0,
                    prontoScanned: 0
                });
            }
            return manifestGroupMap.get(inboundMawb)!;
        };

        // Map outbound_lmd_bags to associate outbound manifest references to inbound MAWBs
        outboundData.forEach((b: any) => {
            const inboundMawb = b.mawb_ref || 'UNASSIGNED';
            const group = getOrCreateManifestGroup(inboundMawb);
            let omRef = '';
            if (b.new_manifest_reference && omIdMap[b.new_manifest_reference]) {
                omRef = omIdMap[b.new_manifest_reference];
            } else if (b.bag_number) {
                omRef = b.bag_number;
            }
            if (omRef) {
                group.outboundManifests.add(omRef);
            }
        });

        // Process service_provider_allocation rows
        spaData.forEach((alloc: any) => {
            const rawRef = alloc.shipment_ref || String(alloc.id);
            const canonicalRef = getCanonicalTracking(rawRef);
            const temuCode = getTemuBarcode(canonicalRef, rawRef);
            const partnerName = resolvePartnerName(alloc.service_provider);
            const inboundMawb = (alloc.mawb_ref && typeof alloc.mawb_ref === 'string' && alloc.mawb_ref.trim()) ? alloc.mawb_ref.trim() : 'UNASSIGNED';

            const statusStr = (alloc.scan_status || '').toUpperCase();
            const is1stScan = alloc.unsealed === true || statusStr === '1ST_SCAN_DONE' || statusStr === '2ND_SCAN_DONE' || statusStr === 'VERIFIED' || statusStr === 'DISPATCHED';
            const is2ndScan = statusStr === '2ND_SCAN_DONE' || statusStr === 'VERIFIED' || statusStr === 'DISPATCHED';

            const fsInfo = firstScanMap.get(canonicalRef.toLowerCase()) || firstScanMap.get(rawRef.toLowerCase()) || (temuCode ? firstScanMap.get(temuCode.toLowerCase()) : null);
            const ssInfo = secondScanMap.get(canonicalRef.toLowerCase()) || secondScanMap.get(rawRef.toLowerCase()) || (temuCode ? secondScanMap.get(temuCode.toLowerCase()) : null);

            const firstScanTime = is1stScan ? (fsInfo?.time || alloc.created_at || null) : null;
            const firstScannedBy = is1stScan ? (fsInfo?.operator || 'Staff') : null;

            const secondScanTime = is2ndScan ? (ssInfo?.time || alloc.updated_at || null) : null;
            const secondScannedBy = is2ndScan ? (ssInfo?.operator || 'Staff') : null;

            const isCreatedOnDate = isTargetDate(alloc.created_at);
            const isUpdatedOnDate = isTargetDate(alloc.updated_at);
            const is1stScanOnDate = isTargetDate(firstScanTime);
            const is2ndScanOnDate = isTargetDate(secondScanTime);
            const hasActivityOnDate = isCreatedOnDate || isUpdatedOnDate || is1stScanOnDate || is2ndScanOnDate;

            if (hasActivityOnDate && (is1stScan || is2ndScan)) {
                if (!isParcelProcessed(canonicalRef, temuCode, rawRef)) {
                    markParcelProcessed(canonicalRef, temuCode, rawRef);

                    totalScannedAll++;
                    if (is1stScan) unsealed1stScanDone++;
                    if (is2ndScan) verified2ndScanDone++;

                    if (partnerName === 'PickMe') pickMeScanned++;
                    else if (partnerName === 'Domex') domexScanned++;
                    else if (partnerName === 'SITREK') sitrekScanned++;
                    else if (partnerName === 'Pronto') prontoScanned++;
                    else otherScanned++;

                    // Update Manifest Breakdown Group
                    const group = getOrCreateManifestGroup(inboundMawb);
                    group.dailyScanned++;
                    if (is1stScan) group.unsealedCount++;
                    if (is2ndScan) group.verifiedCount++;

                    if (partnerName === 'PickMe') group.pickMeScanned++;
                    else if (partnerName === 'Domex') group.domexScanned++;
                    else if (partnerName === 'SITREK') group.sitrekScanned++;
                    else if (partnerName === 'Pronto') group.prontoScanned++;

                    // Resolve Outbound Bag & Outbound Manifest
                    const outboundBag = ssInfo?.bagNumber || shipmentToBagMap.get(canonicalRef) || shipmentToBagMap.get(rawRef) || 'Pending Bag';
                    let outboundManifest = shipmentToOmMap.get(canonicalRef) || shipmentToOmMap.get(rawRef) || '';
                    if (!outboundManifest && mawbPartnerToManifestMap.has(`${inboundMawb}_${partnerName}`)) {
                        outboundManifest = mawbPartnerToManifestMap.get(`${inboundMawb}_${partnerName}`)!;
                    }
                    if (!outboundManifest) outboundManifest = 'Pending Manifest';

                    scannedParcels.push({
                        id: alloc.id,
                        trackingNumber: canonicalRef,
                        senderReference: temuCode || undefined,
                        temuBarcode: temuCode || undefined,
                        inboundMawb,
                        outboundBag,
                        outboundManifest,
                        unsealed: is1stScan,
                        verified: is2ndScan,
                        firstScanTime,
                        firstScannedBy,
                        secondScanTime,
                        secondScannedBy,
                        scannedBy: secondScannedBy || firstScannedBy || 'Staff',
                        scanStatus: alloc.scan_status || (is2ndScan ? '2ND_SCAN_DONE' : '1ST_SCAN_DONE'),
                        serviceProvider: partnerName,
                        scannedAt: secondScanTime || firstScanTime || alloc.updated_at || alloc.created_at
                    });
                } else {
                    // Update existing record if new info is available
                    const existing = scannedParcels.find(p => p.trackingNumber.toLowerCase() === canonicalRef.toLowerCase() || (p.senderReference && p.senderReference.toLowerCase() === rawRef.toLowerCase()));
                    if (existing) {
                        if (is1stScan) {
                            existing.unsealed = true;
                            if (!existing.firstScanTime && firstScanTime) existing.firstScanTime = firstScanTime;
                            if ((!existing.firstScannedBy || existing.firstScannedBy === 'Staff') && firstScannedBy) existing.firstScannedBy = firstScannedBy;
                        }
                        if (is2ndScan) {
                            existing.verified = true;
                            if (!existing.secondScanTime && secondScanTime) existing.secondScanTime = secondScanTime;
                            if ((!existing.secondScannedBy || existing.secondScannedBy === 'Staff') && secondScannedBy) existing.secondScannedBy = secondScannedBy;
                            if (existing.scannedBy === 'Staff' && secondScannedBy) existing.scannedBy = secondScannedBy;
                        }
                        if (partnerName !== 'Other' && partnerName !== 'Unassigned' && (existing.serviceProvider === 'Other' || existing.serviceProvider === 'Unassigned')) {
                            existing.serviceProvider = partnerName;
                        }
                        if (existing.outboundBag === 'Pending Bag') {
                            const ob = ssInfo?.bagNumber || shipmentToBagMap.get(canonicalRef) || shipmentToBagMap.get(rawRef);
                            if (ob) existing.outboundBag = ob;
                        }
                        if (existing.outboundManifest === 'Pending Manifest') {
                            const om = shipmentToOmMap.get(canonicalRef) || shipmentToOmMap.get(rawRef);
                            if (om) existing.outboundManifest = om;
                        }
                    }
                }
            }
        });

        // Add scanned parcels from bag_unsealing on selected date if not already counted
        unsealData.forEach((u: any) => {
            if (isTargetDate(u.created_at)) {
                const group = getOrCreateManifestGroup(u.mawb_ref);
                const inboundMawb = (u.mawb_ref && typeof u.mawb_ref === 'string' && u.mawb_ref.trim()) ? u.mawb_ref.trim() : 'UNASSIGNED';
                const uOp = resolveUserName(u.unsealed_by) || 'Staff';

                let parsedParcels = u.scanned_parcels;
                if (typeof parsedParcels === 'string') {
                    try {
                        parsedParcels = JSON.parse(parsedParcels);
                    } catch {
                        parsedParcels = [];
                    }
                }

                if (Array.isArray(parsedParcels)) {
                    parsedParcels.forEach((p: any) => {
                        let rawTrk = '';
                        let objSkynet = '';
                        let objTemu = '';
                        let pOp = '';
                        let pTime = '';

                        if (typeof p === 'string') {
                            rawTrk = p.trim();
                        } else if (p && typeof p === 'object') {
                            objSkynet = (p.skynetTrackingNumber || p.skynet_tracking_number || '').trim();
                            objTemu = (p.senderReference || p.sender_reference || p.temuBarcode || p.temu_barcode || '').trim();
                            rawTrk = (p.trackingNumber || p.tracking_number || p.referenceNumber || p.reference_number || objSkynet || objTemu).trim();
                            pOp = resolveUserName(p.unsealedBy || p.unsealed_by || p.operator || p.scannedBy || p.scanned_by);
                            pTime = p.timestamp || p.scannedAt || p.scanned_at || p.unsealed_at || p.created_at || '';
                        }

                        if (!rawTrk) return;

                        const canonicalRef = objSkynet ? objSkynet : getCanonicalTracking(rawTrk);
                        const temuCode = objTemu || getTemuBarcode(canonicalRef, rawTrk);

                        const fsInfo = firstScanMap.get(canonicalRef.toLowerCase()) || firstScanMap.get(rawTrk.toLowerCase()) || (temuCode ? firstScanMap.get(temuCode.toLowerCase()) : null);
                        const ssInfo = secondScanMap.get(canonicalRef.toLowerCase()) || secondScanMap.get(rawTrk.toLowerCase()) || (temuCode ? secondScanMap.get(temuCode.toLowerCase()) : null);

                        const firstScanTime = pTime || fsInfo?.time || u.created_at;
                        const firstScannedBy = pOp || fsInfo?.operator || uOp;
                        const secondScanTime = ssInfo?.time || null;
                        const secondScannedBy = ssInfo?.operator || null;

                        if (!isParcelProcessed(canonicalRef, temuCode, rawTrk)) {
                            markParcelProcessed(canonicalRef, temuCode, rawTrk);
                            totalScannedAll++;
                            unsealed1stScanDone++;

                            group.dailyScanned++;
                            group.unsealedCount++;

                            const outboundBag = ssInfo?.bagNumber || shipmentToBagMap.get(canonicalRef) || shipmentToBagMap.get(rawTrk) || 'Pending Bag';
                            const outboundManifest = shipmentToOmMap.get(canonicalRef) || shipmentToOmMap.get(rawTrk) || 'Pending Manifest';

                            scannedParcels.push({
                                id: `unseal-${u.id}-${rawTrk}`,
                                trackingNumber: canonicalRef,
                                senderReference: temuCode || undefined,
                                temuBarcode: temuCode || undefined,
                                inboundMawb,
                                outboundBag,
                                outboundManifest,
                                unsealed: true,
                                verified: Boolean(secondScanTime),
                                firstScanTime,
                                firstScannedBy,
                                secondScanTime,
                                secondScannedBy,
                                scannedBy: secondScannedBy || firstScannedBy || 'Staff',
                                scanStatus: secondScanTime ? '2ND_SCAN_DONE' : '1ST_SCAN_DONE',
                                serviceProvider: 'Unassigned',
                                scannedAt: secondScanTime || firstScanTime || u.created_at
                            });
                        } else {
                            // Update existing record if it was not marked unsealed
                            const existing = scannedParcels.find(sp => sp.trackingNumber.toLowerCase() === canonicalRef.toLowerCase() || (sp.senderReference && sp.senderReference.toLowerCase() === rawTrk.toLowerCase()));
                            if (existing) {
                                existing.unsealed = true;
                                if (!existing.firstScanTime) existing.firstScanTime = firstScanTime;
                                if (!existing.firstScannedBy || existing.firstScannedBy === 'Staff') existing.firstScannedBy = firstScannedBy;
                                if (temuCode && !existing.senderReference) {
                                    existing.senderReference = temuCode;
                                    existing.temuBarcode = temuCode;
                                }
                            }
                        }
                    });
                }
            }
        });

        // Add scanned parcels from outbound_lmd_bag_items on selected date if not already counted
        bagItemsData.forEach((it: any) => {
            if (isTargetDate(it.created_at)) {
                const rawTrk = (it.shipment_ref || '').trim();
                if (!rawTrk) return;
                const canonicalRef = getCanonicalTracking(rawTrk);
                const temuCode = getTemuBarcode(canonicalRef, rawTrk);

                if (!isParcelProcessed(canonicalRef, temuCode, rawTrk)) {
                    markParcelProcessed(canonicalRef, temuCode, rawTrk);
                    totalScannedAll++;
                    verified2ndScanDone++;

                    const bNum = (it.bag_number || '').trim();
                    const outboundManifest = shipmentToOmMap.get(canonicalRef) || shipmentToOmMap.get(rawTrk) || (bNum ? bagToOmMap.get(bNum) : '') || 'Pending Manifest';
                    const fsInfo = firstScanMap.get(canonicalRef.toLowerCase()) || firstScanMap.get(rawTrk.toLowerCase()) || (temuCode ? firstScanMap.get(temuCode.toLowerCase()) : null);
                    const itOp = resolveUserName(it.scanned_by) || 'Staff';

                    scannedParcels.push({
                        id: `item-${it.id}-${rawTrk}`,
                        trackingNumber: canonicalRef,
                        senderReference: temuCode || undefined,
                        temuBarcode: temuCode || undefined,
                        inboundMawb: 'UNASSIGNED',
                        outboundBag: bNum || 'Pending Bag',
                        outboundManifest,
                        unsealed: Boolean(fsInfo?.time),
                        verified: true,
                        firstScanTime: fsInfo?.time || null,
                        firstScannedBy: fsInfo?.operator || null,
                        secondScanTime: it.created_at,
                        secondScannedBy: itOp,
                        scannedBy: itOp,
                        scanStatus: '2ND_SCAN_DONE',
                        serviceProvider: 'Other',
                        scannedAt: it.created_at
                    });
                }
            }
        });

        // Build array for manifestTable
        const manifestTable = Array.from(manifestGroupMap.values())
            .map(g => ({
                inboundMawb: g.inboundMawb,
                outboundManifest: Array.from(g.outboundManifests).filter(Boolean).join(', ') || 'Pending Outbound',
                dailyScanned: g.dailyScanned,
                unsealedCount: g.unsealedCount,
                verifiedCount: g.verifiedCount,
                pickMeScanned: g.pickMeScanned,
                domexScanned: g.domexScanned,
                sitrekScanned: g.sitrekScanned,
                prontoScanned: g.prontoScanned
            }))
            .filter(g => g.dailyScanned > 0 || g.unsealedCount > 0 || g.verifiedCount > 0 || g.outboundManifest !== 'Pending Outbound')
            .sort((a, b) => b.dailyScanned - a.dailyScanned);

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
                sitrekScanned,
                prontoScanned,
                otherScanned
            },
            manifestTable,
            scannedParcels,
            outboundBags
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (e: any) {
        console.error("Error in /api/dispatch-verify-stats:", e);
        return NextResponse.json({ success: false, error: e.message || 'Failed to fetch dispatch verification stats' }, { status: 500 });
    }
}
