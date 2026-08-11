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

export async function GET(request: Request) {
    try {
        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database configuration missing.' }, { status: 500 });
        }

        // 1. Fetch Service Providers for mapping ID -> Name
        let serviceProvidersMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'Pronto' };
        try {
            const spRes = await fetch(`${sb.url}/rest/v1/service_providers?select=id,name,code`, { headers: sb.headers, cache: 'no-store' });
            const spData = await spRes.json();
            if (Array.isArray(spData)) {
                spData.forEach((sp: any) => {
                    if (sp.id && sp.name) serviceProvidersMap[sp.id] = sp.name;
                });
            }
        } catch (e) {
            console.error('[manifest-tracking] Error fetching service_providers:', e);
        }

        // 2. Fetch Outbound Manifests
        let rawManifests: any[] = [];
        try {
            const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
            const omData = await omRes.json();
            if (Array.isArray(omData)) rawManifests = omData;
        } catch (e) {
            console.error('[manifest-tracking] Error fetching outbound_manifests:', e);
        }

        // 3. Fetch Outbound LMD Bags
        let rawBags: any[] = [];
        try {
            const bagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
            const bagsData = await bagsRes.json();
            if (Array.isArray(bagsData)) rawBags = bagsData;
        } catch (e) {
            console.error('[manifest-tracking] Error fetching outbound_lmd_bags:', e);
        }

        // 4. Fetch Outbound Bag Items (for parcel list fallback or detail enrichment)
        let bagItemsMap = new Map<string, any[]>();
        try {
            const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?select=*&order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
            const itemsData = await itemsRes.json();
            if (Array.isArray(itemsData)) {
                itemsData.forEach((item: any) => {
                    const bNum = item.bag_number;
                    if (!bNum) return;
                    const list = bagItemsMap.get(bNum) || [];
                    list.push(item);
                    bagItemsMap.set(bNum, list);
                });
            }
        } catch (e) {
            console.error('[manifest-tracking] Error fetching outbound_lmd_bag_items:', e);
        }

        // 5. Build Shipments lookup for consignee & city data
        let shipmentsMap = new Map<string, any>();
        try {
            const shipRes = await fetch(`${sb.url}/rest/v1/shipments?select=reference_number,recipient_name,consignee_name,city,destination_city,status&limit=2000`, { headers: sb.headers, cache: 'no-store' });
            const shipData = await shipRes.json();
            if (Array.isArray(shipData)) {
                shipData.forEach((s: any) => {
                    if (s.reference_number) {
                        shipmentsMap.set(String(s.reference_number).trim(), s);
                    }
                });
            }
        } catch (e) {
            console.error('[manifest-tracking] Error fetching shipments lookup:', e);
        }

        // Process Bags & format parcel contents
        const processedBags = rawBags.map((bag: any) => {
            let parcelsList: any[] = [];
            
            // Try parsing JSONB parcels column first
            if (Array.isArray(bag.parcels) && bag.parcels.length > 0) {
                parcelsList = bag.parcels.map((p: any) => {
                    const ref = p.trackingNumber || p.shipment_ref || p.reference_number || '';
                    const shipInfo = ref ? shipmentsMap.get(String(ref).trim()) : null;
                    return {
                        trackingNumber: ref,
                        weight: p.weight || 0,
                        scannedBy: p.scannedBy || p.scanned_by || 'Staff',
                        recipientName: p.recipientName || shipInfo?.recipient_name || shipInfo?.consignee_name || '—',
                        city: p.city || shipInfo?.city || shipInfo?.destination_city || '—',
                        timestamp: p.timestamp || p.created_at || bag.created_at
                    };
                });
            } else if (typeof bag.parcels === 'string' && bag.parcels.trim() !== '' && bag.parcels !== '[]') {
                try {
                    const parsed = JSON.parse(bag.parcels);
                    if (Array.isArray(parsed)) {
                        parcelsList = parsed.map((p: any) => {
                            const ref = p.trackingNumber || p.shipment_ref || p.reference_number || '';
                            const shipInfo = ref ? shipmentsMap.get(String(ref).trim()) : null;
                            return {
                                trackingNumber: ref,
                                weight: p.weight || 0,
                                scannedBy: p.scannedBy || p.scanned_by || 'Staff',
                                recipientName: p.recipientName || shipInfo?.recipient_name || shipInfo?.consignee_name || '—',
                                city: p.city || shipInfo?.city || shipInfo?.destination_city || '—',
                                timestamp: p.timestamp || p.created_at || bag.created_at
                            };
                        });
                    }
                } catch (e) {}
            }

            // Fallback to outbound_lmd_bag_items table if JSONB parcels was empty
            if (parcelsList.length === 0 && bagItemsMap.has(bag.bag_number)) {
                const dbItems = bagItemsMap.get(bag.bag_number) || [];
                parcelsList = dbItems.map((it: any) => {
                    const ref = it.shipment_ref || '';
                    const shipInfo = ref ? shipmentsMap.get(String(ref).trim()) : null;
                    return {
                        trackingNumber: ref,
                        weight: it.weight || 0,
                        scannedBy: it.scanned_by || 'Staff',
                        recipientName: shipInfo?.recipient_name || shipInfo?.consignee_name || '—',
                        city: shipInfo?.city || shipInfo?.destination_city || '—',
                        timestamp: it.created_at
                    };
                });
            }

            return {
                id: bag.id,
                bag_number: bag.bag_number,
                target_partner: bag.target_partner || 'ALL',
                destination_hub: bag.destination_hub || '—',
                status: (bag.status as 'OPEN' | 'SEALED') || 'OPEN',
                parcel_count: bag.parcel_count || parcelsList.length,
                total_weight: bag.total_weight || parcelsList.reduce((acc, p) => acc + (Number(p.weight) || 0), 0),
                created_by: bag.created_by || 'Staff',
                created_at: bag.created_at,
                sealed_at: bag.sealed_at,
                sealed_by: bag.sealed_by,
                new_manifest_reference: bag.new_manifest_reference ? Number(bag.new_manifest_reference) : null,
                is_bag_in_a_manifest: Boolean(bag.is_bag_in_a_manifest),
                parcels: parcelsList
            };
        });

        // Map bags into Manifests
        const bagMapById = new Map<number, any>();
        const bagMapByNum = new Map<string, any>();
        processedBags.forEach(b => {
            if (b.id) bagMapById.set(b.id, b);
            if (b.bag_number) bagMapByNum.set(b.bag_number, b);
        });

        const assignedBagNumbers = new Set<string>();

        const manifestsList = rawManifests.map((manifest: any) => {
            const manifestId = Number(manifest.id);
            const refStr = manifest.manifest_reference || '';
            const bagNumArray: string[] = Array.isArray(manifest.bag_numbers) ? manifest.bag_numbers : [];

            // Find matching bags by new_manifest_reference FK OR bag_numbers array
            const manifestBags = processedBags.filter(bag => {
                const matchesFk = bag.new_manifest_reference === manifestId;
                const matchesNumList = bagNumArray.includes(bag.bag_number);
                if (matchesFk || matchesNumList) {
                    assignedBagNumbers.add(bag.bag_number);
                    return true;
                }
                return false;
            });

            // Calculate total parcels across all bags in this manifest
            const calculatedTotalParcels = manifestBags.reduce((acc, b) => acc + (b.parcel_count || 0), 0);
            const providerName = manifest.service_provider ? (serviceProvidersMap[manifest.service_provider] || `Partner #${manifest.service_provider}`) : 'All Partners';

            return {
                id: manifestId,
                manifest_reference: refStr,
                status: (manifest.status as 'OPEN' | 'CLOSED') || 'OPEN',
                service_provider: manifest.service_provider,
                service_provider_name: providerName,
                total_bags: manifest.total_bags || manifestBags.length,
                total_parcels: manifest.total_parcels || calculatedTotalParcels,
                created_by: manifest.created_by,
                created_at: manifest.created_at,
                json_path: manifest.json_path,
                xml_path: manifest.xml_path,
                is_uploaded: Boolean(manifest.is_uploaded),
                bag_numbers: bagNumArray,
                bags: manifestBags
            };
        });

        // Identify unassigned / standalone bags
        const unassignedBags = processedBags.filter(b => !assignedBagNumbers.has(b.bag_number) && !b.is_bag_in_a_manifest && !b.new_manifest_reference);

        // Compute aggregate statistics
        const totalManifests = manifestsList.length;
        const openManifests = manifestsList.filter(m => m.status === 'OPEN').length;
        const closedManifests = manifestsList.filter(m => m.status === 'CLOSED').length;

        const totalBags = processedBags.length;
        const openBags = processedBags.filter(b => b.status === 'OPEN').length;
        const sealedBags = processedBags.filter(b => b.status === 'SEALED').length;
        const manifestedBags = processedBags.filter(b => assignedBagNumbers.has(b.bag_number) || b.is_bag_in_a_manifest || b.new_manifest_reference).length;
        const unmanifestedBags = totalBags - manifestedBags;

        const totalParcels = processedBags.reduce((acc, b) => acc + (b.parcel_count || 0), 0);
        const totalWeight = processedBags.reduce((acc, b) => acc + (b.total_weight || 0), 0);

        // Partner breakdown
        const partnerStats: Record<string, { bags: number; parcels: number; weight: number }> = {};
        processedBags.forEach(b => {
            const partner = b.target_partner || 'Unassigned';
            if (!partnerStats[partner]) partnerStats[partner] = { bags: 0, parcels: 0, weight: 0 };
            partnerStats[partner].bags += 1;
            partnerStats[partner].parcels += b.parcel_count || 0;
            partnerStats[partner].weight += b.total_weight || 0;
        });

        return NextResponse.json({
            success: true,
            stats: {
                totalManifests,
                openManifests,
                closedManifests,
                totalBags,
                openBags,
                sealedBags,
                manifestedBags,
                unmanifestedBags,
                totalParcels,
                totalWeight: Math.round(totalWeight * 100) / 100,
                partnerStats
            },
            manifests: manifestsList,
            unassignedBags
        });

    } catch (error: any) {
        console.error('[manifest-tracking] Error in GET handler:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
