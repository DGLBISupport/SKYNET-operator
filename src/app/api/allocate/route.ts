import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkyNetParcelData } from '@/types';

// In-memory cache for static/semi-static configuration lookups to avoid redundant database calls
const cache = {
    providers: new Map<number, string>(),
    cities: new Map<number, any>(),
    zones: new Map<number, string>(),
    mawbs: new Map<string, any>()
};

const cleanAddress = (...parts: (string | null | undefined)[]) => {
    return parts.filter(p => p && p.trim() !== "").map(p => p.trim()).join(", ");
};

async function resolveZoneAndPartner(
    supabaseUrl: string,
    headers: any,
    shipment: any,
    allocation?: any
) {
    const spId = allocation?.service_provider;
    const mappedCityId = allocation?.mapped_city;
    let cityName = shipment.consignee_location_name || "";
    let districtName = shipment.consignee_address_3 || "";
    const shipmentRef = shipment.reference_number;

    const cityPromise = mappedCityId
        ? (cache.cities.has(mappedCityId)
            ? Promise.resolve(cache.cities.get(mappedCityId))
            : fetch(`${supabaseUrl}/rest/v1/district_city_mapping?id=eq.${mappedCityId}`, { headers })
                .then(res => res.json())
                .then(data => {
                    const val = data && data[0];
                    if (val) cache.cities.set(mappedCityId, val);
                    return val;
                }))
        : (cityName
            ? fetch(`${supabaseUrl}/rest/v1/district_city_mapping?city=ilike.${cityName}`, { headers })
                .then(res => res.json())
                .then(data => {
                    const val = data && data[0];
                    return val;
                })
            : Promise.resolve(null));

    const mappedCity = await cityPromise;

    if (mappedCity) {
        cityName = mappedCity.city || cityName;
        districtName = mappedCity.area_name || districtName;
    }

    // Resolve zone using cache fallback
    let assignedZone = "Default-Zone";
    if (mappedCity && mappedCity.zone) {
        const zoneId = mappedCity.zone;
        if (cache.zones.has(zoneId)) {
            assignedZone = cache.zones.get(zoneId)!;
        } else {
            const zoneRes = await fetch(`${supabaseUrl}/rest/v1/zones?id=eq.${zoneId}`, { headers });
            const zones = await zoneRes.json();
            if (zones && zones[0]) {
                assignedZone = zones[0].zone_name || "Default-Zone";
                cache.zones.set(zoneId, assignedZone);
            }
        }
    }

    if (assignedZone === 'Zone-E02') {
        assignedZone = 'Zone C';
    }

    // Resolve partner
    let assignedPartner = "Unknown";
    if (!spId) {
        // Allocate dynamically: PickMe (1) or Domex (2)
        if (assignedZone.toLowerCase().includes('b') || assignedZone.toLowerCase().includes('c') || shipmentRef % 2 === 0) {
            assignedPartner = 'Domex';
        } else {
            assignedPartner = 'PickMe';
        }
    } else {
        // Retrieve provider name from cache or DB
        if (cache.providers.has(spId)) {
            assignedPartner = cache.providers.get(spId)!;
        } else {
            const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?id=eq.${spId}`, { headers });
            const providers = await spRes.json();
            if (providers && providers[0]) {
                assignedPartner = providers[0].name || "Unknown";
                cache.providers.set(spId, assignedPartner);
            }
        }
        if (assignedPartner.toLowerCase() === 'pickme') assignedPartner = 'PickMe';
        else if (assignedPartner.toLowerCase() === 'domex') assignedPartner = 'Domex';
        else if (assignedPartner.toLowerCase() === 'pronto') assignedPartner = 'Pronto';
    }

    return { assignedZone, assignedPartner, mappedCity };
}

export async function POST(request: Request) {
    try {
        const { 
            trackingNumber, 
            stage = 'second', 
            mawbRef, 
            bagNumber, 
            expectedCount, 
            scannedCount, 
            status: bagStatus,
            overrideBag,
            registerExtra,
            extraNote,
            operator
        } = await request.json();

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        const headers = {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
        };

        // ═══════════════════════════════════════════════════════
        // STAGE: FINISH BAG (SAVE UNSEALED BAG RECORD)
        // ═══════════════════════════════════════════════════════
        if (stage === 'finish-bag') {
            if (!mawbRef || !bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing required unsealing parameters.' }, { status: 400 });
            }

            const discrepancy = (scannedCount || 0) - (expectedCount || 0);

            const insertRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing`, {
                method: 'POST',
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    mawb_ref: mawbRef,
                    bag_number: bagNumber,
                    expected_count: expectedCount || 0,
                    scanned_count: scannedCount || 0,
                    discrepancy: discrepancy,
                    status: bagStatus || 'COUNTED',
                    unsealed_by: operator || 'Unknown'
                })
            });

            if (!insertRes.ok) {
                const errText = await insertRes.text();
                if (errText.includes('23505') || insertRes.status === 409) {
                    return NextResponse.json({ success: false, error: `Bag "${bagNumber}" has already been unsealed.` }, { status: 409 });
                }
                return NextResponse.json({ success: false, error: `Failed to save bag unsealing: ${errText}` }, { status: 500 });
            }

            const data = await insertRes.json();
            return NextResponse.json({ success: true, data: data[0] });
        }

        if (!trackingNumber) {
            return NextResponse.json({ success: false, error: 'Missing tracking number' }, { status: 400 });
        }

        let resolvedShipment: any = null;
        let shipmentRef: number;

        const isNumeric = /^\d+$/.test(trackingNumber.trim());

        if (isNumeric) {
            shipmentRef = parseInt(trackingNumber.trim(), 10);
        } else {
            // Find by sender_reference (Temu barcode)
            const temuRes = await fetch(`${supabaseUrl}/rest/v1/shipments?sender_reference=eq.${trackingNumber.trim()}`, { headers });
            if (temuRes.ok) {
                const shipments = await temuRes.json();
                if (shipments && shipments[0]) {
                    resolvedShipment = shipments[0];
                    shipmentRef = resolvedShipment.reference_number;
                } else {
                    return NextResponse.json({
                        success: false,
                        error: `No shipment found matching Temu barcode "${trackingNumber}".`
                    }, { status: 404 });
                }
            } else {
                const errText = await temuRes.text();
                return NextResponse.json({ success: false, error: `Database search by Temu barcode failed: ${errText}` }, { status: 500 });
            }
        }

        // ═══════════════════════════════════════════════════════
        // STAGE 1 — BOX UNSEALING (FIRST SCAN)
        // ═══════════════════════════════════════════════════════
        if (stage === 'first') {
            // 1. Fetch shipment details to check if barcode is valid
            let shipment = resolvedShipment;
            if (!shipment) {
                const shipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${shipmentRef}`, { headers });
                const shipments = await shipRes.json();
                shipment = shipments && shipments[0];
            }

            // Handle registerExtra if shipment is NOT found
            if (!shipment && registerExtra) {
                let trackingStr = trackingNumber.trim();
                let refToInsert = shipmentRef;
                if (!isNumeric) {
                    refToInsert = Math.floor(100000000 + Math.random() * 900000000);
                }
                const newShipment = {
                    reference_number: refToInsert,
                    bag_number: bagNumber,
                    mawb_ref: mawbRef || '603-70659761',
                    consignee_name: 'Untracked Extra Parcel',
                    consignee_location_name: 'Unknown City',
                    consignee_state: 'Unknown Province',
                    consignee_address_3: 'Unknown District',
                    weight: 0.1,
                    sender_reference: isNumeric ? null : trackingStr,
                    goods_description: extraNote ? `Extra: ${extraNote}` : 'Untracked extra parcel registered by unsealing staff'
                };

                const insertShipRes = await fetch(`${supabaseUrl}/rest/v1/shipments`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify(newShipment)
                });

                if (insertShipRes.ok) {
                    const insertedShipments = await insertShipRes.json();
                    shipment = insertedShipments && insertedShipments[0];
                    if (shipment) {
                        shipmentRef = shipment.reference_number;
                    }
                } else {
                    const errText = await insertShipRes.text();
                    return NextResponse.json({ success: false, error: `Failed to register extra shipment: ${errText}` }, { status: 500 });
                }
            }

            if (!shipment) {
                return NextResponse.json({
                    success: false,
                    error: 'NOT_FOUND',
                    message: `Shipment reference number ${shipmentRef} not found in database.`
                }, { status: 404 });
            }

            // Handle overrideBag if shipment is found but bag number doesn't match
            if (bagNumber) {
                const shipmentBag = shipment.bag_number || '';
                if (shipmentBag.toLowerCase() !== bagNumber.toLowerCase()) {
                    if (overrideBag) {
                        // Update bag_number in database
                        const updateShipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${shipmentRef}`, {
                            method: 'PATCH',
                            headers: {
                                ...headers,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                bag_number: bagNumber,
                                goods_description: extraNote ? `Overage: ${extraNote}` : (shipment.goods_description || '')
                            })
                        });
                        if (updateShipRes.ok) {
                            shipment.bag_number = bagNumber;
                        } else {
                            const errText = await updateShipRes.text();
                            return NextResponse.json({ success: false, error: `Failed to update shipment bag: ${errText}` }, { status: 500 });
                        }
                    } else {
                        return NextResponse.json({
                            success: false,
                            error: 'NOT_IN_BAG',
                            message: `This parcel belongs to Bag "${shipment.bag_number || 'Unknown'}", not the currently selected Bag "${bagNumber}".`,
                            actualBag: shipment.bag_number || null,
                            expectedBag: bagNumber
                        }, { status: 400 });
                    }
                }
            }

            // 2. Check if already exists in allocations
            const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, { headers });
            if (!spaRes.ok) {
                const errText = await spaRes.text();
                throw new Error(`Failed to fetch allocations: ${errText}`);
            }
            const allocations = await spaRes.json();
            
            const finalMawb = mawbRef || shipment.mawb_ref || '603-70659761'; // fallback

            let finalAllocation = allocations && allocations[0];

            if (!allocations || allocations.length === 0) {
                // Insert new allocation row (only first 4 columns: id, created_at, mawb_ref, shipment_ref)
                const insertRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        mawb_ref: finalMawb,
                        shipment_ref: shipmentRef
                    })
                });
                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    throw new Error(`Database save failure: ${errText}`);
                }
                const inserted = await insertRes.json();
                finalAllocation = inserted && inserted[0];
            } else {
                // Update existing record's MAWB reference to associate it with this box session
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocations[0].id}`, {
                    method: 'PATCH',
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        mawb_ref: finalMawb
                    })
                });
                if (!updateRes.ok) {
                    const errText = await updateRes.text();
                    throw new Error(`Database update failure: ${errText}`);
                }
                const updated = await updateRes.json();
                finalAllocation = updated && updated[0];
            }

            // Resolve zone and partner using helper
            const { assignedZone, assignedPartner } = await resolveZoneAndPartner(supabaseUrl, headers, shipment, finalAllocation);

            const skynetData: SkyNetParcelData = {
                trackingNumber: shipment.reference_number.toString(),
                recipientName: shipment.consignee_name || "Unknown Recipient",
                city: shipment.consignee_location_name || "Unknown City",
                province: shipment.consignee_state || "Unknown Province",
                district: shipment.consignee_address_3 || "Unknown District",
                weight: shipment.weight || 0,
                mawbRef: finalMawb,
                senderReference: shipment.sender_reference || undefined
            };

            return NextResponse.json({
                success: true,
                parcel: skynetData,
                assignedZone,
                assignedPartner
            });
        }

        // ═══════════════════════════════════════════════════════
        // STAGE 2 — LMD ALLOCATION (SECOND SCAN)
        // ═══════════════════════════════════════════════════════
        // 1. Concurrently fetch service provider allocation and shipment details (parallelized step 1)
        const spaPromise = fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, { headers });
        const shipPromise = resolvedShipment
            ? Promise.resolve(null)
            : fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${shipmentRef}`, { headers }).then(res => res.json());

        const [spaRes, shipResData] = await Promise.all([
            spaPromise,
            shipPromise
        ]);

        const allocations = await spaRes.json();
        const shipment = resolvedShipment || (shipResData && shipResData[0]);

        if (!shipment) {
            return NextResponse.json({
                success: false,
                error: `Shipment details not found for reference number ${shipmentRef} in database.`
            }, { status: 404 });
        }

        let allocation = allocations && allocations[0];
        let missedFirstScan = false;

        // If no allocation row exists (Missed First Scan):
        if (!allocation) {
            missedFirstScan = true;
            const finalMawb = shipment.mawb_ref || '603-70659761'; // fallback

            // Auto-record to first scan (insert new row with first 4 columns)
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation`, {
                method: 'POST',
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    mawb_ref: finalMawb,
                    shipment_ref: shipmentRef
                })
            });
            if (!insertRes.ok) {
                const errText = await insertRes.text();
                throw new Error(`Failed to auto-record missed first scan: ${errText}`);
            }
            const insertedRows = await insertRes.json();
            allocation = insertedRows && insertedRows[0];
        }

        // 2. Concurrently resolve details (parallelized step 2 with cache fallbacks)
        const spId = allocation.service_provider;
        const mappedCityId = allocation.mapped_city;
        let cityName = shipment.consignee_location_name || "";
        let districtName = shipment.consignee_address_3 || "";
        const mawbRefVal = allocation.mawb_ref;

        const cityPromise = mappedCityId
            ? (cache.cities.has(mappedCityId)
                ? Promise.resolve(cache.cities.get(mappedCityId))
                : fetch(`${supabaseUrl}/rest/v1/district_city_mapping?id=eq.${mappedCityId}`, { headers })
                    .then(res => res.json())
                    .then(data => {
                        const val = data && data[0];
                        if (val) cache.cities.set(mappedCityId, val);
                        return val;
                    }))
            : (cityName
                ? fetch(`${supabaseUrl}/rest/v1/district_city_mapping?city=ilike.${cityName}`, { headers })
                    .then(res => res.json())
                    .then(data => {
                        const val = data && data[0];
                        return val;
                    })
                : Promise.resolve(null));

        const mawbPromise = mawbRefVal
            ? (cache.mawbs.has(mawbRefVal)
                ? Promise.resolve(cache.mawbs.get(mawbRefVal))
                : fetch(`${supabaseUrl}/rest/v1/mawb?mawb_reference=eq.${mawbRefVal}`, { headers })
                    .then(res => res.json())
                    .then(data => {
                        const val = data && data[0];
                        if (val) cache.mawbs.set(mawbRefVal, val);
                        return val;
                    }))
            : Promise.resolve(null);

        const [mappedCity, mawbDetails] = await Promise.all([
            cityPromise,
            mawbPromise
        ]);

        if (mappedCity) {
            cityName = mappedCity.city || cityName;
            districtName = mappedCity.area_name || districtName;
        }

        // 3. Resolve zone using cache fallback (parallelized step 3)
        let assignedZone = "Default-Zone";
        if (mappedCity && mappedCity.zone) {
            const zoneId = mappedCity.zone;
            if (cache.zones.has(zoneId)) {
                assignedZone = cache.zones.get(zoneId)!;
            } else {
                const zoneRes = await fetch(`${supabaseUrl}/rest/v1/zones?id=eq.${zoneId}`, { headers });
                const zones = await zoneRes.json();
                if (zones && zones[0]) {
                    assignedZone = zones[0].zone_name || "Default-Zone";
                    cache.zones.set(zoneId, assignedZone);
                }
            }
        }

        if (assignedZone === 'Zone-E02') {
            assignedZone = 'Zone C';
        }

        // Allocate dynamic partner if not set (or always re-allocate if stage 2 is scanned)
        let assignedPartner = "Unknown";
        let finalProviderId = spId;

        if (!spId) {
            // Allocate dynamically: PickMe (1) or Domex (2)
            if (assignedZone.toLowerCase().includes('b') || assignedZone.toLowerCase().includes('c') || shipmentRef % 2 === 0) {
                finalProviderId = 2; // Domex
                assignedPartner = 'Domex';
            } else {
                finalProviderId = 1; // PickMe
                assignedPartner = 'PickMe';
            }

            // Save the allocated provider back to the database row
            if (allocation.id) {
                const patchRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocation.id}`, {
                    method: "PATCH",
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify({
                        service_provider: finalProviderId,
                        validated: true,
                        mapped_city: mappedCity ? mappedCity.id : null
                    })
                });
                if (!patchRes.ok) {
                    const errText = await patchRes.text();
                    throw new Error(`Failed to save allocated partner back to database: ${errText}`);
                }
            } else {
                throw new Error("Cannot save allocation: Database row ID is missing.");
            }
        } else {
            // Retrieve provider name from cache or DB
            if (cache.providers.has(spId)) {
                assignedPartner = cache.providers.get(spId)!;
            } else {
                const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?id=eq.${spId}`, { headers });
                const providers = await spRes.json();
                if (providers && providers[0]) {
                    assignedPartner = providers[0].name || "Unknown";
                    cache.providers.set(spId, assignedPartner);
                }
            }
            if (assignedPartner.toLowerCase() === 'pickme') assignedPartner = 'PickMe';
            else if (assignedPartner.toLowerCase() === 'domex') assignedPartner = 'Domex';
            else if (assignedPartner.toLowerCase() === 'pronto') assignedPartner = 'Pronto';
        }

        const skynetData: SkyNetParcelData = {
            trackingNumber: shipment.reference_number.toString(),
            recipientName: shipment.consignee_name || "Unknown Recipient",
            recipientPhone: shipment.consignee_phone || "No Phone",
            recipientAddress: cleanAddress(
                shipment.consignee_address_1,
                shipment.consignee_address_2,
                shipment.consignee_address_3,
                shipment.consignee_address_4,
                shipment.consignee_address_5
            ),
            senderName: shipment.consignor_name || "Unknown Sender",
            senderAddress: cleanAddress(
                shipment.consignor_address_1,
                shipment.consignor_address_2,
                shipment.consignor_address_3,
                shipment.consignor_address_4,
                shipment.consignor_address_5
            ),
            province: shipment.consignee_state || "Unknown Province",
            district: districtName || "Unknown District",
            city: cityName || "Unknown City",
            weight: shipment.weight_measure?.toUpperCase() === 'G' ? (shipment.weight || 0) / 1000 : (shipment.weight || 0),
            value: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value.toFixed(2)}` : undefined,
            account: shipment.shipper_code || undefined,
            apiSync: allocation.validated ? "Validated" : "Pending",
            goodsDesc: shipment.goods_desc || undefined,
            mawbRef: allocation.mawb_ref || undefined,
            mawbCarrier: mawbDetails ? mawbDetails.carrier : undefined,
            mawbFlight: mawbDetails ? mawbDetails.travel_id : undefined,
            mawbBags: mawbDetails ? mawbDetails.declared_bags : undefined,
            serviceType: shipment.service_type || undefined,
            businessType: shipment.business_type || undefined,
            senderReference: shipment.sender_reference || undefined
        };

        return NextResponse.json({
            success: true,
            parcel: skynetData,
            assignedZone,
            assignedPartner,
            missedFirstScan
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const urlObj = new URL(request.url);
        const getMawbs = urlObj.searchParams.get('mawbs') === 'true';
        const getBags = urlObj.searchParams.get('getBags') === 'true';
        const mawbRefParam = urlObj.searchParams.get('mawbRef');
        const getUnsealedBags = urlObj.searchParams.get('getUnsealedBags') === 'true';

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const headers = {
            "apikey": anonKey!,
            "Authorization": `Bearer ${anonKey}`
        };

        if (getMawbs) {
            const res = await fetch(`${supabaseUrl}/rest/v1/mawb?select=mawb_reference,carrier,declared_bags`, { headers });
            if (!res.ok) {
                const errText = await res.text();
                return NextResponse.json({ success: false, error: errText }, { status: 500 });
            }
            const mawbs = await res.json();
            return NextResponse.json({ success: true, mawbs });
        }

        if (getBags && mawbRefParam) {
            // Map test reference to the UUID reference if it's the fallback MAWB
            let searchMawb = mawbRefParam;
            if (mawbRefParam === '603-70659761') {
                searchMawb = '6331c8b6-9182-4e36-86f1-73a2431f5bc8';
            }
            
            let allShipments: any[] = [];
            let offset = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                const res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=eq.${searchMawb}&select=bag_number&limit=${limit}&offset=${offset}`, { headers });
                if (!res.ok) {
                    const errText = await res.text();
                    return NextResponse.json({ success: false, error: errText }, { status: 500 });
                }
                const shipments = await res.json();
                allShipments = allShipments.concat(shipments);
                if (shipments.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }
            
            const bagCountsMap: Record<string, number> = {};
            allShipments.forEach((s: any) => {
                if (s.bag_number) {
                    bagCountsMap[s.bag_number] = (bagCountsMap[s.bag_number] || 0) + 1;
                }
            });
            
            const bagsList = Object.entries(bagCountsMap).map(([bagNumber, expectedCount]) => ({
                bagNumber,
                expectedCount
            }));
            
            return NextResponse.json({ success: true, bags: bagsList });
        }

        if (getUnsealedBags) {
            const res = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?select=*&order=created_at.desc`, { headers });
            if (!res.ok) {
                const errText = await res.text();
                return NextResponse.json({ success: false, error: errText }, { status: 500 });
            }
            const unsealedBags = await res.json();
            return NextResponse.json({ success: true, unsealedBags });
        }

        const interfaces = os.networkInterfaces();
        let localIP = '127.0.0.1';
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name] || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIP = net.address;
                    break;
                }
            }
            if (localIP !== '127.0.0.1') break;
        }

        const hostHeader = request.headers.get('host') || '';
        const port = hostHeader.split(':')[1] || '';
        
        const protocol = urlObj.protocol; // 'http:' or 'https:'
        const localUrl = port ? `${protocol}//${localIP}:${port}` : `${protocol}//${localIP}`;

        return NextResponse.json({
            success: true,
            ip: localIP,
            port: port,
            url: localUrl
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}