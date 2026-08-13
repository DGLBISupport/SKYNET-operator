import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkyNetParcelData } from '@/types';

export const dynamic = 'force-dynamic';

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
    if (spId) {
        const numId = Number(spId);
        if (numId === 1) {
            assignedPartner = 'PickMe';
        } else if (numId === 2) {
            assignedPartner = 'Domex';
        } else if (cache.providers.has(numId)) {
            assignedPartner = cache.providers.get(numId)!;
        } else {
            const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?id=eq.${spId}`, { headers });
            const providers = await spRes.json();
            if (providers && providers[0]) {
                assignedPartner = providers[0].name || "Unknown";
                cache.providers.set(numId, assignedPartner);
            }
        }
        if (assignedPartner.toLowerCase().includes('pickme')) assignedPartner = 'PickMe';
        else if (assignedPartner.toLowerCase().includes('domex')) assignedPartner = 'Domex';
        else if (assignedPartner.toLowerCase().includes('pronto')) assignedPartner = 'Pronto';
    }

    return { assignedZone, assignedPartner, mappedCity };
}

// ─────────────────────────────────────────────────────────────────────────────
// FFDX GetonLine Tracking Upload
// Mirrors track_upload.py — sends EventID 1558 "Collected by Courier Provider"
// after every successful 1st scan (box unsealing). Fire-and-forget: never
// blocks the scan response; errors are logged only.
// ─────────────────────────────────────────────────────────────────────────────
function buildFfdxXml(referenceNumber: string): string {
    const entityId   = process.env.FFDX_ENTITY_ID   || '';
    const entityPin  = process.env.FFDX_ENTITY_PIN  || '';
    const updateId   = process.env.FFDX_UPDATE_ENTITY_ID || 'LK7171';
    
    // Format in local timezone (defaulting to Asia/Colombo)
    const tz = process.env.TZ || 'Asia/Colombo';
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const m: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;

    const h24 = parseInt(m.hour || '0', 10) % 24;
    const h12 = String(h24 % 12 || 12).padStart(2, '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const eventDT = `${m.year}/${m.month}/${m.day} ${h12}:${m.minute}:${m.second} ${ampm}`;

    return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<WSGET><AccessRequest><WSVersion>WS1.0</WSVersion><FileType>2</FileType><Action>upload</Action><EntityID>${entityId}</EntityID><EntityPIN>${entityPin}</EntityPIN><MessageID>0001</MessageID></AccessRequest><Event><ReferenceNumber>${referenceNumber}</ReferenceNumber><ReferenceType>C</ReferenceType><EventDateTime>${eventDT}</EventDateTime><EventID>1558</EventID><Remarks>Skynet Warehouse</Remarks><OriginByPrefix>0</OriginByPrefix><OriginEntityID></OriginEntityID><UpdateEntityID>${updateId}</UpdateEntityID><UpdateEntityLocationName>Colombo</UpdateEntityLocationName></Event></WSGET>`;
}

async function uploadToFfdx(
    referenceNumber: string,
    supabaseUrl: string,
    supabaseHeaders: Record<string, string>,
    allocationId?: number | null
): Promise<void> {
    const apiUrl   = `https://ws05.ffdx.net/ffdx_ws/v12/service_ffdx.asmx/WSDataTransfer`;
    const username = process.env.FFDX_USERNAME || '';
    const password = process.env.FFDX_PASSWORD || '';

    try {
        const xmlStream = buildFfdxXml(referenceNumber);
        const body = new URLSearchParams({
            Username:     username,
            Password:     password,
            xmlStream:    xmlStream,
            LevelConfirm: '0'
        });

        console.log(`[FFDX] Uploading tracking event for parcel: ${referenceNumber}`);
        const res = await fetch(apiUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    body.toString(),
            signal:  AbortSignal.timeout(15000)   // 15 s timeout
        });

        const rawText = (await res.text()).trim();
        console.log(`[FFDX] HTTP ${res.status} for ${referenceNumber}: ${rawText.slice(0, 200)}`);

        // Determine success: FFDX returns XML; a successful upload contains <Status>1</Status>
        const success = res.ok && rawText.includes('<Status>1</Status>');
        const trackStatus = success ? 'UPLOADED' : 'FAILED';

        // Update track_status in Supabase (best-effort)
        if (allocationId) {
            await fetch(
                `${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocationId}`,
                {
                    method:  'PATCH',
                    headers: { ...supabaseHeaders, 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ track_status: trackStatus })
                }
            ).catch(e => console.error('[FFDX] Failed to update track_status in Supabase:', e));
        }

        if (!success) {
            console.warn(`[FFDX] Upload may have failed for ${referenceNumber}. Raw: ${rawText.slice(0, 400)}`);
        } else {
            console.log(`[FFDX] ✅ Successfully uploaded tracking event for ${referenceNumber}`);
        }
    } catch (err: any) {
        console.error(`[FFDX] ❌ Connection error for ${referenceNumber}:`, err?.message || err);
        // Still try to mark as FAILED in Supabase
        if (allocationId) {
            fetch(
                `${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocationId}`,
                {
                    method:  'PATCH',
                    headers: { ...supabaseHeaders, 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ track_status: 'FAILED' })
                }
            ).catch(() => {});
        }
    }
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
            operator,
            targetMawb,
            targetPartner,
            outboundBagNumber,
            scannedParcels,
            scanned_parcels,
            missingParcels,
            missing_parcels
        } = await request.json();

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !key) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        const headers = {
            "apikey": key,
            "Authorization": `Bearer ${key}`
        };

        // ═══════════════════════════════════════════════════════
        // STAGE: FINISH BAG (SAVE UNSEALED BAG RECORD & UPDATE MISSING PARCELS)
        // ═══════════════════════════════════════════════════════
        if (stage === 'finish-bag') {
            if (!mawbRef || !bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing required unsealing parameters.' }, { status: 400 });
            }

            const discrepancy = (scannedCount || 0) - (expectedCount || 0);
            const parcelsToStore = scannedParcels || scanned_parcels || [];
            const missingList = missingParcels || missing_parcels || [];

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
                    unsealed: true,
                    unsealed_by: operator || 'Unknown',
                    scanned_parcels: parcelsToStore
                })
            });

            if (!insertRes.ok) {
                const errText = await insertRes.text();
                if (errText.includes('23505') || insertRes.status === 409) {
                    return NextResponse.json({ success: false, error: `Bag "${bagNumber}" has already been unsealed.` }, { status: 409 });
                }
                return NextResponse.json({ success: false, error: `Failed to save bag unsealing: ${errText}` }, { status: 500 });
            }

            // Update status of each missing parcel in service_provider_allocation
            if (Array.isArray(missingList) && missingList.length > 0) {
                for (const mp of missingList) {
                    const trackingNum = mp.trackingNumber || mp.shipmentRef || mp.skynetTrackingNumber;
                    if (!trackingNum) continue;

                    const rawReason = mp.status || mp.reason || 'Missing Parcels';
                    const mpStatus = rawReason.startsWith('SHORTAGE:') ? rawReason : `SHORTAGE: ${rawReason}`;

                    try {
                        const checkRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(trackingNum)}`, { headers });
                        if (checkRes.ok) {
                            const allocs = await checkRes.json();
                            if (Array.isArray(allocs) && allocs.length > 0) {
                                await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(trackingNum)}`, {
                                    method: 'PATCH',
                                    headers: { ...headers, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        scan_status: mpStatus,
                                        updated_at: new Date().toISOString()
                                    })
                                });
                            } else {
                                await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation`, {
                                    method: 'POST',
                                    headers: { ...headers, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        mawb_ref: mawbRef,
                                        shipment_ref: trackingNum,
                                        scan_status: mpStatus,
                                        unsealed: false,
                                        updated_at: new Date().toISOString()
                                    })
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to update allocation for missing parcel ${trackingNum}:`, err);
                    }
                }
            }

            const data = await insertRes.json();
            return NextResponse.json({ success: true, data: data[0] });
        }

        if (!trackingNumber) {
            return NextResponse.json({ success: false, error: 'Missing tracking number' }, { status: 400 });
        }

        let resolvedShipment: any = null;
        const cleanBar = trackingNumber.trim();
        let shipmentRef: string = cleanBar;
        const isNumeric = /^\d+$/.test(cleanBar);
        const activeMawb = mawbRef || targetMawb || '';

        if (isNumeric) {
            // First try matching in activeMawb if provided
            if (activeMawb) {
                const mawbSearchRes = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${encodeURIComponent(activeMawb.trim())}&or=(reference_number.eq.${encodeURIComponent(cleanBar)},sender_reference.eq.${encodeURIComponent(cleanBar)})`, { headers });
                if (mawbSearchRes.ok) {
                    const shipments = await mawbSearchRes.json();
                    if (shipments && shipments[0]) {
                        resolvedShipment = shipments[0];
                        shipmentRef = String(resolvedShipment.reference_number);
                    }
                }
            }
            if (!resolvedShipment) {
                // Search across all MAWBs
                const searchRes = await fetch(`${supabaseUrl}/rest/v1/shipments?or=(reference_number.eq.${encodeURIComponent(cleanBar)},sender_reference.eq.${encodeURIComponent(cleanBar)})`, { headers });
                if (searchRes.ok) {
                    const shipments = await searchRes.json();
                    if (shipments && shipments[0]) {
                        resolvedShipment = shipments[0];
                        shipmentRef = String(resolvedShipment.reference_number);
                    }
                }
            }
        }

        if (!resolvedShipment) {
            // Find by sender_reference (Temu barcode)
            if (activeMawb) {
                const mawbTemuRes = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${encodeURIComponent(activeMawb.trim())}&sender_reference=eq.${encodeURIComponent(cleanBar)}`, { headers });
                if (mawbTemuRes.ok) {
                    const shipments = await mawbTemuRes.json();
                    if (shipments && shipments[0]) {
                        resolvedShipment = shipments[0];
                        shipmentRef = String(resolvedShipment.reference_number);
                    }
                }
            }
            if (!resolvedShipment) {
                const temuRes = await fetch(`${supabaseUrl}/rest/v1/shipments?sender_reference=eq.${encodeURIComponent(cleanBar)}`, { headers });
                if (temuRes.ok) {
                    const shipments = await temuRes.json();
                    if (shipments && shipments[0]) {
                        resolvedShipment = shipments[0];
                        shipmentRef = String(resolvedShipment.reference_number);
                    }
                }
            }
        }

        const isTemuScan = Boolean(
            resolvedShipment &&
            resolvedShipment.sender_reference &&
            cleanBar.toUpperCase() === resolvedShipment.sender_reference.trim().toUpperCase() &&
            cleanBar.toUpperCase() !== resolvedShipment.reference_number?.toString().trim().toUpperCase()
        );

        // ═══════════════════════════════════════════════════════
        // STAGE: DAMAGED LABEL LOOKUP (READ-ONLY)
        // ═══════════════════════════════════════════════════════
        if (stage === 'damaged-lookup' || stage === 'lookup') {
            let shipment = resolvedShipment;
            if (!shipment) {
                const shipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${encodeURIComponent(shipmentRef)}`, { headers });
                if (shipRes.ok) {
                    const shipments = await shipRes.json();
                    shipment = shipments && shipments[0];
                }
            }

            if (!shipment) {
                return NextResponse.json({
                    success: false,
                    error: 'NOT_FOUND',
                    message: `Shipment reference number "${cleanBar}" not found in database.`
                }, { status: 404 });
            }

            // Read-only allocation record lookup
            const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(shipmentRef)}`, { headers });
            let allocation = null;
            if (spaRes.ok) {
                const allocations = await spaRes.json();
                allocation = allocations && allocations[0];
            }

            // Check if 1st scan was performed (informational only, does NOT mutate DB)
            const firstScanConfirmed = Boolean(
                allocation?.unsealed === true ||
                allocation?.scan_status === '1ST_SCAN_DONE' ||
                allocation?.scan_status === '2ND_SCAN_DONE'
            );
            const missedFirstScan = !firstScanConfirmed;

            // Resolve zone and partner using existing helper
            const { assignedZone, assignedPartner } = await resolveZoneAndPartner(supabaseUrl, headers, shipment, allocation);

            const initialManifestRef = allocation?.mawb_ref || shipment.mawb_reference || shipment.mawb_ref || "Initial Manifest";

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
                district: shipment.consignee_address_3 || "Unknown District",
                city: shipment.consignee_location_name || "Unknown City",
                weight: shipment.weight_measure?.toUpperCase() === 'G' ? (shipment.weight || 0) / 1000 : (shipment.weight || 0),
                value: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value.toFixed(2)}` : undefined,
                account: shipment.shipper_code || undefined,
                apiSync: allocation?.validated ? "Validated" : "Pending",
                goodsDesc: shipment.goods_desc || undefined,
                mawbRef: initialManifestRef,
                serviceType: shipment.service_type || undefined,
                businessType: shipment.business_type || undefined,
                senderReference: shipment.sender_reference || undefined,
                _scannedVia: isTemuScan ? 'TEMU' : 'SKYNET',
                isTemuScan: isTemuScan,
                scannedMethod: isTemuScan ? 'TEMU' : 'SKYNET'
            };

            return NextResponse.json({
                success: true,
                parcel: skynetData,
                assignedZone,
                assignedPartner,
                missedFirstScan,
                scanStatus: allocation?.scan_status || 'NOT_SCANNED'
            });
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
            let isNewShipment = false;
            if (!shipment && registerExtra) {
                let trackingStr = trackingNumber.trim();
                let refToInsert: string = shipmentRef;
                if (!isNumeric) {
                    refToInsert = Math.floor(100000000 + Math.random() * 900000000).toString();
                }
                const newShipment = {
                    reference_number: refToInsert,
                    bag_number: bagNumber,
                    mawb_ref: mawbRef || '',
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
                        shipmentRef = String(shipment.reference_number);
                        isNewShipment = true;
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

            // Handle overrideBag if shipment is found but bag number or MAWB doesn't match
            let overridePerformed = false;
            const shipmentBag = shipment.bag_number || '';
            const shipmentMawb = shipment.mawb_reference || shipment.mawb_ref || '';

            const isMawbMismatch = Boolean(mawbRef && shipmentMawb && shipmentMawb.trim().toLowerCase() !== mawbRef.trim().toLowerCase());
            const isBagMismatch = Boolean(bagNumber && shipmentBag.trim().toLowerCase() !== bagNumber.trim().toLowerCase());

            if (bagNumber || mawbRef) {
                // Quick guard: if this bag has already been unsealed, block further first-scan attempts
                try {
                    const mawbFilter = mawbRef ? `mawb_ref=eq.${encodeURIComponent(mawbRef)}&` : '';
                    const checkUnsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?${mawbFilter}bag_number=eq.${encodeURIComponent(bagNumber)}`, { headers });
                    if (checkUnsealRes.ok) {
                        const unsealList = await checkUnsealRes.json();
                        const unsealRec = unsealList && unsealList[0];
                        if (unsealRec && unsealRec.unsealed) {
                            return NextResponse.json({ success: false, error: 'BAG_ALREADY_COMPLETED', message: `Bag "${bagNumber}" has already been unsealed.` }, { status: 409 });
                        }
                        // If parcel already present in scanned_parcels, return duplicate indicator
                        if (unsealRec && Array.isArray(unsealRec.scanned_parcels)) {
                            const found = unsealRec.scanned_parcels.some((p: any) =>
                                (p.skynetTrackingNumber || p.trackingNumber || p.tracking_number)?.toString() === shipmentRef.toString()
                            );
                            if (found) {
                                return NextResponse.json({ success: false, error: 'ALREADY_UNSEALED_PARCEL', message: `Parcel ${shipmentRef} already unsealed in Bag "${bagNumber}".` }, { status: 409 });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to check bag_unsealing before first-scan:', e);
                }

                if (isMawbMismatch || isBagMismatch) {
                    if (overrideBag) {
                        // Update bag_number and mawb_reference in database
                        const patchBody: any = {
                            goods_description: extraNote ? `Overage: ${extraNote}` : (shipment.goods_description || '')
                        };
                        if (bagNumber) patchBody.bag_number = bagNumber;
                        if (mawbRef) patchBody.mawb_reference = mawbRef;

                        const updateShipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${shipmentRef}`, {
                            method: 'PATCH',
                            headers: {
                                ...headers,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(patchBody)
                        });
                        if (updateShipRes.ok) {
                            if (bagNumber) shipment.bag_number = bagNumber;
                            if (mawbRef) shipment.mawb_reference = mawbRef;
                            overridePerformed = true;
                        } else {
                            const errText = await updateShipRes.text();
                            return NextResponse.json({ success: false, error: `Failed to update shipment bag/MAWB: ${errText}` }, { status: 500 });
                        }
                    } else {
                        const mismatchMsg = isMawbMismatch
                            ? `This parcel belongs to MAWB "${shipmentMawb}" (Bag "${shipmentBag || 'Unknown'}"), not the currently selected MAWB "${mawbRef}".`
                            : `This parcel belongs to Bag "${shipmentBag || 'Unknown'}", not the currently selected Bag "${bagNumber}".`;

                        return NextResponse.json({
                            success: false,
                            error: 'NOT_IN_BAG',
                            message: mismatchMsg,
                            actualBag: shipmentBag || null,
                            actualMawb: shipmentMawb || null,
                            expectedBag: bagNumber,
                            expectedMawb: mawbRef
                        }, { status: 400 });
                    }
                }
            }

            // Scan status is tracked entirely in service_provider_allocation — no shipments write needed here.

            // 2. Fetch allocation record if present (Read-only lookup from service_provider_allocation)
            const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, { headers });
            let finalAllocation = null;
            if (spaRes.ok) {
                const allocations = await spaRes.json();
                finalAllocation = allocations && allocations[0];
            }
            
            const finalMawb = mawbRef || shipment.mawb_ref || '';

            // Mark 1st scan done on service_provider_allocation (source of truth for scan status)
            if (finalAllocation && finalAllocation.id) {
                fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${finalAllocation.id}`, {
                    method: 'PATCH',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ unsealed: true, scan_status: '1ST_SCAN_DONE', updated_at: new Date().toISOString() })
                }).catch(e => console.error("Failed to set 1ST_SCAN_DONE on allocation:", e));

                // Fire-and-forget: push "Collected by Courier Provider" event to FFDX GetonLine
                uploadToFfdx(shipmentRef, supabaseUrl, headers, finalAllocation.id);
            } else {
                // Parcel has no allocation row yet — create a minimal one to record scan status
                fetch(`${supabaseUrl}/rest/v1/service_provider_allocation`, {
                    method: 'POST',
                    headers: { ...headers, "Content-Type": "application/json", "Prefer": "return=minimal" },
                    body: JSON.stringify({
                        shipment_ref: shipmentRef,
                        mawb_ref: mawbRef || shipment.mawb_ref || null,
                        unsealed: true,
                        scan_status: '1ST_SCAN_DONE',
                        updated_at: new Date().toISOString()
                    })
                }).catch(e => console.error("Failed to create minimal allocation for 1ST_SCAN_DONE:", e));

                // Fire-and-forget: push "Collected by Courier Provider" event to FFDX GetonLine
                // (no allocationId yet since row was just created — track_status will be set via allocationId=null)
                uploadToFfdx(shipmentRef, supabaseUrl, headers, null);
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
                senderReference: shipment.sender_reference || undefined,
                _scannedVia: isTemuScan ? 'TEMU' : 'SKYNET',
                isTemuScan: isTemuScan,
                scannedMethod: isTemuScan ? 'TEMU' : 'SKYNET'
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
        // Always fetch FRESH shipment data from DB for Stage 2 — do NOT reuse
        // resolvedShipment which was fetched before any Stage 1 update ran.
        const [spaRes, freshShipRes, lmdBagItemRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, { headers }),
            fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${encodeURIComponent(shipmentRef)}`, { headers }),
            fetch(`${supabaseUrl}/rest/v1/outbound_lmd_bag_items?shipment_ref=eq.${encodeURIComponent(shipmentRef)}`, { headers })
        ]);

        const allocations = await spaRes.json();
        const freshShipData = await freshShipRes.json();
        const lmdBagItems = await lmdBagItemRes.json();
        // Use fresh DB row for shipment details (scan status is checked via allocation below)
        const shipment = (freshShipData && freshShipData[0]) || resolvedShipment;
        const existingLmdBag = Array.isArray(lmdBagItems) && lmdBagItems.length > 0 ? lmdBagItems[0].bag_number : null;

        if (!shipment) {
            return NextResponse.json({
                success: false,
                error: `Shipment details not found for reference number ${shipmentRef} in database.`
            }, { status: 404 });
        }

        let allocation = allocations && allocations[0];
        let missedFirstScan = false;
        let firstScanConfirmed = false;

        // Parcel-level 1st scan check — read from service_provider_allocation (source of truth).
        // allocation.unsealed is set to true during Stage 1 (Box Unsealing).
        firstScanConfirmed = Boolean(
            allocation?.unsealed === true ||
            allocation?.scan_status === '1ST_SCAN_DONE' ||
            allocation?.scan_status === '2ND_SCAN_DONE'
        );

        // Flag parcels that bypassed 1st scan
        missedFirstScan = !firstScanConfirmed;

        // 2. Concurrently resolve details (parallelized step 2 with cache fallbacks)
        const spId = allocation?.service_provider;
        const mappedCityId = allocation?.mapped_city;
        let cityName = shipment.consignee_location_name || "";
        let districtName = shipment.consignee_address_3 || "";
        const mawbRefVal = allocation?.mawb_ref || shipment.mawb_reference || shipment.mawb_ref;

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

        // Resolve partner strictly from service_provider_allocation table (No dynamic allocation)
        let assignedPartner = "Unknown";

        if (spId) {
            const numId = Number(spId);
            if (numId === 1) {
                assignedPartner = 'PickMe';
            } else if (numId === 2) {
                assignedPartner = 'Domex';
            } else if (cache.providers.has(numId)) {
                assignedPartner = cache.providers.get(numId)!;
            } else {
                const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?id=eq.${spId}`, { headers });
                const providers = await spRes.json();
                if (providers && providers[0]) {
                    assignedPartner = providers[0].name || "Unknown";
                    cache.providers.set(numId, assignedPartner);
                }
            }
            if (assignedPartner.toLowerCase().includes('pickme')) assignedPartner = 'PickMe';
            else if (assignedPartner.toLowerCase().includes('domex')) assignedPartner = 'Domex';
            else if (assignedPartner.toLowerCase().includes('pronto')) assignedPartner = 'Pronto';
        }

        const initialManifestRef = allocation?.mawb_ref || shipment.mawb_reference || shipment.mawb_ref || mawbRefVal || "Initial Manifest";

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
            apiSync: allocation?.validated ? "Validated" : "Pending",
            goodsDesc: shipment.goods_desc || undefined,
            mawbRef: initialManifestRef,
            mawbCarrier: mawbDetails ? mawbDetails.carrier : undefined,
            mawbFlight: mawbDetails ? mawbDetails.travel_id : undefined,
            mawbBags: mawbDetails ? mawbDetails.declared_bags : undefined,
            serviceType: shipment.service_type || undefined,
            businessType: shipment.business_type || undefined,
            senderReference: shipment.sender_reference || undefined,
            _scannedVia: isTemuScan ? 'TEMU' : 'SKYNET',
            isTemuScan: isTemuScan,
            scannedMethod: isTemuScan ? 'TEMU' : 'SKYNET'
        };

        // Perform Validation Checks:
        let validationStatus: 'CORRECT' | 'INCORRECT' = 'CORRECT';
        let validationReason: string | undefined = undefined;
        let validationError: string | undefined = undefined;

        // 0. FIRST SCAN REQUIRED CHECK (highest priority — blocks all other checks)
        if (missedFirstScan) {
            validationStatus = 'INCORRECT';
            validationReason = 'MISSED_FIRST_SCAN';
            validationError = 'This parcel has not completed the 1st scan (Box Unsealing). Please perform the 1st scan first before proceeding to LMD Verification.';
        }

        // 1. DEDUPLICATION CHECK (once allocated to an LMD bag / manifest, it CANNOT be allocated again)
        if (validationStatus === 'CORRECT') {
            if (existingLmdBag || allocation?.scan_status === '2ND_SCAN_DONE') {
                const bagRefMsg = existingLmdBag ? `to LMD Bag "${existingLmdBag}"` : `to an LMD Bag`;
                validationStatus = 'INCORRECT';
                validationReason = 'DUPLICATE';
                validationError = `Already Scanned!! Parcel "${shipmentRef}" has ALREADY been allocated ${bagRefMsg} and cannot be allocated again.`;
            }
        }

        // 2. Partner Mismatch & Unallocated Check
        if (validationStatus === 'CORRECT') {
            if (assignedPartner === 'Unknown') {
                validationStatus = 'INCORRECT';
                validationReason = 'UNALLOCATED_PARTNER';
                validationError = 'Not assigned to a service provider and not scanned in first scan.';
            } else if (targetPartner && targetPartner !== 'ALL' && assignedPartner.trim().toLowerCase() !== targetPartner.trim().toLowerCase()) {
                validationStatus = 'INCORRECT';
                validationReason = 'PARTNER_MISMATCH';
                validationError = `Courier Partner Mismatch: Parcel is assigned to "${assignedPartner}", but active Bag is assigned to "${targetPartner}".`;
            }
        }

        if (validationStatus === 'CORRECT') {
            const allocationLogMsg = `[LMD ALLOCATION LOG] Parcel "${shipmentRef}" (Initial Manifest: "${initialManifestRef}") allocated to Bag "${outboundBagNumber || 'Active Bag'}" under LMD Manifest "${targetMawb || 'LMD Manifest'}".`;
            console.log(allocationLogMsg);

            if (allocation && allocation.id) {
                // Mark 2nd scan done on service_provider_allocation (source of truth)
                fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocation.id}`, {
                    method: 'PATCH',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        validated: true,
                        scan_status: '2ND_SCAN_DONE',
                        updated_at: new Date().toISOString()
                    })
                }).catch(e => console.error("Failed to update allocation to 2ND_SCAN_DONE:", e));
            }
        }

        return NextResponse.json({
            success: validationStatus === 'CORRECT',
            validation: validationStatus,
            reason: validationReason,
            error: validationError,
            parcel: {
                ...skynetData,
                initialManifest: initialManifestRef
            },
            assignedZone,
            assignedPartner,
            missedFirstScan,
            initialManifest: initialManifestRef,
            targetMawb,
            outboundBagNumber,
            allocationLog: `Parcel "${shipmentRef}" (Initial Manifest: "${initialManifestRef}") allocated to Bag "${outboundBagNumber || 'Active Bag'}" under LMD Manifest "${targetMawb || 'LMD Manifest'}"`
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
        const getBagParcels = urlObj.searchParams.get('getBagParcels') === 'true';
        const mawbRefParam = urlObj.searchParams.get('mawbRef');
        const bagNumberParam = urlObj.searchParams.get('bagNumber');
        const getUnsealedBags = urlObj.searchParams.get('getUnsealedBags') === 'true';

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !key) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        const headers = {
            "apikey": key,
            "Authorization": `Bearer ${key}`
        };

        if (getMawbs) {
            const res = await fetch(`${supabaseUrl}/rest/v1/mawb?has_service_providers_allocated=eq.true&select=mawb_reference,carrier,declared_bags,has_service_providers_allocated`, { headers, cache: 'no-store' });
            if (!res.ok) {
                const errText = await res.text();
                return NextResponse.json({ success: false, error: errText }, { status: 500 });
            }
            const mawbs = await res.json();
            return NextResponse.json({ success: true, mawbs });
        }

        if (getBags && mawbRefParam) {
            const searchMawb = mawbRefParam.trim();
            const cleanSearchMawb = encodeURIComponent(searchMawb);

            // Fetch ALL shipments for this MAWB using pagination to handle large manifests (>1000 items)
            let allShipments: any[] = [];
            let offset = 0;
            const limit = 1000;
            let hasMore = true;
            let attempts = 0;

            while (hasMore && attempts < 20) {
                attempts++;
                try {
                    const res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${cleanSearchMawb}&select=bag_number,reference_number&order=reference_number.asc&limit=${limit}&offset=${offset}`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data) && data.length > 0) {
                            allShipments.push(...data);
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
                } catch {
                    hasMore = false;
                }
            }

            // Fallback query on shipments_duplicate if primary returned 0 shipments
            if (allShipments.length === 0) {
                offset = 0;
                hasMore = true;
                attempts = 0;
                while (hasMore && attempts < 10) {
                    attempts++;
                    try {
                        const dupRes = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?mawb_reference=ilike.${cleanSearchMawb}&select=bag_number,reference_number&order=reference_number.asc&limit=${limit}&offset=${offset}`, { headers });
                        if (dupRes.ok) {
                            const data = await dupRes.json();
                            if (Array.isArray(data) && data.length > 0) {
                                allShipments.push(...data);
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
                    } catch {
                        hasMore = false;
                    }
                }
            }

            // Fetch unsealed bags registered for this MAWB
            let unsealedBagsData: any[] = [];
            try {
                const unsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?mawb_ref=ilike.${cleanSearchMawb}&select=bag_number,expected_count`, { headers });
                if (unsealRes.ok) {
                    const data = await unsealRes.json();
                    if (Array.isArray(data)) unsealedBagsData = data;
                }
            } catch (e) {
                console.error("Failed to fetch unsealed bags:", e);
            }

            // Group distinct bag numbers and calculate expected parcel count (count of reference_number)
            const bagCountsMap: Record<string, number> = {};
            let unassignedCount = 0;

            allShipments.forEach((s: any) => {
                const rawBag = s.bag_number ? String(s.bag_number).trim() : '';
                if (rawBag !== '') {
                    bagCountsMap[rawBag] = (bagCountsMap[rawBag] || 0) + 1;
                } else {
                    unassignedCount++;
                }
            });

            // Include any unsealed bags registered for this MAWB if not already in map
            unsealedBagsData.forEach((u: any) => {
                if (u.bag_number) {
                    const trimmedBag = String(u.bag_number).trim();
                    if (!bagCountsMap[trimmedBag]) {
                        bagCountsMap[trimmedBag] = u.expected_count || 0;
                    }
                }
            });

            const bagsList = Object.entries(bagCountsMap).map(([bagNumber, expectedCount]) => ({
                bagNumber,
                expectedCount
            }));

            return NextResponse.json({ success: true, bags: bagsList });
        }

        if (getBagParcels && bagNumberParam) {
            const rawBagNum = bagNumberParam.trim();
            const cleanBagNum = encodeURIComponent(rawBagNum);
            const searchMawb = mawbRefParam ? mawbRefParam.trim() : '';
            const cleanSearchMawb = searchMawb ? encodeURIComponent(searchMawb) : '';

            let shipments: any[] = [];

            // If MAWB reference is provided, scope search to BOTH MAWB and Bag Number
            if (cleanSearchMawb) {
                // 1. Try direct exact match on bag_number AND mawb_reference in shipments table
                let res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${cleanSearchMawb}&bag_number=eq.${cleanBagNum}&select=*`, { headers });
                if (res.ok) {
                    const found = await res.json();
                    if (Array.isArray(found) && found.length > 0) shipments = found;
                }

                // 2. Try case-insensitive ilike match on bag_number AND mawb_reference
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${cleanSearchMawb}&bag_number=ilike.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 3. Try wildcard ilike match on bag_number AND mawb_reference
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${cleanSearchMawb}&bag_number=ilike.*${cleanBagNum}*&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 4. Fallback search on shipments_duplicate table by exact bag_number AND mawb_reference
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?mawb_reference=ilike.${cleanSearchMawb}&bag_number=eq.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 5. Fallback search on shipments_duplicate table by ilike bag_number AND mawb_reference
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?mawb_reference=ilike.${cleanSearchMawb}&bag_number=ilike.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }
            }

            // Fallback search without MAWB if no shipments were found matching the MAWB (or if no MAWB provided)
            if (!Array.isArray(shipments) || shipments.length === 0) {
                // 1. Try direct exact match on bag_number in shipments table
                let res = await fetch(`${supabaseUrl}/rest/v1/shipments?bag_number=eq.${cleanBagNum}&select=*`, { headers });
                if (res.ok) {
                    const found = await res.json();
                    if (Array.isArray(found) && found.length > 0) shipments = found;
                }

                // 2. Try case-insensitive ilike match on bag_number
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments?bag_number=ilike.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 3. Try wildcard ilike match on bag_number
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments?bag_number=ilike.*${cleanBagNum}*&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 4. Fallback search on shipments_duplicate table by exact bag_number
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?bag_number=eq.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }

                // 5. Fallback search on shipments_duplicate table by ilike bag_number
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?bag_number=ilike.${cleanBagNum}&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }
            }

            // 6. ONLY if no shipments with specific bag_number exist AND bag_number is unassigned/synthetic (e.g. ends with BAG-01 or UNASSIGNED), query unassigned shipments for MAWB
            if ((!Array.isArray(shipments) || shipments.length === 0) && (rawBagNum.includes('-BAG-') || rawBagNum.toLowerCase().includes('bag') || rawBagNum.toLowerCase().includes('unassigned'))) {
                const mawbMatch = rawBagNum.match(/^([0-9]{3}-[0-9]{8})/);
                const mawbRefToSearch = mawbMatch ? mawbMatch[1] : (mawbRefParam || '');

                if (mawbRefToSearch) {
                    const synthRes = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${encodeURIComponent(mawbRefToSearch.trim())}&or=(bag_number.is.null,bag_number.eq."")&select=*`, { headers });
                    if (synthRes.ok) {
                        const found = await synthRes.json();
                        if (Array.isArray(found) && found.length > 0) shipments = found;
                    }
                }
            }

            let partnerMap: Record<string, string> = {};
            if (Array.isArray(shipments) && shipments.length > 0) {
                const refs = shipments.map((s: any) => s.reference_number).filter(Boolean);
                if (refs.length > 0) {
                    const refsQuery = refs.map((r: string) => `shipment_ref.eq.${encodeURIComponent(r)}`).join(',');
                    try {
                        const spaRes = await fetch(
                            `${supabaseUrl}/rest/v1/service_provider_allocation?or=(${refsQuery})&select=shipment_ref,service_provider`,
                            { headers }
                        );
                        if (spaRes.ok) {
                            const spaData = await spaRes.json();
                            const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?select=id,name`, { headers });
                            if (spRes.ok) {
                                const spData = await spRes.json();
                                const spMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex' };
                                (spData || []).forEach((sp: any) => {
                                    spMap[sp.id] = sp.name;
                                });
                                (spaData || []).forEach((alloc: any) => {
                                    if (alloc.shipment_ref && alloc.service_provider) {
                                        const numId = Number(alloc.service_provider);
                                        let name = spMap[numId] || spMap[alloc.service_provider] || 'Unknown';
                                        if (name.toLowerCase().includes('pickme')) name = 'PickMe';
                                        else if (name.toLowerCase().includes('domex')) name = 'Domex';
                                        else if (name.toLowerCase().includes('pronto')) name = 'Pronto';
                                        partnerMap[alloc.shipment_ref] = name;
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        console.error("Error loading allocations for bag parcels:", err);
                    }
                }
            }

            const parcels = (Array.isArray(shipments) ? shipments : []).map((s: any) => ({
                trackingNumber: s.reference_number,
                skynetTrackingNumber: s.reference_number,
                senderReference: s.sender_reference || s.alternate_reference || '',
                recipientName: s.consignee_name || 'Unknown Recipient',
                city: s.consignee_location_name || s.consignee_address_3 || 'Unknown City',
                assignedPartner: partnerMap[s.reference_number] || 'Unknown',
                assignedZone: s.delivery_route_code || 'Default-Zone',
                weight: s.weight || s.dead_weight || 0.1
            }));

            return NextResponse.json({ success: true, count: parcels.length, parcels });
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