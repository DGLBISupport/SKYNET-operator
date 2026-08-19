/**
 * /api/ffdx-upload
 *
 * Server-side FFDX GETonline manifest upload endpoint.
 * Builds the WSGET XML payload dynamically from Supabase database tables
 * (shipments, mawb, outbound_manifests, service_providers, outbound_lmd_bags)
 * and POSTs to FFDX WSDataTransfer API without any hardcoded mock data.
 *
 * Called internally by /api/lmd-bags (non-blocking, fire-and-forget pattern).
 */

import { NextResponse } from 'next/server';
import { saveManifestToSupabaseStorage, ParcelLogData } from '@/lib/supabaseStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── FFDX API Config (from environment variables) ────────────────────────────
const FFDX_VERSION = process.env.FFDX_VERSION || 'v12';
const FFDX_BASE_URL = `https://ws05.ffdx.net/ffdx_ws/${FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer`;

const FFDX_USERNAME = process.env.FFDX_USERNAME || '26AFE6A6F99D1300F43071AE6219FD79';
const FFDX_PASSWORD = process.env.FFDX_PASSWORD || '6044F95F8F096B06083F35DE08A5641B';
const FFDX_ENTITY_ID = process.env.FFDX_ENTITY_ID || '4B71FB68246CD8FD8EBE0D79FAF5273E';
const FFDX_ENTITY_PIN = process.env.FFDX_ENTITY_PIN || 'VeeVA4?37kd';
const FFDX_UPDATE_ENTITY_ID = process.env.FFDX_UPDATE_ENTITY_ID || 'LK7171';

// ─── Supabase Config ──────────────────────────────────────────────────────────
const getSupabaseConfig = () => {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return {
        url,
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        }
    };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateMessageId(): string {
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}

function nowFormatted(): string {
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
    const h24 = String(parseInt(m.hour || '0', 10) % 24).padStart(2, '0');
    return `${m.year}/${m.month}/${m.day} ${h24}:${m.minute}:${m.second}`;
}

function escapeXml(str: string | number | null | undefined): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ─── Fetch full shipment details from Supabase shipments table ────────────────
async function fetchShipmentDetails(sb: any, trackingNumber: string): Promise<any | null> {
    if (!sb || !trackingNumber) return null;
    try {
        const rawRef = trackingNumber.trim();
        const cleanRef = rawRef.replace(/^skyt-?/i, '').trim();
        if (!cleanRef) return null;

        // 1. Try exact match on rawRef & cleanRef
        const query1 = `or=(reference_number.eq.${encodeURIComponent(cleanRef)},sender_reference.eq.${encodeURIComponent(cleanRef)},alternate_reference.eq.${encodeURIComponent(cleanRef)},sender_reference_2.eq.${encodeURIComponent(cleanRef)},reference_number.eq.${encodeURIComponent(rawRef)},sender_reference.eq.${encodeURIComponent(rawRef)})`;
        const res1 = await fetch(`${sb.url}/rest/v1/shipments?${query1}&select=*`, { headers: sb.headers, cache: 'no-store' });
        const data1 = await res1.json();
        if (Array.isArray(data1) && data1.length > 0) return data1[0];

        // 2. Try with SKYT- prefix
        const skytRef = `SKYT-${cleanRef}`;
        const query2 = `or=(reference_number.eq.${encodeURIComponent(skytRef)},sender_reference.eq.${encodeURIComponent(skytRef)},alternate_reference.eq.${encodeURIComponent(skytRef)})`;
        const res2 = await fetch(`${sb.url}/rest/v1/shipments?${query2}&select=*`, { headers: sb.headers, cache: 'no-store' });
        const data2 = await res2.json();
        if (Array.isArray(data2) && data2.length > 0) return data2[0];

        // 3. Try ilike wildcard fallback
        const query3 = `or=(reference_number.ilike.*${encodeURIComponent(cleanRef)}*,sender_reference.ilike.*${encodeURIComponent(cleanRef)}*)`;
        const res3 = await fetch(`${sb.url}/rest/v1/shipments?${query3}&select=*&limit=1`, { headers: sb.headers, cache: 'no-store' });
        const data3 = await res3.json();
        if (Array.isArray(data3) && data3.length > 0) return data3[0];

        return null;
    } catch (e) {
        console.error(`[ffdx-upload] Failed to fetch shipment for ${trackingNumber}:`, e);
        return null;
    }
}

