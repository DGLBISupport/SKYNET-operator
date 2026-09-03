import { NextResponse } from 'next/server';
import { normalizeWeightToGrams } from '@/lib/weightUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory cache for outbound LMD dispatch bags (for instant response & backup)
interface OutboundBag {
    bagNumber: string;
    mawbRef: string; // manifest_reference string (display only, resolved from outbound_manifests)
    manifestDbId?: number; // outbound_manifests.id (FK, used for DB queries)
    targetPartner?: 'PickMe' | 'Domex' | 'SITREK' | 'Pronto' | 'ALL';
    destinationHub?: string;
    status: 'OPEN' | 'SEALED';
    parcelCount: number;
    totalWeight: number;
    createdAt: string;
    sealedAt?: string;
    sealedBy?: string;
    operator?: string;
    parcels: any[];
}

interface ManifestSession {
    mawbRef: string;
    dbId?: number; // outbound_manifests.id — cached after create or lookup
    status: 'OPEN' | 'CLOSED';
    serviceProviderId?: number;
    serviceProviderName?: string;
    closedAt?: string;
    closedBy?: string;
}

interface OutboundManifestRecord {
    id?: number;
    created_at?: string;
    manifest_reference: string;
    bag_numbers: string[] | null;
    total_bags: number | null;
    service_provider: number | null;
    service_provider_name?: string;
    created_by?: number | null;
    json_path?: string | null;
    xml_path?: string | null;
    total_parcels: number | null;
    status?: 'OPEN' | 'CLOSED';
}

const outboundBagsMap = new Map<string, OutboundBag>();
const manifestsMap = new Map<string, ManifestSession>();

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

// Helper: Resolve numeric user ID from public.users table using user ID, email, username, or operator name
async function resolveUserId(sb: any, userVal: any): Promise<number | null> {
    if (userVal === null || userVal === undefined || userVal === '') return null;
    if (typeof userVal === 'number' && !isNaN(userVal)) return userVal;
    if (typeof userVal === 'string' && /^\d+$/.test(userVal.trim())) return parseInt(userVal.trim(), 10);

    if (!sb || typeof userVal !== 'string') return null;
    const strVal = userVal.trim();
    if (!strVal || strVal === 'Staff') return null;

    try {
        // 1. Try exact match on email or username
        const res1 = await fetch(
            `${sb.url}/rest/v1/users?or=(email.eq.${encodeURIComponent(strVal)},username.eq.${encodeURIComponent(strVal)})&select=id&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );
        const data1 = await res1.json();
        if (Array.isArray(data1) && data1.length > 0 && data1[0]?.id) {
            return Number(data1[0].id);
        }

        // 2. Try match on first_name
        const firstName = strVal.split(/\s+/)[0];
        if (firstName) {
            const res2 = await fetch(
                `${sb.url}/rest/v1/users?first_name=ilike.${encodeURIComponent(firstName)}&select=id&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            const data2 = await res2.json();
            if (Array.isArray(data2) && data2.length > 0 && data2[0]?.id) {
                return Number(data2[0].id);
            }
        }
    } catch (e) {
        console.error('resolveUserId error:', e);
    }
    return null;
}

// Helper: Format current date as DDMMYYYY (e.g., 07082026)
function getFormattedDateDDMMYYYY(dateObj: Date = new Date()): string {
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}${mm}${yyyy}`;
}

// Helper: Get outbound_manifests.id for a given manifest_reference string
async function getManifestDbId(sb: any, manifestRef: string): Promise<number | null> {
    if (!sb || !manifestRef) return null;
    const cached = manifestsMap.get(manifestRef);
    if (cached?.dbId) return cached.dbId;
    try {
        const res = await fetch(
            `${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(manifestRef)}&select=id`,
            { headers: sb.headers, cache: 'no-store' }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].id) {
            const id = Number(data[0].id);
            const existing = manifestsMap.get(manifestRef);
            if (existing) existing.dbId = id;
            return id;
        }
    } catch (e) {
        console.error('getManifestDbId error:', e);
    }
    return null;
}

// Helper: Sync manifest metrics into public.outbound_manifests table
async function updateOutboundManifestInDB(sb: any, manifestRef: string, serviceProviderId: number | null, addedBagNumber?: string, manifestStatus?: 'OPEN' | 'CLOSED') {
    if (!sb || !manifestRef) return;
    try {
        const manifestId = await getManifestDbId(sb, manifestRef);
        let bagNumbers: string[] = [];
        let totalParcels = 0;

        if (manifestId) {
            // Fetch all bags linked to this manifest via FK
            const bagsRes = await fetch(
                `${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestId}&select=bag_number,parcel_count`,
                { headers: sb.headers, cache: 'no-store' }
            );
            const bagsData = await bagsRes.json();
            if (Array.isArray(bagsData)) {
                bagNumbers = bagsData.map((b: any) => b.bag_number).filter(Boolean);
                totalParcels = bagsData.reduce((acc: number, b: any) => acc + (Number(b.parcel_count) || 0), 0);
            }
            if (bagNumbers.length > 0) {
                try {
                    const itemsRes = await fetch(
                        `${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=in.(${bagNumbers.map((bn: string) => `"${encodeURIComponent(bn)}"`).join(',')})&select=id`,
                        { headers: sb.headers, cache: 'no-store' }
                    );
                    const itemsData = await itemsRes.json();
                    if (Array.isArray(itemsData) && itemsData.length > 0) {
                        totalParcels = Math.max(totalParcels, itemsData.length);
                    }
                } catch (e) {}
            }
        }

        if (addedBagNumber && !bagNumbers.includes(addedBagNumber)) bagNumbers.push(addedBagNumber);

        const payload: any = {
            bag_numbers: bagNumbers,
            total_bags: bagNumbers.length,
            total_parcels: totalParcels
        };
        if (serviceProviderId) payload.service_provider = serviceProviderId;
        if (manifestStatus) payload.status = manifestStatus;

        if (manifestId) {
            await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, {
                method: 'PATCH', headers: sb.headers, body: JSON.stringify(payload)
            });
        } else {
            // Fallback: match by manifest_reference string if ID is not yet resolved
            const checkRes = await fetch(
                `${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(manifestRef)}&select=id`,
                { headers: sb.headers, cache: 'no-store' }
            );
            const checkData = await checkRes.json();
            if (Array.isArray(checkData) && checkData.length > 0) {
                await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(manifestRef)}`, {
                    method: 'PATCH', headers: sb.headers, body: JSON.stringify(payload)
                });
            } else {
                if (!payload.status) payload.status = 'OPEN';
                payload.manifest_reference = manifestRef;
                await fetch(`${sb.url}/rest/v1/outbound_manifests`, {
                    method: 'POST', headers: sb.headers, body: JSON.stringify(payload)
                });
            }
        }
    } catch (err) {
        console.error("Failed to sync outbound_manifests in DB:", err);
    }
}

