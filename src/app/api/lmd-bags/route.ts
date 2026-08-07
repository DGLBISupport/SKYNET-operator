import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory cache for outbound LMD dispatch bags (for instant response & backup)
interface OutboundBag {
    bagNumber: string;
    mawbRef: string;
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
    status: 'OPEN' | 'CLOSED';
    closedAt?: string;
    closedBy?: string;
}

const outboundBagsMap = new Map<string, OutboundBag>();
const manifestsMap = new Map<string, ManifestSession>();

const getSupabaseConfig = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    const { searchParams } = new URL(request.url);
    const mawbRef = searchParams.get('mawbRef');
    const bagNumber = searchParams.get('bagNumber');

    const sb = getSupabaseConfig();

    if (bagNumber) {
        // Try fetching specific bag from Supabase
        if (sb) {
            try {
                const bagRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, { headers: sb.headers });
                const bagsData = await bagRes.json();
                if (Array.isArray(bagsData) && bagsData.length > 0) {
                    const row = bagsData[0];
                    let parcels: any[] = [];
                    if (Array.isArray(row.parcels)) {
                        parcels = row.parcels;
                    } else if (typeof row.parcels === 'string') {
                        try { parcels = JSON.parse(row.parcels); } catch (e) { parcels = []; }
                    } else {
                        try {
                            const itemsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bagNumber)}`, { headers: sb.headers });
                            const itemsData = await itemsRes.json();
                            parcels = Array.isArray(itemsData) ? itemsData.map((it: any) => ({
                                trackingNumber: it.shipment_ref,
                                weight: it.weight || 0.1,
                                scannedBy: it.scanned_by
                            })) : [];
                        } catch (e) { parcels = []; }
                    }

                    const bag: OutboundBag = {
                        bagNumber: row.bag_number,
                        mawbRef: row.mawb_ref,
                        targetPartner: row.target_partner || 'ALL',
                        destinationHub: row.destination_hub,
                        status: row.status as 'OPEN' | 'SEALED',
                        parcelCount: row.parcel_count || parcels.length,
                        totalWeight: row.total_weight || 0,
                        createdAt: row.created_at,
                        sealedAt: row.sealed_at,
                        sealedBy: row.sealed_by,
                        operator: row.created_by || 'Staff',
                        parcels
                    };
                    outboundBagsMap.set(bagNumber, bag);
                    return NextResponse.json({ success: true, bag });
                }
            } catch (e) {
                console.error("Supabase GET bag error:", e);
            }
        }

        const bag = outboundBagsMap.get(bagNumber);
        if (!bag) {
            return NextResponse.json({ success: false, error: `Bag "${bagNumber}" not found.` }, { status: 404 });
        }
        return NextResponse.json({ success: true, bag });
    }

    if (mawbRef) {
        if (sb) {
            try {
                // Fetch bags for this MAWB from Supabase DB
                const bagsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?mawb_ref=eq.${encodeURIComponent(mawbRef)}&order=created_at.desc`, { headers: sb.headers, cache: 'no-store' });
                const bagsData = await bagsRes.json();

                // Fetch manifest session from DB
                const manifestRes = await fetch(`${sb.url}/rest/v1/manifest_sessions?mawb_ref=eq.${encodeURIComponent(mawbRef)}`, { headers: sb.headers, cache: 'no-store' });
                const manifestData = await manifestRes.json();
                const manifestStatus = Array.isArray(manifestData) && manifestData.length > 0 ? manifestData[0].status : 'OPEN';

                if (Array.isArray(bagsData)) {
                    const dbBags: OutboundBag[] = bagsData.map((row: any) => {
                        let parcels: any[] = [];
                        if (Array.isArray(row.parcels)) {
                            parcels = row.parcels;
                        } else if (typeof row.parcels === 'string') {
                            try { parcels = JSON.parse(row.parcels); } catch (e) { parcels = []; }
                        }
                        const b: OutboundBag = {
                            bagNumber: row.bag_number,
                            mawbRef: row.mawb_ref,
                            targetPartner: row.target_partner || 'ALL',
                            destinationHub: row.destination_hub,
                            status: row.status as 'OPEN' | 'SEALED',
                            parcelCount: row.parcel_count || parcels.length,
                            totalWeight: row.total_weight || 0,
                            createdAt: row.created_at,
                            sealedAt: row.sealed_at,
                            sealedBy: row.sealed_by,
                            operator: row.created_by || 'Staff',
                            parcels
                        };
                        return b;
                    });

                    outboundBagsMap.forEach((bag, bagNumber) => {
                        if (bag.mawbRef.toLowerCase() === mawbRef.toLowerCase()) {
                            outboundBagsMap.delete(bagNumber);
                        }
                    });

                    dbBags.forEach((bag) => outboundBagsMap.set(bag.bagNumber, bag));
                    manifestsMap.set(mawbRef, { mawbRef, status: manifestStatus });

                    return NextResponse.json({
                        success: true,
                        mawbRef,
                        manifestStatus,
                        bags: dbBags
                    });
                }
            } catch (e) {
                console.error("Supabase GET mawbRef bags error:", e);
            }
        }

        const bags = Array.from(outboundBagsMap.values()).filter(b => b.mawbRef.toLowerCase() === mawbRef.toLowerCase());
        const manifestSession = manifestsMap.get(mawbRef) || { mawbRef, status: 'OPEN' };
        return NextResponse.json({
            success: true,
            mawbRef,
            manifestStatus: manifestSession.status,
            bags
        });
    }

    return NextResponse.json({
        success: true,
        bags: Array.from(outboundBagsMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        manifests: Array.from(manifestsMap.values())
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, mawbRef, bagNumber, partner, destinationHub, operator, parcelCount, totalWeight, parcels } = body;
        const effectiveMawbRef = mawbRef || 'GENERAL';

        const sb = getSupabaseConfig();

        // Check if manifest is closed
        if (mawbRef) {
            const manifestSession = manifestsMap.get(mawbRef);
            if (manifestSession && manifestSession.status === 'CLOSED' && action === 'create') {
                return NextResponse.json({
                    success: false,
                    error: `Manifest "${mawbRef}" is CLOSED. No additional bags can be created under this manifest.`
                }, { status: 400 });
            }
        }

        // ACTION: CREATE NEW LMD OUTBOUND BAG
        if (action === 'create') {
            const existingBags = Array.from(outboundBagsMap.values()).filter(b => (b.mawbRef || 'GENERAL').toLowerCase() === effectiveMawbRef.toLowerCase());
            const nextIndex = existingBags.length + 1;
            const formattedIndex = String(nextIndex).padStart(2, '0');
            const partnerCode = partner && partner !== 'ALL' ? `-${partner.toUpperCase()}` : '';
            const mawbPrefix = mawbRef ? mawbRef : 'LMD';
            const defaultBagNumber = `${mawbPrefix}${partnerCode}-BAG-${formattedIndex}`;
            const newBagNumber = (body.customBagNumber || body.bagNumber || defaultBagNumber).trim();

            const newBag: OutboundBag = {
                bagNumber: newBagNumber,
                mawbRef: effectiveMawbRef,
                targetPartner: partner || 'ALL',
                destinationHub: destinationHub || (partner && partner !== 'ALL' ? `${partner}` : 'Main Sort Hub'),
                status: 'OPEN',
                parcelCount: 0,
                totalWeight: 0,
                createdAt: new Date().toISOString(),
                operator: operator || 'Staff',
                parcels: []
            };

            outboundBagsMap.set(newBagNumber, newBag);
            if (mawbRef && !manifestsMap.has(mawbRef)) {
                manifestsMap.set(mawbRef, { mawbRef, status: 'OPEN' });
            }

            // Persist to Supabase Postgres DB
            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags`, {
                        method: 'POST',
                        headers: sb.headers,
                        body: JSON.stringify({
                            mawb_ref: effectiveMawbRef,
                            bag_number: newBagNumber,
                            target_partner: partner || 'ALL',
                            destination_hub: newBag.destinationHub,
                            status: 'OPEN',
                            parcel_count: 0,
                            total_weight: 0,
                            created_by: operator || 'Staff'
                        })
                    });

                    if (mawbRef) {
                        await fetch(`${sb.url}/rest/v1/manifest_sessions`, {
                            method: 'POST',
                            headers: { ...sb.headers, "Prefer": "resolution=merge-duplicates" },
                            body: JSON.stringify({
                                mawb_ref: mawbRef,
                                status: 'OPEN'
                            })
                        });
                    }
                } catch (err) {
                    console.error("Supabase insert outbound_lmd_bags error:", err);
                }
            }

            return NextResponse.json({
                success: true,
                message: `New Outbound LMD Bag "${newBagNumber}" created successfully.`,
                bag: newBag
            });
        }

        // ACTION: ADD PARCEL TO ACTIVE BAG
        if (action === 'add-parcel') {
            if (!bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            }
            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                bag = {
                    bagNumber: bagNumber,
                    mawbRef: mawbRef,
                    targetPartner: partner || body.targetPartner || 'ALL',
                    destinationHub: destinationHub || 'Main Sort Hub',
                    status: 'OPEN',
                    parcelCount: 0,
                    totalWeight: 0,
                    createdAt: new Date().toISOString(),
                    operator: operator || 'Staff',
                    parcels: []
                };
            }

            if (bag.status === 'SEALED') {
                return NextResponse.json({
                    success: false,
                    error: `Bag "${bagNumber}" is SEALED & CLOSED. No additional parcels can be added.`
                }, { status: 400 });
            }

            // Append parcel and update metrics
            const newParcel = body.parcel;
            if (newParcel) {
                bag.parcels.unshift(newParcel);
                bag.parcelCount = bag.parcels.length;
                bag.totalWeight = Number((bag.parcels.reduce((acc, p) => acc + (Number(p.weight) || 0.1), 0)).toFixed(2));
            }

            outboundBagsMap.set(bagNumber, bag);

            // Persist parcel addition to Supabase DB
            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'PATCH',
                        headers: sb.headers,
                        body: JSON.stringify({
                            parcel_count: bag.parcelCount,
                            total_weight: bag.totalWeight,
                            parcels: bag.parcels || []
                        })
                    });

                    if (newParcel) {
                        const tracking = newParcel.trackingNumber || newParcel.reference_number;
                        if (tracking) {
                            await fetch(`${sb.url}/rest/v1/outbound_lmd_bag_items`, {
                                method: 'POST',
                                headers: sb.headers,
                                body: JSON.stringify({
                                    bag_number: bagNumber,
                                    shipment_ref: tracking,
                                    weight: Number(newParcel.weight) || 0.1,
                                    scanned_by: operator || 'Staff'
                                })
                            }).catch(e => console.error("Optional bag items table update ignored:", e));
                        }
                    }
                } catch (err) {
                    console.error("Supabase add-parcel update error:", err);
                }
            }

            return NextResponse.json({ success: true, bag });
        }

        // ACTION: SEAL & CLOSE BAG
        if (action === 'seal') {
            if (!bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            }
            const sealedTimestamp = new Date().toISOString();
            const sealingOperator = operator || 'Staff';

            let bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                bag = {
                    bagNumber: bagNumber,
                    mawbRef: mawbRef,
                    targetPartner: partner || body.targetPartner || 'ALL',
                    destinationHub: destinationHub || 'Main Sort Hub',
                    status: 'SEALED',
                    parcelCount: parcelCount || 0,
                    totalWeight: totalWeight || 0,
                    createdAt: sealedTimestamp,
                    sealedAt: sealedTimestamp,
                    sealedBy: sealingOperator,
                    operator: sealingOperator,
                    parcels: parcels || []
                };
            } else {
                bag.status = 'SEALED';
                bag.sealedAt = sealedTimestamp;
                bag.sealedBy = sealingOperator;
                if (parcelCount !== undefined) bag.parcelCount = parcelCount;
                if (totalWeight !== undefined) bag.totalWeight = totalWeight;
                if (parcels) bag.parcels = parcels;
            }

            outboundBagsMap.set(bagNumber, bag);

            // Persist SEALED status and operator details to Supabase Postgres DB
            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bagNumber)}`, {
                        method: 'PATCH',
                        headers: sb.headers,
                        body: JSON.stringify({
                            status: 'SEALED',
                            sealed_at: sealedTimestamp,
                            sealed_by: sealingOperator,
                            parcel_count: bag.parcelCount,
                            total_weight: bag.totalWeight,
                            parcels: bag.parcels || []
                        })
                    });

                    // Note: bag items are already recorded row-by-row during 'add-parcel'.
                    // Do NOT re-insert them here to avoid duplicate scanned_by entries.

                } catch (err) {
                    console.error("Supabase seal bag update error:", err);
                }
            }

            return NextResponse.json({
                success: true,
                message: `Outbound Bag "${bagNumber}" has been SEALED & CLOSED.`,
                bag
            });
        }

        // ACTION: CLOSE MANIFEST
        if (action === 'close-manifest') {
            const closedTimestamp = new Date().toISOString();
            const closingOperator = operator || 'Staff';

            manifestsMap.set(mawbRef, {
                mawbRef,
                status: 'CLOSED',
                closedAt: closedTimestamp,
                closedBy: closingOperator
            });

            if (sb) {
                try {
                    await fetch(`${sb.url}/rest/v1/manifest_sessions`, {
                        method: 'POST',
                        headers: { ...sb.headers, "Prefer": "resolution=merge-duplicates" },
                        body: JSON.stringify({
                            mawb_ref: mawbRef,
                            status: 'CLOSED',
                            closed_at: closedTimestamp,
                            closed_by: closingOperator
                        })
                    });
                } catch (err) {
                    console.error("Supabase close manifest error:", err);
                }
            }

            return NextResponse.json({
                success: true,
                message: `Manifest "${mawbRef}" has been CLOSED. No additional bags can be created.`,
                manifest: manifestsMap.get(mawbRef)
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid action parameter' }, { status: 400 });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
    }
}
