import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkyNetParcelData, ZoneRule } from '@/types';

const cleanAddress = (...parts: (string | null | undefined)[]) => {
    return parts.filter(p => p && p.trim() !== "").map(p => p.trim()).join(", ");
};

export async function POST(request: Request) {
    try {
        const { trackingNumber } = await request.json();

        if (!trackingNumber) {
            return NextResponse.json({ success: false, error: 'Missing tracking number' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        const shipmentRef = parseInt(trackingNumber.trim(), 10);
        if (isNaN(shipmentRef)) {
            return NextResponse.json({ success: false, error: 'Invalid barcode format. Expected a numeric shipment reference number.' }, { status: 400 });
        }

        // 1. Fetch service provider allocation
        const spaRes = await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?shipment_ref=eq.${shipmentRef}`, {
            headers: {
                "apikey": anonKey,
                "Authorization": `Bearer ${anonKey}`
            }
        });
        const allocations = await spaRes.json();
        if (!allocations || allocations.length === 0) {
            return NextResponse.json({
                success: false,
                error: `Barcode ${trackingNumber} not found in service provider allocations. Please check the shipment reference.`
            }, { status: 404 });
        }

        const allocation = allocations[0];

        // 2. Fetch shipment details
        const shipRes = await fetch(`${supabaseUrl}/rest/v1/shipments?reference_number=eq.${shipmentRef}`, {
            headers: {
                "apikey": anonKey,
                "Authorization": `Bearer ${anonKey}`
            }
        });
        const shipments = await shipRes.json();
        const shipment = shipments && shipments[0];
        if (!shipment) {
            return NextResponse.json({
                success: false,
                error: `Shipment details not found for reference number ${shipmentRef} in database.`
            }, { status: 404 });
        }

        // 3. Fetch service provider
        let providerName = "Unknown";
        if (allocation.service_provider) {
            const spRes = await fetch(`${supabaseUrl}/rest/v1/service_providers?id=eq.${allocation.service_provider}`, {
                headers: {
                    "apikey": anonKey,
                    "Authorization": `Bearer ${anonKey}`
                }
            });
            const providers = await spRes.json();
            if (providers && providers[0]) {
                providerName = providers[0].name || "Unknown";
            }
        }

        // Normalize provider name (e.g. DOMEX -> Domex, PickMe -> PickMe) for UI bin routing compatibility
        let assignedPartner = providerName;
        if (providerName.toLowerCase() === 'pickme') assignedPartner = 'PickMe';
        else if (providerName.toLowerCase() === 'domex') assignedPartner = 'Domex';
        else if (providerName.toLowerCase() === 'pronto') assignedPartner = 'Pronto';

        // 4. Resolve city mapping details
        let mappedCity = null;
        let cityName = shipment.consignee_location_name || "";
        let districtName = shipment.consignee_address_3 || "";

        if (allocation.mapped_city) {
            const cityRes = await fetch(`${supabaseUrl}/rest/v1/district_city_mapping?id=eq.${allocation.mapped_city}`, {
                headers: {
                    "apikey": anonKey,
                    "Authorization": `Bearer ${anonKey}`
                }
            });
            const cities = await cityRes.json();
            if (cities && cities[0]) {
                mappedCity = cities[0];
                cityName = mappedCity.city || cityName;
                districtName = mappedCity.area_name || districtName;
            }
        } else if (cityName) {
            // Attempt to dynamically find a city mapping
            const cityRes = await fetch(`${supabaseUrl}/rest/v1/district_city_mapping?city=ilike.${cityName}`, {
                headers: {
                    "apikey": anonKey,
                    "Authorization": `Bearer ${anonKey}`
                }
            });
            const cities = await cityRes.json();
            if (cities && cities[0]) {
                mappedCity = cities[0];
                cityName = mappedCity.city;
                districtName = mappedCity.area_name;

                // Silently update the database to link mapped_city permanently
                try {
                    await fetch(`${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocation.id}`, {
                        method: "PATCH",
                        headers: {
                            "apikey": anonKey,
                            "Authorization": `Bearer ${anonKey}`,
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        },
                        body: JSON.stringify({ mapped_city: mappedCity.id })
                    });
                } catch (dbErr) {
                    console.error("Failed to update mapped_city in DB:", dbErr);
                }
            }
        }

        // 5. Fetch zone details
        let assignedZone = "Default-Zone";
        if (mappedCity && mappedCity.zone) {
            const zoneRes = await fetch(`${supabaseUrl}/rest/v1/zones?id=eq.${mappedCity.zone}`, {
                headers: {
                    "apikey": anonKey,
                    "Authorization": `Bearer ${anonKey}`
                }
            });
            const zones = await zoneRes.json();
            if (zones && zones[0]) {
                assignedZone = zones[0].zone_name || "Default-Zone";
            }
        }

        // Translate specific zone codes if needed to match styling
        if (assignedZone === 'Zone-E02') {
            assignedZone = 'Zone C';
        }

        // 6. Fetch MAWB details if reference is present
        let mawbDetails = null;
        if (allocation.mawb_ref) {
            const mawbRes = await fetch(`${supabaseUrl}/rest/v1/mawb?mawb_reference=eq.${allocation.mawb_ref}`, {
                headers: {
                    "apikey": anonKey,
                    "Authorization": `Bearer ${anonKey}`
                }
            });
            const mawbs = await mawbRes.json();
            if (mawbs && mawbs[0]) {
                mawbDetails = mawbs[0];
            }
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
            businessType: shipment.business_type || undefined
        };

        return NextResponse.json({
            success: true,
            parcel: skynetData,
            assignedZone,
            assignedPartner
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
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
        
        const urlObj = new URL(request.url);
        const protocol = urlObj.protocol; // 'http:' or 'https:'
        
        // Construct the URL using server's real local network IP
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