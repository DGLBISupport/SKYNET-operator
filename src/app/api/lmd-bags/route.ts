import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory cache for outbound LMD dispatch bags (for instant response & backup)
interface OutboundBag {
    bagNumber: string;
    mawbRef: string; // manifest_reference string (display only, resolved from outbound_manifests)
    manifestDbId?: number; // outbound_manifests.id (FK, used for DB queries)
    targetPartner?: 'PickMe' | 'Domex' | 'Pronto' | 'ALL';
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
        let serviceProvidersMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'Pronto' };
        if (sb) {
            try {
                const spRes = await fetch(`${sb.url}/rest/v1/service_providers?select=id,name,code`, { headers: sb.headers, cache: 'no-store' });
                const spData = await spRes.json();
                if (Array.isArray(spData)) spData.forEach((sp: any) => { serviceProvidersMap[sp.id] = sp.name; });

                const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
                const omData = await omRes.json();
                if (Array.isArray(omData)) {
                    manifestsList = omData.map((row: any) => ({
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
                    omData.forEach((row: any) => {
                        if (row.manifest_reference && row.id) {
                            const existing = manifestsMap.get(row.manifest_reference);
                            if (existing) existing.dbId = Number(row.id);
                        }
                    });
                }
            } catch (e) { console.error("Supabase GET outbound_manifests error:", e); }
        }
        manifestsMap.forEach((session, ref) => {
            if (ref && ref.startsWith('LK-') && !manifestsList.some(m => m.manifest_reference === ref)) {
                manifestsList.push({ manifest_reference: ref, bag_numbers: [], total_bags: 0, service_provider: session.serviceProviderId || null, service_provider_name: session.serviceProviderName || 'All Partners', total_parcels: 0, status: session.status });
            }
        });
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
                    else {
                        try {
                            const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}`, { headers: sb.headers });
                            const itemsData = await itemsRes.json();
                            parcels = Array.isArray(itemsData) ? itemsData.map((it: any) => ({ trackingNumber: it.shipment_ref, weight: it.weight || 0.1, scannedBy: it.scanned_by })) : [];
                        } catch (e) { parcels = []; }
                    }
                    const joinedManifest = row.outbound_manifests;
                    const resolvedMawbRef = joinedManifest?.manifest_reference || row.mawb_ref || '';
                    const resolvedManifestDbId = joinedManifest?.id || row.new_manifest_reference || null;
                    const bag: OutboundBag = {
                        bagNumber: row.bag_number, mawbRef: resolvedMawbRef, manifestDbId: resolvedManifestDbId ? Number(resolvedManifestDbId) : undefined,
                        targetPartner: row.target_partner || 'ALL', destinationHub: row.destination_hub, status: row.status as 'OPEN' | 'SEALED',
                        parcelCount: row.parcel_count || parcels.length, totalWeight: row.total_weight || 0, createdAt: row.created_at,
                        sealedAt: row.sealed_at, sealedBy: row.sealed_by, operator: row.created_by || 'Staff', parcels
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
                // Fetch manifest status from outbound_manifests only
                const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=id,status`, { headers: sb.headers, cache: 'no-store' });
                const omData = await omRes.json();
                let manifestStatus: 'OPEN' | 'CLOSED' = 'OPEN';
                let manifestDbId: number | null = null;
                if (Array.isArray(omData) && omData.length > 0) {
                    if (omData[0].status) manifestStatus = omData[0].status as 'OPEN' | 'CLOSED';
                    if (omData[0].id) manifestDbId = Number(omData[0].id);
                }

                // Fetch bags via new_manifest_reference FK (outbound_lmd_bags has no mawb_ref column)
                let bagsData: any[] = [];
                if (manifestDbId) {
                    const bagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?new_manifest_reference=eq.${manifestDbId}&order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
                    const fetchedBags = await bagsRes.json();
                    if (Array.isArray(fetchedBags)) bagsData = fetchedBags;
                }

                if (Array.isArray(bagsData)) {
                    const dbBags: OutboundBag[] = bagsData.map((row: any) => {
                        let parcels: any[] = [];
                        if (Array.isArray(row.parcels)) parcels = row.parcels;
                        else if (typeof row.parcels === 'string') { try { parcels = JSON.parse(row.parcels); } catch (e) { parcels = []; } }
                        return {
                            bagNumber: row.bag_number, mawbRef: mawbRef,
                            manifestDbId: row.new_manifest_reference ? Number(row.new_manifest_reference) : (manifestDbId || undefined),
                            targetPartner: row.target_partner || 'ALL', destinationHub: row.destination_hub, status: row.status as 'OPEN' | 'SEALED',
                            parcelCount: row.parcel_count || parcels.length, totalWeight: row.total_weight || 0, createdAt: row.created_at,
                            sealedAt: row.sealed_at, sealedBy: row.sealed_by, operator: row.created_by || 'Staff', parcels
                        } as OutboundBag;
                    });
                    outboundBagsMap.forEach((bag, bNum) => { if (bag.mawbRef.toLowerCase() === mawbRef.toLowerCase()) outboundBagsMap.delete(bNum); });
                    dbBags.forEach((bag) => outboundBagsMap.set(bag.bagNumber, bag));
                    manifestsMap.set(mawbRef, { mawbRef, dbId: manifestDbId || undefined, status: manifestStatus });
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
        const { action, mawbRef, bagNumber, partner, destinationHub, operator, parcelCount, totalWeight, parcels, providerName, serviceProviderId } = body;
        const effectiveMawbRef = mawbRef || 'GENERAL';
        const sb = getSupabaseConfig();
        const baseUrl = getBaseUrl(request);

        if (action === 'create-manifest') {
            const providerCode = (providerName || partner || 'PICKME').toUpperCase().replace(/\s+/g, '');
            const todayStr = getFormattedDateDDMMYYYY();
            const prefixPattern = `LK-${providerCode}-${todayStr}-`;
            let spId: number | null = serviceProviderId ? Number(serviceProviderId) : null;
            const seqs: number[] = [];

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
                            else if (providerCode.includes('PRONTO')) spId = 3;
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

            let nextSeq = seqs.length > 0 ? Math.max(...seqs, 0) + 1 : 1;
            let manifestReference = `${prefixPattern}${String(nextSeq).padStart(2, '0')}`;

            // Safety loop: ensure manifestReference is completely unique
            while (manifestsMap.has(manifestReference)) {
                nextSeq++;
                manifestReference = `${prefixPattern}${String(nextSeq).padStart(2, '0')}`;
            }
            manifestsMap.set(manifestReference, { mawbRef: manifestReference, status: 'OPEN', serviceProviderId: spId || undefined, serviceProviderName: providerName || partner || 'PickMe' });
            let newManifestDbId: number | null = null;
            if (sb) {
                try {
                    const insertRes = await fetch(`${sb.url}/rest/v1/outbound_manifests`, {
                        method: 'POST', headers: sb.headers,
                        body: JSON.stringify({ manifest_reference: manifestReference, bag_numbers: [], total_bags: 0, service_provider: spId, total_parcels: 0, created_by: 1, status: 'OPEN' })
                    });
                    const insertData = await insertRes.json();
                    if (Array.isArray(insertData) && insertData.length > 0 && insertData[0].id) {
                        newManifestDbId = Number(insertData[0].id);
                        const session = manifestsMap.get(manifestReference);
                        if (session) session.dbId = newManifestDbId;
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
            const partnerCode = partner && partner !== 'ALL' ? `-${partner.toUpperCase()}` : '';
            const defaultBagNumber = `${mawbRef ? mawbRef : 'LMD'}${partnerCode}-BAG-${String(nextIndex).padStart(2, '0')}`;
            const newBagNumber = (body.customBagNumber || body.bagNumber || defaultBagNumber).trim();
            const manifestDbId: number | null = mawbRef ? await getManifestDbId(sb, mawbRef) : null;
            const newBag: OutboundBag = {
                bagNumber: newBagNumber, mawbRef: effectiveMawbRef, manifestDbId: manifestDbId || undefined,
                targetPartner: partner || 'ALL', destinationHub: destinationHub || (partner && partner !== 'ALL' ? `${partner}` : 'Main Sort Hub'),
                status: 'OPEN', parcelCount: 0, totalWeight: 0, createdAt: new Date().toISOString(), operator: operator || 'Staff', parcels: []
            };
            outboundBagsMap.set(newBagNumber, newBag);
            if (mawbRef && !manifestsMap.has(mawbRef)) manifestsMap.set(mawbRef, { mawbRef, dbId: manifestDbId || undefined, status: 'OPEN' });
            if (sb) {
                try {
                    // outbound_lmd_bags links to outbound_manifests via new_manifest_reference (no mawb_ref column)
                    const bagPayload: any = {
                        bag_number: newBagNumber, target_partner: partner || 'ALL', destination_hub: newBag.destinationHub,
                        status: 'OPEN', parcel_count: 0, total_weight: 0, created_by: operator || 'Staff',
                        is_bag_in_a_manifest: !!manifestDbId
                    };
                    if (manifestDbId) bagPayload.new_manifest_reference = manifestDbId;
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags`, { method: 'POST', headers: sb.headers, body: JSON.stringify(bagPayload) });
                    await updateOutboundManifestInDB(sb, effectiveMawbRef, serviceProviderId ? Number(serviceProviderId) : null, newBagNumber);
                } catch (err) { console.error("Supabase insert outbound_lmd_bags error:", err); }
            }
            return NextResponse.json({ success: true, message: `New Outbound LMD Bag "${newBagNumber}" created successfully.`, bag: newBag });
        }

        if (action === 'add-parcel') {
            if (!bagNumber) return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) bag = { bagNumber, mawbRef: mawbRef, targetPartner: partner || body.targetPartner || 'ALL', destinationHub: destinationHub || 'Main Sort Hub', status: 'OPEN', parcelCount: 0, totalWeight: 0, createdAt: new Date().toISOString(), operator: operator || 'Staff', parcels: [] };
            if (bag.status === 'SEALED') return NextResponse.json({ success: false, error: `Bag "${bagNumber}" is SEALED & CLOSED. No additional parcels can be added.` }, { status: 400 });
            const newParcel = body.parcel;
            if (newParcel) {
                bag.parcels.unshift(newParcel);
                bag.parcelCount = bag.parcels.length;
                bag.totalWeight = Number((bag.parcels.reduce((acc, p) => acc + (Number(p.weight) || 0.1), 0)).toFixed(2));
            }
            outboundBagsMap.set(bagNumber, bag);
            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify({ parcel_count: bag.parcelCount, total_weight: bag.totalWeight, parcels: bag.parcels || [] }) });
                    if (newParcel) {
                        const tracking = newParcel.trackingNumber || newParcel.reference_number;
                        if (tracking) await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items`, { method: 'POST', headers: sb.headers, body: JSON.stringify({ bag_number: bagNumber, shipment_ref: tracking, weight: Number(newParcel.weight) || 0.1, scanned_by: operator || 'Staff' }) }).catch(e => console.error("Optional bag items table update ignored:", e));
                    }
                    if (bag.mawbRef) await updateOutboundManifestInDB(sb, bag.mawbRef, serviceProviderId ? Number(serviceProviderId) : null);
                } catch (err) { console.error("Supabase add-parcel update error:", err); }
            }

            return NextResponse.json({ success: true, bag });
        }

        if (action === 'seal') {
            if (!bagNumber) return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            const sealedTimestamp = new Date().toISOString();
            const sealingOperator = operator || 'Staff';
            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                bag = { bagNumber, mawbRef: mawbRef, targetPartner: partner || body.targetPartner || 'ALL', destinationHub: destinationHub || 'Main Sort Hub', status: 'SEALED', parcelCount: parcelCount || 0, totalWeight: totalWeight || 0, createdAt: sealedTimestamp, sealedAt: sealedTimestamp, sealedBy: sealingOperator, operator: sealingOperator, parcels: parcels || [] };
            } else {
                bag.status = 'SEALED'; bag.sealedAt = sealedTimestamp; bag.sealedBy = sealingOperator;
                if (parcelCount !== undefined) bag.parcelCount = parcelCount;
                if (totalWeight !== undefined) bag.totalWeight = totalWeight;
                if (parcels) bag.parcels = parcels;
            }
            outboundBagsMap.set(bagNumber, bag);
            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify({ status: 'SEALED', sealed_at: sealedTimestamp, sealed_by: sealingOperator, parcel_count: bag.parcelCount, total_weight: bag.totalWeight, parcels: bag.parcels || [] }) });
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


                    // Step 6 – Update outbound_manifests with full accurate data
                    const manifestUpdatePayload: any = {
                        bag_numbers: allBagNumbers,
                        total_bags: allBagNumbers.length,
                        total_parcels: totalParcelsCount,
                        status: 'CLOSED'
                    };

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

                    // Step 7 – Trigger FFDX GETonline upload (bulk) for entire manifest
                    triggerFfdxUpload({
                        manifestReference: mawbRef,
                        manifestId: manifestId || manifestSession?.dbId,
                        serviceProviderName: body.serviceProviderName || manifestSession?.serviceProviderName || 'All Partners',
                        bags: allBagsList,
                        baseUrl
                    });

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

        return NextResponse.json({ success: false, error: 'Invalid action parameter' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    return POST(request);
}