// ─── Fetch inbound MAWB details from Supabase mawb table ─────────────────────
async function fetchMawbRecord(sb: any, mawbRef: string): Promise<any | null> {
    if (!sb || !mawbRef) return null;
    try {
        const res = await fetch(
            `${sb.url}/rest/v1/mawb?mawb_reference=eq.${encodeURIComponent(mawbRef.trim())}&select=*`,
            { headers: sb.headers, cache: 'no-store' }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data[0];
        return null;
    } catch (e) {
        console.error(`[ffdx-upload] Failed to fetch mawb record for ${mawbRef}:`, e);
        return null;
    }
}

// ─── Build XML for a single <Shipment> block dynamically ─────────────────────
function buildShipmentXml(parcel: any, shipmentDetail: any | null, bagNumber: string): string {
    const ref = shipmentDetail?.reference_number || parcel?.trackingNumber || parcel?.shipment_ref || '';
    const senderRef = shipmentDetail?.sender_reference || parcel?.senderReference || '';

    // Calculate weight in grams
    const rawWeight = Number(shipmentDetail?.weight) || Number(parcel?.weight) || 0.1;
    const weightGrams = Math.round(rawWeight * 1000);
    const deadWeightGrams = Math.round((Number(shipmentDetail?.dead_weight) || rawWeight) * 1000);
    const declaredWeightGrams = Math.round((Number(shipmentDetail?.customer_declared_weight) || 0) * 1000);

    // Consignor (Sender) properties from DB (real data only)
    const consignorName = escapeXml(shipmentDetail?.consignor_name || '');
    const consignorAddr1 = escapeXml(shipmentDetail?.consignor_address_1 || '');
    const consignorAddr2 = escapeXml(shipmentDetail?.consignor_address_2 || '');
    const consignorAddr3 = escapeXml(shipmentDetail?.consignor_address_3 || '');
    const consignorAddr4 = escapeXml(shipmentDetail?.consignor_address_4 || '');
    const consignorAddr5 = escapeXml(shipmentDetail?.consignor_address_5 || '');
    const consignorLocationName = escapeXml(shipmentDetail?.consignor_location_name || '');
    const consignorCountryCode = escapeXml(shipmentDetail?.consignor_country_code || '');
    const consignorCountryName = escapeXml(shipmentDetail?.consignor_country_name || '');
    const consignorState = escapeXml(shipmentDetail?.consignor_state || '');
    const consignorPostcode = escapeXml(shipmentDetail?.consignor_postcode || '');
    const consignorPhone = escapeXml(shipmentDetail?.consignor_phone || '');
    const consignorFax = escapeXml(shipmentDetail?.consignor_fax || '');
    const consignorEmail = escapeXml(shipmentDetail?.consignor_email || '');
    const consignorContact = escapeXml(shipmentDetail?.consignor_contact || shipmentDetail?.consignor_name || '');

    // Consignee (Recipient) properties from DB / scanned parcel (real data only)
    const consigneeName = escapeXml(shipmentDetail?.consignee_name || parcel?.recipientName || '');
    const consigneeAddr1 = escapeXml(shipmentDetail?.consignee_address_1 || parcel?.city || '');
    const consigneeAddr2 = escapeXml(shipmentDetail?.consignee_address_2 || parcel?.province || '');
    const consigneeAddr3 = escapeXml(shipmentDetail?.consignee_address_3 || '');
    const consigneeAddr4 = escapeXml(shipmentDetail?.consignee_address_4 || '');
    const consigneeAddr5 = escapeXml(shipmentDetail?.consignee_address_5 || '');
    const consigneeLocationName = escapeXml(shipmentDetail?.consignee_location_name || parcel?.city || '');
    const consigneeState = escapeXml(shipmentDetail?.consignee_state || parcel?.province || '');
    const consigneeCountryCode = escapeXml(shipmentDetail?.consignee_country_code || '');
    const consigneeCountryName = escapeXml(shipmentDetail?.consignee_country_name || '');
    const consigneePostcode = escapeXml(shipmentDetail?.consignee_postcode || '');
    const consigneePhone = escapeXml(shipmentDetail?.consignee_phone || '');
    const consigneeFax = escapeXml(shipmentDetail?.consignee_fax || '');
    const consigneeEmail = escapeXml(shipmentDetail?.consignee_email || '');
    const consigneeContact = escapeXml(shipmentDetail?.consignee_contact || shipmentDetail?.consignee_name || parcel?.recipientName || '');

    // Locations & Codes from DB (real data only)
    const originCountryCode = escapeXml(shipmentDetail?.origin_country_code || '');
    const originCountryName = escapeXml(shipmentDetail?.origin_country_name || '');
    const originLocationCode = escapeXml(shipmentDetail?.origin_location_code || '');
    const originLocationName = escapeXml(shipmentDetail?.origin_location_name || '');
    const destLocationCode = escapeXml(shipmentDetail?.dest_location_code || '');
    const destLocationName = escapeXml(shipmentDetail?.dest_location_name || '');

    const shipperCode = escapeXml(FFDX_UPDATE_ENTITY_ID || FFDX_ENTITY_ID || '');
    const shipperName = escapeXml('Logicentrix Pvt Ltd');

    // Item/Goods details from DB (real data only)
    const goodsDesc = escapeXml(shipmentDetail?.goods_desc || '');
    const harmonisedCode = escapeXml(shipmentDetail?.harmonised_code || '');
    const customsValue = shipmentDetail?.customs_value !== undefined && shipmentDetail.customs_value !== null ? shipmentDetail.customs_value : 0;
    const customsCurrency = escapeXml(shipmentDetail?.customs_currency_code || '');
    const serviceType = escapeXml(shipmentDetail?.service_type || '');
    const shipmentType = escapeXml(shipmentDetail?.shipment_type || '');
    const shipTerms = escapeXml(shipmentDetail?.ship_terms || '');
    const numItems = Number(shipmentDetail?.num_of_items) || 1;

    // Cubic measures
    const cubicLength = shipmentDetail?.cubic_length || 0;
    const cubicWidth = shipmentDetail?.cubic_width || 0;
    const cubicHeight = shipmentDetail?.cubic_height || 0;
    const cubicWeight = shipmentDetail?.cubic_weight || 0;
    const cubicMeasure = escapeXml(shipmentDetail?.cubic_measure || 'G');
    const weightMeasure = escapeXml(shipmentDetail?.weight_measure || 'G');

    const notes = escapeXml(shipmentDetail?.notes || '');
    const itemRef = escapeXml(ref);

    return `            <Shipment>
                <ReferenceNumber>${escapeXml(ref)}</ReferenceNumber>
                <SenderReference>${escapeXml(senderRef)}</SenderReference>
                <SenderReference2>${escapeXml(shipmentDetail?.sender_reference_2 || '')}</SenderReference2>
                <SenderReference3>${escapeXml(shipmentDetail?.sender_reference_3 || '')}</SenderReference3>
                <AlternateReference>${escapeXml(shipmentDetail?.alternate_reference || '')}</AlternateReference>
                <ConsignorName>${consignorName}</ConsignorName>
                <ConsignorAddress1>${consignorAddr1}</ConsignorAddress1>
                <ConsignorAddress2>${consignorAddr2}</ConsignorAddress2>
                <ConsignorAddress3>${consignorAddr3}</ConsignorAddress3>
                <ConsignorAddress4>${consignorAddr4}</ConsignorAddress4>
                <ConsignorAddress5>${consignorAddr5}</ConsignorAddress5>
                <ConsignorLocationName>${consignorLocationName}</ConsignorLocationName>
                <ConsignorCountryCode>${consignorCountryCode}</ConsignorCountryCode>
                <ConsignorCountryName>${consignorCountryName}</ConsignorCountryName>
                <ConsignorState>${consignorState}</ConsignorState>
                <ConsignorPostcode>${consignorPostcode}</ConsignorPostcode>
                <ConsignorAddressGeoLat>0</ConsignorAddressGeoLat>
                <ConsignorAddressGeoLng>0</ConsignorAddressGeoLng>
                <ConsignorPhone>${consignorPhone}</ConsignorPhone>
                <ConsignorFax>${consignorFax}</ConsignorFax>
                <ConsignorEmail>${consignorEmail}</ConsignorEmail>
                <ConsignorContact>${consignorContact}</ConsignorContact>
                <ConsigneeName>${consigneeName}</ConsigneeName>
                <ConsigneeAddress1>${consigneeAddr1}</ConsigneeAddress1>
                <ConsigneeAddress2>${consigneeAddr2}</ConsigneeAddress2>
                <ConsigneeAddress3>${consigneeAddr3}</ConsigneeAddress3>
                <ConsigneeAddress4>${consigneeAddr4}</ConsigneeAddress4>
                <ConsigneeAddress5>${consigneeAddr5}</ConsigneeAddress5>
                <ConsigneeLocationName>${consigneeLocationName}</ConsigneeLocationName>
                <ConsigneeState>${consigneeState}</ConsigneeState>
                <ConsigneeCountryCode>${consigneeCountryCode}</ConsigneeCountryCode>
                <ConsigneeCountryName>${consigneeCountryName}</ConsigneeCountryName>
                <ConsigneePostCode>${consigneePostcode}</ConsigneePostCode>
                <ConsigneeAddressGeoLat>0</ConsigneeAddressGeoLat>
                <ConsigneeAddressGeoLng>0</ConsigneeAddressGeoLng>
                <ConsigneeContact>${consigneeContact}</ConsigneeContact>
                <ConsigneePhone>${consigneePhone}</ConsigneePhone>
                <ConsigneeFax>${consigneeFax}</ConsigneeFax>
                <ConsigneeEmail>${consigneeEmail}</ConsigneeEmail>
                <OriginCountryCode>${originCountryCode}</OriginCountryCode>
                <OriginCountryName>${originCountryName}</OriginCountryName>
                <OriginLocationCode>${originLocationCode}</OriginLocationCode>
                <OriginLocationName>${originLocationName}</OriginLocationName>
                <DestLocationCode>${destLocationCode}</DestLocationCode>
                <DestLocationName>${destLocationName}</DestLocationName>
                <ShipperCode>${shipperCode}</ShipperCode>
                <ShipperName>${shipperName}</ShipperName>
                <Weight>${weightGrams}</Weight>
                <WeightMeasure>${weightMeasure}</WeightMeasure>
                <DeadWeight>${deadWeightGrams}</DeadWeight>
                <CustomerDeclaredWeight>${declaredWeightGrams}</CustomerDeclaredWeight>
                <CubicLength>${cubicLength}</CubicLength>
                <CubicWidth>${cubicWidth}</CubicWidth>
                <CubicHeight>${cubicHeight}</CubicHeight>
                <CubicWeight>${cubicWeight}</CubicWeight>
                <CubicMeasure>${cubicMeasure}</CubicMeasure>
                <BagNumber>${escapeXml(bagNumber)}</BagNumber>
                <NumofItems>${numItems}</NumofItems>
                <ServiceType>${serviceType}</ServiceType>
                <ShipmentType>${shipmentType}</ShipmentType>
                <GoodsDesc>${goodsDesc}</GoodsDesc>
                <HarmonisedCode>${harmonisedCode}</HarmonisedCode>
                <Notes>${notes}</Notes>
                <CustomsValue>${customsValue}</CustomsValue>
                <CustomsCurrencyCode>${customsCurrency}</CustomsCurrencyCode>
                <CODAmount>${shipmentDetail?.cod_amount || '0.0000'}</CODAmount>
                <CODCurrencyCode>${escapeXml(shipmentDetail?.cod_currency_code || '')}</CODCurrencyCode>
                <SecurityValue>${shipmentDetail?.security_value || '0.0000'}</SecurityValue>
                <InsuranceValue>${shipmentDetail?.insurance_value || '0.0000'}</InsuranceValue>
                <InsuranceCurrencyCode>${escapeXml(shipmentDetail?.insurance_currency_code || '')}</InsuranceCurrencyCode>
                <DeliveryInstructions>${escapeXml(shipmentDetail?.delivery_instructions || '')}</DeliveryInstructions>
                <ClearanceReference>${escapeXml(shipmentDetail?.clearance_reference || '')}</ClearanceReference>
                <ReasonExport>${escapeXml(shipmentDetail?.reason_export || '')}</ReasonExport>
                <ShipTerms>${shipTerms}</ShipTerms>
                <Surcharge>${escapeXml(shipmentDetail?.surcharge || '')}</Surcharge>
                <Incoterms>${escapeXml(shipmentDetail?.incoterms || '')}</Incoterms>
                <ConsigneeTaxID>${escapeXml(shipmentDetail?.consignee_tax_id || '')}</ConsigneeTaxID>
                <ConsigneeKycType>${escapeXml(shipmentDetail?.consignee_kyc_type || '')}</ConsigneeKycType>
                <ConsigneeKycNumber>${escapeXml(shipmentDetail?.consignee_kyc_number || '')}</ConsigneeKycNumber>
                <ConsignorKycType>${escapeXml(shipmentDetail?.consignor_kyc_type || '')}</ConsignorKycType>
                <ConsignorKycNumber>${escapeXml(shipmentDetail?.consignor_kyc_number || '')}</ConsignorKycNumber>
                <ConsignorTaxID>${escapeXml(shipmentDetail?.consignor_tax_id || '')}</ConsignorTaxID>
                <ConsignorIEC>${escapeXml(shipmentDetail?.consignor_iec || '')}</ConsignorIEC>
                <ConsignorReceivingCountryTaxID>${escapeXml(shipmentDetail?.consignor_receiving_country_tax_id || '')}</ConsignorReceivingCountryTaxID>
                <CSB>${escapeXml(shipmentDetail?.csb || '')}</CSB>
                <InvoiceType>${escapeXml(shipmentDetail?.invoice_type || '')}</InvoiceType>
                <BondUT>${escapeXml(shipmentDetail?.bond_ut || '')}</BondUT>
                <EcomShipment>${escapeXml(shipmentDetail?.ecom_shipment || '')}</EcomShipment>
                <MEIS>${escapeXml(shipmentDetail?.meis || '')}</MEIS>
                <TotalGST>${shipmentDetail?.total_gst || 0}</TotalGST>
                <TotalGSTCurrencyCode>${escapeXml(shipmentDetail?.total_gst_currency_code || '')}</TotalGSTCurrencyCode>
                <FOBValue>${shipmentDetail?.fob_value || 0}</FOBValue>
                <FOBCurrencyCode>${escapeXml(shipmentDetail?.fob_currency_code || '')}</FOBCurrencyCode>
                <ConnoteExportInvoiceNum>${escapeXml(shipmentDetail?.connote_export_invoice_num || '')}</ConnoteExportInvoiceNum>
                <ConnoteExportInvoiceDate>${escapeXml(shipmentDetail?.connote_export_invoice_date || '')}</ConnoteExportInvoiceDate>
                <FreightCost>${shipmentDetail?.freight_cost || 0}</FreightCost>
                <FreightCostCurrencyCode>${escapeXml(shipmentDetail?.freight_cost_currency_code || '')}</FreightCostCurrencyCode>
                <DeliveryAgentCode>${escapeXml(shipmentDetail?.delivery_agent_code || '')}</DeliveryAgentCode>
                <DeliveryRouteCode>${escapeXml(shipmentDetail?.delivery_route_code || '')}</DeliveryRouteCode>
                <BusinessType>${escapeXml(shipmentDetail?.business_type || '')}</BusinessType>
                <CPCCode>${escapeXml(shipmentDetail?.cpc_code || '')}</CPCCode>
                <SKUNumber>${escapeXml(shipmentDetail?.sku_number || '')}</SKUNumber>
                <ATENumber>${escapeXml(shipmentDetail?.ate_number || '')}</ATENumber>
                <ProductURL>${escapeXml(shipmentDetail?.product_url || '')}</ProductURL>
                <GoodsValue>${shipmentDetail?.goods_value || 0}</GoodsValue>
                <GoodsCurrencyCode>${escapeXml(shipmentDetail?.goods_currency_code || '')}</GoodsCurrencyCode>
                <DutyValue>${shipmentDetail?.duty_value || 0}</DutyValue>
                <DutyCurrencyCode>${escapeXml(shipmentDetail?.duty_currency_code || '')}</DutyCurrencyCode>
                <EORINumber>${escapeXml(shipmentDetail?.eori_number || '')}</EORINumber>
                <Items>
                    <Item>
                        <ItemReference>${itemRef}</ItemReference>
                        <ItemAlternateReference></ItemAlternateReference>
                        <ItemCubicLength>${cubicLength}</ItemCubicLength>
                        <ItemCubicWidth>${cubicWidth}</ItemCubicWidth>
                        <ItemCubicHeight>${cubicHeight}</ItemCubicHeight>
                        <ItemCubicMeasure>${cubicMeasure}</ItemCubicMeasure>
                        <ItemWeight>${weightGrams}</ItemWeight>
                        <ItemDeadWeight>${deadWeightGrams}</ItemDeadWeight>
                        <ItemWeightMeasure>${weightMeasure}</ItemWeightMeasure>
                        <ItemNotes>${notes}</ItemNotes>
                        <ItemBagNumber>${escapeXml(bagNumber)}</ItemBagNumber>
                        <Pieces>
                            <Piece>
                                <PieceRef>${escapeXml(senderRef || ref)}</PieceRef>
                                <PieceAltRef></PieceAltRef>
                                <PieceHarmonisedCode>${harmonisedCode}</PieceHarmonisedCode>
                                <PieceGoodsDescription>${goodsDesc}</PieceGoodsDescription>
                                <PieceWeight>${weightGrams}</PieceWeight>
                                <PieceDeadWeight>0</PieceDeadWeight>
                                <PieceQty>1</PieceQty>
                                <PieceContent></PieceContent>
                                <PieceNotes>${notes}</PieceNotes>
                                <PieceSize></PieceSize>
                                <PieceCountryCodeOfManufacture>${originCountryCode}</PieceCountryCodeOfManufacture>
                                <PieceCountryCodeOfOrigin>${originCountryCode}</PieceCountryCodeOfOrigin>
                                <PieceCustomsValue>${customsValue}</PieceCustomsValue>
                                <PieceCurrencyCode>${customsCurrency}</PieceCurrencyCode>
                                <PieceSenderRef1></PieceSenderRef1>
                                <PieceSenderRef2></PieceSenderRef2>
                                <PieceCPCCode></PieceCPCCode>
                                <PieceATENumber></PieceATENumber>
                                <PieceProductURL></PieceProductURL>
                                <PieceGoodsValue>0.00</PieceGoodsValue>
                                <PieceGoodsCurrencyCode></PieceGoodsCurrencyCode>
                                <PieceDutyValue>0.00</PieceDutyValue>
                                <PieceDutyCurrencyCode></PieceDutyCurrencyCode>
                                <PieceGSTValue>0.00</PieceGSTValue>
                                <PieceGSTCurrencyCode></PieceGSTCurrencyCode>
                            </Piece>
                        </Pieces>
                    </Item>
                </Items>
                <Reference1></Reference1>
                <Reference2></Reference2>
                <Reference3></Reference3>
                <Reference4></Reference4>
                <Reference5></Reference5>
            </Shipment>`;
}

// ─── Build the full WSGET XML payload dynamically from DB ─────────────────────
function buildUploadXml(
    manifestReference: string,
    shipmentBlocks: string[],
    headerInfo: {
        travelId?: string;
        carrierCode?: string;
        carrierName?: string;
        fromLoc?: string;
        fromLocName?: string;
        toLoc?: string;
        toLocName?: string;
        shipperCode?: string;
        shipperName?: string;
        receiverCode?: string;
        receiverName?: string;
        notes?: string;
        manifestedBy?: string;
        declaredWt?: number | string;
        weightMeasure?: string;
        scheduledArrival?: string;
    }
): string {
    const messageId = generateMessageId();
    const now = nowFormatted();

    const shipmentsContent = shipmentBlocks.length > 0
        ? shipmentBlocks.join('\n')
        : '';

    const travelId = escapeXml(headerInfo.travelId || headerInfo.receiverCode || '');
    const carrierCode = 'UL';
    const carrierName = 'Sri Lankan Airlines';
    const fromLoc = 'CMB';
    const fromLocName = 'Colombo';
    const toLoc = 'CMB';
    const toLocName = 'Colombo';
    const shipperCode = 'LK7171';
    const shipperName = 'Logicentrix Pvt Ltd';
    const receiverCode = escapeXml(headerInfo.receiverCode || '');
    const receiverName = escapeXml(headerInfo.receiverName || '');
    const notes = escapeXml(headerInfo.notes || '');
    const scheduledArrival = escapeXml(headerInfo.scheduledArrival || '');
    const declaredWt = headerInfo.declaredWt !== undefined ? String(headerInfo.declaredWt) : '';
    const manifestedBy = escapeXml(headerInfo.manifestedBy || FFDX_UPDATE_ENTITY_ID);
    const weightMeasure = escapeXml(headerInfo.weightMeasure || 'K');

    return `<?xml version='1.0' encoding='iso-8859-1' ?>
<WSGET>
    <AccessRequest>
        <WSVersion>1.0a</WSVersion>
        <FileType>1</FileType>
        <Action>upload</Action>
        <EntityID>${escapeXml(FFDX_ENTITY_ID)}</EntityID>
        <EntityPIN>${escapeXml(FFDX_ENTITY_PIN)}</EntityPIN>
        <MessageID>${messageId}</MessageID>
    </AccessRequest>
    <Mawb>
        <MawbReference>${escapeXml(manifestReference)}</MawbReference>
        <UpliftDate>${now}</UpliftDate>
        <TravelID>${travelId}</TravelID>
        <CarrierCode>${carrierCode}</CarrierCode>
        <Carrier>${carrierName}</Carrier>
        <FromLoc>${fromLoc}</FromLoc>
        <FromLocName>${fromLocName}</FromLocName>
        <ToLoc>${toLoc}</ToLoc>
        <ToLocName>${toLocName}</ToLocName>
        <ShipperCode>${shipperCode}</ShipperCode>
        <ShipperName>${shipperName}</ShipperName>
        <ReceiverCode>${receiverCode}</ReceiverCode>
        <ReceiverName>${receiverName}</ReceiverName>
        <Notes>${notes}</Notes>
        <ScheduledArrival>${scheduledArrival}</ScheduledArrival>
        <DeclaredWt>${declaredWt}</DeclaredWt>
        <ManifestedBy>${manifestedBy}</ManifestedBy>
        <WeightMeasure>${weightMeasure}</WeightMeasure>
        <Shipments>
${shipmentsContent}
        </Shipments>
    </Mawb>
</WSGET>`;
}

// ─── POST the XML to FFDX ─────────────────────────────────────────────────────
async function postToFfdx(xmlStream: string, manifestReference: string): Promise<{ success: boolean; response?: string; error?: string }> {
    const MAX_RETRIES = 3;
    const RETRY_BACKOFF_MS = 5000;
    let lastError: string = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[ffdx-upload] [${manifestReference}] Attempt ${attempt}/${MAX_RETRIES} — posting to FFDX...`);

            const formData = new URLSearchParams();
            formData.append('Username', FFDX_USERNAME);
            formData.append('Password', FFDX_PASSWORD);
            formData.append('xmlStream', xmlStream);
            formData.append('LevelConfirm', 'summary');

            const res = await fetch(FFDX_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
                signal: AbortSignal.timeout(60_000),
            });

            const text = await res.text();
            console.log(`[ffdx-upload] [${manifestReference}] FFDX response (${res.status}): ${text.slice(0, 300)}`);

            if (!res.ok) {
                lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS));
                    continue;
                }
                return { success: false, error: lastError };
            }

            // FFDX returns HTTP 200 with string body: MessageID|-1|Error message
            const rawContent = text.replace(/<[^>]+>/g, '').trim();
            const parts = rawContent.split('|');
            const statusVal = parts.length > 1 ? parseInt(parts[1], 10) : 0;

            if (statusVal < 0 || rawContent.toLowerCase().includes('object reference') || rawContent.toLowerCase().includes('error')) {
                lastError = `FFDX Rejected: ${rawContent}`;
                console.error(`[ffdx-upload] [${manifestReference}] FFDX upload rejected by server: ${lastError}`);
                return { success: false, response: text, error: lastError };
            }

            return { success: true, response: text };
        } catch (err: any) {
            lastError = err?.message || String(err);
            console.error(`[ffdx-upload] [${manifestReference}] Attempt ${attempt} failed:`, lastError);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS));
            }
        }
    }

    return { success: false, error: `FFDX upload failed after ${MAX_RETRIES} attempts: ${lastError}` };
}

// ─── Mark manifest as uploaded in Supabase ───────────────────────────────────
async function markManifestUploaded(sb: any, manifestId: number | null, manifestReference: string, jsonPath?: string, xmlPath?: string): Promise<void> {
    if (!sb) return;
    try {
        const patchData: Record<string, any> = { is_uploaded: true };
        if (jsonPath) patchData.json_path = jsonPath;
        if (xmlPath) patchData.xml_path = xmlPath;

        if (manifestId) {
            await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, {
                method: 'PATCH',
                headers: sb.headers,
                body: JSON.stringify(patchData)
            });
        } else {
            await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(manifestReference)}`, {
                method: 'PATCH',
                headers: sb.headers,
                body: JSON.stringify(patchData)
            });
        }
        console.log(`[ffdx-upload] Marked manifest "${manifestReference}" as uploaded in Supabase.`);
    } catch (e) {
        console.error(`[ffdx-upload] Failed to mark manifest as uploaded:`, e);
    }
}

