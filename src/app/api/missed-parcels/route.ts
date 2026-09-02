import { NextResponse } from 'next/server';
import { SkyNetParcelData } from '@/types';
import { normalizeWeightToGrams } from '@/lib/weightUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dynamic in-memory caches
const cache = {
    providers: new Map<number, string>(),
    cities: new Map<string, any>(),
    zones: new Map<number, string>(),
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
        console.error("Failed to fetch zones:", e);
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
        console.error("Failed to fetch service providers:", e);
    }

    return cache.providers.get(numId) || "Unknown";
}

const cleanAddress = (...parts: (string | null | undefined)[]) => {
    return parts.filter(p => p && p.trim() !== "").map(p => p.trim()).join(", ");
};

const cleanRecipientAddressLines = (shipment: any) => {
    const rawParts = [
        shipment?.consignee_address_1,
        shipment?.consignee_address_2,
        shipment?.consignee_address_3,
        shipment?.consignee_address_4,
        shipment?.consignee_address_5
    ].filter(p => p && typeof p === 'string' && p.trim() !== '').map(p => p.trim());

    const city = (shipment?.consignee_location_name || '').trim().toLowerCase();
    const state = (shipment?.consignee_state || '').trim().toLowerCase();
    const country = (shipment?.consignee_country_name || 'sri lanka').trim().toLowerCase();
    const countryCode = (shipment?.consignee_country_code || 'lk').trim().toLowerCase();
    const stateBase = state.replace(/\s*province\s*$/i, '').trim();

    const isAdministrativeToken = (t: string) => {
        const lower = t.trim().toLowerCase();
        if (!lower) return true;
        if (countryCode && lower === countryCode) return true;
        if (country && (lower === country || lower === country.replace(/\s+/g, ''))) return true;
        if (state && (lower === state || lower === state.replace(/\s+/g, ''))) return true;
        if (stateBase && (lower === stateBase || lower === `${stateBase} province` || lower === `${stateBase}province`)) return true;
        if (city && (lower === city || lower === city.replace(/\s+/g, ''))) return true;
        return false;
    };

    const filteredLines: string[] = [];
    for (const part of rawParts) {
        const subParts = part.split(',').map(p => p.trim()).filter(Boolean);
        if (subParts.length > 0 && subParts.every(p => isAdministrativeToken(p))) {
            continue;
        }

        let cleanParts = [...subParts];
        while (cleanParts.length > 1 && isAdministrativeToken(cleanParts[cleanParts.length - 1])) {
            cleanParts.pop();
        }

        const cleanLine = cleanParts.join(', ').trim();
        if (cleanLine && !isAdministrativeToken(cleanLine)) {
            const lowerClean = cleanLine.toLowerCase();
            if (!filteredLines.some(l => l.toLowerCase() === lowerClean)) {
                filteredLines.push(cleanLine);
            }
        }
    }

    return filteredLines.length > 0 ? filteredLines.join('\n') : (shipment?.consignee_address_1 || '');
};

async function resolveZoneAndPartner(
    supabaseUrl: string,
    headers: any,
    shipment: any,
    allocation?: any
) {
    const spId = allocation?.service_provider;
    const mappedCityId = allocation?.mapped_city;
    let cityName = shipment?.consignee_location_name || "";
    let districtName = shipment?.consignee_address_3 || "";

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

    let assignedZone = "Default-Zone";
    if (mappedCity && mappedCity.zone) {
        assignedZone = await getZoneName(supabaseUrl, headers, Number(mappedCity.zone));
    }
    if (assignedZone === 'Zone-E02') {
        assignedZone = 'Zone C';
    }

    let assignedPartner = "Unknown";
    if (spId) {
        const rawName = await getProviderName(supabaseUrl, headers, Number(spId));
        assignedPartner = rawName;
        if (rawName.toLowerCase().includes('pickme')) assignedPartner = 'PickMe';
        else if (rawName.toLowerCase().includes('domex')) assignedPartner = 'Domex';
        else if (rawName.toLowerCase().includes('sitrek')) assignedPartner = 'SITREK';
        else if (rawName.toLowerCase().includes('pronto')) assignedPartner = 'Pronto';
    }

    return { assignedZone, assignedPartner, mappedCity, cityName, districtName };
}

