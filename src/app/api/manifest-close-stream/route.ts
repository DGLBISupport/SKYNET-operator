/**
 * /api/manifest-close-stream
 *
 * Server-Sent Events (SSE) endpoint for real-time manifest close progress.
 * Streams events as each bag/parcel is processed and the FFDX GETonline
 * upload is executed. The frontend connects with EventSource and renders a
 * live progress modal.
 *
 * Event types emitted (as JSON-encoded `data:` lines):
 *  { type: 'start',      totalBags, totalParcels }
 *  { type: 'bag',        bagIndex, bagNumber, parcelCount, status: 'processing' }
 *  { type: 'parcel',     bagNumber, trackingNumber, index, total, status: 'enriching'|'ok'|'skipped' }
 *  { type: 'ffdx_start', bagNumber, parcelCount }
 *  { type: 'ffdx_done',  success, error? }
 *  { type: 'done',       success, summary: { totalBags, totalParcels, uploaded, errors } }
 *  { type: 'error',      message }
 */

import { NextResponse } from 'next/server';
import { saveManifestToSupabaseStorage } from '@/lib/supabaseStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// ─── FFDX Config ──────────────────────────────────────────────────────────────
const FFDX_VERSION = process.env.FFDX_VERSION || 'v12';
const FFDX_BASE_URL = `https://ws05.ffdx.net/ffdx_ws/${FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer`;
const FFDX_USERNAME = process.env.FFDX_USERNAME || '26AFE6A6F99D1300F43071AE6219FD79';
const FFDX_PASSWORD = process.env.FFDX_PASSWORD || '6044F95F8F096B06083F35DE08A5641B';
const FFDX_ENTITY_ID = process.env.FFDX_ENTITY_ID || '4B71FB68246CD8FD8EBE0D79FAF5273E';
const FFDX_ENTITY_PIN = process.env.FFDX_ENTITY_PIN || 'VeeVA4?37kd';
const FFDX_UPDATE_ENTITY_ID = process.env.FFDX_UPDATE_ENTITY_ID || 'LK7171';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function resolveUserId(sb: any, userVal: any): Promise<number | null> {
    if (userVal === null || userVal === undefined || userVal === '') return null;
    if (typeof userVal === 'number' && !isNaN(userVal)) return userVal;
    if (typeof userVal === 'string' && /^\d+$/.test(userVal.trim())) return parseInt(userVal.trim(), 10);

    if (!sb || typeof userVal !== 'string') return null;
    const strVal = userVal.trim();
    if (!strVal || strVal === 'Staff') return null;

    try {
        const res1 = await fetch(
            `${sb.url}/rest/v1/users?or=(email.eq.${encodeURIComponent(strVal)},username.eq.${encodeURIComponent(strVal)})&select=id&limit=1`,
            { headers: sb.headers, cache: 'no-store' }
        );
        const data1 = await res1.json();
        if (Array.isArray(data1) && data1.length > 0 && data1[0]?.id) {
            return Number(data1[0].id);
        }

        const firstName = strVal.split(/\s+/)[0];
        if (firstName) {
            const res2 = await fetch(
                `${sb.url}/rest/v1/users?first_name=ilike.${encodeURIComponent(firstName)}&select=id&limit=1`,
                { headers: sb.headers, cache: 'no-store' }
            );
            const data2 = await res2.json();
            if (Array.isArray(data2) && data2.length > 0 && data2[0]?.id) {
                return Number(data2[0].id);
            }
        }
    } catch (e) {
        console.error('resolveUserId error:', e);
    }
    return null;
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

// ─── Fetch shipment detail from Supabase with multi-column fallback ─────────────────
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
    } catch { return null; }
}

// ─── Fetch inbound MAWB record ────────────────────────────────────────────────
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
    } catch { return null; }
}

// ─── Resolve manifest DB id ───────────────────────────────────────────────────
async function getManifestDbId(sb: any, mawbRef: string): Promise<number | null> {
    try {
        const res = await fetch(
            `${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=id`,
            { headers: sb.headers, cache: 'no-store' }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].id) return Number(data[0].id);
        return null;
    } catch { return null; }
}

