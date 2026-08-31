import { NextResponse } from 'next/server';
import { normalizeWeightToGrams } from '@/lib/weightUtils';

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

async function fetchJson<T>(url: string, headers: Record<string, string>, fallback: T, timeoutMs = 12000): Promise<T> {
    try {
        const res = await fetch(url, {
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`[manifest-tracking] fetchJson HTTP ${res.status} for ${url}:`, errText);
            return fallback;
        }
        const data = await res.json();
        return Array.isArray(data) || (data && typeof data === 'object') ? data : fallback;
    } catch (e: any) {
        console.error(`[manifest-tracking] fetchJson error for ${url}:`, e?.message || e);
        return fallback;
    }
}

export async function GET(request: Request) {
    try {
        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database configuration missing.' }, { status: 500 });
        }

        // 1. Fetch core datasets in parallel with explicit column projections (no implicit select=*)
        const [rawSp, rawUsers, rawManifests, rawBags] = await Promise.all([
            // service_providers: small lookup table
            fetchJson<any[]>(`${sb.url}/rest/v1/service_providers?select=id,name,code`, sb.headers, [], 15000),
            fetchJson<any[]>(`${sb.url}/rest/v1/users?select=id,username,first_name,last_name,email`, sb.headers, [], 15000),
            // outbound_manifests: only columns that exist in the schema (no created_by on this table)
            fetchJson<any[]>(`${sb.url}/rest/v1/outbound_manifests?select=id,manifest_reference,bag_numbers,status,service_provider,total_bags,total_parcels,opened_by,closed_by,closed_at,created_at,json_path,xml_path,is_uploaded&order=created_at.desc`, sb.headers, [], 20000),
            // outbound_lmd_bags: explicit field list — parcels JSONB kept because the mapping loop actively uses it
            fetchJson<any[]>(`${sb.url}/rest/v1/outbound_lmd_bags?select=id,bag_number,target_partner,destination_hub,status,parcel_count,total_weight,created_by,created_at,opened_by,opened_at,closed_by,closed_at,sealed_at,sealed_by,new_manifest_reference,is_bag_in_a_manifest,parcels&order=created_at.desc`, sb.headers, [], 25000)
        ]);

        // Build Service Providers map
        const serviceProvidersMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'SITREK', 4: 'Pronto' };
        if (Array.isArray(rawSp)) {
            rawSp.forEach((sp: any) => {
                if (sp.id && sp.name) serviceProvidersMap[sp.id] = sp.name;
            });
        }

        // Build Users map
        const usersMap = new Map<string, string>();
        if (Array.isArray(rawUsers)) {
            rawUsers.forEach((u: any) => {
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
                const displayName = fullName || u.username || u.email || `User #${u.id}`;
                if (u.id !== undefined && u.id !== null) {
                    usersMap.set(String(u.id), displayName);
                }
                if (u.username) {
                    usersMap.set(String(u.username).toLowerCase(), displayName);
                }
            });
        }

        const resolveUserName = (val: any): string => {
            if (val === undefined || val === null || val === '') return '';
            const strVal = String(val).trim();
            if (usersMap.has(strVal)) return usersMap.get(strVal)!;
            if (usersMap.has(strVal.toLowerCase())) return usersMap.get(strVal.toLowerCase())!;
            return strVal;
        };

        // 2. Process Bags & format parcel contents
        const processedBags = (Array.isArray(rawBags) ? rawBags : []).map((bag: any) => {
            let parcelsList: any[] = [];
            
            // Try parsing JSONB parcels column
            if (Array.isArray(bag.parcels) && bag.parcels.length > 0) {
                parcelsList = bag.parcels.map((p: any) => {
                    const ref = p.trackingNumber || p.shipment_ref || p.reference_number || p.scannedBarcode || '';
                    const inboundManifest = p.inboundManifest || p.initialManifest || p.mawbRef || '—';
                    const inboundBag = p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—';
                    const assignedPartner = p.assignedPartner || p.partner || (bag.target_partner && bag.target_partner !== 'ALL' ? bag.target_partner : '—');
                    return {
                        trackingNumber: ref,
                        inboundManifest,
                        inboundBag,
                        initialManifest: inboundManifest,
                        initialBag: inboundBag,
                        assignedPartner,
                        partner: assignedPartner,
                        weight: normalizeWeightToGrams(p.weight || 0),
                        scannedBy: resolveUserName(p.scannedBy || p.scanned_by) || 'Staff',
                        recipientName: p.recipientName || '—',
                        city: p.city || '—',
                        timestamp: p.timestamp || p.created_at || bag.created_at
                    };
                });
            } else if (typeof bag.parcels === 'string' && bag.parcels.trim() !== '' && bag.parcels !== '[]') {
                try {
                    const parsed = JSON.parse(bag.parcels);
                    if (Array.isArray(parsed)) {
                        parcelsList = parsed.map((p: any) => {
                            const ref = p.trackingNumber || p.shipment_ref || p.reference_number || p.scannedBarcode || '';
                            const inboundManifest = p.inboundManifest || p.initialManifest || p.mawbRef || '—';
                            const inboundBag = p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—';
                            const assignedPartner = p.assignedPartner || p.partner || (bag.target_partner && bag.target_partner !== 'ALL' ? bag.target_partner : '—');
                            return {
                                trackingNumber: ref,
                                inboundManifest,
                                inboundBag,
                                initialManifest: inboundManifest,
                                initialBag: inboundBag,
                                assignedPartner,
                                partner: assignedPartner,
                                weight: normalizeWeightToGrams(p.weight || 0),
                                scannedBy: resolveUserName(p.scannedBy || p.scanned_by) || 'Staff',
                                recipientName: p.recipientName || '—',
                                city: p.city || '—',
                                timestamp: p.timestamp || p.created_at || bag.created_at
                            };
                        });
                    }
                } catch (e) {}
            }

            const rawOpenedBy = bag.opened_by || bag.created_by;
            const rawClosedBy = bag.closed_by || bag.sealed_by;
            const cumulativeParcelsWeight = parcelsList.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
            const resolvedBagWeight = cumulativeParcelsWeight > 0 ? cumulativeParcelsWeight : normalizeWeightToGrams(bag.total_weight);

            return {
                id: bag.id,
                bag_number: bag.bag_number,
                target_partner: bag.target_partner || 'ALL',
                destination_hub: bag.destination_hub || '—',
                status: (bag.status as 'OPEN' | 'SEALED') || 'OPEN',
                parcel_count: bag.parcel_count || parcelsList.length,
                total_weight: resolvedBagWeight,
                created_by: resolveUserName(bag.created_by) || 'Staff',
                created_at: bag.created_at,
                opened_by: resolveUserName(rawOpenedBy) || 'Staff',
                opened_at: bag.opened_at || bag.created_at,
                closed_by: resolveUserName(rawClosedBy) || (bag.status === 'SEALED' ? 'Staff' : null),
                closed_at: bag.closed_at || bag.sealed_at || null,
                sealed_at: bag.sealed_at,
                sealed_by: resolveUserName(bag.sealed_by),
                new_manifest_reference: bag.new_manifest_reference ? Number(bag.new_manifest_reference) : null,
                is_bag_in_a_manifest: Boolean(bag.is_bag_in_a_manifest),
                parcels: parcelsList
            };
        });

        // 3. Map bags into Manifests
        const assignedBagNumbers = new Set<string>();

        const manifestsList = (Array.isArray(rawManifests) ? rawManifests : []).map((manifest: any) => {
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

            // Calculate total parcels and weight across all bags in this manifest
            const calculatedTotalParcels = manifestBags.reduce((acc, b) => acc + (b.parcel_count || 0), 0);
            const calculatedTotalWeight = manifestBags.reduce((acc, b) => {
                const bWeight = Number(b.total_weight) || (b.parcels || []).reduce((pSum: number, p: any) => pSum + (Number(p.weight) || 0), 0);
                return acc + bWeight;
            }, 0);
            const providerName = manifest.service_provider ? (serviceProvidersMap[manifest.service_provider] || `Partner #${manifest.service_provider}`) : 'All Partners';

            // outbound_manifests has no created_by column — use opened_by only
            const resolvedOpenedBy = resolveUserName(manifest.opened_by);
            const resolvedClosedBy = resolveUserName(manifest.closed_by);

            return {
                id: manifestId,
                manifest_reference: refStr,
                status: (manifest.status as 'OPEN' | 'CLOSED') || 'OPEN',
                service_provider: manifest.service_provider,
                service_provider_name: providerName,
                total_bags: manifest.total_bags || manifestBags.length,
                total_parcels: manifest.total_parcels || calculatedTotalParcels,
                total_weight: calculatedTotalWeight,
                created_by: resolvedOpenedBy || 'Staff', // outbound_manifests has no created_by; use opened_by
                opened_by: resolvedOpenedBy || 'Staff',
                closed_by: resolvedClosedBy || (manifest.status === 'CLOSED' ? 'Staff' : null),
                closed_at: manifest.closed_at || null,
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
