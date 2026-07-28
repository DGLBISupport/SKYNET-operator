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
            scanned_parcels
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
            const parcelsToStore = scannedParcels || scanned_parcels || [];

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

        if (isNumeric) {
            // First search both reference_number and sender_reference
            const searchRes = await fetch(`${supabaseUrl}/rest/v1/shipments?or=(reference_number.eq.${encodeURIComponent(cleanBar)},sender_reference.eq.${encodeURIComponent(cleanBar)})`, { headers });
            if (searchRes.ok) {
                const shipments = await searchRes.json();
                if (shipments && shipments[0]) {
                    resolvedShipment = shipments[0];
                    shipmentRef = String(resolvedShipment.reference_number);
                }
            }
        }

        if (!resolvedShipment) {
            // Find by sender_reference (Temu barcode)
            const temuRes = await fetch(`${supabaseUrl}/rest/v1/shipments?sender_reference=eq.${encodeURIComponent(cleanBar)}`, { headers });
            if (temuRes.ok) {
                const shipments = await temuRes.json();
                if (shipments && shipments[0]) {
                    resolvedShipment = shipments[0];
                    shipmentRef = String(resolvedShipment.reference_number);
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
                // Quick guard: if this bag has already been unsealed, block further first-scan attempts
                try {
                    const checkUnsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?bag_number=eq.${encodeURIComponent(bagNumber)}`, { headers });
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

            // 2. Fetch allocation record if present (Read-only lookup from service_provider_allocation)
            const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, { headers });
            let finalAllocation = null;
            if (spaRes.ok) {
                const allocations = await spaRes.json();
                finalAllocation = allocations && allocations[0];
            }
            
            const finalMawb = mawbRef || shipment.mawb_ref || '';

            // Set unsealed flag on service_provider_allocation record if present
            if (finalAllocation && finalAllocation.id) {
                fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${finalAllocation.id}`, {
                    method: 'PATCH',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ unsealed: true, updated_at: new Date().toISOString() })
                }).catch(e => console.error("Failed to set unsealed flag on allocation:", e));
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
        let firstScanParcelMatched = false;
        let firstScanConfirmed = false;

        // Check bag_unsealing history first to track individual parcel first-scan completion
        const targetBagNum = shipment.bag_number;
        let unsealRecord: any = null;
        let existingParcels: any[] = [];
        if (targetBagNum) {
            try {
                const unsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?bag_number=eq.${encodeURIComponent(targetBagNum)}`, { headers });
                if (unsealRes.ok) {
                    const unsealList = await unsealRes.json();
                    unsealRecord = unsealList && unsealList[0];
                    if (unsealRecord) {
                        existingParcels = Array.isArray(unsealRecord.scanned_parcels) ? unsealRecord.scanned_parcels : [];
                        firstScanParcelMatched = existingParcels.some((p: any) =>
                            (p.skynetTrackingNumber || p.trackingNumber || p.tracking_number)?.toString() === shipmentRef.toString()
                        );
                    }
                }
            } catch (e) {
                console.error("Failed to read bag_unsealing parcel history:", e);
            }
        }

        // Determine first-scan completion using parcel-level history when available.
        if (unsealRecord) {
            firstScanConfirmed = firstScanParcelMatched;
        } else {
            firstScanConfirmed = Boolean(allocation && allocation.unsealed === true);
        }

        // Check if parcel was unsealed during 1st Scan (First scan compulsory check)
        missedFirstScan = !firstScanConfirmed;

        if (firstScanConfirmed && allocation && allocation.id && !allocation.unsealed) {
            // Reconcile service_provider_allocation state when parcel was already recorded in bag_unsealing.
            fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocation.id}`, {
                method: 'PATCH',
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ unsealed: true, updated_at: new Date().toISOString() })
            }).catch(e => console.error("Failed to reconcile allocation unsealed state:", e));
        }

        if (missedFirstScan && unsealRecord) {
            try {
                const alreadyInBag = existingParcels.some((p: any) =>
                    (p.skynetTrackingNumber || p.trackingNumber || p.tracking_number)?.toString() === shipmentRef.toString()
                );

                if (!alreadyInBag) {
                    const newParcelEntry = {
                        trackingNumber: shipment.sender_reference || shipmentRef.toString(),
                        skynetTrackingNumber: shipmentRef.toString(),
                        senderReference: shipment.sender_reference || null,
                        recipientName: shipment.consignee_name || 'Unknown Recipient',
                        city: shipment.consignee_location_name || 'Unknown City',
                        timestamp: new Date().toLocaleTimeString(),
                        missedFirstScanReconciled: true
                    };
                    const updatedParcels = [newParcelEntry, ...existingParcels];
                    const newScannedCount = (unsealRecord.scanned_count || 0) + 1;
                    const newDiscrepancy = newScannedCount - (unsealRecord.expected_count || 0);

                    await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?id=eq.${unsealRecord.id}`, {
                        method: 'PATCH',
                        headers: {
                            ...headers,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            scanned_count: newScannedCount,
                            discrepancy: newDiscrepancy,
                            scanned_parcels: updatedParcels
                        })
                    });
                }
            } catch (e) {
                console.error("Failed to reconcile missed first scan into bag_unsealing:", e);
            }
        }

        // 2. Concurrently resolve details (parallelized step 2 with cache fallbacks)
        const spId = allocation?.service_provider;
        const mappedCityId = allocation?.mapped_city;
        let cityName = shipment.consignee_location_name || "";
        let districtName = shipment.consignee_address_3 || "";
        const mawbRefVal = allocation?.mawb_ref;

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
            mawbRef: allocation?.mawb_ref || undefined,
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

        // 1. Manifest Mismatch Check
        const parcelMawb = allocation?.mawb_ref || shipment?.mawb_ref;
        if (targetMawb && parcelMawb && parcelMawb.trim().toLowerCase() !== targetMawb.trim().toLowerCase()) {
            validationStatus = 'INCORRECT';
            validationReason = 'MANIFEST_MISMATCH';
            validationError = `Manifest Mismatch: Parcel belongs to Manifest "${parcelMawb}", not selected Manifest "${targetMawb}".`;
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

        return NextResponse.json({
            success: validationStatus === 'CORRECT',
            validation: validationStatus,
            reason: validationReason,
            error: validationError,
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
        const getBagParcels = urlObj.searchParams.get('getBagParcels') === 'true';
        const mawbRefParam = urlObj.searchParams.get('mawbRef');
        const bagNumberParam = urlObj.searchParams.get('bagNumber');
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
            const searchMawb = mawbRefParam.trim();
            const cleanSearchMawb = encodeURIComponent(searchMawb);

            let allShipments: any[] = [];
            let offset = 0;
            const limit = 1000;
            let hasMore = true;

            // 1. Primary query on shipments table with ilike matching for MAWB
            while (hasMore) {
                const res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${cleanSearchMawb}&select=bag_number,reference_number&limit=${limit}&offset=${offset}`, { headers });
                if (!res.ok) {
                    break;
                }
                const shipments = await res.json();
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    hasMore = false;
                } else {
                    allShipments = allShipments.concat(shipments);
                    if (shipments.length < limit) hasMore = false;
                    else offset += limit;
                }
            }

            // 2. Query shipments table by bag_number matching searchMawb
            offset = 0;
            hasMore = true;
            while (hasMore) {
                const res = await fetch(`${supabaseUrl}/rest/v1/shipments?bag_number=ilike.*${cleanSearchMawb}*&select=bag_number,reference_number&limit=${limit}&offset=${offset}`, { headers });
                if (!res.ok) break;
                const shipments = await res.json();
                if (!Array.isArray(shipments) || shipments.length === 0) {
                    hasMore = false;
                } else {
                    const existingRefs = new Set(allShipments.map(s => s.reference_number));
                    shipments.forEach(s => {
                        if (!existingRefs.has(s.reference_number)) {
                            allShipments.push(s);
                        }
                    });
                    if (shipments.length < limit) hasMore = false;
                    else offset += limit;
                }
            }

            // 3. Fallback query on shipments_duplicate if primary returned 0 shipments
            if (allShipments.length === 0) {
                offset = 0;
                hasMore = true;
                while (hasMore) {
                    const res = await fetch(`${supabaseUrl}/rest/v1/shipments_duplicate?mawb_reference=ilike.${cleanSearchMawb}&select=bag_number,reference_number&limit=${limit}&offset=${offset}`, { headers });
                    if (!res.ok) break;
                    const shipments = await res.json();
                    if (!Array.isArray(shipments) || shipments.length === 0) {
                        hasMore = false;
                    } else {
                        allShipments = allShipments.concat(shipments);
                        if (shipments.length < limit) hasMore = false;
                        else offset += limit;
                    }
                }
            }

            const bagCountsMap: Record<string, number> = {};
            let unassignedCount = 0;

            allShipments.forEach((s: any) => {
                if (s.bag_number && String(s.bag_number).trim() !== '') {
                    const bNum = String(s.bag_number).trim();
                    bagCountsMap[bNum] = (bagCountsMap[bNum] || 0) + 1;
                } else {
                    unassignedCount++;
                }
            });

            // Also check bag_unsealing table for bags registered for this MAWB
            const unsealRes = await fetch(`${supabaseUrl}/rest/v1/bag_unsealing?mawb_ref=ilike.${cleanSearchMawb}&select=bag_number,expected_count`, { headers });
            if (unsealRes.ok) {
                const unsealed = await unsealRes.json();
                if (Array.isArray(unsealed)) {
                    unsealed.forEach((u: any) => {
                        if (u.bag_number) {
                            const trimmedBag = String(u.bag_number).trim();
                            if (!bagCountsMap[trimmedBag]) {
                                bagCountsMap[trimmedBag] = u.expected_count || 0;
                            }
                        }
                    });
                }
            }

            // For every bag found in bagCountsMap, verify count directly against shipments table
            for (const bNum of Object.keys(bagCountsMap)) {
                const checkShipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?bag_number=ilike.${encodeURIComponent(bNum)}&select=reference_number`, { headers });
                if (checkShipRes.ok) {
                    const shipRows = await checkShipRes.json();
                    if (Array.isArray(shipRows) && shipRows.length > 0) {
                        bagCountsMap[bNum] = shipRows.length;
                    }
                }
            }

            // If unassigned shipments exist for this MAWB, list default synthetic bag for unassigned parcels
            if (unassignedCount > 0) {
                const unassignedBagName = Object.keys(bagCountsMap).length === 0 ? `${searchMawb}-BAG-01` : `${searchMawb}-UNASSIGNED`;
                if (!bagCountsMap[unassignedBagName]) {
                    bagCountsMap[unassignedBagName] = unassignedCount;
                }
            }

            const bagsList = Object.entries(bagCountsMap).map(([bagNumber, expectedCount]) => ({
                bagNumber,
                expectedCount
            }));

            return NextResponse.json({ success: true, bags: bagsList });
        }

        if (getBagParcels && bagNumberParam) {
            const rawBagNum = bagNumberParam.trim();
            const cleanBagNum = encodeURIComponent(rawBagNum);

            let shipments: any[] = [];

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

            // 6. ONLY if no shipments with specific bag_number exist AND bag_number is unassigned/synthetic (e.g. ends with BAG-01 or UNASSIGNED), query unassigned shipments for MAWB
            if ((!Array.isArray(shipments) || shipments.length === 0) && (rawBagNum.includes('-BAG-') || rawBagNum.toLowerCase().includes('bag') || rawBagNum.toLowerCase().includes('unassigned'))) {
                const mawbMatch = rawBagNum.match(/^([0-9]{3}-[0-9]{8})/);
                const mawbRefToSearch = mawbMatch ? mawbMatch[1] : (mawbRefParam || '');

                if (mawbRefToSearch) {
                    res = await fetch(`${supabaseUrl}/rest/v1/shipments?mawb_reference=ilike.${encodeURIComponent(mawbRefToSearch.trim())}&or=(bag_number.is.null,bag_number.eq."")&select=*`, { headers });
                    if (res.ok) {
                        const found = await res.json();
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