// ─── Build single shipment XML block ──────────────────────────────────────────
function buildShipmentXml(parcel: any, detail: any | null, bagNumber: string): string {
    const ref = detail?.reference_number || parcel?.trackingNumber || parcel?.shipment_ref || '';
    const senderRef = detail?.sender_reference || parcel?.senderReference || ref;

    const rawWeight = Number(detail?.weight) || Number(parcel?.weight) || 0.1;
    const weightGrams = Math.round(rawWeight * 1000);
    const deadWeightGrams = Math.round((Number(detail?.dead_weight) || rawWeight) * 1000);
    const declaredWeightGrams = Math.round((Number(detail?.customer_declared_weight) || 0) * 1000);
    const cubicLength = detail?.cubic_length || 0;
    const cubicWidth = detail?.cubic_width || 0;
    const cubicHeight = detail?.cubic_height || 0;
    const cubicWeight = detail?.cubic_weight || 0;
    const cubicMeasure = escapeXml(detail?.cubic_measure || 'G');
    const weightMeasure = escapeXml(detail?.weight_measure || 'G');
    const numItems = Number(detail?.num_of_items) || 1;
    const customsValue = detail?.customs_value !== undefined && detail?.customs_value !== null ? detail.customs_value : 0;
    const customsCurrency = escapeXml(detail?.customs_currency_code || '');

    // Consignor (Sender) — real database values only, no dummy fallbacks
    const consignorName = escapeXml(detail?.consignor_name || '');
    const consignorAddr1 = escapeXml(detail?.consignor_address_1 || '');
    const consignorAddr2 = escapeXml(detail?.consignor_address_2 || '');
    const consignorLocationName = escapeXml(detail?.consignor_location_name || '');
    const consignorCountryCode = escapeXml(detail?.consignor_country_code || '');
    const consignorCountryName = escapeXml(detail?.consignor_country_name || '');
    const consignorState = escapeXml(detail?.consignor_state || '');
    const consignorPostcode = escapeXml(detail?.consignor_postcode || '');
    const consignorPhone = escapeXml(detail?.consignor_phone || '');
    const consignorFax = escapeXml(detail?.consignor_fax || '');
    const consignorEmail = escapeXml(detail?.consignor_email || '');
    const consignorContact = escapeXml(detail?.consignor_contact || detail?.consignor_name || '');

    // Consignee (Recipient) — real database / scanned parcel values only, no dummy fallbacks
    const consigneeName = escapeXml(detail?.consignee_name || parcel?.recipientName || '');
    const consigneeAddr1 = escapeXml(detail?.consignee_address_1 || parcel?.city || '');
    const consigneeAddr2 = escapeXml(detail?.consignee_address_2 || parcel?.province || '');
    const consigneeAddr3 = escapeXml(detail?.consignee_address_3 || '');
    const consigneeAddr4 = escapeXml(detail?.consignee_address_4 || '');
    const consigneeAddr5 = escapeXml(detail?.consignee_address_5 || '');
    const consigneeLocationName = escapeXml(detail?.consignee_location_name || parcel?.city || '');
    const consigneeState = escapeXml(detail?.consignee_state || parcel?.province || '');
    const consigneeCountryCode = escapeXml(detail?.consignee_country_code || '');
    const consigneeCountryName = escapeXml(detail?.consignee_country_name || '');
    const consigneePostcode = escapeXml(detail?.consignee_postcode || '');
    const consigneePhone = escapeXml(detail?.consignee_phone || '');
    const consigneeFax = escapeXml(detail?.consignee_fax || '');
    const consigneeEmail = escapeXml(detail?.consignee_email || '');
    const consigneeContact = escapeXml(detail?.consignee_contact || detail?.consignee_name || parcel?.recipientName || '');

    // Origin / Destination — real database values only
    const originCountryCode = escapeXml(detail?.origin_country_code || '');
    const originCountryName = escapeXml(detail?.origin_country_name || '');
    const originLocationCode = escapeXml(detail?.origin_location_code || '');
    const originLocationName = escapeXml(detail?.origin_location_name || '');
    const destLocationCode = escapeXml(detail?.dest_location_code || '');
    const destLocationName = escapeXml(detail?.dest_location_name || '');

    const shipperCode = escapeXml(FFDX_UPDATE_ENTITY_ID || FFDX_ENTITY_ID || '');
    const shipperName = escapeXml('Logicentrix Pvt Ltd');
    const goodsDesc = escapeXml(detail?.goods_desc || '');
    const harmonisedCode = escapeXml(detail?.harmonised_code || '');
    const serviceType = escapeXml(detail?.service_type || '');
    const shipmentType = escapeXml(detail?.shipment_type || '');
    const shipTerms = escapeXml(detail?.ship_terms || '');
    const notes = escapeXml(detail?.notes || '');
    const itemRef = escapeXml(ref);

    return `            <Shipment>
                <ReferenceNumber>${escapeXml(ref)}</ReferenceNumber>
                <SenderReference>${escapeXml(senderRef)}</SenderReference>
                <SenderReference2>${escapeXml(detail?.sender_reference_2 || '')}</SenderReference2>
                <SenderReference3>${escapeXml(detail?.sender_reference_3 || '')}</SenderReference3>
                <AlternateReference>${escapeXml(detail?.alternate_reference || '')}</AlternateReference>
                <ConsignorName>${consignorName}</ConsignorName>
                <ConsignorAddress1>${consignorAddr1}</ConsignorAddress1>
                <ConsignorAddress2>${consignorAddr2}</ConsignorAddress2>
                <ConsignorAddress3></ConsignorAddress3>
                <ConsignorAddress4></ConsignorAddress4>
                <ConsignorAddress5></ConsignorAddress5>
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
                <CODAmount>${detail?.cod_amount || '0.0000'}</CODAmount>
                <CODCurrencyCode>${escapeXml(detail?.cod_currency_code || '')}</CODCurrencyCode>
                <SecurityValue>${detail?.security_value || '0.0000'}</SecurityValue>
                <InsuranceValue>${detail?.insurance_value || '0.0000'}</InsuranceValue>
                <InsuranceCurrencyCode>${escapeXml(detail?.insurance_currency_code || '')}</InsuranceCurrencyCode>
                <DeliveryInstructions>${escapeXml(detail?.delivery_instructions || '')}</DeliveryInstructions>
                <ClearanceReference>${escapeXml(detail?.clearance_reference || '')}</ClearanceReference>
                <ReasonExport>${escapeXml(detail?.reason_export || '')}</ReasonExport>
                <ShipTerms>${shipTerms}</ShipTerms>
                <Surcharge>${escapeXml(detail?.surcharge || '')}</Surcharge>
                <Incoterms>${escapeXml(detail?.incoterms || '')}</Incoterms>
                <ConsigneeTaxID>${escapeXml(detail?.consignee_tax_id || '')}</ConsigneeTaxID>
                <ConsigneeKycType>${escapeXml(detail?.consignee_kyc_type || '')}</ConsigneeKycType>
                <ConsigneeKycNumber>${escapeXml(detail?.consignee_kyc_number || '')}</ConsigneeKycNumber>
                <ConsignorKycType>${escapeXml(detail?.consignor_kyc_type || '')}</ConsignorKycType>
                <ConsignorKycNumber>${escapeXml(detail?.consignor_kyc_number || '')}</ConsignorKycNumber>
                <ConsignorTaxID>${escapeXml(detail?.consignor_tax_id || '')}</ConsignorTaxID>
                <ConsignorIEC>${escapeXml(detail?.consignor_iec || '')}</ConsignorIEC>
                <ConsignorReceivingCountryTaxID>${escapeXml(detail?.consignor_receiving_country_tax_id || '')}</ConsignorReceivingCountryTaxID>
                <CSB>${escapeXml(detail?.csb || '')}</CSB>
                <InvoiceType>${escapeXml(detail?.invoice_type || '')}</InvoiceType>
                <BondUT>${escapeXml(detail?.bond_ut || '')}</BondUT>
                <EcomShipment>${escapeXml(detail?.ecom_shipment || '')}</EcomShipment>
                <MEIS>${escapeXml(detail?.meis || '')}</MEIS>
                <TotalGST>${detail?.total_gst || 0}</TotalGST>
                <TotalGSTCurrencyCode>${escapeXml(detail?.total_gst_currency_code || '')}</TotalGSTCurrencyCode>
                <FOBValue>${detail?.fob_value || 0}</FOBValue>
                <FOBCurrencyCode>${escapeXml(detail?.fob_currency_code || '')}</FOBCurrencyCode>
                <ConnoteExportInvoiceNum>${escapeXml(detail?.connote_export_invoice_num || '')}</ConnoteExportInvoiceNum>
                <ConnoteExportInvoiceDate>${escapeXml(detail?.connote_export_invoice_date || '')}</ConnoteExportInvoiceDate>
                <FreightCost>${detail?.freight_cost || 0}</FreightCost>
                <FreightCostCurrencyCode>${escapeXml(detail?.freight_cost_currency_code || '')}</FreightCostCurrencyCode>
                <DeliveryAgentCode>${escapeXml(detail?.delivery_agent_code || '')}</DeliveryAgentCode>
                <DeliveryRouteCode>${escapeXml(detail?.delivery_route_code || '')}</DeliveryRouteCode>
                <BusinessType>${escapeXml(detail?.business_type || '')}</BusinessType>
                <CPCCode>${escapeXml(detail?.cpc_code || '')}</CPCCode>
                <SKUNumber>${escapeXml(detail?.sku_number || '')}</SKUNumber>
                <ATENumber>${escapeXml(detail?.ate_number || '')}</ATENumber>
                <ProductURL>${escapeXml(detail?.product_url || '')}</ProductURL>
                <GoodsValue>${detail?.goods_value || 0}</GoodsValue>
                <GoodsCurrencyCode>${escapeXml(detail?.goods_currency_code || '')}</GoodsCurrencyCode>
                <DutyValue>${detail?.duty_value || 0}</DutyValue>
                <DutyCurrencyCode>${escapeXml(detail?.duty_currency_code || '')}</DutyCurrencyCode>
                <EORINumber>${escapeXml(detail?.eori_number || '')}</EORINumber>
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
                                <PieceCurrencyCode>${escapeXml(detail?.customs_currency_code || '')}</PieceCurrencyCode>
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

// ─── Build full XML payload ───────────────────────────────────────────────────
function buildUploadXml(manifestReference: string, shipmentBlocks: string[], headerInfo: Record<string, any>): string {
    const messageId = generateMessageId();
    const now = nowFormatted();
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
    const shipmentsContent = shipmentBlocks.join('\n');

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

// ─── POST XML to FFDX API ─────────────────────────────────────────────────────
async function postToFfdx(xmlStream: string, manifestReference: string): Promise<{ success: boolean; response?: string; error?: string }> {
    const MAX_RETRIES = 3;
    const RETRY_BACKOFF_MS = 4000;
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
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
            if (!res.ok) {
                lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
                if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS)); continue; }
                return { success: false, error: lastError };
            }
            const rawContent = text.replace(/<[^>]+>/g, '').trim();
            const parts = rawContent.split('|');
            const statusVal = parts.length > 1 ? parseInt(parts[1], 10) : 0;
            if (statusVal < 0 || rawContent.toLowerCase().includes('object reference') || rawContent.toLowerCase().includes('error')) {
                return { success: false, response: text, error: `FFDX Rejected: ${rawContent}` };
            }
            return { success: true, response: text };
        } catch (err: any) {
            lastError = err?.message || String(err);
            if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS)); }
        }
    }
    return { success: false, error: `FFDX upload failed after ${MAX_RETRIES} attempts: ${lastError}` };
}

// ─── GET /api/manifest-close-stream ──────────────────────────────────────────
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mawbRef = searchParams.get('mawbRef') || '';
    const operator = searchParams.get('operator') || 'Staff';
    const serviceProviderName = searchParams.get('serviceProviderName') || '';

    if (!mawbRef) {
        return new NextResponse('Missing mawbRef', { status: 400 });
    }

    // Helper: encode an SSE event line
    const encode = (data: object) => `data: ${JSON.stringify(data)}\n\n`;

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (data: object) => {
                try { controller.enqueue(new TextEncoder().encode(encode(data))); } catch { /* stream may be closed */ }
            };

            try {
                const sb = getSupabaseConfig();
                if (!sb) {
                    emit({ type: 'error', message: 'Supabase not configured — cannot close manifest.' });
                    controller.close();
                    return;
                }

                // ── Step 1: Resolve manifest DB id & record ───────────────────
                let manifestRecord: any = null;
                let manifestId: number | null = await getManifestDbId(sb, mawbRef);
                let manifestBagNumbers: string[] = [];

                try {
                    const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=*`, { headers: sb.headers, cache: 'no-store' });
                    const omData = await omRes.json();
                    if (Array.isArray(omData) && omData.length > 0) {
                        manifestRecord = omData[0];
                        if (manifestRecord.id) manifestId = Number(manifestRecord.id);
                        if (Array.isArray(manifestRecord.bag_numbers)) manifestBagNumbers = manifestRecord.bag_numbers;
                    }
                } catch (e) {
                    console.error('[manifest-close-stream] Error fetching outbound_manifests:', e);
                }

                // ── Step 2: Mark manifest CLOSED in DB ───────────────────────
                const closedTimestamp = new Date().toISOString();
                const closedByParam = searchParams.get('closedBy') || searchParams.get('closed_by') || searchParams.get('userId') || searchParams.get('operator');
                const closedUserId = (await resolveUserId(sb, closedByParam)) ?? (await resolveUserId(sb, operator));

                const manifestUpdatePayload: any = { status: 'CLOSED', closed_at: closedTimestamp };
                if (closedUserId) manifestUpdatePayload.closed_by = closedUserId;

                if (manifestId) {
                    await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, {
                        method: 'PATCH', headers: sb.headers,
                        body: JSON.stringify(manifestUpdatePayload)
                    });
                } else {
                    await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}`, {
                        method: 'PATCH', headers: sb.headers,
                        body: JSON.stringify(manifestUpdatePayload)
                    });
                }

                // ── Step 3: Fetch all bags (OR query: by manifest id OR mawb_ref) ──
                const allBagsMap = new Map<string, { bagNumber: string; parcels: any[] }>();

                try {
                    const bagFilters = [`mawb_ref.ilike.*${encodeURIComponent(mawbRef)}*`];
                    if (manifestId) bagFilters.push(`new_manifest_reference.eq.${manifestId}`);

                    const dbBagsRes = await fetch(
                        `${sb.url}/rest/v1/outbound_lmd_bags?or=(${bagFilters.join(',')})&select=bag_number,parcel_count,total_weight,target_partner,parcels`,
                        { headers: sb.headers, cache: 'no-store' }
                    );
                    const dbBagsRaw = await dbBagsRes.json();

                    if (Array.isArray(dbBagsRaw)) {
                        for (const b of dbBagsRaw) {
                            if (!b.bag_number) continue;
                            let bagParcels: any[] = [];
                            if (Array.isArray(b.parcels)) bagParcels = b.parcels;
                            else if (typeof b.parcels === 'string') { try { bagParcels = JSON.parse(b.parcels); } catch { bagParcels = []; } }
                            allBagsMap.set(b.bag_number, { bagNumber: b.bag_number, parcels: bagParcels });
                        }
                    }
                } catch (e) {
                    console.error('[manifest-close-stream] Error fetching outbound_lmd_bags:', e);
                }

                // Include any bag numbers listed in outbound_manifests.bag_numbers not already added
                for (const bn of manifestBagNumbers) {
                    if (bn && !allBagsMap.has(bn)) {
                        allBagsMap.set(bn, { bagNumber: bn, parcels: [] });
                    }
                }

                // ── Step 4: Rebuild parcel list from outbound_lmd_bag_items (authoritative scan history) ──
                for (const [bagNum, bagEntry] of allBagsMap.entries()) {
                    try {
                        const itemsRes = await fetch(
                            `${sb.url}/rest/v1/outbound_lmd_bag_items?bag_number=ilike.${encodeURIComponent(bagNum)}&select=shipment_ref,weight`,
                            { headers: sb.headers, cache: 'no-store' }
                        );
                        const items = await itemsRes.json();
                        const scanMap = new Map<string, any>();

                        // Primary: use every row in outbound_lmd_bag_items
                        if (Array.isArray(items) && items.length > 0) {
                            for (const item of items) {
                                const ref = String(item.shipment_ref || '').replace(/^skyt-?/i, '').trim();
                                if (ref) scanMap.set(ref.toLowerCase(), { trackingNumber: ref, weight: item.weight || 0.1 });
                            }
                        }

                        // Fallback: also merge parcels from JSONB column not already in scanMap
                        for (const p of bagEntry.parcels) {
                            const ref = String(p.trackingNumber || p.reference_number || p.shipment_ref || '').replace(/^skyt-?/i, '').trim();
                            if (ref && !scanMap.has(ref.toLowerCase())) {
                                scanMap.set(ref.toLowerCase(), { trackingNumber: ref, weight: p.weight || 0.1, recipientName: p.recipientName, city: p.city, province: p.province });
                            }
                        }

                        bagEntry.parcels = Array.from(scanMap.values());
                    } catch (e) {
                        console.error(`[manifest-close-stream] Enrich error for bag ${bagNum}:`, e);
                    }
                }

                const allBagsList = Array.from(allBagsMap.values());
                const totalParcels = allBagsList.reduce((s, b) => s + (b.parcels?.length || 0), 0);
                const totalBags = allBagsList.length;

                // ── Emit: start ───────────────────────────────────────────────
                emit({ type: 'start', totalBags, totalParcels, mawbRef, closedAt: closedTimestamp, closedBy: operator });

                // ── Step 5: Resolve receiver code & name ─────────────────────
                let receiverCode = '';
                let receiverName = '';
                const refUpper = mawbRef.toUpperCase();
                const spUpper = serviceProviderName.toUpperCase();
                if (spUpper.includes('PICKME') || refUpper.includes('PICKME')) { receiverCode = 'PICKME'; receiverName = 'PickMe'; }
                else if (spUpper.includes('DOMEX') || refUpper.includes('DOMEX')) { receiverCode = 'DOMEX'; receiverName = 'Domex'; }
                else if (spUpper.includes('PRONTO') || refUpper.includes('PRONTO')) { receiverCode = 'PRONTO'; receiverName = 'Pronto'; }
                else {
                    try {
                        const omRes = await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}&select=service_provider,service_providers(name,code)`, { headers: sb.headers, cache: 'no-store' });
                        const omData = await omRes.json();
                        if (Array.isArray(omData) && omData.length > 0) {
                            const sp = omData[0].service_providers;
                            if (sp?.code) receiverCode = sp.code.toUpperCase();
                            if (sp?.name) receiverName = sp.name;
                        }
                    } catch { /* fallback below */ }
                }
                if (!receiverCode) { receiverCode = 'PICKME'; receiverName = 'PickMe'; }

                // ── Step 6: Build XML — emit per-bag and per-parcel events ────
                // NOTE: we no longer collect every parcel into one shared shipmentBlocks
                // array and send them all in a single FFDX call. That's what was causing
                // "Object reference not set to an instance of an object" — one parcel with
                // no matching `shipments` row produced a near-empty <Shipment> block, FFDX's
                // server crashed on it, and the whole manifest upload got rejected/corrupted
                // after only partially registering (hence "only last scanned parcel" on GETonline).
                // Instead: enrich first, skip parcels with no DB record, then upload each
                // remaining parcel to FFDX individually so one bad record can't take the rest down.
                type ShipmentEntry = { parcel: any; detail: any; bagNumber: string; trackingNum: string };
                const shipmentEntries: ShipmentEntry[] = [];
                let firstShipmentDetail: any = null;
                let totalWeightKg = 0;
                let bagIndex = 0;

                for (const bag of allBagsList) {
                    bagIndex++;
                    const parcels = Array.isArray(bag.parcels) ? bag.parcels : [];
                    emit({ type: 'bag', bagIndex, bagNumber: bag.bagNumber, parcelCount: parcels.length, status: 'processing' });

                    let parcelIdx = 0;
                    for (const parcel of parcels) {
                        parcelIdx++;
                        const trackingNum = String(parcel.trackingNumber || parcel.shipment_ref || '').replace(/^skyt-?/i, '').trim();
                        if (!trackingNum) {
                            emit({ type: 'parcel', bagNumber: bag.bagNumber, trackingNumber: '(empty)', index: parcelIdx, total: parcels.length, status: 'skipped', message: 'No tracking number' });
                            continue;
                        }

                        emit({ type: 'parcel', bagNumber: bag.bagNumber, trackingNumber: trackingNum, index: parcelIdx, total: parcels.length, status: 'enriching' });

                        const detail = await fetchShipmentDetails(sb, trackingNum);

                        if (!detail) {
                            // No DB record for this parcel — do NOT send it to FFDX. Sending a
                            // near-empty <Shipment> block is what triggers the null-reference
                            // rejection and can take the whole batch down with it.
                            emit({ type: 'parcel', bagNumber: bag.bagNumber, trackingNumber: trackingNum, index: parcelIdx, total: parcels.length, status: 'skipped', message: 'No matching shipment record in database' });
                            continue;
                        }

                        if (!firstShipmentDetail) firstShipmentDetail = detail;

                        const weight = Number(detail?.weight) || Number(parcel?.weight) || 0.1;
                        totalWeightKg += weight;
                        shipmentEntries.push({ parcel, detail, bagNumber: bag.bagNumber, trackingNum });
                    }

                    emit({ type: 'bag', bagIndex, bagNumber: bag.bagNumber, parcelCount: parcels.length, status: 'done' });
                }

                // Update DB totals
                const allBagNumbers = allBagsList.map(b => b.bagNumber);
                const finalManifestPayload: any = { bag_numbers: allBagNumbers, total_bags: allBagNumbers.length, total_parcels: shipmentEntries.length, status: 'CLOSED', closed_at: closedTimestamp };
                if (closedUserId) finalManifestPayload.closed_by = closedUserId;
                if (manifestId) {
                    await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify(finalManifestPayload) }).catch(() => { });
                } else {
                    await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify(finalManifestPayload) }).catch(() => { });
                }

                // ── Step 7: Build header info & upload to FFDX — ONE SHIPMENT PER CALL ──
                let mawbRecord: any = null;
                const carrierCode = 'UL';
                const carrierName = 'Sri Lankan Airlines';
                const travelId = mawbRecord?.travel_id || receiverCode;
                const fromLoc = 'CMB';
                const fromLocName = 'Colombo';
                const toLoc = 'CMB';
                const toLocName = 'Colombo';
                const shipperCode = 'LK7171';
                const shipperName = 'Logicentrix Pvt Ltd';

                const headerInfo = {
                    travelId, carrierCode, carrierName, fromLoc, fromLocName, toLoc, toLocName,
                    shipperCode,
                    shipperName,
                    receiverCode, receiverName,
                    notes: mawbRecord?.notes || firstShipmentDetail?.notes || '',
                    manifestedBy: FFDX_UPDATE_ENTITY_ID || 'LK7171',
                    declaredWt: mawbRecord?.declared_wt || totalWeightKg.toFixed(2),
                    weightMeasure: mawbRecord?.weight_measure || 'K',
                    scheduledArrival: mawbRecord?.scheduled_arrival || ''
                };

                emit({ type: 'ffdx_start', parcelCount: shipmentEntries.length });

                let uploadedCount = 0;
                let failedCount = 0;
                let lastFfdxError: string | undefined;
                const INTER_CALL_DELAY_MS = 250;

                for (const entry of shipmentEntries) {
                    const singleShipmentBlock = buildShipmentXml(entry.parcel, entry.detail, entry.bagNumber);
                    const xmlPayload = buildUploadXml(mawbRef, [singleShipmentBlock], headerInfo);
                    const result = await postToFfdx(xmlPayload, `${mawbRef}:${entry.trackingNum}`);

                    if (result.success) {
                        uploadedCount++;
                        emit({ type: 'parcel', bagNumber: entry.bagNumber, trackingNumber: entry.trackingNum, status: 'ok', message: 'Uploaded to GETonline' });
                    } else {
                        failedCount++;
                        lastFfdxError = result.error;
                        emit({ type: 'parcel', bagNumber: entry.bagNumber, trackingNumber: entry.trackingNum, status: 'error', message: result.error });
                    }

                    if (INTER_CALL_DELAY_MS > 0) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
                }

                const ffdxResult: { success: boolean; response?: string; error?: string } =
                    shipmentEntries.length === 0
                        ? { success: true } // nothing to upload — still fine
                        : { success: failedCount === 0, error: failedCount > 0 ? `${failedCount} of ${shipmentEntries.length} shipment(s) rejected by FFDX. Last error: ${lastFfdxError}` : undefined };

                let storageResult: any = null;
                // Save complete manifest log (XML and JSON) to Supabase storage buckets and update DB
                try {
                    const allShipmentBlocks = shipmentEntries.map(e => buildShipmentXml(e.parcel, e.detail, e.bagNumber));
                    const fullXmlPayload = buildUploadXml(mawbRef, allShipmentBlocks, headerInfo);
                    const parcelLogs = shipmentEntries.map(e => ({
                        trackingNumber: e.trackingNum,
                        bagNumber: e.bagNumber,
                        weightKg: Number(e.detail?.weight) || Number(e.parcel?.weight) || 0.1,
                        consigneeName: e.detail?.consignee_name || e.parcel?.recipientName || '',
                        consigneeAddress: e.detail?.consignee_address_1 || e.parcel?.city || '',
                        consigneeCity: e.detail?.consignee_city || e.parcel?.city || '',
                        consignorName: e.detail?.consignor_name || '',
                        consignorCountry: e.detail?.consignor_country_code || '',
                        senderReference: e.detail?.sender_reference || e.parcel?.senderReference || '',
                        status: 'UPLOADED',
                    }));

                    storageResult = await saveManifestToSupabaseStorage({
                        manifestReference: mawbRef,
                        manifestId: manifestId || null,
                        serviceProvider: receiverName,
                        headerInfo,
                        totalBags: allBagsList.length,
                        totalParcels: shipmentEntries.length,
                        totalWeightKg,
                        parcels: parcelLogs,
                        xmlPayload: fullXmlPayload,
                    }).catch(err => {
                        console.error('[manifest-close-stream] Error saving to Supabase storage:', err);
                        return null;
                    });
                } catch (e) {
                    console.error('[manifest-close-stream] Error building storage payload:', e);
                }

                // Mark uploaded in DB if at least one shipment made it through
                if (uploadedCount > 0 || shipmentEntries.length === 0) {
                    const patchData: Record<string, any> = { is_uploaded: true };
                    if (storageResult?.jsonPath) patchData.json_path = storageResult.jsonPath;
                    if (storageResult?.xmlPath) patchData.xml_path = storageResult.xmlPath;

                    if (manifestId) {
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?id=eq.${manifestId}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify(patchData) }).catch(() => { });
                    } else {
                        await fetch(`${sb.url}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(mawbRef)}`, { method: 'PATCH', headers: sb.headers, body: JSON.stringify(patchData) }).catch(() => { });
                    }
                }

                emit({ type: 'ffdx_done', success: ffdxResult.success, error: ffdxResult.error });

                emit({
                    type: 'done',
                    success: ffdxResult.success,
                    closedAt: closedTimestamp,
                    closedBy: operator,
                    summary: {
                        totalBags,
                        totalParcels,
                        uploaded: uploadedCount,
                        errors: failedCount,
                        ffdxError: ffdxResult.error
                    }
                });

            } catch (err: any) {
                console.error('[manifest-close-stream] Fatal error:', err);
                try { controller.enqueue(new TextEncoder().encode(encode({ type: 'error', message: err?.message || 'Internal server error' }))); } catch { /* ignore */ }
            } finally {
                try { controller.close(); } catch { /* ignore */ }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    });
}