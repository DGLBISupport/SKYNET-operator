import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
};

const getSupabaseConfig = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return { date: '-', time: '-' };
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { date: '-', time: '-' };
        const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        return {
            date: d.toLocaleDateString('en-GB', dateOptions),
            time: d.toLocaleTimeString('en-GB', timeOptions)
        };
    } catch (e) {
        return { date: '-', time: '-' };
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || searchParams.get('tracking') || '').trim();

        if (!query) {
            return NextResponse.json({
                success: false,
                notFound: true,
                error: 'Please enter a parcel barcode or reference number to track.'
            }, { headers: noCacheHeaders });
        }

        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500, headers: noCacheHeaders });
        }

        const cleanQ = encodeURIComponent(query);

        // 1. Fetch parcel from shipments table by reference_number, sender_reference, or alternate_reference
        const shipRes = await fetch(
            `${sb.url}/rest/v1/shipments?or=(reference_number.ilike.*${cleanQ}*,sender_reference.ilike.*${cleanQ}*,alternate_reference.ilike.*${cleanQ}*,bag_number.ilike.*${cleanQ}*)&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );

        if (!shipRes.ok) {
            const errText = await shipRes.text();
            return NextResponse.json({ success: false, error: `Supabase query error: ${errText}` }, { status: 500, headers: noCacheHeaders });
        }

        const shipData = await shipRes.json();
        if (!Array.isArray(shipData) || shipData.length === 0) {
            return NextResponse.json({
                success: false,
                notFound: true,
                query,
                error: `No parcel found matching barcode/reference "${query}" in Supabase database.`
            }, { headers: noCacheHeaders });
        }

        const shipment = shipData[0];
        const refNum = shipment.reference_number;

        // 2. Fetch service provider allocation
        let allocation: any = null;
        const allocRes = await fetch(
            `${sb.url}/rest/v1/service_provider_allocation?shipment_ref=eq.${encodeURIComponent(refNum)}&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );
        if (allocRes.ok) {
            const allocData = await allocRes.json();
            if (Array.isArray(allocData) && allocData.length > 0) {
                allocation = allocData[0];
            }
        }

        // 3. Resolve service provider name
        let partnerName = 'Unassigned';
        if (allocation && allocation.service_provider !== null && allocation.service_provider !== undefined) {
            const spRes = await fetch(
                `${sb.url}/rest/v1/service_providers?id=eq.${allocation.service_provider}&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            if (spRes.ok) {
                const spData = await spRes.json();
                if (Array.isArray(spData) && spData.length > 0) {
                    partnerName = spData[0].name || partnerName;
                }
            }
        } else if (shipment.shipper_name) {
            partnerName = shipment.shipper_name;
        }

        // 4. Resolve zone name & Zone Allocation step rule:
        let zoneName = '';
        const isStep2Done = Boolean(
            allocation &&
            allocation.mapped_zone !== null &&
            allocation.mapped_zone !== undefined &&
            allocation.mapped_zone !== '' &&
            allocation.mapped_zone !== 0
        );

        if (isStep2Done) {
            const zoneRes = await fetch(
                `${sb.url}/rest/v1/zones?id=eq.${allocation.mapped_zone}&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            if (zoneRes.ok) {
                const zoneData = await zoneRes.json();
                if (Array.isArray(zoneData) && zoneData.length > 0) {
                    zoneName = zoneData[0].zone_name || `Zone ${allocation.mapped_zone}`;
                } else {
                    zoneName = `Zone ${allocation.mapped_zone}`;
                }
            } else {
                zoneName = `Zone ${allocation.mapped_zone}`;
            }
            if (zoneName === 'Zone-E02') {
                zoneName = 'Zone C';
            }
        }

        // 5. Fetch MAWB details if available
        let mawbDetails: any = null;
        if (shipment.mawb_reference) {
            const mawbRes = await fetch(
                `${sb.url}/rest/v1/mawb?mawb_reference=eq.${encodeURIComponent(shipment.mawb_reference)}&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            if (mawbRes.ok) {
                const mawbData = await mawbRes.json();
                if (Array.isArray(mawbData) && mawbData.length > 0) {
                    mawbDetails = mawbData[0];
                }
            }
        }

        // 6. Check bag_unsealing table
        let bagUnsealRecord: any = null;
        if (shipment.bag_number) {
            const unsealRes = await fetch(
                `${sb.url}/rest/v1/bag_unsealing?bag_number=eq.${encodeURIComponent(shipment.bag_number)}&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            if (unsealRes.ok) {
                const unsealData = await unsealRes.json();
                if (Array.isArray(unsealData) && unsealData.length > 0) {
                    bagUnsealRecord = unsealData[0];
                }
            }
        }

        // 7. Check outbound_lmd_bags & outbound_lmd_bag_items tables
        let outboundBagRecord: any = null;
        const outboundRes = await fetch(
            `${sb.url}/rest/v1/outbound_lmd_bags?parcels=cs.[{"referenceNumber":"${refNum}"}]&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );
        if (outboundRes.ok) {
            const outboundData = await outboundRes.json();
            if (Array.isArray(outboundData) && outboundData.length > 0) {
                outboundBagRecord = outboundData[0];
            }
        }

        // Fallback: check outbound_lmd_bag_items table by shipment_ref
        let itemBagRecord: any = null;
        const itemRes = await fetch(
            `${sb.url}/rest/v1/outbound_lmd_bag_items?shipment_ref=eq.${encodeURIComponent(refNum)}&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );
        if (itemRes.ok) {
            const itemData = await itemRes.json();
            if (Array.isArray(itemData) && itemData.length > 0) {
                itemBagRecord = itemData[0];
                if (!outboundBagRecord && itemBagRecord.bag_number) {
                    const bagRes = await fetch(
                        `${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(itemBagRecord.bag_number)}&limit=1`,
                        { headers: sb.headers, cache: 'no-store' }
                    );
                    if (bagRes.ok) {
                        const bagData = await bagRes.json();
                        if (Array.isArray(bagData) && bagData.length > 0) {
                            outboundBagRecord = bagData[0];
                        }
                    }
                }
            }
        }

        // Compute step status flags
        const isStep1Done = true; // Manifest download (shipment row exists)
        const isStep2DoneFinal = isStep2Done;
        const isStep3Done = Boolean(allocation && allocation.service_provider !== null && allocation.service_provider !== undefined && partnerName !== 'Unassigned');
        const isStep4Done = Boolean(allocation?.unsealed || bagUnsealRecord || shipment?.unsealed);
        const scanStatusStr = (allocation?.scan_status || '').toUpperCase();
        const isStep5Done = Boolean(
            scanStatusStr === '2ND_SCAN_DONE' ||
            scanStatusStr === 'VERIFIED' ||
            scanStatusStr === 'SCANNED' ||
            scanStatusStr === 'DISPATCHED' ||
            scanStatusStr === 'COMPLETED' ||
            outboundBagRecord ||
            itemBagRecord
        );
        const isStep6Done = Boolean(
            scanStatusStr === 'DISPATCHED' ||
            outboundBagRecord?.status === 'SEALED' ||
            outboundBagRecord?.status === 'DISPATCHED'
        );

        // Format step dates
        const step1Dt = formatDate(shipment.created_at || mawbDetails?.created_at || mawbDetails?.fetched_at);
        const step2Dt = formatDate(allocation?.created_at || shipment.created_at);
        const step3Dt = formatDate(allocation?.updated_at || allocation?.created_at || shipment.created_at);
        const step4Dt = formatDate(bagUnsealRecord?.created_at || allocation?.updated_at);
        const step5Dt = formatDate(itemBagRecord?.created_at || outboundBagRecord?.created_at || allocation?.updated_at);
        const step6Dt = formatDate(outboundBagRecord?.sealed_at || outboundBagRecord?.updated_at || allocation?.updated_at);

        const steps = [
            {
                stepNumber: 1,
                title: 'Manifest Download',
                subtitle: 'Download shipment data',
                status: isStep1Done ? 'COMPLETED' : 'PENDING',
                date: isStep1Done ? step1Dt.date : '-',
                time: isStep1Done ? step1Dt.time : '-',
                location: `${shipment.origin_country_name || shipment.origin_location_code || 'Origin'} -> ${shipment.dest_location_name || 'Colombo'}`,
                activity: 'Manifest Download',
                notes: `MAWB Ref: ${shipment.mawb_reference || 'N/A'}`,
                enteredBy: mawbDetails?.manifested_by || 'Manifest Upload Engine'
            },
            {
                stepNumber: 2,
                title: 'Zone Allocation',
                subtitle: 'Assign shipments to zones',
                status: isStep2DoneFinal ? 'COMPLETED' : 'PENDING',
                date: isStep2DoneFinal ? step2Dt.date : '-',
                time: isStep2DoneFinal ? step2Dt.time : '-',
                location: isStep2DoneFinal ? (shipment.consignee_location_name || shipment.consignee_address_3 || 'Destination Zone') : 'Pending Allocation',
                activity: 'Zone Allocation',
                notes: isStep2DoneFinal ? `Assigned Zone: ${zoneName}` : 'Pending Zone Allocation (mapped_zone is null)',
                enteredBy: 'Zone Engine'
            },
            {
                stepNumber: 3,
                title: 'Service Provider',
                subtitle: 'Allocate shipments',
                status: isStep3Done ? 'COMPLETED' : 'PENDING',
                date: isStep3Done ? step3Dt.date : '-',
                time: isStep3Done ? step3Dt.time : '-',
                location: isStep3Done ? 'Sorting Hub' : 'Pending Allocation',
                activity: 'Service Provider',
                notes: isStep3Done ? `Provider: ${partnerName}` : 'Pending Provider Allocation',
                enteredBy: 'Service Allocator'
            },
            {
                stepNumber: 4,
                title: 'Box Unsealing (1st scan)',
                subtitle: 'Scan & unseal boxes',
                status: isStep4Done ? 'COMPLETED' : 'PENDING',
                date: isStep4Done ? step4Dt.date : '-',
                time: isStep4Done ? step4Dt.time : '-',
                location: isStep4Done ? 'Warehouse Unsealing Floor' : 'Pending Unsealing',
                activity: 'Box Unsealing (1st scan)',
                notes: isStep4Done ? `Bag/Box: ${shipment.bag_number || 'N/A'}` : 'Pending Box Unsealing (1st scan)',
                enteredBy: bagUnsealRecord?.unsealed_by || '1st Scan Operator'
            },
            {
                stepNumber: 5,
                title: 'Verification (2nd scan)',
                subtitle: 'Verify parcel details',
                status: isStep5Done ? 'COMPLETED' : 'PENDING',
                date: isStep5Done ? step5Dt.date : '-',
                time: isStep5Done ? step5Dt.time : '-',
                location: isStep5Done ? 'Outbound Verification Station' : 'Pending Verification',
                activity: 'Verification (2nd scan)',
                notes: isStep5Done ? `LMD Verification (Status: ${allocation?.scan_status || 'VERIFIED'})` : 'Pending 2nd Scan Verification',
                enteredBy: itemBagRecord?.scanned_by || '2nd Scan Operator'
            },
            {
                stepNumber: 6,
                title: 'Dispatched',
                subtitle: 'Handed to courier',
                status: isStep6Done ? 'COMPLETED' : isStep5Done ? 'IN_PROGRESS' : 'PENDING',
                date: isStep6Done ? step6Dt.date : '-',
                time: isStep6Done ? step6Dt.time : '-',
                location: isStep6Done ? 'Outbound Courier Gate' : 'Pending Dispatch',
                activity: 'Dispatched',
                notes: isStep6Done ? `Handed over to ${partnerName}` : 'Pending Dispatch',
                enteredBy: outboundBagRecord?.sealed_by || 'Dispatch Supervisor'
            }
        ];

        // Filter tracking History so Activity ONLY includes our 6 steps that are reached/completed in database
        const trackingHistory: any[] = [];

        if (isStep1Done) {
            trackingHistory.push({
                date: step1Dt.date,
                time: step1Dt.time,
                location: `${shipment.origin_country_name || 'Origin'} -> ${shipment.dest_location_name || 'Colombo'}`,
                activity: 'Manifest Download',
                notes: `MAWB Ref: ${shipment.mawb_reference || 'N/A'}`,
                enteredBy: mawbDetails?.manifested_by || 'System Ingestion',
                receivedUTC: step1Dt.date,
                sentUTC: step1Dt.date
            });
        }
        if (isStep2DoneFinal) {
            trackingHistory.push({
                date: step2Dt.date,
                time: step2Dt.time,
                location: shipment.consignee_location_name || shipment.consignee_address_3 || 'Colombo Hub',
                activity: 'Zone Allocation',
                notes: `Assigned Zone: ${zoneName}`,
                enteredBy: 'Zone Engine',
                receivedUTC: step2Dt.date,
                sentUTC: step2Dt.date
            });
        }
        if (isStep3Done) {
            trackingHistory.push({
                date: step3Dt.date,
                time: step3Dt.time,
                location: 'Sorting Hub',
                activity: 'Service Provider',
                notes: `Allocated to: ${partnerName}`,
                enteredBy: 'Allocation Engine',
                receivedUTC: step3Dt.date,
                sentUTC: step3Dt.date
            });
        }
        if (isStep4Done) {
            trackingHistory.push({
                date: step4Dt.date,
                time: step4Dt.time,
                location: 'Warehouse Floor',
                activity: 'Box Unsealing (1st scan)',
                notes: `Bag/Box: ${shipment.bag_number || 'N/A'}`,
                enteredBy: bagUnsealRecord?.unsealed_by || '1st Scan Operator',
                receivedUTC: step4Dt.date,
                sentUTC: step4Dt.date
            });
        }
        if (isStep5Done) {
            trackingHistory.push({
                date: step5Dt.date,
                time: step5Dt.time,
                location: 'Verification Station',
                activity: 'Verification (2nd scan)',
                notes: `Status: ${allocation?.scan_status || 'VERIFIED'}`,
                enteredBy: itemBagRecord?.scanned_by || '2nd Scan Operator',
                receivedUTC: step5Dt.date,
                sentUTC: step5Dt.date
            });
        }
        if (isStep6Done) {
            trackingHistory.push({
                date: step6Dt.date,
                time: step6Dt.time,
                location: 'Outbound Gate',
                activity: 'Dispatched',
                notes: `Courier: ${partnerName}`,
                enteredBy: outboundBagRecord?.sealed_by || 'Dispatch Team',
                receivedUTC: step6Dt.date,
                sentUTC: step6Dt.date
            });
        }

        // Overall status label
        let overallStatus = 'Manifest Downloaded';
        if (isStep6Done) overallStatus = 'Dispatched';
        else if (isStep5Done) overallStatus = 'Verification (2nd Scan Done)';
        else if (isStep4Done) overallStatus = 'Box Unsealed (1st Scan Done)';
        else if (isStep3Done) overallStatus = 'Service Provider Allocated';
        else if (isStep2DoneFinal) overallStatus = 'Zone Allocated';

        // Manifest info array from database
        const manifestInfo = [
            {
                date: step1Dt.date !== '-' ? `${step1Dt.date} ${step1Dt.time}` : '-',
                docketNo: shipment.mawb_reference || shipment.bag_number || refNum,
                senderNo: shipment.shipper_code || shipment.consignor_name || 'Skynet Ingestion',
                receiver: `${shipment.consignee_name || 'Recipient'} (${shipment.dest_location_name || 'Colombo'})`,
                from: shipment.origin_country_name || shipment.origin_location_name || 'Origin',
                to: shipment.dest_location_name || shipment.consignee_country_name || 'Colombo',
                flight: mawbDetails?.travel_id || 'Direct Air Flight',
                carrier: mawbDetails?.carrier || shipment.shipper_name || 'Cargo Express',
                type: shipment.shipment_type || 'Parcel B',
                cons: String(shipment.num_of_items || 1),
                status: isStep6Done ? 'Dispatched' : 'Active',
                receivedUTC: step1Dt.date,
                sentUTC: isStep6Done ? step6Dt.date : '-'
            }
        ];

        // Sender Info from database
        const senderInfo = {
            name: shipment.consignor_name || 'Skynet Ingest / Shipper',
            address: [
                shipment.consignor_address_1,
                shipment.consignor_address_2,
                shipment.consignor_location_name,
                shipment.consignor_country_name
            ].filter(Boolean).join(', ') || 'Origin Logistics Hub',
            phone: shipment.consignor_phone || '-',
            senderReference: shipment.sender_reference || shipment.alternate_reference || refNum
        };

        // Receiver Info from database
        const receiverInfo = {
            name: shipment.consignee_name || 'Recipient',
            address: [
                shipment.consignee_address_1,
                shipment.consignee_address_2,
                shipment.consignee_address_3,
                shipment.consignee_location_name,
                shipment.consignee_country_name
            ].filter(Boolean).join(', ') || 'Destination Address',
            phone: shipment.consignee_phone || shipment.consignee_contact || '-',
            email: shipment.consignee_email || '-'
        };

        // Shipment specs from database
        const shipmentInfo = {
            type: shipment.service_type || 'Express Non-Document',
            goodsDesc: shipment.goods_desc || 'General Goods',
            itemsCount: String(shipment.num_of_items || 1),
            weight: shipment.weight ? `${shipment.weight} ${shipment.weight_measure || 'g'}` : '-',
            deadWeight: shipment.dead_weight ? `${shipment.dead_weight} g` : '-',
            cubicWeight: shipment.customer_declared_weight ? `${shipment.customer_declared_weight} g` : '-',
            codAmount: shipment.cod_amount ? `${shipment.cod_amount} ${shipment.cod_currency_code || 'LKR'}` : '0.00',
            customsValue: shipment.customs_value ? `${shipment.customs_currency_code || 'LKR'} ${shipment.customs_value}` : '-',
            location: shipment.consignee_location_name || shipment.dest_location_name || 'Sri Lanka',
            bagNo: outboundBagRecord?.bag_number || itemBagRecord?.bag_number || shipment.bag_number || '-',
            partner: partnerName,
            clearanceRef: shipment.clearance_reference || '-',
            createdBy: shipment.consignor_name || 'System Upload',
            incoterms: shipment.incoterms || '-',
            skuNumber: '-',
            harmonisedCode: shipment.harmonised_code || '-',
            duties: '-',
            vat: '-',
            insurance: shipment.insurance_value ? `${shipment.insurance_value} ${shipment.insurance_currency_code || ''}` : '-',
            typeOfBusiness: shipment.business_type || '-',
            pudoAgent: '-',
            pudoCode: '-'
        };

        return NextResponse.json({
            success: true,
            connoteNo: refNum,
            serviceType: shipment.service_type || 'Express Parcel Allocation',
            destination: `${shipment.dest_location_name || shipment.consignee_location_name || 'Sri Lanka'}`,
            status: overallStatus,
            deliveredOn: isStep6Done ? `${step6Dt.date} ${step6Dt.time}` : 'In Progress',
            signedBy: isStep6Done ? partnerName : 'Logistics Operational Staff',
            steps,
            trackingHistory,
            manifestInfo,
            senderInfo,
            receiverInfo,
            shipmentInfo,
            fetchedAt: new Date().toISOString()
        }, { headers: noCacheHeaders });

    } catch (err: any) {
        console.error("Tracking API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: noCacheHeaders });
    }
}