function buildFfdxXml(referenceNumber: string, eventId: string = '1558', remarks: string = 'Skynet Warehouse'): string {
    const entityId = process.env.FFDX_ENTITY_ID || '4B71FB68246CD8FD8EBE0D79FAF5273E';
    const entityPin = process.env.FFDX_ENTITY_PIN || 'VeeVA4?37kd';
    const updateId = process.env.FFDX_UPDATE_ENTITY_ID || 'LK7171';

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
    const FFDX_VERSION = process.env.FFDX_VERSION || 'v12';
    const apiUrl = `https://ws05.ffdx.net/ffdx_ws/${FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer`;
    const username = process.env.FFDX_USERNAME || '26AFE6A6F99D1300F43071AE6219FD79';
    const password = process.env.FFDX_PASSWORD || '6044F95F8F096B06083F35DE08A5641B';

    try {
        const xmlStream = buildFfdxXml(referenceNumber, eventId, remarks);
        const body = new URLSearchParams({
            Username: username,
            Password: password,
            xmlStream: xmlStream,
            LevelConfirm: 'summary'
        });

        console.log(`[FFDX] [Missed Parcel Recovery] Uploading tracking event (EventID ${eventId} - ${remarks}) for parcel: ${referenceNumber}`);
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            signal: AbortSignal.timeout(15000)
        });

        const rawText = (await res.text()).trim();
        const cleanContent = rawText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
        const isSuccessStatus = rawText.includes('StatusCode>0') || rawText.toLowerCase().includes('transmitted successfully') || rawText.includes('<Status>1</Status>');
        const isExplicitFailure = rawText.includes('Invalid') || rawText.includes('denied') || rawText.includes('StatusCode>-1') || cleanContent.includes('|-1|');
        const success = res.ok && isSuccessStatus && !isExplicitFailure;
        const trackStatus = success ? 'UPLOADED' : 'FAILED';

        if (allocationId) {
            await fetch(
                `${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocationId}`,
                {
                    method: 'PATCH',
                    headers: { ...supabaseHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ track_status: trackStatus })
                }
            ).catch(e => console.error('[FFDX] Failed to update track_status:', e));
        }

        if (success) {
            console.log(`[FFDX] ✅ Successfully uploaded tracking event (${eventId}) for recovered parcel ${referenceNumber}`);
        } else {
            console.warn(`[FFDX] ⚠️ Upload response for ${referenceNumber}: ${rawText.slice(0, 300)}`);
        }
    } catch (err: any) {
        console.error(`[FFDX] ❌ Connection error for recovered parcel ${referenceNumber}:`, err?.message || err);
        if (allocationId) {
            fetch(
                `${supabaseUrl}/rest/v1/service_provider_allocation?id=eq.${allocationId}`,
                {
                    method: 'PATCH',
                    headers: { ...supabaseHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ track_status: 'FAILED' })
                }
            ).catch(() => {});
        }
    }
}

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateFilter = searchParams.get('date') || '';
        const mawbFilter = searchParams.get('mawb') || '';
        const partnerFilter = searchParams.get('partner') || 'ALL';
        const statusFilter = searchParams.get('status') || 'ALL'; // ALL | PENDING_RECOVERY | RECOVERED
        const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        // Fetch service provider allocations that are explicitly in shortage/missing/shortlanded status
        let spaQuery = `${sb.url}/rest/v1/service_provider_allocation?or=(scan_status.ilike.*SHORTAGE*,scan_status.ilike.*MISSING*,scan_status.ilike.*SHORTLANDED*)&select=id,shipment_ref,mawb_ref,service_provider,unsealed,scan_status,created_at,updated_at,mapped_city&order=updated_at.desc&limit=1500`;

        // Concurrently fetch shortage allocations, recent unsealed bags, and available MAWBs
        const [spaRes, buRes, mawbRes] = await Promise.all([
            fetch(spaQuery, { headers: sb.headers, cache: 'no-store' }),
            fetch(`${sb.url}/rest/v1/bag_unsealing?select=bag_number,mawb_ref,scanned_parcels&order=created_at.desc&limit=200`, { headers: sb.headers, cache: 'no-store' }).catch(() => null),
            fetch(`${sb.url}/rest/v1/mawb?select=mawb_reference,fetched_at&order=fetched_at.desc.nullslast,mawb_created.desc.nullslast&limit=100`, { headers: sb.headers, cache: 'no-store' }).catch(() => null)
        ]);

        if (!spaRes.ok) {
            const errText = await spaRes.text();
            return NextResponse.json({ success: false, error: `Failed to fetch allocations: ${errText}` }, { status: 500 });
        }

        const allAllocations: any[] = await spaRes.json();
        
        // Build fallback parcel -> bagNumber map from bag_unsealing
        const parcelToBagMap: Record<string, string> = {};
        if (buRes && buRes.ok) {
            try {
                const bagsData = await buRes.json();
                if (Array.isArray(bagsData)) {
                    bagsData.forEach((b: any) => {
                        if (b.bag_number && Array.isArray(b.scanned_parcels)) {
                            b.scanned_parcels.forEach((p: any) => {
                                const ref = p.skynetTrackingNumber || p.trackingNumber || p.shipmentRef || p.tracking_number;
                                if (ref) {
                                    parcelToBagMap[String(ref).trim()] = b.bag_number;
                                    parcelToBagMap[String(ref).trim().toLowerCase()] = b.bag_number;
                                }
                            });
                        }
                    });
                }
            } catch (e) {}
        }

        // Build list of all available MAWBs from mawb table (with fetched_at for today-detection)
        const allMawbSet = new Set<string>();
        // Map of mawb_reference -> fetched_at date string
        const mawbFetchedAtMap: Record<string, string> = {};

        // Compute today's date in local timezone (Asia/Colombo)
        const tz = process.env.TZ || 'Asia/Colombo';
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

        if (mawbRes && mawbRes.ok) {
            try {
                const mawbData = await mawbRes.json();
                if (Array.isArray(mawbData)) {
                    mawbData.forEach((m: any) => {
                        if (m.mawb_reference && m.mawb_reference.trim()) {
                            allMawbSet.add(m.mawb_reference.trim());
                            if (m.fetched_at) {
                                mawbFetchedAtMap[m.mawb_reference.trim()] = m.fetched_at;
                            }
                        }
                    });
                }
            } catch (e) {}
        }
        
        // Filter allocations that are strictly shortage, missing, or confirmed shortlanded
        const relevantAllocs = allAllocations.filter((a: any) => {
            const statusUpper = (a.scan_status || '').toUpperCase();
            return statusUpper.startsWith('SHORTAGE') || statusUpper.includes('MISSING') || statusUpper.includes('SHORT') || statusUpper.includes('SHORTLANDED');
        });

        if (relevantAllocs.length === 0) {
            const allMawbRefs0 = Array.from(allMawbSet);
            const mawbListWithDates0 = allMawbRefs0.map(ref => ({
                mawb: ref,
                fetchedAt: mawbFetchedAtMap[ref] || null
            }));
            const todayMawbs0 = allMawbRefs0.filter(ref => {
                const fa = mawbFetchedAtMap[ref];
                if (!fa) return false;
                const dayPart = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fa));
                return dayPart === todayStr;
            });
            return NextResponse.json({
                success: true,
                parcels: [],
                stats: {
                    total: 0,
                    pending: 0,
                    shortlanded: 0,
                    recovered: 0,
                    pickme: 0,
                    domex: 0,
                    sitrek: 0,
                    pronto: 0,
                    other: 0
                },
                mawbList: allMawbRefs0,
                mawbListWithDates: mawbListWithDates0,
                todayMawbs: todayMawbs0
            });
        }

        // Collect shipment refs to fetch shipment details in batch
        const shipmentRefs = Array.from(new Set(relevantAllocs.map(a => a.shipment_ref).filter(Boolean)));
        const shipmentMap: Record<string, any> = {};

        // Batch fetch shipments in chunks of 50 refs
        const chunkSize = 50;
        for (let i = 0; i < shipmentRefs.length; i += chunkSize) {
            const chunk = shipmentRefs.slice(i, i + chunkSize);
            const inList = chunk.map(r => `"${encodeURIComponent(r)}"`).join(',');
            try {
                const shipRes = await fetch(
                    `${sb.url}/rest/v1/shipments?reference_number=in.(${inList})&select=reference_number,sender_reference,bag_number,mawb_reference,consignee_name,consignee_location_name,consignee_address_3,consignee_state,weight,weight_measure,goods_desc,created_at`,
                    { headers: sb.headers, cache: 'no-store' }
                );
                if (shipRes.ok) {
                    const chunkData = await shipRes.json();
                    if (Array.isArray(chunkData)) {
                        chunkData.forEach((s: any) => {
                            if (s.reference_number) {
                                shipmentMap[String(s.reference_number).trim()] = s;
                                shipmentMap[String(s.reference_number).trim().toLowerCase()] = s;
                            }
                        });
                    }
                } else {
                    console.error("Shipments query error:", await shipRes.text());
                }
            } catch (e) {
                console.error("Error fetching shipment chunk:", e);
            }
        }

        const mawbSet = new Set<string>();
        let pendingCount = 0;
        let shortlandedCount = 0;
        let recoveredCount = 0;
        const partnerCounts: Record<string, number> = { PickMe: 0, Domex: 0, SITREK: 0, Pronto: 0, Other: 0 };
        const mappedParcels: any[] = [];

        for (const alloc of relevantAllocs) {
            const ref = String(alloc.shipment_ref || '').trim();
            const shipment = shipmentMap[ref] || shipmentMap[ref.toLowerCase()] || {};
            
            const rawStatus = (alloc.scan_status || '').toUpperCase();
            const isShortlanded = rawStatus.includes('SHORTLANDED');
            const isRecovered = (rawStatus === '1ST_SCAN_DONE' || rawStatus === '2ND_SCAN_DONE') && alloc.unsealed === true;

            const currentStage: 'SHORTAGE' | 'SHORTLANDED' | 'RECOVERED' = isShortlanded ? 'SHORTLANDED' : isRecovered ? 'RECOVERED' : 'SHORTAGE';
            const { assignedZone, assignedPartner, cityName, districtName } = await resolveZoneAndPartner(sb.url, sb.headers, shipment, alloc);
            
            let pName = 'Other';
            if (assignedPartner.includes('PickMe')) pName = 'PickMe';
            else if (assignedPartner.includes('Domex')) pName = 'Domex';
            else if (assignedPartner.includes('SITREK')) pName = 'SITREK';
            else if (assignedPartner.includes('Pronto')) pName = 'Pronto';

            const mawbRef = alloc.mawb_ref || shipment.mawb_reference || shipment.mawb_ref || '-';
            if (mawbRef && mawbRef !== '-') mawbSet.add(mawbRef);

            // Shortage Reason extraction
            let shortageReason = 'Missing in Bag';
            if (alloc.scan_status) {
                if (alloc.scan_status.startsWith('SHORTAGE:')) {
                    shortageReason = alloc.scan_status.replace('SHORTAGE:', '').trim();
                } else if (alloc.scan_status.includes('|')) {
                    shortageReason = alloc.scan_status.split('|')[0].trim();
                } else {
                    shortageReason = alloc.scan_status;
                }
            }

            const resolvedBag = shipment.bag_number || parcelToBagMap[ref] || parcelToBagMap[ref.toLowerCase()] || '-';

            const item = {
                id: alloc.id,
                trackingNumber: ref,
                senderReference: shipment.sender_reference || null,
                mawbReference: mawbRef,
                bagNumber: resolvedBag,
                consigneeName: shipment.consignee_name || 'Unknown Recipient',
                city: cityName || shipment.consignee_location_name || 'Unknown City',
                district: districtName || shipment.consignee_address_3 || '',
                province: shipment.consignee_state || '',
                weight: shipment.weight ? normalizeWeightToGrams(shipment.weight, shipment.weight_measure) : 0,
                assignedPartner: pName,
                assignedZone: assignedZone,
                shortageReason: shortageReason,
                status: currentStage,
                rawScanStatus: alloc.scan_status,
                unsealed: alloc.unsealed === true,
                trackStatus: isRecovered || isShortlanded ? 'UPLOADED' : 'PENDING',
                createdAt: alloc.created_at,
                updatedAt: alloc.updated_at
            };

            // Apply MAWB / Manifest filter check
            if (mawbFilter && mawbFilter !== 'ALL') {
                const cleanMawb = mawbFilter.trim().toLowerCase();
                const itemMawb = (item.mawbReference || '').trim().toLowerCase();
                if (itemMawb !== cleanMawb && !itemMawb.includes(cleanMawb)) {
                    continue;
                }
            }

            // Accumulate stats for the selected manifest / scope
            if (isShortlanded) shortlandedCount++;
            else if (isRecovered) recoveredCount++;
            else pendingCount++;

            if (partnerCounts[pName] !== undefined) {
                partnerCounts[pName]++;
            } else {
                partnerCounts['Other']++;
            }

            // Apply partner & status filter checks
            if (partnerFilter !== 'ALL' && pName.toLowerCase() !== partnerFilter.toLowerCase()) {
                continue;
            }
            if (statusFilter === 'SHORTLANDED' && currentStage !== 'SHORTLANDED') {
                continue;
            }
            if (statusFilter === 'PENDING_RECOVERY' && currentStage !== 'SHORTAGE') {
                continue;
            }
            if (statusFilter === 'RECOVERED' && currentStage !== 'RECOVERED') {
                continue;
            }

            if (searchQuery) {
                const matchRef = item.trackingNumber.toLowerCase().includes(searchQuery);
                const matchSender = (item.senderReference || '').toLowerCase().includes(searchQuery);
                const matchConsignee = item.consigneeName.toLowerCase().includes(searchQuery);
                const matchCity = item.city.toLowerCase().includes(searchQuery);
                const matchBag = item.bagNumber.toLowerCase().includes(searchQuery);
                const matchMawb = item.mawbReference.toLowerCase().includes(searchQuery);
                if (!matchRef && !matchSender && !matchConsignee && !matchCity && !matchBag && !matchMawb) {
                    continue;
                }
            }

            mappedParcels.push(item);
        }

        const totalManifestCount = pendingCount + shortlandedCount + recoveredCount;

        // Build final mawb list with fetched_at metadata
        const allMawbRefs = Array.from(new Set([...allMawbSet, ...mawbSet]));
        const mawbListWithDates = allMawbRefs.map(ref => ({
            mawb: ref,
            fetchedAt: mawbFetchedAtMap[ref] || null
        }));

        // Determine which MAWBs were fetched today (for auto-select on client)
        const todayMawbs = allMawbRefs.filter(ref => {
            const fa = mawbFetchedAtMap[ref];
            if (!fa) return false;
            const dayPart = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fa));
            return dayPart === todayStr;
        });

        return NextResponse.json({
            success: true,
            parcels: mappedParcels,
            stats: {
                total: totalManifestCount,
                pending: pendingCount,
                shortlanded: shortlandedCount,
                recovered: recoveredCount,
                pickme: partnerCounts['PickMe'],
                domex: partnerCounts['Domex'],
                sitrek: partnerCounts['SITREK'],
                pronto: partnerCounts['Pronto'],
                other: partnerCounts['Other']
            },
            mawbList: allMawbRefs,
            mawbListWithDates,
            todayMawbs
        });

    } catch (err: any) {
        console.error("GET /api/missed-parcels error:", err);
        return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const {
            action = 'recover',
            trackingNumber,
            barcode,
            operator = 'System Operator',
            notes = ''
        } = await request.json();

        const inputBarcode = (trackingNumber || barcode || '').trim();
        if (!inputBarcode) {
            return NextResponse.json({ success: false, error: 'Tracking number or barcode is required.' }, { status: 400 });
        }

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database environment variables are not configured.' }, { status: 500 });
        }

        const cleanBar = inputBarcode.trim();
        const encodedBar = encodeURIComponent(cleanBar);

        // Concurrently find shipment and allocation
        const [shipRes, spaRes] = await Promise.all([
            fetch(`${sb.url}/rest/v1/shipments?or=(reference_number.eq.${encodedBar},sender_reference.eq.${encodedBar})&limit=1`, { headers: sb.headers }),
            fetch(`${sb.url}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodedBar}&limit=1`, { headers: sb.headers })
        ]);

        let shipment: any = null;
        if (shipRes.ok) {
            const ships = await shipRes.json();
            shipment = ships && ships[0];
        }

        let allocation: any = null;
        if (spaRes.ok) {
            const allocs = await spaRes.json();
            allocation = allocs && allocs[0];
        }

        // If shipment found by sender_reference (Temu code), ensure allocation is also looked up by shipment.reference_number
        let canonicalRef = shipment ? String(shipment.reference_number) : cleanBar;
        if (!allocation && canonicalRef !== cleanBar) {
            const spaRes2 = await fetch(`${sb.url}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(canonicalRef)}&limit=1`, { headers: sb.headers });
            if (spaRes2.ok) {
                const allocs2 = await spaRes2.json();
                allocation = allocs2 && allocs2[0];
            }
        }

        if (!shipment && !allocation) {
            return NextResponse.json({
                success: false,
                error: 'NOT_FOUND',
                message: `Parcel "${cleanBar}" was not found in the database.`
            }, { status: 404 });
        }

        const isTemuScan = Boolean(
            shipment &&
            shipment.sender_reference &&
            cleanBar.toUpperCase() === shipment.sender_reference.trim().toUpperCase() &&
            cleanBar.toUpperCase() !== shipment.reference_number?.toString().trim().toUpperCase()
        );

        const isShortlandedAction = action === 'shortlanded';
        const nowIso = new Date().toISOString();

        let eventIdToSend: string;
        let remarksToSend: string;
        let nextScanStatus: string;
        let nextUnsealed: boolean;

        if (isShortlandedAction) {
            eventIdToSend = '24';
            remarksToSend = notes ? `Skynet Warehouse: ${notes}` : 'Skynet Warehouse';
            nextScanStatus = 'SHORTLANDED_CONFIRMED';
            nextUnsealed = false;
        } else {
            eventIdToSend = isTemuScan ? '85' : '1558';
            remarksToSend = notes ? `Skynet Warehouse: ${notes}` : 'Skynet Warehouse';
            nextScanStatus = '1ST_SCAN_DONE';
            nextUnsealed = true;
        }

        let finalAllocationId = allocation?.id;

        if (allocation && allocation.id) {
            // Update existing allocation record in service_provider_allocation
            const patchRes = await fetch(`${sb.url}/rest/v1/service_provider_allocation?id=eq.${allocation.id}`, {
                method: 'PATCH',
                headers: sb.headers,
                body: JSON.stringify({
                    unsealed: nextUnsealed,
                    scan_status: nextScanStatus,
                    updated_at: nowIso
                })
            });
            if (!patchRes.ok) {
                const patchErr = await patchRes.text();
                console.error("Failed to patch allocation record:", patchErr);
            }
        } else {
            // Create allocation record if missing
            const postRes = await fetch(`${sb.url}/rest/v1/service_provider_allocation`, {
                method: 'POST',
                headers: sb.headers,
                body: JSON.stringify({
                    shipment_ref: canonicalRef,
                    mawb_ref: shipment?.mawb_reference || shipment?.mawb_ref || null,
                    unsealed: nextUnsealed,
                    scan_status: nextScanStatus,
                    created_at: nowIso,
                    updated_at: nowIso
                })
            });
            if (postRes.ok) {
                const inserted = await postRes.json();
                finalAllocationId = inserted && inserted[0]?.id;
            }
        }

        // Fire-and-forget tracking event upload to FFDX GetonLine (Code 24 for Shortlanded, Code 1558/85 for Recovered)
        uploadToFfdx(canonicalRef, sb.url, sb.headers, finalAllocationId, eventIdToSend, remarksToSend);

        // Resolve Courier Partner and Zone
        const { assignedZone, assignedPartner, mappedCity, cityName, districtName } = await resolveZoneAndPartner(sb.url, sb.headers, shipment || {}, allocation || {});

        const skynetData: SkyNetParcelData = {
            trackingNumber: canonicalRef,
            recipientName: shipment?.consignee_name || "Unknown Recipient",
            recipientPhone: shipment?.consignee_phone || "No Phone",
            recipientAddress: cleanRecipientAddressLines(shipment),
            senderName: shipment?.consignor_name || "Unknown Sender",
            province: shipment?.consignee_state || "Unknown Province",
            district: districtName || shipment?.consignee_address_3 || "Unknown District",
            city: cityName || shipment?.consignee_location_name || "Unknown City",
            weight: shipment?.weight ? normalizeWeightToGrams(shipment.weight, shipment.weight_measure) : 0,
            mawbRef: allocation?.mawb_ref || shipment?.mawb_reference || shipment?.mawb_ref || "Initial Manifest",
            senderReference: shipment?.sender_reference || undefined,
            _scannedVia: isTemuScan ? 'TEMU' : 'SKYNET',
            isTemuScan: isTemuScan,
            scannedMethod: isTemuScan ? 'TEMU' : 'SKYNET'
        };

        return NextResponse.json({
            success: true,
            action: isShortlandedAction ? 'shortlanded' : 'recover',
            parcel: skynetData,
            assignedPartner,
            assignedZone,
            operator,
            recoveredAt: nowIso,
            message: isShortlandedAction
                ? `Parcel "${canonicalRef}" has been confirmed as Shortlanded (Event 24 pushed to GetonLine).`
                : `Parcel "${canonicalRef}" has been recovered successfully and marked as 1st Scan Done.`
        });

    } catch (err: any) {
        console.error("POST /api/missed-parcels error:", err);
        return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