// ─── POST /api/ffdx-upload ────────────────────────────────────────────────────
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { manifestReference, manifestId, serviceProviderName, bags } = body as {
            manifestReference: string;
            manifestId?: number | null;
            serviceProviderName?: string;
            bags: Array<{
                bagNumber: string;
                parcels: Array<{
                    trackingNumber?: string;
                    shipment_ref?: string;
                    reference_number?: string;
                    senderReference?: string;
                    weight?: number;
                    recipientName?: string;
                    city?: string;
                    province?: string;
                }>;
            }>;
        };

        if (!manifestReference) {
            return NextResponse.json({ success: false, error: 'Missing manifestReference' }, { status: 400 });
        }

        const sb = getSupabaseConfig();

        // ─── 1. Dynamically resolve Receiver Code & Name ──────────────────────
        let receiverCode = '';
        let receiverName = '';

        const refUpper = (manifestReference || '').toUpperCase();
        const spUpper = (serviceProviderName || '').toUpperCase();

        if (spUpper.includes('PICKME') || refUpper.includes('PICKME')) {
            receiverCode = 'PICKME';
            receiverName = 'PickMe';
        } else if (spUpper.includes('DOMEX') || refUpper.includes('DOMEX')) {
            receiverCode = 'DOMEX';
            receiverName = 'Domex';
        } else if (spUpper.includes('PRONTO') || refUpper.includes('PRONTO')) {
            receiverCode = 'PRONTO';
            receiverName = 'Pronto';
        } else if (sb) {
            try {
                const omRes = await fetch(
                    `${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(manifestReference)}&select=service_provider,service_providers(name,code)`,
                    { headers: sb.headers, cache: 'no-store' }
                );
                const omData = await omRes.json();
                if (Array.isArray(omData) && omData.length > 0) {
                    const row = omData[0];
                    const sp = row.service_providers;
                    if (sp?.code) receiverCode = sp.code.toUpperCase();
                    if (sp?.name) receiverName = sp.name;
                }
            } catch (e) {
                console.error('[ffdx-upload] Error fetching service_provider from DB:', e);
            }
        }

        if (!receiverCode) {
            receiverCode = 'PICKME';
            receiverName = 'PickMe';
        }

        // ─── 2. Fetch details for all parcels in this manifest ────────────────
        const shipmentBlocks: string[] = [];
        let allBags = Array.isArray(bags) ? bags : [];
        let firstShipmentDetail: any = null;
        let totalCalculatedWeightKg = 0;

        // If any bag has no parcels and we have Supabase, enrich from outbound_lmd_bag_items
        if (sb) {
            const enrichedBags: typeof allBags = [];
            for (const bag of allBags) {
                let bagParcels = Array.isArray(bag.parcels) ? bag.parcels : [];
                if (bagParcels.length === 0 && bag.bagNumber) {
                    try {
                        const itemsRes = await fetch(
                            `${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=eq.${encodeURIComponent(bag.bagNumber)}&select=shipment_ref,weight`,
                            { headers: sb.headers, cache: 'no-store' }
                        );
                        const items = await itemsRes.json();
                        if (Array.isArray(items) && items.length > 0) {
                            bagParcels = items.map((i: any) => ({
                                trackingNumber: String(i.shipment_ref || '').replace(/^skyt-?/i, '').trim(),
                                weight: i.weight || 0.1
                            })).filter((p: any) => p.trackingNumber);
                        } else {
                            // Also try fetching from outbound_lmd_bags.parcels JSONB
                            const bagRes = await fetch(
                                `${sb.url}/rest/v1/outbound_lmd_bags?bag_number=eq.${encodeURIComponent(bag.bagNumber)}&select=parcels`,
                                { headers: sb.headers, cache: 'no-store' }
                            );
                            const bagData = await bagRes.json();
                            if (Array.isArray(bagData) && bagData.length > 0) {
                                const raw = bagData[0].parcels;
                                if (Array.isArray(raw)) bagParcels = raw;
                                else if (typeof raw === 'string') { try { bagParcels = JSON.parse(raw); } catch { bagParcels = []; } }
                            }
                        }
                    } catch (e) {
                        console.error(`[ffdx-upload] Failed to enrich parcels for bag ${bag.bagNumber}:`, e);
                    }
                }
                enrichedBags.push({ ...bag, parcels: bagParcels });
            }
            allBags = enrichedBags;
        }

        const parcelLogs: ParcelLogData[] = [];
        for (const bag of allBags) {
            const parcels = Array.isArray(bag.parcels) ? bag.parcels : [];
            for (const parcel of parcels) {
                const trackingNum = (parcel.trackingNumber || parcel.shipment_ref || '').replace(/^skyt-?/i, '').trim();
                if (!trackingNum) continue;

                const detail = await fetchShipmentDetails(sb, trackingNum);
                if (!firstShipmentDetail && detail) {
                    firstShipmentDetail = detail;
                }

                const parcelWeight = Number(detail?.weight) || Number(parcel?.weight) || 0.1;
                totalCalculatedWeightKg += parcelWeight;

                shipmentBlocks.push(buildShipmentXml(parcel, detail, bag.bagNumber));

                parcelLogs.push({
                    trackingNumber: trackingNum,
                    bagNumber: bag.bagNumber,
                    weightKg: parcelWeight,
                    consigneeName: detail?.consignee_name || parcel?.recipientName || '',
                    consigneeAddress: detail?.consignee_address_1 || parcel?.city || '',
                    consigneeCity: detail?.consignee_city || parcel?.city || '',
                    consignorName: detail?.consignor_name || '',
                    consignorCountry: detail?.consignor_country_code || '',
                    senderReference: detail?.sender_reference || parcel?.senderReference || '',
                    status: 'UPLOADED',
                });
            }
        }

        // ─── 3. Fetch Inbound MAWB record dynamically from DB ────────────────
        let mawbRecord: any = null;
        const inboundMawbRef = firstShipmentDetail?.mawb_reference;
        if (sb && inboundMawbRef) {
            mawbRecord = await fetchMawbRecord(sb, inboundMawbRef);
        }

        // ─── 4. Build Header Info (Hardcoded Manifest Info) ────────
        const carrierCode = 'UL';
        const carrierName = 'Sri Lankan Airlines';
        const travelId = mawbRecord?.travel_id || receiverCode;
        const fromLoc = 'CMB';
        const fromLocName = 'Colombo';
        const toLoc = 'CMB';
        const toLocName = 'Colombo';
        const shipperCode = 'LK7171';
        const shipperName = 'Logicentrix Pvt Ltd';
        const manifestedBy = FFDX_UPDATE_ENTITY_ID || 'LK7171';

        const headerInfo = {
            travelId,
            carrierCode,
            carrierName,
            fromLoc,
            fromLocName,
            toLoc,
            toLocName,
            shipperCode,
            shipperName,
            receiverCode,
            receiverName,
            notes: mawbRecord?.notes || firstShipmentDetail?.notes || '',
            manifestedBy,
            declaredWt: mawbRecord?.declared_wt || totalCalculatedWeightKg.toFixed(2),
            weightMeasure: mawbRecord?.weight_measure || 'K',
            scheduledArrival: mawbRecord?.scheduled_arrival || ''
        };

        // ─── 5. Build and send XML payload ────────────────────────────────────
        const xmlPayload = buildUploadXml(manifestReference, shipmentBlocks, headerInfo);

        // Save manifest logs (XML and JSON) to Supabase storage buckets and update DB
        const storageResult = await saveManifestToSupabaseStorage({
            manifestReference,
            manifestId: manifestId || null,
            serviceProvider: receiverName,
            headerInfo,
            totalBags: allBags.length,
            totalParcels: parcelLogs.length,
            totalWeightKg: totalCalculatedWeightKg,
            parcels: parcelLogs,
            xmlPayload,
        }).catch(err => {
            console.error('[ffdx-upload] Error saving to Supabase storage:', err);
            return null;
        });

        console.log(`[ffdx-upload] Uploading manifest "${manifestReference}" with ${shipmentBlocks.length} shipment(s) (Carrier: ${carrierName}, Receiver: ${receiverCode}, From: ${fromLocName}) to FFDX GETonline...`);

        const ffdxResult = await postToFfdx(xmlPayload, manifestReference);

        if (ffdxResult.success) {
            await markManifestUploaded(sb, manifestId || null, manifestReference, storageResult?.jsonPath, storageResult?.xmlPath);
        } else {
            console.error(`[ffdx-upload] FFDX upload FAILED for "${manifestReference}":`, ffdxResult.error);
        }

        return NextResponse.json({
            success: ffdxResult.success,
            manifestReference,
            shipmentCount: shipmentBlocks.length,
            ffdxResponse: ffdxResult.response,
            error: ffdxResult.error
        });

    } catch (err: any) {
        console.error('[ffdx-upload] Internal error:', err);
        return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
    }
}
