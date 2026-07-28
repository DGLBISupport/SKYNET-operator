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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim();
        const typeFilter = searchParams.get('type') || 'ALL'; // ALL | tracking | bag | manifest | box

        if (!query) {
            return NextResponse.json({ success: true, query: '', results: { parcels: [], bags: [], manifests: [], unsealedBoxes: [] } });
        }

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
        }

        const cleanQ = encodeURIComponent(query);

        let parcels: any[] = [];
        let bags: any[] = [];
        let manifests: any[] = [];
        let unsealedBoxes: any[] = [];

        // 1. SEARCH SHIPMENTS (Parcels by tracking number, Temu barcode, Bag number, or MAWB)
        try {
            const shipRes = await fetch(
                `${sb.url}/rest/v1/shipments?or=(reference_number.ilike.*${cleanQ}*,sender_reference.ilike.*${cleanQ}*,bag_number.ilike.*${cleanQ}*,mawb_reference.ilike.*${cleanQ}*)&limit=50`,
                { headers: sb.headers }
            );
            if (shipRes.ok) {
                const shipData = await shipRes.json();
                if (Array.isArray(shipData) && shipData.length > 0) {
                    let partnerMap: Record<string, string> = {};
                    const refs = shipData.map((s: any) => s.reference_number).filter(Boolean);
                    if (refs.length > 0) {
                        const refsQuery = refs.map((r: string) => `shipment_ref.eq.${encodeURIComponent(r)}`).join(',');
                        try {
                            const spaRes = await fetch(
                                `${sb.url}/rest/v1/service_provider_allocation?or=(${refsQuery})&select=shipment_ref,service_provider`,
                                { headers: sb.headers }
                            );
                            if (spaRes.ok) {
                                const spaData = await spaRes.json();
                                const spRes = await fetch(`${sb.url}/rest/v1/service_providers?select=id,name`, { headers: sb.headers });
                                if (spRes.ok) {
                                    const spData = await spRes.json();
                                    const spMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex' };
                                    (spData || []).forEach((sp: any) => {
                                        spMap[sp.id] = sp.name;
                                    });
                                    (spaData || []).forEach((alloc: any) => {
                                        if (alloc.shipment_ref && alloc.service_provider) {
                                            const spNum = Number(alloc.service_provider);
                                            let name = spMap[spNum] || spMap[alloc.service_provider] || 'Unknown';
                                            if (name.toLowerCase().includes('pickme')) name = 'PickMe';
                                            else if (name.toLowerCase().includes('domex')) name = 'Domex';
                                            else if (name.toLowerCase().includes('pronto')) name = 'Pronto';
                                            partnerMap[alloc.shipment_ref] = name;
                                        }
                                    });
                                }
                            }
                        } catch (err) {
                            console.error("Error loading allocations in search:", err);
                        }
                    }

                    parcels = shipData.map(s => ({
                        referenceNumber: s.reference_number,
                        trackingNumber: s.reference_number,
                        senderReference: s.sender_reference || s.alternate_reference || '',
                        mawbRef: s.mawb_reference || '',
                        bagNumber: s.bag_number || '',
                        consigneeName: s.consignee_name || 'Unknown Recipient',
                        consigneeAddress: s.consignee_address_1 || s.consignee_address_3 || '',
                        city: s.consignee_location_name || s.consignee_address_3 || 'Unknown City',
                        assignedPartner: partnerMap[s.reference_number] || 'Unknown',
                        assignedZone: s.delivery_route_code || 'Default-Zone',
                        weight: s.weight || s.dead_weight || 0.1,
                        goodsDescription: s.goods_description || '',
                        createdAt: s.created_at || s.updated_at || ''
                    }));
                }
            }
        } catch (e) {
            console.error("Search shipments error:", e);
        }

        // 2. SEARCH OUTBOUND LMD BAGS (By Bag Number, MAWB Ref, or Destination Hub)
        try {
            const bagRes = await fetch(
                `${sb.url}/rest/v1/outbound_lmd_bags?or=(bag_number.ilike.*${cleanQ}*,mawb_ref.ilike.*${cleanQ}*,destination_hub.ilike.*${cleanQ}*)&order=created_at.desc&limit=30`,
                { headers: sb.headers }
            );
            if (bagRes.ok) {
                const bagData = await bagRes.json();
                if (Array.isArray(bagData)) {
                    bags = bagData.map(b => {
                        let parsedParcels: any[] = [];
                        if (Array.isArray(b.parcels)) parsedParcels = b.parcels;
                        else if (typeof b.parcels === 'string') {
                            try { parsedParcels = JSON.parse(b.parcels); } catch (e) { parsedParcels = []; }
                        }
                        return {
                            id: b.id,
                            bagNumber: b.bag_number,
                            mawbRef: b.mawb_ref,
                            targetPartner: b.target_partner || 'ALL',
                            destinationHub: b.destination_hub,
                            status: b.status,
                            parcelCount: b.parcel_count || parsedParcels.length,
                            totalWeight: b.total_weight || 0,
                            createdBy: b.created_by || 'Staff',
                            createdAt: b.created_at,
                            sealedAt: b.sealed_at,
                            sealedBy: b.sealed_by,
                            parcels: parsedParcels
                        };
                    });
                }
            }
        } catch (e) {
            console.error("Search outbound bags error:", e);
        }

        // 3. SEARCH MANIFEST SESSIONS (By MAWB Reference)
        try {
            const manRes = await fetch(
                `${sb.url}/rest/v1/manifest_sessions?mawb_ref.ilike.*${cleanQ}*&limit=20`,
                { headers: sb.headers }
            );
            if (manRes.ok) {
                const manData = await manRes.json();
                if (Array.isArray(manData)) {
                    manifests = manData.map(m => ({
                        mawbRef: m.mawb_ref,
                        status: m.status,
                        closedAt: m.closed_at,
                        closedBy: m.closed_by
                    }));
                }
            }
        } catch (e) {
            console.error("Search manifest sessions error:", e);
        }

        // 4. SEARCH BAG UNSEALING / BOX SESSIONS (By Bag Number or MAWB Ref)
        try {
            const unsealRes = await fetch(
                `${sb.url}/rest/v1/bag_unsealing?or=(bag_number.ilike.*${cleanQ}*,mawb_ref.ilike.*${cleanQ}*)&order=created_at.desc&limit=30`,
                { headers: sb.headers }
            );
            if (unsealRes.ok) {
                const unsealData = await unsealRes.json();
                if (Array.isArray(unsealData)) {
                    unsealedBoxes = unsealData.map(u => ({
                        id: u.id,
                        mawbRef: u.mawb_ref,
                        bagNumber: u.bag_number,
                        expectedCount: u.expected_count,
                        scannedCount: u.scanned_count,
                        status: u.status,
                        unsealedBy: u.unsealed_by || u.operator || 'Staff',
                        createdAt: u.created_at,
                        scannedParcels: u.scanned_parcels || []
                    }));
                }
            }
        } catch (e) {
            console.error("Search bag unsealing error:", e);
        }

        return NextResponse.json({
            success: true,
            query,
            typeFilter,
            results: {
                parcels,
                bags,
                manifests,
                unsealedBoxes
            }
        });

    } catch (err: any) {
        console.error("Global search API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