// ─── FFDX GETonline Upload Helper ────────────────────────────────────────────
// Fire-and-forget: builds the bag/parcel payload and calls /api/ffdx-upload.
// Does NOT block the main request — failures are logged but do not throw.
async function triggerFfdxUpload({
    manifestReference,
    manifestId,
    serviceProviderName,
    bags,
    baseUrl
}: {
    manifestReference: string;
    manifestId?: number | null;
    serviceProviderName?: string;
    bags: Array<{ bagNumber: string; parcels: any[] }>;
    baseUrl: string;
}): Promise<void> {
    try {
        if (!manifestReference) return;
        const payload = { manifestReference, manifestId: manifestId || null, serviceProviderName: serviceProviderName || 'All Partners', bags };
        console.log(`[lmd-bags] Triggering FFDX upload for "${manifestReference}" (${bags.reduce((s, b) => s + b.parcels.length, 0)} parcel(s))`);
        // Non-blocking: we don't await here — fire and forget
        fetch(`${baseUrl}/api/ffdx-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(async (res) => {
            const txt = await res.text().catch(() => '');
            if (!res.ok) console.error(`[lmd-bags] FFDX upload response error (${res.status}): ${txt.slice(0, 300)}`);
            else console.log(`[lmd-bags] FFDX upload triggered OK for "${manifestReference}"`);
        }).catch(e => console.error(`[lmd-bags] FFDX upload fetch failed for "${manifestReference}":`, e));
    } catch (e) {
        console.error(`[lmd-bags] triggerFfdxUpload error:`, e);
    }
}

// Helper: get base URL for internal API calls
function getBaseUrl(request: Request): string {
    try {
        const url = new URL(request.url);
        return `${url.protocol}//${url.host}`;
    } catch {
        return process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mawbRef = searchParams.get('mawbRef') || searchParams.get('manifestRef');
    const bagNumber = searchParams.get('bagNumber');
    const getOutboundManifests = searchParams.get('getOutboundManifests');
    const sb = getSupabaseConfig();

    if (getOutboundManifests === 'true') {
        let manifestsList: OutboundManifestRecord[] = [];
        let serviceProvidersMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'SITREK', 4: 'Pronto' };
        let supabaseSuccess = false;
        if (sb) {
            try {
                const spRes = await fetch(`${sb.url}/rest/v1/service_providers?select=id,name,code`, { headers: sb.headers, cache: 'no-store' });
                const spData = await spRes.json();
                if (Array.isArray(spData)) spData.forEach((sp: any) => { serviceProvidersMap[sp.id] = sp.name; });

                // Fetch ALL open/unclosed manifests (no date restriction)
                const omRes = await fetch(
                    `${sb.url}/rest/v1/outbound_manifests?or=(status.neq.CLOSED,status.is.null)&order=created_at.desc`,
                    { headers: sb.headers, cache: 'no-store' }
                );
                const omData = await omRes.json();
                if (Array.isArray(omData)) {
                    supabaseSuccess = true;
                    // Filter out any manifests that might have status 'CLOSED'
                    const unclosedRows = omData.filter((row: any) => (row.status || 'OPEN').toUpperCase() !== 'CLOSED');
                    manifestsList = unclosedRows.map((row: any) => ({
                        id: row.id,
                        created_at: row.created_at,
                        manifest_reference: row.manifest_reference,
                        bag_numbers: row.bag_numbers || [],
                        total_bags: row.total_bags || (row.bag_numbers ? row.bag_numbers.length : 0),
                        service_provider: row.service_provider,
                        service_provider_name: row.service_provider ? serviceProvidersMap[row.service_provider] || `Partner #${row.service_provider}` : 'All Partners',
                        created_by: row.created_by,
                        json_path: row.json_path,
                        xml_path: row.xml_path,
                        total_parcels: row.total_parcels || 0,
                        status: (row.status as 'OPEN' | 'CLOSED') || manifestsMap.get(row.manifest_reference)?.status || 'OPEN'
                    }));

                    // Prune in-memory manifestsMap: remove any manifest reference that is no longer in Supabase DB!
                    const activeRefsFromDb = new Set(unclosedRows.map((row: any) => row.manifest_reference).filter(Boolean));
                    manifestsMap.forEach((_, ref) => {
                        if (ref && ref.startsWith('LK-') && !activeRefsFromDb.has(ref)) {
                            manifestsMap.delete(ref);
                        }
                    });

                    unclosedRows.forEach((row: any) => {
                        if (row.manifest_reference && row.id) {
                            const existing = manifestsMap.get(row.manifest_reference);
                            if (existing) existing.dbId = Number(row.id);
                        }
                    });
                }
            } catch (e) { console.error("Supabase GET outbound_manifests error:", e); }
        }

        // Only append fallback in-memory manifests if Supabase fetch failed or is unconfigured
        // Also filter to only unclosed manifests (closed ones are excluded from the dropdown)
        if (!supabaseSuccess) {
            manifestsMap.forEach((session, ref) => {
                if (ref && ref.startsWith('LK-') && (session.status || 'OPEN').toUpperCase() !== 'CLOSED' && !manifestsList.some(m => m.manifest_reference === ref)) {
                    manifestsList.push({ manifest_reference: ref, bag_numbers: [], total_bags: 0, service_provider: session.serviceProviderId || null, service_provider_name: session.serviceProviderName || 'All Partners', total_parcels: 0, status: session.status || 'OPEN' });
                }
            });
        }
        return NextResponse.json({ success: true, manifests: manifestsList });
    }

    if (bagNumber) {
        if (sb) {
            try {
                const bagRes = await fetch(
                    `${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}&select=*,outbound_manifests(id,manifest_reference)`,
                    { headers: sb.headers }
                );
                const bagsData = await bagRes.json();
                if (Array.isArray(bagsData) && bagsData.length > 0) {
                    const row = bagsData[0];
                    let parcels: any[] = [];
                    if (Array.isArray(row.parcels)) parcels = row.parcels;
                    else if (typeof row.parcels === 'string') { try { parcels = JSON.parse(row.parcels); } catch (e) { parcels = []; } }

                    const parcelMap = new Map<string, any>();
                    // 1. Existing parsed JSONB parcels
                    parcels.forEach((p: any) => {
                        const trk = String(p.trackingNumber || p.shipment_ref || p.reference_number || '').trim();
                        if (trk) parcelMap.set(trk.toLowerCase(), p);
                    });

                    // 2. Authoritative items from outbound_lmd_bag_items table
                    try {
                        const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}&select=shipment_ref,weight,created_at,scanned_by`, { headers: sb.headers, cache: 'no-store' });
                        const itemsData = await itemsRes.json();
                        if (Array.isArray(itemsData) && itemsData.length > 0) {
                            itemsData.forEach((it: any) => {
                                const trk = String(it.shipment_ref || '').trim();
                                if (trk) {
                                    const existing = parcelMap.get(trk.toLowerCase());
                                    parcelMap.set(trk.toLowerCase(), {
                                        trackingNumber: trk,
                                        weight: normalizeWeightToGrams(it.weight || existing?.weight || 0),
                                        scannedBy: it.scanned_by || existing?.scannedBy || 'Staff',
                                        timestamp: it.created_at || existing?.timestamp || row.created_at,
                                        ...existing
                                    });
                                }
                            });
                        }
                    } catch (e) { console.error("Error enriching bag items on GET:", e); }

                    const mergedParcels = Array.from(parcelMap.values());
                    const joinedManifest = row.outbound_manifests;
                    const resolvedMawbRef = joinedManifest?.manifest_reference || row.mawb_ref || '';
                    const resolvedManifestDbId = joinedManifest?.id || row.new_manifest_reference || null;
                    const cumulativeWeight = mergedParcels.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
                    const finalParcelCount = mergedParcels.length > 0 ? mergedParcels.length : (row.parcel_count || 0);

                    const bag: OutboundBag = {
                        bagNumber: row.bag_number, mawbRef: resolvedMawbRef, manifestDbId: resolvedManifestDbId ? Number(resolvedManifestDbId) : undefined,
                        targetPartner: row.target_partner || 'ALL', destinationHub: row.destination_hub, status: row.status as 'OPEN' | 'SEALED',
                        parcelCount: finalParcelCount, totalWeight: cumulativeWeight > 0 ? cumulativeWeight : normalizeWeightToGrams(row.total_weight), createdAt: row.created_at,
                        sealedAt: row.sealed_at, sealedBy: row.sealed_by, operator: row.created_by || 'Staff', parcels: mergedParcels
                    };
                    outboundBagsMap.set(bagNumber, bag);
                    return NextResponse.json({ success: true, bag });
                }
            } catch (e) { console.error("Supabase GET bag error:", e); }
        }
        const bag = outboundBagsMap.get(bagNumber);
        if (!bag) return NextResponse.json({ success: false, error: `Bag "${bagNumber}" not found.` }, { status: 404 });
        return NextResponse.json({ success: true, bag });
    }

    if (mawbRef) {
        if (sb) {
            try {
                // Fetch manifest status — increase timeout to avoid abort on slow connections
                const omRes = await fetch(
                    `${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=id,status`,
                    { headers: sb.headers, cache: 'no-store', signal: AbortSignal.timeout(20000) }
                );
                const omData = await omRes.json();
                let manifestStatus: 'OPEN' | 'CLOSED' = 'OPEN';
                let manifestDbId: number | null = null;
                let manifestExistsInDb = false;

                if (Array.isArray(omData) && omData.length > 0) {
                    manifestExistsInDb = true;
                    if (omData[0].status) manifestStatus = omData[0].status as 'OPEN' | 'CLOSED';
                    if (omData[0].id) manifestDbId = Number(omData[0].id);
                } else if (Array.isArray(omData) && omData.length === 0) {
                    // Manifest deleted in DB — prune in-memory caches
                    manifestsMap.delete(mawbRef);
                    outboundBagsMap.forEach((bag, bNum) => { if (bag.mawbRef.toLowerCase() === mawbRef.toLowerCase()) outboundBagsMap.delete(bNum); });
                }

                // Fetch bags via new_manifest_reference FK — explicit column projection to reduce payload
                let bagsData: any[] = [];
                if (manifestDbId) {
                    const bagsRes = await fetch(
                        `${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestDbId}&select=id,bag_number,target_partner,destination_hub,status,parcel_count,total_weight,created_by,created_at,sealed_at,sealed_by,new_manifest_reference,parcels&order=created_at.desc`,
                        { headers: sb.headers, cache: 'no-store', signal: AbortSignal.timeout(20000) }
                    );
                    const fetchedBags = await bagsRes.json();
                    if (Array.isArray(fetchedBags)) bagsData = fetchedBags;
                }

                if (manifestExistsInDb || Array.isArray(bagsData)) {
                    // Fetch all items from outbound_lmd_bag_items for these bags in bulk to ensure accurate counts
                    const bagNumbersList = bagsData.map((b: any) => b.bag_number).filter(Boolean);
                    const bagItemsMap = new Map<string, any[]>();
                    if (bagNumbersList.length > 0) {
                        try {
                            const itemsRes = await fetch(
                                `${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=in.(${bagNumbersList.map((bn: string) => `"${encodeURIComponent(bn)}"`).join(',')})&select=bag_number,shipment_ref,weight,created_at,scanned_by`,
                                { headers: sb.headers, cache: 'no-store', signal: AbortSignal.timeout(15000) }
                            );
                            const itemsData = await itemsRes.json();
                            if (Array.isArray(itemsData)) {
                                itemsData.forEach((it: any) => {
                                    const bn = String(it.bag_number || '').trim().toLowerCase();
                                    if (!bagItemsMap.has(bn)) bagItemsMap.set(bn, []);
                                    bagItemsMap.get(bn)!.push(it);
                                });
                            }
                        } catch (e) {
                            console.error("Error bulk fetching bag items for mawbRef:", e);
                        }
                    }

                    const dbBags: OutboundBag[] = bagsData.map((row: any) => {
                        let jsonbParcels: any[] = [];
                        if (Array.isArray(row.parcels)) jsonbParcels = row.parcels;
                        else if (typeof row.parcels === 'string') { try { jsonbParcels = JSON.parse(row.parcels); } catch (e) { jsonbParcels = []; } }

                        const parcelMap = new Map<string, any>();
                        // 1. Insert JSONB parcels
                        jsonbParcels.forEach((p: any) => {
                            const trk = String(p.trackingNumber || p.shipment_ref || p.reference_number || '').trim();
                            if (trk) parcelMap.set(trk.toLowerCase(), p);
                        });

                        // 2. Insert and merge DB items
                        const dbItems = bagItemsMap.get(String(row.bag_number || '').trim().toLowerCase()) || [];
                        dbItems.forEach((it: any) => {
                            const trk = String(it.shipment_ref || '').trim();
                            if (trk) {
                                const existing = parcelMap.get(trk.toLowerCase());
                                parcelMap.set(trk.toLowerCase(), {
                                    trackingNumber: trk,
                                    weight: normalizeWeightToGrams(it.weight || existing?.weight || 0),
                                    scannedBy: it.scanned_by || existing?.scannedBy || 'Staff',
                                    timestamp: it.created_at || existing?.timestamp || row.created_at,
                                    ...existing
                                });
                            }
                        });

                        const mergedParcels = Array.from(parcelMap.values());
                        const cumWeightGrams = mergedParcels.reduce((acc: number, p: any) => acc + normalizeWeightToGrams(p.weight), 0);
                        const resolvedTotalWeight = cumWeightGrams > 0 ? cumWeightGrams : normalizeWeightToGrams(row.total_weight);
                        const finalParcelCount = mergedParcels.length > 0 ? mergedParcels.length : (row.parcel_count || 0);

                        return {
                            bagNumber: row.bag_number, mawbRef: mawbRef,
                            manifestDbId: row.new_manifest_reference ? Number(row.new_manifest_reference) : (manifestDbId || undefined),
                            targetPartner: row.target_partner || 'ALL', destinationHub: row.destination_hub, status: row.status as 'OPEN' | 'SEALED',
                            parcelCount: finalParcelCount, totalWeight: resolvedTotalWeight, createdAt: row.created_at,
                            sealedAt: row.sealed_at, sealedBy: row.sealed_by, operator: row.created_by || 'Staff', parcels: mergedParcels
                        } as OutboundBag;
                    });
                    outboundBagsMap.forEach((bag, bNum) => { if (bag.mawbRef.toLowerCase() === mawbRef.toLowerCase()) outboundBagsMap.delete(bNum); });
                    if (manifestExistsInDb) {
                        dbBags.forEach((bag) => outboundBagsMap.set(bag.bagNumber, bag));
                        manifestsMap.set(mawbRef, { mawbRef, dbId: manifestDbId || undefined, status: manifestStatus });
                    }
                    return NextResponse.json({ success: true, mawbRef, manifestStatus, bags: dbBags });
                }
            } catch (e) { console.error("Supabase GET mawbRef bags error:", e); }
        }
        const bags = Array.from(outboundBagsMap.values()).filter(b => b.mawbRef.toLowerCase() === mawbRef.toLowerCase());
        const manifestSession = manifestsMap.get(mawbRef) || { mawbRef, status: 'OPEN' };
        return NextResponse.json({ success: true, mawbRef, manifestStatus: manifestSession.status, bags });
    }

    return NextResponse.json({ success: true, bags: Array.from(outboundBagsMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), manifests: Array.from(manifestsMap.values()) });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, mawbRef, bagNumber, partner, destinationHub, operator, openedBy, opened_by, parcelCount, totalWeight, parcels, providerName, serviceProviderId } = body;
        const activeOpenedBy = operator || openedBy || opened_by || 'Staff';
        const effectiveMawbRef = mawbRef || 'GENERAL';
        const sb = getSupabaseConfig();
        const baseUrl = getBaseUrl(request);

        if (action === 'create-manifest') {
            const providerCode = (providerName || partner || 'PICKME').toUpperCase().replace(/\s+/g, '');
            const todayStr = getFormattedDateDDMMYYYY();
            const prefixPattern = `LK-${providerCode}-${todayStr}-`;
            let spId: number | null = serviceProviderId ? Number(serviceProviderId) : null;
            const seqs: number[] = [];
            const customRef = (body.customManifestReference || body.manifestReference || body.manifestName || '').trim();

            if (sb) {
                try {
                    if (!spId) {
                        const spRes = await fetch(`${sb.url}/rest/v1/service_providers?select=id,name,code`, { headers: sb.headers });
                        const spData = await spRes.json();
                        if (Array.isArray(spData)) {
                            const found = spData.find((sp: any) => (sp.name && sp.name.toUpperCase().includes(providerCode)) || (sp.code && sp.code.toUpperCase().includes(providerCode)));
                            if (found) spId = found.id;
                            else if (providerCode.includes('PICKME')) spId = 1;
                            else if (providerCode.includes('DOMEX')) spId = 2;
                            else if (providerCode.includes('SITREK')) spId = 3;
                            else if (providerCode.includes('PRONTO')) spId = 4;
                        }
                    }

                    if (customRef) {
                        const checkRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(customRef)}&select=id,manifest_reference`, { headers: sb.headers, cache: 'no-store' });
                        const checkData = await checkRes.json();
                        if (Array.isArray(checkData) && checkData.length > 0) {
                            return NextResponse.json({ success: false, error: `Manifest reference "${customRef}" already exists in database. Please choose a different name.` }, { status: 400 });
                        }
                    }

                    const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=ilike.${encodeURIComponent(prefixPattern + '*')}&select=manifest_reference`, { headers: sb.headers, cache: 'no-store' });
                    const omData = await omRes.json();
                    if (Array.isArray(omData)) {
                        omData.forEach((row: any) => {
                            const ref = row.manifest_reference || '';
                            const parts = ref.split('-');
                            const num = parseInt(parts[parts.length - 1], 10);
                            if (!isNaN(num)) seqs.push(num);
                        });
                    }
                } catch (err) { console.error("Error querying outbound manifests sequence:", err); }
            }

            // Also check in-memory manifestsMap
            manifestsMap.forEach((_, ref) => {
                if (ref && ref.toUpperCase().startsWith(prefixPattern.toUpperCase())) {
                    const parts = ref.split('-');
                    const num = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(num)) seqs.push(num);
                }
            });

            let manifestReference = customRef;
            if (!manifestReference) {
                let nextSeq = seqs.length > 0 ? Math.max(...seqs, 0) + 1 : 1;
                manifestReference = `${prefixPattern}${String(nextSeq).padStart(2, '0')}`;

                // Safety loop: ensure manifestReference is completely unique
                while (manifestsMap.has(manifestReference)) {
                    nextSeq++;
                    manifestReference = `${prefixPattern}${String(nextSeq).padStart(2, '0')}`;
                }
            } else {
                if (manifestsMap.has(manifestReference)) {
                    return NextResponse.json({ success: false, error: `Manifest reference "${manifestReference}" already exists. Please choose a different name.` }, { status: 400 });
                }
            }

            manifestsMap.set(manifestReference, { mawbRef: manifestReference, status: 'OPEN', serviceProviderId: spId || undefined, serviceProviderName: providerName || partner || 'PickMe' });
            let newManifestDbId: number | null = null;
            if (sb) {
                try {
                    const manifestPayload: any = {
                        manifest_reference: manifestReference,
                        bag_numbers: [],
                        total_bags: 0,
                        service_provider: spId,
                        total_parcels: 0,
                        status: 'OPEN'
                    };
                    const openedUserId = (await resolveUserId(sb, openedBy ?? opened_by ?? body.userId ?? body.user_id)) ?? (await resolveUserId(sb, operator));
                    if (openedUserId) manifestPayload.opened_by = openedUserId;

                    const insertRes = await fetch(`${sb.url}/rest/v1/outbound_manifests`, {
                        method: 'POST', headers: sb.headers,
                        body: JSON.stringify(manifestPayload)
                    });
                    const insertData = await insertRes.json();
                    if (Array.isArray(insertData) && insertData.length > 0 && insertData[0].id) {
                        newManifestDbId = Number(insertData[0].id);
                        const session = manifestsMap.get(manifestReference);
                        if (session) session.dbId = newManifestDbId;
                    } else {
                        console.error("Error inserting outbound_manifests response:", insertData);
                    }
                } catch (err) { console.error("Error inserting new outbound_manifests:", err); }
            }

            return NextResponse.json({ success: true, message: `New Outbound Manifest "${manifestReference}" created successfully.`, manifest: { id: newManifestDbId, manifest_reference: manifestReference, service_provider: spId, service_provider_name: providerName || partner || 'PickMe', bag_numbers: [], total_bags: 0, total_parcels: 0, status: 'OPEN' } });
        }

        if (mawbRef) {
            const manifestSession = manifestsMap.get(mawbRef);
            if (manifestSession && manifestSession.status === 'CLOSED' && action === 'create') {
                return NextResponse.json({ success: false, error: `Manifest "${mawbRef}" is CLOSED. No additional bags can be created under this manifest.` }, { status: 400 });
            }
        }

        if (action === 'create') {
            const existingBags = Array.from(outboundBagsMap.values()).filter(b => (b.mawbRef || 'GENERAL').toLowerCase() === effectiveMawbRef.toLowerCase());
            const nextIndex = existingBags.length + 1;
            const mawbPrefix = mawbRef ? mawbRef : (partner && partner !== 'ALL' ? `LMD-${partner.toUpperCase()}` : 'LMD');
            const includesPartner = partner && partner !== 'ALL' && mawbPrefix.toUpperCase().includes(partner.toUpperCase());
            const partnerCode = (partner && partner !== 'ALL' && !includesPartner) ? `-${partner.toUpperCase()}` : '';
            const defaultBagNumber = `${mawbPrefix}${partnerCode}-BAG-${String(nextIndex).padStart(2, '0')}`;
            const newBagNumber = (body.customBagNumber || body.bagNumber || defaultBagNumber).trim();

            // Prevent duplicate creation if bag already exists in memory
            if (outboundBagsMap.has(newBagNumber)) {
                const existing = outboundBagsMap.get(newBagNumber)!;
                return NextResponse.json({ success: true, message: `Outbound LMD Bag "${newBagNumber}" is already active.`, bag: existing });
            }

            let manifestDbId: number | null = mawbRef ? await getManifestDbId(sb, mawbRef) : null;
            if (mawbRef && !manifestDbId && sb) {
                await updateOutboundManifestInDB(sb, mawbRef, serviceProviderId ? Number(serviceProviderId) : null);
                manifestDbId = await getManifestDbId(sb, mawbRef);
            }

            // Check if already in Supabase database to avoid duplicate key errors or ghost duplicates
            if (sb) {
                try {
                    const checkRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(newBagNumber)}&select=bag_number,status,parcel_count,total_weight,destination_hub,target_partner,created_at`, { headers: sb.headers });
                    const checkData = await checkRes.json();
                    if (Array.isArray(checkData) && checkData.length > 0) {
                        const existingDbBag: OutboundBag = {
                            bagNumber: checkData[0].bag_number,
                            mawbRef: effectiveMawbRef,
                            manifestDbId: manifestDbId || undefined,
                            targetPartner: checkData[0].target_partner || partner || 'ALL',
                            destinationHub: checkData[0].destination_hub || destinationHub || 'Main Sort Hub',
                            status: checkData[0].status || 'OPEN',
                            parcelCount: checkData[0].parcel_count || 0,
                            totalWeight: checkData[0].total_weight || 0,
                            createdAt: checkData[0].created_at || new Date().toISOString(),
                            operator: typeof operator === 'string' ? operator : 'Staff',
                            parcels: []
                        };
                        outboundBagsMap.set(newBagNumber, existingDbBag);
                        return NextResponse.json({ success: true, message: `Outbound LMD Bag "${newBagNumber}" already exists.`, bag: existingDbBag });
                    }
                } catch (err) {
                    console.error("Error checking existing bag in DB:", err);
                }
            }

            const newBag: OutboundBag = {
                bagNumber: newBagNumber, mawbRef: effectiveMawbRef, manifestDbId: manifestDbId || undefined,
                targetPartner: partner || 'ALL', destinationHub: destinationHub || (partner && partner !== 'ALL' ? `${partner}` : 'Main Sort Hub'),
                status: 'OPEN', parcelCount: 0, totalWeight: 0, createdAt: new Date().toISOString(), operator: typeof operator === 'string' ? operator : 'Staff', parcels: []
            };
            outboundBagsMap.set(newBagNumber, newBag);
            if (mawbRef && !manifestsMap.has(mawbRef)) manifestsMap.set(mawbRef, { mawbRef, dbId: manifestDbId || undefined, status: 'OPEN' });

            if (sb) {
                try {
                    const openTimestamp = new Date().toISOString();
                    const bagPayload: any = {
                        bag_number: newBagNumber,
                        target_partner: partner || 'ALL',
                        destination_hub: newBag.destinationHub,
                        status: 'OPEN',
                        parcel_count: 0,
                        total_weight: 0,
                        created_by: typeof operator === 'string' ? operator : 'Staff',
                        opened_at: openTimestamp,
                        is_bag_in_a_manifest: !!manifestDbId
                    };
                    const openedUserId = (await resolveUserId(sb, openedBy ?? opened_by ?? body.userId ?? body.user_id)) ?? (await resolveUserId(sb, operator));
                    if (openedUserId) bagPayload.opened_by = openedUserId;
                    if (manifestDbId) bagPayload.new_manifest_reference = manifestDbId;

                    const bagInsertRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags`, {
                        method: 'POST', headers: sb.headers, body: JSON.stringify(bagPayload)
                    });
                    if (!bagInsertRes.ok) {
                        console.error("Supabase insert outbound_lmd_bags error:", await bagInsertRes.text());
                    }
                    await updateOutboundManifestInDB(sb, effectiveMawbRef, serviceProviderId ? Number(serviceProviderId) : null, newBagNumber);
                } catch (err) { console.error("Supabase insert outbound_lmd_bags error:", err); }
            }
            return NextResponse.json({ success: true, message: `New Outbound LMD Bag "${newBagNumber}" created successfully.`, bag: newBag });
        }

        if (action === 'add-parcel') {
            if (!bagNumber) return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) bag = { bagNumber, mawbRef: mawbRef, targetPartner: partner || body.targetPartner || 'ALL', destinationHub: destinationHub || 'Main Sort Hub', status: 'OPEN', parcelCount: 0, totalWeight: 0, createdAt: new Date().toISOString(), operator: typeof operator === 'string' ? operator : 'Staff', parcels: [] };
            if (bag.status === 'SEALED') return NextResponse.json({ success: false, error: `Bag "${bagNumber}" is SEALED & CLOSED. No additional parcels can be added.` }, { status: 400 });
            
            const newParcel = body.parcel;
            const tracking = String(newParcel?.trackingNumber || newParcel?.reference_number || newParcel?.scannedBarcode || '').trim();

            // 1. Insert into outbound_lmd_bag_items table FIRST
            if (newParcel && tracking && sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items`, {
                        method: 'POST',
                        headers: sb.headers,
                        body: JSON.stringify({
                            bag_number: bagNumber,
                            shipment_ref: tracking,
                            weight: normalizeWeightToGrams(newParcel.weight),
                            scanned_by: typeof operator === 'string' ? operator : 'Staff'
                        })
                    }).catch(e => console.error("Optional bag items table update ignored:", e));
                } catch (err) {
                    console.error("Error inserting into outbound_lmd_bag_items:", err);
                }
            }

            // 2. Fetch all bag items from DB for this bag to avoid in-memory stale overwrite
            let allDbBagItems: any[] = [];
            if (sb) {
                try {
                    const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}&select=shipment_ref,weight,created_at,scanned_by`, { headers: sb.headers, cache: 'no-store' });
                    const itemsData = await itemsRes.json();
                    if (Array.isArray(itemsData)) allDbBagItems = itemsData;
                } catch (e) {
                    console.error("Error fetching bag items for sync:", e);
                }
            }

            // 3. Build deduplicated parcels list
            const parcelMap = new Map<string, any>();
            (bag.parcels || []).forEach((p: any) => {
                const trk = String(p.trackingNumber || p.reference_number || p.shipment_ref || '').trim();
                if (trk) parcelMap.set(trk.toLowerCase(), p);
            });
            allDbBagItems.forEach((it: any) => {
                const trk = String(it.shipment_ref || '').trim();
                if (trk) {
                    const existing = parcelMap.get(trk.toLowerCase());
                    parcelMap.set(trk.toLowerCase(), {
                        trackingNumber: trk,
                        weight: normalizeWeightToGrams(it.weight || existing?.weight || 0),
                        scannedBy: it.scanned_by || existing?.scannedBy || (typeof operator === 'string' ? operator : 'Staff'),
                        timestamp: it.created_at || existing?.timestamp || new Date().toISOString(),
                        ...existing
                    });
                }
            });
            if (newParcel && tracking) {
                const existing = parcelMap.get(tracking.toLowerCase());
                parcelMap.set(tracking.toLowerCase(), {
                    ...newParcel,
                    trackingNumber: tracking,
                    weight: normalizeWeightToGrams(newParcel.weight),
                    scannedBy: typeof operator === 'string' ? operator : 'Staff',
                    timestamp: new Date().toISOString(),
                    ...existing
                });
            }

            const mergedParcels = Array.from(parcelMap.values());
            bag.parcels = mergedParcels;
            bag.parcelCount = mergedParcels.length;
            bag.totalWeight = Math.round(mergedParcels.reduce((acc, p) => acc + (normalizeWeightToGrams(p.weight)), 0));
            outboundBagsMap.set(bagNumber, bag);

            if (sb) {
                try {
                    const patchRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'PATCH',
                        headers: sb.headers,
                        body: JSON.stringify({ parcel_count: bag.parcelCount, total_weight: bag.totalWeight, parcels: bag.parcels || [] })
                    });
                    if (!patchRes.ok) {
                        console.error("Supabase add-parcel PATCH error:", await patchRes.text());
                    }
                    if (bag.mawbRef) await updateOutboundManifestInDB(sb, bag.mawbRef, serviceProviderId ? Number(serviceProviderId) : null);
                } catch (err) { console.error("Supabase add-parcel update error:", err); }
            }

            return NextResponse.json({ success: true, bag });
        }

        if (action === 'seal') {
            if (!bagNumber) return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            const sealedTimestamp = new Date().toISOString();
            const sealingOperator = typeof operator === 'string' ? operator : 'Staff';
            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                bag = { bagNumber, mawbRef: mawbRef, targetPartner: partner || body.targetPartner || 'ALL', destinationHub: destinationHub || 'Main Sort Hub', status: 'SEALED', parcelCount: parcelCount || 0, totalWeight: totalWeight || 0, createdAt: sealedTimestamp, sealedAt: sealedTimestamp, sealedBy: sealingOperator, operator: sealingOperator, parcels: parcels || [] };
            } else {
                bag.status = 'SEALED'; bag.sealedAt = sealedTimestamp; bag.sealedBy = sealingOperator;
                if (parcelCount !== undefined) bag.parcelCount = parcelCount;
                if (totalWeight !== undefined) bag.totalWeight = totalWeight;
                if (parcels) bag.parcels = parcels;
            }

            // Enrich and reconcile from outbound_lmd_bag_items before sealing to prevent freezing a stale count
            if (sb) {
                try {
                    const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}&select=shipment_ref,weight,created_at,scanned_by`, { headers: sb.headers, cache: 'no-store' });
                    const itemsData = await itemsRes.json();
                    if (Array.isArray(itemsData) && itemsData.length > 0) {
                        const parcelMap = new Map<string, any>();
                        (bag.parcels || []).forEach((p: any) => {
                            const trk = String(p.trackingNumber || p.shipment_ref || p.reference_number || '').trim();
                            if (trk) parcelMap.set(trk.toLowerCase(), p);
                        });
                        itemsData.forEach((it: any) => {
                            const trk = String(it.shipment_ref || '').trim();
                            if (trk) {
                                const existing = parcelMap.get(trk.toLowerCase());
                                parcelMap.set(trk.toLowerCase(), {
                                    trackingNumber: trk,
                                    weight: normalizeWeightToGrams(it.weight || existing?.weight || 0),
                                    scannedBy: it.scanned_by || existing?.scannedBy || sealingOperator,
                                    timestamp: it.created_at || existing?.timestamp || sealedTimestamp,
                                    ...existing
                                });
                            }
                        });
                        const reconciledParcels = Array.from(parcelMap.values());
                        bag.parcels = reconciledParcels;
                        bag.parcelCount = reconciledParcels.length;
                        bag.totalWeight = Math.round(reconciledParcels.reduce((acc, p) => acc + normalizeWeightToGrams(p.weight), 0));
                    }
                } catch (e) {
                    console.error("Error reconciling seal items:", e);
                }
            }

            outboundBagsMap.set(bagNumber, bag);
            if (sb) {
                try {
                    const sealPayload: any = {
                        status: 'SEALED',
                        sealed_at: sealedTimestamp,
                        sealed_by: sealingOperator,
                        closed_at: sealedTimestamp,
                        parcel_count: bag.parcelCount,
                        total_weight: bag.totalWeight,
                        parcels: bag.parcels || []
                    };
                    const closedUserId = (await resolveUserId(sb, body.closedBy ?? body.closed_by ?? body.userId ?? body.user_id)) ?? (await resolveUserId(sb, sealingOperator));
                    if (closedUserId) sealPayload.closed_by = closedUserId;

                    const sealRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'PATCH', headers: sb.headers, body: JSON.stringify(sealPayload)
                    });
                    if (!sealRes.ok) {
                        console.error("Supabase seal bag PATCH error:", await sealRes.text());
                    }
                    if (bag.mawbRef) await updateOutboundManifestInDB(sb, bag.mawbRef, serviceProviderId ? Number(serviceProviderId) : null);
                } catch (err) { console.error("Supabase seal bag update error:", err); }
            }

            return NextResponse.json({ success: true, message: `Outbound Bag "${bagNumber}" has been SEALED & CLOSED.`, bag });
        }

        if (action === 'close-manifest') {
            const closedTimestamp = new Date().toISOString();
            const closingOperator = operator || 'Staff';

            // Check for open bags under this manifest
            const openBags: string[] = [];
            for (const b of Array.from(outboundBagsMap.values())) {
                if ((b.mawbRef || '').toLowerCase() === (mawbRef || '').toLowerCase() && (b.status === 'OPEN' || b.status !== 'SEALED')) {
                    openBags.push(b.bagNumber);
                }
            }

            if (sb) {
                try {
                    const manifestId = await getManifestDbId(sb, mawbRef);
                    let dbBagsRes;
                    if (manifestId) {
                        dbBagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestId}&status=eq.OPEN&select=bag_number`, { headers: sb.headers, cache: 'no-store' });
                    } else {
                        dbBagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?mawb_ref=eq.${encodeURIComponent(mawbRef)}&status=eq.OPEN&select=bag_number`, { headers: sb.headers, cache: 'no-store' });
                    }
                    const dbBags = await dbBagsRes.json();
                    if (Array.isArray(dbBags)) {
                        for (const b of dbBags) {
                            if (b.bag_number && !openBags.includes(b.bag_number)) {
                                openBags.push(b.bag_number);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error checking open bags in DB for close-manifest:", e);
                }
            }

            if (openBags.length > 0) {
                return NextResponse.json({
                    success: false,
                    error: `Cannot close Manifest "${mawbRef}". The following bag(s) are still OPEN: ${openBags.join(', ')}. Please seal and close all bags under this manifest first.`
                }, { status: 400 });
            }

            manifestsMap.set(mawbRef, { mawbRef, dbId: manifestsMap.get(mawbRef)?.dbId, status: 'CLOSED', closedAt: closedTimestamp, closedBy: closingOperator });

            // ── Bulk: Gather all sealed bags + parcels from DB (authoritative source) ──
            const allBagsForManifestMap = new Map<string, { bagNumber: string; parcels: any[] }>();

            // Step 1 – Collect all bags from memory
            for (const b of Array.from(outboundBagsMap.values())) {
                if ((b.mawbRef || '').toLowerCase() === (mawbRef || '').toLowerCase()) {
                    allBagsForManifestMap.set(b.bagNumber, { bagNumber: b.bagNumber, parcels: b.parcels || [] });
                }
            }

            if (sb) {
                try {
                    // Step 2 – Resolve manifestId for this manifest reference
                    const manifestId = await getManifestDbId(sb, mawbRef);

                    // Step 3 – Fetch all bags for this manifest from DB
                    let dbBagsRes;
                    if (manifestId) {
                        dbBagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestId}&select=bag_number,parcel_count,total_weight,target_partner,parcels`, { headers: sb.headers, cache: 'no-store' });
                    } else {
                        dbBagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?mawb_ref=eq.${encodeURIComponent(mawbRef)}&select=bag_number,parcel_count,total_weight,target_partner,parcels`, { headers: sb.headers, cache: 'no-store' });
                    }
                    const dbBagsRaw = await dbBagsRes.json();

                    if (Array.isArray(dbBagsRaw)) {
                        for (const b of dbBagsRaw) {
                            if (!b.bag_number) continue;
                            // Use JSONB parcels from DB if memory doesn't have it
                            let bagParcels: any[] = [];
                            if (Array.isArray(b.parcels)) bagParcels = b.parcels;
                            else if (typeof b.parcels === 'string') { try { bagParcels = JSON.parse(b.parcels); } catch { bagParcels = []; } }

                            if (!allBagsForManifestMap.has(b.bag_number)) {
                                allBagsForManifestMap.set(b.bag_number, { bagNumber: b.bag_number, parcels: bagParcels });
                            } else if (bagParcels.length > (allBagsForManifestMap.get(b.bag_number)?.parcels.length || 0)) {
                                // Prefer the DB parcel list if it is more complete
                                allBagsForManifestMap.set(b.bag_number, { bagNumber: b.bag_number, parcels: bagParcels });
                            }
                        }
                    }

                    // Step 4 – For every bag, enrich parcel list from outbound_lmd_bag_items (authoritative scan list)
                    for (const [bagNum, bagEntry] of allBagsForManifestMap.entries()) {
                        try {
                            const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNum)}&select=shipment_ref,weight`, { headers: sb.headers, cache: 'no-store' });
                            const items = await itemsRes.json();
                            if (Array.isArray(items) && items.length > 0) {
                                // Build a Set of existing tracking numbers in current parcel list
                                const existingRefs = new Set(bagEntry.parcels.map((p: any) => String(p.trackingNumber || p.reference_number || p.shipment_ref || '').replace(/^skyt-?/i, '').trim().toLowerCase()));
                                for (const item of items) {
                                    const ref = String(item.shipment_ref || '').replace(/^skyt-?/i, '').trim();
                                    if (ref && !existingRefs.has(ref.toLowerCase())) {
                                        bagEntry.parcels.push({ trackingNumber: ref, weight: item.weight || 0.1 });
                                        existingRefs.add(ref.toLowerCase());
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`[close-manifest] Failed to enrich parcel items for bag ${bagNum}:`, e);
                        }
                    }

                    const allBagsList = Array.from(allBagsForManifestMap.values());
                    const allBagNumbers = allBagsList.map(b => b.bagNumber);
                    const totalParcelsCount = allBagsList.reduce((sum, b) => sum + (b.parcels?.length || 0), 0);


                    const closedUserId = (await resolveUserId(sb, body.closedBy ?? body.closed_by ?? body.userId ?? body.user_id)) ?? (await resolveUserId(sb, closingOperator));
                    // Step 6 – Update outbound_manifests with full accurate data
                    const manifestUpdatePayload: any = {
                        bag_numbers: allBagNumbers,
                        total_bags: allBagNumbers.length,
                        total_parcels: totalParcelsCount,
                        status: 'CLOSED',
                        closed_at: closedTimestamp
                    };
                    if (closedUserId) manifestUpdatePayload.closed_by = closedUserId;

                    // Resolve service_provider id from manifest session or body
                    const manifestSession = manifestsMap.get(mawbRef);
                    const resolvedSpId = serviceProviderId ? Number(serviceProviderId) : (manifestSession?.serviceProviderId || null);
                    if (resolvedSpId) manifestUpdatePayload.service_provider = resolvedSpId;

                    // Update outbound_manifests only (no manifest_sessions — that table is for inbound manifests)
                    if (manifestId) {
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, {
                            method: 'PATCH',
                            headers: sb.headers,
                            body: JSON.stringify(manifestUpdatePayload)
                        });
                    } else {
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}`, {
                            method: 'PATCH',
                            headers: sb.headers,
                            body: JSON.stringify(manifestUpdatePayload)
                        });
                    }

                    // Step 7 – Trigger FFDX GETonline upload (bulk) for entire manifest only if not already uploaded
                    let isAlreadyUploaded = false;
                    try {
                        const omCheck = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=id,is_uploaded`, { headers: sb.headers, cache: 'no-store' });
                        const omCheckData = await omCheck.json();
                        if (Array.isArray(omCheckData) && omCheckData.length > 0 && omCheckData[0].is_uploaded === true) {
                            isAlreadyUploaded = true;
                        }
                    } catch { }

                    if (!isAlreadyUploaded) {
                        triggerFfdxUpload({
                            manifestReference: mawbRef,
                            manifestId: manifestId || manifestSession?.dbId,
                            serviceProviderName: body.serviceProviderName || manifestSession?.serviceProviderName || 'All Partners',
                            bags: allBagsList,
                            baseUrl
                        });
                    } else {
                        console.log(`[close-manifest] Manifest "${mawbRef}" was already uploaded to GETonline. Skipping duplicate background trigger.`);
                    }

                } catch (err) {
                    console.error("[close-manifest] Bulk update error:", err);
                }
            }

            return NextResponse.json({ success: true, message: `Manifest "${mawbRef}" has been CLOSED. All parcels and bags updated in bulk.`, manifest: manifestsMap.get(mawbRef) });
        }

        if (action === 'delete-bag') {
            if (!bagNumber) return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });

            const bag = outboundBagsMap.get(bagNumber);
            if (bag && bag.status === 'SEALED') {
                return NextResponse.json({
                    success: false,
                    error: `Cannot delete sealed bag. Outbound Bag "${bagNumber}" is SEALED & CLOSED.`
                }, { status: 400 });
            }

            if (sb) {
                try {
                    const checkRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}&select=status`, { headers: sb.headers, cache: 'no-store' });
                    const checkData = await checkRes.json();
                    if (Array.isArray(checkData) && checkData.length > 0 && checkData[0].status === 'SEALED') {
                        return NextResponse.json({
                            success: false,
                            error: `Cannot delete sealed bag. Outbound Bag "${bagNumber}" is SEALED & CLOSED.`
                        }, { status: 400 });
                    }
                } catch (e) {
                    console.error("Error checking sealed status before bag deletion:", e);
                }
            }

            const targetMawb = mawbRef || bag?.mawbRef;

            outboundBagsMap.delete(bagNumber);

            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'DELETE',
                        headers: sb.headers
                    });
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'DELETE',
                        headers: sb.headers
                    }).catch(e => console.error("Optional bag items delete error:", e));

                    if (targetMawb) {
                        await updateOutboundManifestInDB(sb, targetMawb, serviceProviderId ? Number(serviceProviderId) : null);
                    }
                } catch (err) {
                    console.error("Supabase delete bag error:", err);
                }
            }

            return NextResponse.json({ success: true, message: `Outbound Bag "${bagNumber}" has been deleted successfully.` });
        }

        if (action === 'delete-manifest') {
            const targetRef = mawbRef || body.manifestReference;
            if (!targetRef) return NextResponse.json({ success: false, error: 'Missing manifest reference' }, { status: 400 });

            // Remove from in-memory maps
            manifestsMap.delete(targetRef);
            outboundBagsMap.forEach((bag, bNum) => {
                if ((bag.mawbRef || '').toLowerCase() === targetRef.toLowerCase()) {
                    outboundBagsMap.delete(bNum);
                }
            });

            if (sb) {
                try {
                    const manifestId = await getManifestDbId(sb, targetRef);
                    if (manifestId) {
                        await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestId}`, { method: 'DELETE', headers: sb.headers });
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, { method: 'DELETE', headers: sb.headers });
                    } else {
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(targetRef)}`, { method: 'DELETE', headers: sb.headers });
                    }
                } catch (err) {
                    console.error("Supabase delete manifest error:", err);
                }
            }

            return NextResponse.json({ success: true, message: `Outbound Manifest "${targetRef}" has been deleted successfully.` });
        }

        return NextResponse.json({ success: false, error: 'Invalid action parameter' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    return POST(request);
}
