import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkyNetParcelData } from '@/types';
import { normalizeWeightToGrams } from '@/lib/weightUtils';

export const dynamic = 'force-dynamic';

// Dynamic in-memory caches to avoid redundant database calls while reflecting database changes
const cache = {
    providers: new Map<number, string>(),
    cities: new Map<string, any>(),
    zones: new Map<number, string>(),
    mawbs: new Map<string, any>()
};

async function getZoneName(supabaseUrl: string, headers: any, zoneId: number): Promise<string> {
    const numId = Number(zoneId);
    if (cache.zones.has(numId)) {
        return cache.zones.get(numId) || "Default-Zone";
    }

    try {
        const zoneRes = await fetch(`${supabaseUrl}/rest/v1/zones?select=id,zone_name`, { headers });
        if (zoneRes.ok) {
            const zones = await zoneRes.json();
            if (Array.isArray(zones)) {
                zones.forEach((z: any) => {
                    if (z.id && z.zone_name) {
                        cache.zones.set(Number(z.id), z.zone_name);
                    }
                });
            }
        }
    } catch (e) {
        console.error("Failed to dynamically fetch zones from database:", e);
    }

    return cache.zones.get(numId) || "Default-Zone";
}

async function getProviderName(supabaseUrl: string, headers: any, spId: number): Promise<string> {
    const numId = Number(spId);
    if (cache.providers.has(numId)) {
        return cache.providers.get(numId) || "Unknown";
    }

    try {
        const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?select=id,name`, { headers });
        if (spRes.ok) {
            const providers = await spRes.json();
            if (Array.isArray(providers)) {
                providers.forEach((p: any) => {
                    if (p.id && p.name) {
                        cache.providers.set(Number(p.id), p.name);
                    }
                });
            }
        }
    } catch (e) {
        console.error("Failed to dynamically fetch service providers from database:", e);
    }

    return cache.providers.get(numId) || "Unknown";
}

const cleanAddress = (...parts: (string | null | undefined)[]) => {
    return parts.filter(p => p && p.trim() !== "").map(p => p.trim()).join(", ");
};

const cleanRecipientAddressLines = (shipment: any) => {
    const rawParts = [
        shipment.consignee_address_1,
        shipment.consignee_address_2,
        shipment.consignee_address_3,
        shipment.consignee_address_4,
        shipment.consignee_address_5
    ].filter(p => p && typeof p === 'string' && p.trim() !== '').map(p => p.trim());

    const city = (shipment.consignee_location_name || '').trim().toLowerCase();
    const state = (shipment.consignee_state || '').trim().toLowerCase();
    const country = (shipment.consignee_country_name || 'sri lanka').trim().toLowerCase();
    const countryCode = (shipment.consignee_country_code || 'lk').trim().toLowerCase();

    const filteredLines: string[] = [];
    for (const part of rawParts) {
        const lower = part.toLowerCase();
        if (
            (city && lower === city) ||
            (state && lower === state) ||
            (country && lower === country) ||
            (countryCode && lower === countryCode) ||
            lower === 'sri lanka' ||
            lower === 'srilanka'
        ) {
            continue;
        }
        if (!filteredLines.some(l => l.toLowerCase() === lower)) {
            filteredLines.push(part);
        }
    }

    return filteredLines.length > 0 ? filteredLines.join('\n') : (shipment.consignee_address_1 || '');
};

const cleanSenderAddressLines = (shipment: any) => {
    const city = (shipment.consignor_location_name || '').trim();
    const state = (shipment.consignor_state || '').trim();
    const postcode = (shipment.consignor_postcode || '').trim();
    const country = (shipment.consignor_country_name || 'CHINA').trim();

    const rawParts = [
        shipment.consignor_address_1,
        shipment.consignor_address_2,
        shipment.consignor_address_3,
        shipment.consignor_address_4,
        shipment.consignor_address_5
    ].filter(p => p && typeof p === 'string' && p.trim() !== '').map(p => p.trim());

    const streetLines: string[] = [];

    for (const part of rawParts) {
        const chunks = part.split(',').map(c => c.trim()).filter(Boolean);
        const filteredChunks = chunks.filter(c => {
            const lower = c.toLowerCase();
            if (city && lower === city.toLowerCase()) return false;
            if (state && lower === state.toLowerCase()) return false;
            if (postcode && lower === postcode.toLowerCase()) return false;
            if (country && lower === country.toLowerCase()) return false;
            if (lower === 'china' || lower === 'cn') return false;
            return true;
        });

        if (filteredChunks.length > 0) {
            const cleanStreet = filteredChunks.join(', ');
            if (!streetLines.some(l => l.toLowerCase() === cleanStreet.toLowerCase())) {
                streetLines.push(cleanStreet);
            }
        }
    }

    const resultLines: string[] = [];
    if (streetLines.length > 0) {
        resultLines.push(...streetLines);
    } else {
        resultLines.push('Machong Logistics Park');
    }

    const cityState = [city, state].filter(Boolean).join(' ');
    if (cityState) {
        resultLines.push(cityState);
    }

    const postCountry = [postcode, country].filter(Boolean).join(' ');
    if (postCountry) {
        resultLines.push(postCountry);
    }

    return resultLines.join('\n');
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

    let mappedCity: any = null;
    if (mappedCityId) {
        const cityKey = `id:${mappedCityId}`;
        if (cache.cities.has(cityKey)) {
            mappedCity = cache.cities.get(cityKey);
        } else {
            try {
                const res = await fetch(`${supabaseUrl}/rest/v1/district_city_mapping?id=eq.${mappedCityId}`, { headers });
                const data = await res.json();
                mappedCity = data && data[0];
                if (mappedCity) cache.cities.set(cityKey, mappedCity);
            } catch (e) {}
        }
    } else if (cityName) {
        const cityKey = `name:${cityName.toLowerCase().trim()}`;
        if (cache.cities.has(cityKey)) {
            mappedCity = cache.cities.get(cityKey);
        } else {
            try {
                const res = await fetch(`${supabaseUrl}/rest/v1/district_city_mapping?city=ilike.${encodeURIComponent(cityName)}`, { headers });
                const data = await res.json();
                mappedCity = data && data[0];
                if (mappedCity) cache.cities.set(cityKey, mappedCity);
            } catch (e) {}
        }
    }

    if (mappedCity) {
        cityName = mappedCity.city || cityName;
        districtName = mappedCity.area_name || districtName;
    }

    // Resolve zone dynamically from database (cached dynamically in memory)
    let assignedZone = "Default-Zone";
    if (mappedCity && mappedCity.zone) {
        assignedZone = await getZoneName(supabaseUrl, headers, Number(mappedCity.zone));
    }

    if (assignedZone === 'Zone-E02') {
        assignedZone = 'Zone C';
    }

    // Resolve partner dynamically from database (cached dynamically in memory)
    let assignedPartner = "Unknown";
    if (spId) {
        const rawName = await getProviderName(supabaseUrl, headers, Number(spId));
        assignedPartner = rawName;
        if (rawName.toLowerCase().includes('pickme')) assignedPartner = 'PickMe';
        else if (rawName.toLowerCase().includes('domex')) assignedPartner = 'Domex';
        else if (rawName.toLowerCase().includes('sitrek')) assignedPartner = 'SITREK';
        else if (rawName.toLowerCase().includes('pronto')) assignedPartner = 'Pronto';
    }

    return { assignedZone, assignedPartner, mappedCity };
}

// ─────────────────────────────────────────────────────────────────────────────
// FFDX GetonLine Tracking Upload
// Sends EventID 1558 ("Collected by Courier Provider") and/or EventID 85 (Damaged parcel via Temu barcode)
// after 1st scan (box unsealing). Fire-and-forget: never blocks the scan response; errors are logged.
// ─────────────────────────────────────────────────────────────────────────────
function buildFfdxXml(referenceNumber: string, eventId: string = '1558', remarks: string = 'Skynet Warehouse'): string {
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
<WSGET><AccessRequest><WSVersion>WS1.0</WSVersion><FileType>2</FileType><Action>upload</Action><EntityID>${entityId}</EntityID><EntityPIN>${entityPin}</EntityPIN><MessageID>0001</MessageID></AccessRequest><Event><ReferenceNumber>${referenceNumber}</ReferenceNumber><ReferenceType>C</ReferenceType><EventDateTime>${eventDT}</EventDateTime><EventID>${eventId}</EventID><Remarks>${remarks}</Remarks><OriginByPrefix>0</OriginByPrefix><OriginEntityID></OriginEntityID><UpdateEntityID>${updateId}</UpdateEntityID><UpdateEntityLocationName>Colombo</UpdateEntityLocationName></Event></WSGET>`;
}

async function uploadToFfdx(
    referenceNumber: string,
    supabaseUrl: string,
    supabaseHeaders: Record<string, string>,
    allocationId?: number | null,
    eventId: string = '1558',
    remarks: string = 'Skynet Warehouse'
): Promise<void> {
    const apiUrl   = `https://ws05.ffdx.net/ffdx_ws/v12/service_ffdx.asmx/WSDataTransfer`;
    const username = process.env.FFDX_USERNAME || '';
    const password = process.env.FFDX_PASSWORD || '';

    try {
        const xmlStream = buildFfdxXml(referenceNumber, eventId, remarks);
        const body = new URLSearchParams({
            Username:     username,
            Password:     password,
            xmlStream:    xmlStream,
            LevelConfirm: '0'
        });

        console.log(`[FFDX] Uploading tracking event (EventID ${eventId} - ${remarks}) for parcel: ${referenceNumber}`);
        const res = await fetch(apiUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    body.toString(),
            signal:  AbortSignal.timeout(15000)   // 15 s timeout
        });

        const rawText = (await res.text()).trim();
        console.log(`[FFDX] HTTP ${res.status} for ${referenceNumber} (EventID ${eventId}): ${rawText.slice(0, 200)}`);

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
            console.warn(`[FFDX] Upload may have failed for ${referenceNumber} (EventID ${eventId}). Raw: ${rawText.slice(0, 400)}`);
        } else {
            console.log(`[FFDX] ✅ Successfully uploaded tracking event (${eventId}) for ${referenceNumber}`);
        }
    } catch (err: any) {
        console.error(`[FFDX] ❌ Connection error for ${referenceNumber} (EventID ${eventId}):`, err?.message || err);
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
        const encodedBar = encodeURIComponent(cleanBar);

        // Concurrently query shipments and service_provider_allocation in 1 parallel network roundtrip
        const [shipRes, initialSpaRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/shipments?or=(reference_number.eq.${encodedBar},sender_reference.eq.${encodedBar})&limit=5`, { headers }),
            fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodedBar}&limit=1`, { headers })
        ]);

        let initialAllocation: any = null;
        if (initialSpaRes.ok) {
            const allocs = await initialSpaRes.json();
            initialAllocation = allocs && allocs[0];
        }

        if (shipRes.ok) {
            const shipments = await shipRes.json();
            if (Array.isArray(shipments) && shipments.length > 0) {
                if (activeMawb) {
                    resolvedShipment = shipments.find((s: any) =>
                        (s.mawb_reference || s.mawb_ref || '').trim().toLowerCase() === activeMawb.trim().toLowerCase()
                    ) || shipments[0];
                } else {
                    resolvedShipment = shipments[0];
                }
                shipmentRef = String(resolvedShipment.reference_number);
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
            let allocation = initialAllocation;
            if (!allocation) {
                const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(shipmentRef)}`, { headers });
                if (spaRes.ok) {
                    const allocations = await spaRes.json();
                    allocation = allocations && allocations[0];
                }
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
                recipientAddress: cleanRecipientAddressLines(shipment),
                senderName: shipment.consignor_name || "Unknown Sender",
                senderAddress: cleanSenderAddressLines(shipment),
                province: shipment.consignee_state || "Unknown Province",
                district: shipment.consignee_address_3 || "Unknown District",
                city: shipment.consignee_location_name || "Unknown City",
                country: shipment.consignee_country_name || "SRI LANKA",
                weight: normalizeWeightToGrams(shipment.weight, shipment.weight_measure),
                weightMeasure: shipment.weight_measure || undefined,
                value: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value.toFixed(2)}` : undefined,
                account: shipment.shipper_code || undefined,
                destLocationCode: shipment.dest_location_code || undefined,
                apiSync: allocation?.validated ? "Validated" : "Pending",
                goodsDesc: shipment.goods_desc || undefined,
                deliveryInstructions: shipment.delivery_instructions || shipment.goods_desc || undefined,
                numOfItems: shipment.num_of_items || 1,
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
            let shipment = resolvedShipment;

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
                    const checkUnsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?${mawbFilter}bag_number=eq.${encodeURIComponent(bagNumber)}&select=unsealed,scanned_parcels&limit=1`, { headers });
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

            // Allocation lookup: reuse initialAllocation if available, else fetch by canonical shipmentRef
            let finalAllocation = initialAllocation;
            if (!finalAllocation) {
                try {
                    const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(shipmentRef)}&limit=1`, { headers });
                    if (spaRes.ok) {
                        const allocations = await spaRes.json();
                        finalAllocation = allocations && allocations[0];
                    }
                } catch (e) {}
            }

            const finalMawb = mawbRef || shipment.mawb_ref || '';

            // Mark 1st scan done on service_provider_allocation (source of truth for scan status)
            const eventIdToSend = isTemuScan ? '85' : '1558';
            const remarksToSend = 'Skynet Warehouse';

            if (finalAllocation && finalAllocation.id) {
                fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${finalAllocation.id}`, {
                    method: 'PATCH',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ unsealed: true, scan_status: '1ST_SCAN_DONE', updated_at: new Date().toISOString() })
                }).catch(e => console.error("Failed to set 1ST_SCAN_DONE on allocation:", e));

                // Fire-and-forget: push tracking event (85 for damaged/Temu parcel, 1558 for normal parcel) to FFDX GetonLine
                uploadToFfdx(shipmentRef, supabaseUrl, headers, finalAllocation.id, eventIdToSend, remarksToSend);
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

                // Fire-and-forget: push tracking event (85 for damaged/Temu parcel, 1558 for normal parcel) to FFDX GetonLine
                uploadToFfdx(shipmentRef, supabaseUrl, headers, null, eventIdToSend, remarksToSend);
            }

            // Resolve zone and partner using helper (sub-millisecond lookup from cache)
            const { assignedZone, assignedPartner } = await resolveZoneAndPartner(supabaseUrl, headers, shipment, finalAllocation);

            const skynetData: SkyNetParcelData = {
                trackingNumber: shipment.reference_number.toString(),
                recipientName: shipment.consignee_name || "Unknown Recipient",
                recipientPhone: shipment.consignee_phone || "No Phone",
                recipientAddress: cleanRecipientAddressLines(shipment),
                senderName: shipment.consignor_name || "Unknown Sender",
                senderAddress: cleanSenderAddressLines(shipment),
                city: shipment.consignee_location_name || "Unknown City",
                province: shipment.consignee_state || "Unknown Province",
                district: shipment.consignee_address_3 || "Unknown District",
                country: shipment.consignee_country_name || "SRI LANKA",
                weight: normalizeWeightToGrams(shipment.weight, shipment.weight_measure),
                weightMeasure: shipment.weight_measure || undefined,
                value: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value.toFixed(2)}` : undefined,
                account: shipment.shipper_code || undefined,
                destLocationCode: shipment.dest_location_code || undefined,
                goodsDesc: shipment.goods_desc || undefined,
                deliveryInstructions: shipment.delivery_instructions || shipment.goods_desc || undefined,
                numOfItems: shipment.num_of_items || 1,
                serviceType: shipment.service_type || undefined,
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
        let shipment = resolvedShipment;
        let allocation = initialAllocation;

        // Parallelize missing lookups if needed
        const [freshShipRes, freshSpaRes, lmdBagItemRes] = await Promise.all([
            !shipment ? fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${encodeURIComponent(shipmentRef)}`, { headers }) : Promise.resolve(null),
            !allocation ? fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(shipmentRef)}`, { headers }) : Promise.resolve(null),
            fetch(`${supabaseUrl}/rest/v1/outbound_lmd_bag_items?shipment_ref=eq.${encodeURIComponent(shipmentRef)}&select=bag_number&limit=1`, { headers })
        ]);

        if (!shipment && freshShipRes) {
            const freshShipData = await freshShipRes.json();
            shipment = freshShipData && freshShipData[0];
        }

        if (!allocation && freshSpaRes) {
            const freshSpaData = await freshSpaRes.json();
            allocation = freshSpaData && freshSpaData[0];
        }

        let existingLmdBag: string | null = null;
        if (lmdBagItemRes) {
            const lmdBagItems = await lmdBagItemRes.json();
            existingLmdBag = Array.isArray(lmdBagItems) && lmdBagItems.length > 0 ? lmdBagItems[0].bag_number : null;
        }

        if (!shipment) {
            return NextResponse.json({
                success: false,
                error: `Shipment details not found for reference number ${shipmentRef} in database.`
            }, { status: 404 });
        }

        let missedFirstScan = false;
        let firstScanConfirmed = false;

        // Parcel-level 1st scan check — read from service_provider_allocation (source of truth).
        firstScanConfirmed = Boolean(
            allocation?.unsealed === true ||
            allocation?.scan_status === '1ST_SCAN_DONE' ||
            allocation?.scan_status === '2ND_SCAN_DONE'
        );

        // Flag parcels that bypassed 1st scan
        missedFirstScan = !firstScanConfirmed;

        // Fast Zone & Partner resolution (sub-millisecond via dynamic memory cache)
        const { assignedZone, assignedPartner, mappedCity } = await resolveZoneAndPartner(supabaseUrl, headers, shipment, allocation);
        const cityName = mappedCity?.city || shipment.consignee_location_name || "";
        const districtName = mappedCity?.area_name || shipment.consignee_address_3 || "";
        const mawbRefVal = allocation?.mawb_ref || shipment.mawb_reference || shipment.mawb_ref;

        const initialManifestRef = allocation?.mawb_ref || shipment.mawb_reference || shipment.mawb_ref || mawbRefVal || "Initial Manifest";

        const skynetData: SkyNetParcelData = {
            trackingNumber: shipment.reference_number.toString(),
            recipientName: shipment.consignee_name || "Unknown Recipient",
            recipientPhone: shipment.consignee_phone || "No Phone",
            recipientAddress: cleanRecipientAddressLines(shipment),
            senderName: shipment.consignor_name || "Unknown Sender",
            senderAddress: cleanSenderAddressLines(shipment),
            province: shipment.consignee_state || "Unknown Province",
            district: districtName || "Unknown District",
            city: cityName || "Unknown City",
            country: shipment.consignee_country_name || "SRI LANKA",
            weight: normalizeWeightToGrams(shipment.weight, shipment.weight_measure),
            weightMeasure: shipment.weight_measure || undefined,
            value: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value.toFixed(2)}` : undefined,
            account: shipment.shipper_code || undefined,
            destLocationCode: shipment.dest_location_code || undefined,
            apiSync: allocation?.validated ? "Validated" : "Pending",
            goodsDesc: shipment.goods_desc || undefined,
            deliveryInstructions: shipment.delivery_instructions || shipment.goods_desc || undefined,
            numOfItems: shipment.num_of_items || 1,
            mawbRef: initialManifestRef,
            initialManifest: initialManifestRef,
            inboundManifest: initialManifestRef,
            inboundBag: shipment.bag_number || undefined,
            initialBag: shipment.bag_number || undefined,
            bagNumber: shipment.bag_number || undefined,
            mawbCarrier: shipment.carrier || undefined,
            mawbFlight: shipment.travel_id || undefined,
            mawbBags: shipment.declared_bags || undefined,
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
            // Determine the target date: use ?date=YYYY-MM-DD query param if provided, otherwise today
            const dateParam = urlObj.searchParams.get('date');
            let targetDate: Date;
            if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                targetDate = new Date(dateParam + 'T00:00:00');
            } else {
                targetDate = new Date();
            }
            const dayStart = new Date(targetDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(targetDate);
            dayEnd.setHours(23, 59, 59, 999);
            const dayStartISO = dayStart.toISOString();
            const dayEndISO = dayEnd.toISOString();

            const res = await fetch(
                `${supabaseUrl}/rest/v1/mawb?has_service_providers_allocated=eq.true&fetched_at=gte.${encodeURIComponent(dayStartISO)}&fetched_at=lte.${encodeURIComponent(dayEndISO)}&select=mawb_reference,carrier,declared_bags,has_service_providers_allocated,fetched_at&order=fetched_at.desc`,
                { headers, cache: 'no-store' }
            );
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

            // Concurrently fetch unsealed bags registered for this MAWB and allocations
            let unsealedBagsData: any[] = [];
            let spAllocList: any[] = [];

            try {
                const [unsealRes, spaRes] = await Promise.all([
                    fetch(`${supabaseUrl}/rest/v1/bag_unsealing?mawb_ref=ilike.${cleanSearchMawb}&select=bag_number,expected_count,scanned_count,scanned_parcels,status,unsealed`, { headers }),
                    fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?mawb_ref=ilike.${cleanSearchMawb}&select=shipment_ref,unsealed,scan_status`, { headers })
                ]);
                if (unsealRes.ok) {
                    const data = await unsealRes.json();
                    if (Array.isArray(data)) unsealedBagsData = data;
                }
                if (spaRes.ok) {
                    const data = await spaRes.json();
                    if (Array.isArray(data)) spAllocList = data;
                }
            } catch (e) {
                console.error("Failed to fetch unsealed bags or allocations:", e);
            }

            // Build set of all unsealed shipment reference numbers from service_provider_allocation & bag_unsealing
            const unsealedRefs = new Set<string>();
            spAllocList.forEach((alloc: any) => {
                const statusStr = (alloc.scan_status || '').toUpperCase();
                if (alloc.unsealed === true || ['1ST_SCAN_DONE', '2ND_SCAN_DONE', 'VERIFIED', 'DISPATCHED', 'COMPLETED'].includes(statusStr)) {
                    if (alloc.shipment_ref) {
                        unsealedRefs.add(String(alloc.shipment_ref).trim().toLowerCase());
                    }
                }
            });

            // Map completed bags from bag_unsealing
            const completedBagMap = new Map<string, any>();
            unsealedBagsData.forEach((u: any) => {
                if (u.bag_number) {
                    const key = String(u.bag_number).trim().toLowerCase();
                    completedBagMap.set(key, u);
                    if (Array.isArray(u.scanned_parcels)) {
                        u.scanned_parcels.forEach((p: any) => {
                            const ref = p.skynetTrackingNumber || p.trackingNumber || p.tracking_number || (typeof p === 'string' ? p : '');
                            if (ref) unsealedRefs.add(String(ref).trim().toLowerCase());
                        });
                    }
                }
            });

            // Group distinct bag numbers, calculate expected count, and count unsealed parcels
            const bagStatsMap: Record<string, { expectedCount: number; scannedCount: number }> = {};
            let unassignedCount = 0;

            allShipments.forEach((s: any) => {
                const rawBag = s.bag_number ? String(s.bag_number).trim() : '';
                if (rawBag !== '') {
                    if (!bagStatsMap[rawBag]) {
                        bagStatsMap[rawBag] = { expectedCount: 0, scannedCount: 0 };
                    }
                    bagStatsMap[rawBag].expectedCount += 1;
                    const refLower = String(s.reference_number || '').trim().toLowerCase();
                    if (refLower && unsealedRefs.has(refLower)) {
                        bagStatsMap[rawBag].scannedCount += 1;
                    }
                } else {
                    unassignedCount++;
                }
            });

            // Include any unsealed bags registered for this MAWB if not already in map
            unsealedBagsData.forEach((u: any) => {
                if (u.bag_number) {
                    const trimmedBag = String(u.bag_number).trim();
                    if (!bagStatsMap[trimmedBag]) {
                        bagStatsMap[trimmedBag] = {
                            expectedCount: u.expected_count || 0,
                            scannedCount: u.scanned_count || u.expected_count || 0
                        };
                    }
                }
            });

            const bagsList = Object.entries(bagStatsMap).map(([bagNumber, stats]) => {
                const comp = completedBagMap.get(bagNumber.toLowerCase());
                const isCompleted = Boolean(comp);
                const scannedCount = isCompleted ? (comp.scanned_count ?? stats.expectedCount) : stats.scannedCount;
                const expectedCount = isCompleted ? (comp.expected_count ?? stats.expectedCount) : stats.expectedCount;
                const pendingCount = Math.max(0, expectedCount - scannedCount);

                let status = 'PENDING';
                if (isCompleted) {
                    status = 'COMPLETED';
                } else if (scannedCount > 0) {
                    status = 'IN_PROGRESS';
                }

                return {
                    bagNumber,
                    expectedCount,
                    scannedCount,
                    pendingCount,
                    status
                };
            });

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
            let allocationMap: Record<string, any> = {};

            if (Array.isArray(shipments) && shipments.length > 0) {
                const refs = shipments.map((s: any) => s.reference_number).filter(Boolean);
                if (refs.length > 0) {
                    const refsQuery = refs.map((r: string) => `shipment_ref.eq.${encodeURIComponent(r)}`).join(',');
                    try {
                        const [spaRes, spRes] = await Promise.all([
                            fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?or=(${refsQuery})&select=shipment_ref,service_provider,unsealed,scan_status,created_at,updated_at`, { headers }),
                            fetch(`${supabaseUrl}/rest/v1/service_providers?select=id,name`, { headers })
                        ]);

                        const spMap: Record<number, string> = { 1: 'PickMe', 2: 'Domex', 3: 'SITREK' };
                        if (spRes.ok) {
                            const spData = await spRes.json();
                            (spData || []).forEach((sp: any) => {
                                spMap[sp.id] = sp.name;
                            });
                        }

                        if (spaRes.ok) {
                            const spaData = await spaRes.json();
                            (spaData || []).forEach((alloc: any) => {
                                if (alloc.shipment_ref) {
                                    allocationMap[alloc.shipment_ref] = alloc;
                                    allocationMap[String(alloc.shipment_ref).trim().toLowerCase()] = alloc;
                                    if (alloc.service_provider) {
                                        const numId = Number(alloc.service_provider);
                                        let name = spMap[numId] || spMap[alloc.service_provider] || 'Unknown';
                                        if (name.toLowerCase().includes('pickme')) name = 'PickMe';
                                        else if (name.toLowerCase().includes('domex')) name = 'Domex';
                                        else if (name.toLowerCase().includes('sitrek')) name = 'SITREK';
                                        else if (name.toLowerCase().includes('pronto')) name = 'Pronto';
                                        partnerMap[alloc.shipment_ref] = name;
                                        partnerMap[String(alloc.shipment_ref).trim().toLowerCase()] = name;
                                    }
                                }
                            });
                        }
                    } catch (err) {
                        console.error("Error loading allocations for bag parcels:", err);
                    }
                }
            }

            // Check if there are completed bag records in bag_unsealing
            let bagUnsealRecord: any = null;
            try {
                const buRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?bag_number=eq.${cleanBagNum}&order=created_at.desc&limit=1`, { headers });
                if (buRes.ok) {
                    const buList = await buRes.json();
                    if (Array.isArray(buList) && buList.length > 0) {
                        bagUnsealRecord = buList[0];
                    }
                }
            } catch (e) {
                console.error("Failed to check bag_unsealing for bag parcels:", e);
            }

            const unsealedParcelsSet = new Set<string>();
            if (bagUnsealRecord && Array.isArray(bagUnsealRecord.scanned_parcels)) {
                bagUnsealRecord.scanned_parcels.forEach((p: any) => {
                    const ref = p.skynetTrackingNumber || p.trackingNumber || p.tracking_number || (typeof p === 'string' ? p : '');
                    if (ref) unsealedParcelsSet.add(String(ref).trim().toLowerCase());
                });
            }

            const scannedParcels: any[] = [];
            const parcels = (Array.isArray(shipments) ? shipments : []).map((s: any) => {
                const refStr = String(s.reference_number || '').trim();
                const refLower = refStr.toLowerCase();
                const alloc = allocationMap[refStr] || allocationMap[refLower];
                const statusStr = (alloc?.scan_status || '').toUpperCase();
                const isUnsealed = Boolean(
                    alloc?.unsealed === true ||
                    ['1ST_SCAN_DONE', '2ND_SCAN_DONE', 'VERIFIED', 'DISPATCHED', 'COMPLETED'].includes(statusStr) ||
                    unsealedParcelsSet.has(refLower)
                );

                const isTemuScan = Boolean(
                    s.sender_reference &&
                    s.sender_reference.trim() !== '' &&
                    s.sender_reference.trim() !== s.reference_number
                );
                const displayTrackingNumber = isTemuScan ? (s.sender_reference || s.reference_number) : s.reference_number;

                const timeStr = alloc?.updated_at
                    ? new Date(alloc.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : alloc?.created_at
                    ? new Date(alloc.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

                const parcelObj = {
                    trackingNumber: s.reference_number,
                    skynetTrackingNumber: s.reference_number,
                    senderReference: s.sender_reference || s.alternate_reference || '',
                    recipientName: s.consignee_name || 'Unknown Recipient',
                    city: s.consignee_location_name || s.consignee_address_3 || 'Unknown City',
                    assignedPartner: partnerMap[s.reference_number] || partnerMap[refLower] || 'Unknown',
                    assignedZone: s.delivery_route_code || 'Default-Zone',
                    weight: normalizeWeightToGrams(s.weight || s.dead_weight, s.weight_measure),
                    isUnsealed: isUnsealed
                };

                if (isUnsealed) {
                    scannedParcels.push({
                        trackingNumber: displayTrackingNumber,
                        skynetTrackingNumber: String(s.reference_number),
                        senderReference: s.sender_reference || s.alternate_reference || '',
                        isTemuScan: isTemuScan,
                        recipientName: s.consignee_name || 'Unknown Recipient',
                        city: s.consignee_location_name || s.consignee_address_3 || 'Unknown City',
                        timestamp: timeStr,
                        assignedPartner: partnerMap[s.reference_number] || partnerMap[refLower] || 'Unknown',
                        assignedZone: s.delivery_route_code || 'Default-Zone',
                        weight: s.weight || s.dead_weight || 0.1
                    });
                }

                return parcelObj;
            });

            return NextResponse.json({
                success: true,
                count: parcels.length,
                scannedCount: scannedParcels.length,
                pendingCount: Math.max(0, parcels.length - scannedParcels.length),
                parcels,
                scannedParcels
            });
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