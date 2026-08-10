#!/usr/bin/env python3
"""
ffdx_test_submit.py

Standalone diagnostic script - submits ONE shipment directly to the FFDX
GETonline WSDataTransfer endpoint. No Next.js/Supabase/Node involved, so you
can see exactly what XML goes out and exactly what FFDX sends back.

WHY YOU WERE SEEING:
  Object reference not set to an instance of an object.

That's a raw .NET NullReferenceException thrown INSIDE FFDX's own service.
It fires when FFDX looks up a code you sent (a location code, a currency
code, etc.) in one of ITS master tables, gets no match, and uses the null
result without checking it first.

In your shipment row, several fields are literally placeholder text rather
than real, FFDX-registered codes:

    origin_location_code: "TBA1"      origin_location_name: "TBA"
    dest_location_code:   "TBA1"
    cod_currency_code:       "TBA"
    insurance_currency_code: "TBA"
    total_gst_currency_code: "TBA"
    fob_currency_code:       "TBA"

This script strips placeholder values like that (falling location codes back
by country, and leaving currency codes blank) before building the XML, then
posts a single shipment to FFDX and prints the raw response.

USAGE:
    python3 ffdx_test_submit.py                    # uses the built-in sample row
    python3 ffdx_test_submit.py my_shipment.json    # uses your own row (object or [object])

Requires Python 3.7+. Standard library only - no pip installs needed.

ENV VARS (all optional - same defaults your app uses):
    FFDX_VERSION, FFDX_USERNAME, FFDX_PASSWORD, FFDX_ENTITY_ID,
    FFDX_ENTITY_PIN, FFDX_UPDATE_ENTITY_ID
"""

import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

# --- FFDX config (same defaults as route.ts) --------------------------------
FFDX_VERSION = os.environ.get("FFDX_VERSION", "v12")
FFDX_BASE_URL = f"https://ws05.ffdx.net/ffdx_ws/{FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer"
FFDX_USERNAME = os.environ.get("FFDX_USERNAME", "26AFE6A6F99D1300F43071AE6219FD79")
FFDX_PASSWORD = os.environ.get("FFDX_PASSWORD", "6044F95F8F096B06083F35DE08A5641B")
FFDX_ENTITY_ID = os.environ.get("FFDX_ENTITY_ID", "4B71FB68246CD8FD8EBE0D79FAF5273E")
FFDX_ENTITY_PIN = os.environ.get("FFDX_ENTITY_PIN", "VeeVA4?37kd")
FFDX_UPDATE_ENTITY_ID = os.environ.get("FFDX_UPDATE_ENTITY_ID", "LK7171")

# --- Sample row (from your Supabase dump) - used if no file argument given --
SAMPLE_SHIPMENT = {
    "reference_number": "710283702074",
    "sender_reference": "LK 260714 Test 40",
    "consignor_name": "Test Sender 40",
    "consignor_address_1": "40. no. 3 bingjiang road, yuzhong district, chongqing, china",
    "consignor_location_name": "China",
    "consignor_country_code": "CN",
    "consignor_country_name": "CHINA",
    "consignor_postcode": "40",
    "consignor_phone": "85223712724",
    "consignor_email": "Sender@sample.com",
    "consignor_contact": "Test Sender LLL",
    "consignee_name": "Skynet LK",
    "consignee_address_1": "No. 26, Lake Lane, Mirissa, 81740",
    "consignee_location_name": "Sri Lanka",
    "consignee_state": "Northern Province",
    "consignee_country_code": "LK",
    "consignee_country_name": "SRI LANKA",
    "consignee_contact": "12143",
    "consignee_phone": "(260) 010-1273",
    "consignee_email": "test@gmail.com",
    "origin_country_code": "CN",
    "origin_country_name": "CHINA",
    "origin_location_code": "TBA1",
    "origin_location_name": "TBA",
    "dest_location_code": "TBA1",
    "dest_location_name": "Sri Lanka",
    "weight": 39270,
    "weight_measure": "G",
    "num_of_items": 1,
    "service_type": "EN",
    "shipment_type": "N",
    "goods_desc": "TEST",
    "harmonised_code": "4412.14",
    "customs_value": 557,
    "customs_currency_code": "LKR",
    "cod_currency_code": "TBA",
    "security_value": 0,
    "insurance_value": 0,
    "insurance_currency_code": "TBA",
    "ship_terms": "DDP",
    "surcharge": "0",
    "total_gst": 0,
    "total_gst_currency_code": "TBA",
    "fob_value": 0,
    "fob_currency_code": "TBA",
    "mawb_reference": "LK Test 0715 21-40",
}

# --- Helpers ------------------------------------------------------------------
def esc(val) -> str:
    """XML-escape a value; None/missing becomes ''."""
    if val is None:
        return ""
    s = str(val)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def generate_message_id() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(10))


def now_formatted() -> str:
    d = datetime.now()
    return d.strftime("%Y/%m/%d %H:%M:%S")


# Values that mean "no real code was ever set" - never forward these to FFDX.
PLACEHOLDER_RX = re.compile(r"^(tba1?|n/?a|-|pending|tbd|unknown|x+)$", re.IGNORECASE)


def clean_code(value) -> str:
    """'' if the value looks like a placeholder, otherwise the trimmed value."""
    v = "" if value is None else str(value).strip()
    if not v:
        return ""
    if PLACEHOLDER_RX.match(v):
        return ""
    return v


def resolve_location(code, name, country_code):
    """Location code+name, falling back by country when the DB value is a placeholder."""
    cleaned_code = clean_code(code)
    if cleaned_code:
        return {"code": cleaned_code, "name": clean_code(name) or cleaned_code}
    cc = (country_code or "").upper()
    if cc in ("CN", "HK"):
        return {"code": "HKG", "name": "Hong Kong"}
    return {"code": "CMB", "name": "Colombo"}


def resolve_currency(code) -> str:
    return clean_code(code)  # FFDX 500s on unrecognised codes - blank is safer than a placeholder


def num(d, key, default=0):
    try:
        v = d.get(key)
        return default if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return default


def to_grams(value: float, measure: str) -> int:
    """
    Convert a weight value to grams based on its stated unit.

    CONFIRMED BUG: the original code (and my first script, copied from it)
    always did `weight * 1000` regardless of `weight_measure`. Your test row
    has weight_measure="G" and weight=39270 - i.e. it's ALREADY 39,270 grams
    - so the old code sent FFDX <Weight>39270000</Weight>, 39.27 TONNES for
    one parcel. That's almost certainly what's triggering the null-ref: a
    per-shipment weight lookup on FFDX's side finding nothing for a value
    that extreme. Fixed here to only scale up from kilograms.
    """
    m = (measure or "G").strip().upper()
    if m in ("G", "GM", "GRAM", "GRAMS"):
        return round(value)
    if m in ("K", "KG", "KILOGRAM", "KILOGRAMS"):
        return round(value * 1000)
    # Unknown unit - assume grams (safer than silently inflating 1000x)
    return round(value)


# --- Build one <Shipment> block ------------------------------------------------
def build_shipment_xml(detail: dict, bag_number: str, fix_weight: bool = True) -> str:
    ref = detail.get("reference_number") or ""
    sender_ref = detail.get("sender_reference") or ref

    raw_weight = num(detail, "weight", 0.1) or 0.1
    measure = detail.get("weight_measure") or "G"
    if fix_weight:
        weight_grams = to_grams(raw_weight, measure)
        dead_weight_grams = to_grams(num(detail, "dead_weight", 0) or raw_weight, measure)
        declared_weight_grams = to_grams(num(detail, "customer_declared_weight", 0), measure)
    else:
        # old (likely buggy) behaviour, kept only for --bisect comparison
        weight_grams = round(raw_weight * 1000)
        dead_weight_grams = round((num(detail, "dead_weight", 0) or raw_weight) * 1000)
        declared_weight_grams = round(num(detail, "customer_declared_weight", 0) * 1000)

    origin = resolve_location(
        detail.get("origin_location_code"),
        detail.get("origin_location_name"),
        detail.get("origin_country_code") or detail.get("consignor_country_code"),
    )
    dest = resolve_location(
        detail.get("dest_location_code"),
        detail.get("dest_location_name"),
        detail.get("consignee_country_code"),
    )

    customs_currency = resolve_currency(detail.get("customs_currency_code"))
    cod_currency = resolve_currency(detail.get("cod_currency_code"))
    insurance_currency = resolve_currency(detail.get("insurance_currency_code"))
    gst_currency = resolve_currency(detail.get("total_gst_currency_code"))
    fob_currency = resolve_currency(detail.get("fob_currency_code"))

    customs_value = detail.get("customs_value", 0)
    if customs_value is None:
        customs_value = 0

    return f"""            <Shipment>
                <ReferenceNumber>{esc(ref)}</ReferenceNumber>
                <SenderReference>{esc(sender_ref)}</SenderReference>
                <SenderReference2>{esc(detail.get("sender_reference_2", ""))}</SenderReference2>
                <SenderReference3></SenderReference3>
                <AlternateReference>{esc(detail.get("alternate_reference", ""))}</AlternateReference>
                <ConsignorName>{esc(detail.get("consignor_name", ""))}</ConsignorName>
                <ConsignorAddress1>{esc(detail.get("consignor_address_1", ""))}</ConsignorAddress1>
                <ConsignorAddress2>{esc(detail.get("consignor_address_2", ""))}</ConsignorAddress2>
                <ConsignorAddress3></ConsignorAddress3>
                <ConsignorAddress4></ConsignorAddress4>
                <ConsignorAddress5></ConsignorAddress5>
                <ConsignorLocationName>{esc(detail.get("consignor_location_name", ""))}</ConsignorLocationName>
                <ConsignorCountryCode>{esc(detail.get("consignor_country_code", ""))}</ConsignorCountryCode>
                <ConsignorCountryName>{esc(detail.get("consignor_country_name", ""))}</ConsignorCountryName>
                <ConsignorState>{esc(detail.get("consignor_state", ""))}</ConsignorState>
                <ConsignorPostcode>{esc(detail.get("consignor_postcode", ""))}</ConsignorPostcode>
                <ConsignorAddressGeoLat>0</ConsignorAddressGeoLat>
                <ConsignorAddressGeoLng>0</ConsignorAddressGeoLng>
                <ConsignorPhone>{esc(detail.get("consignor_phone", ""))}</ConsignorPhone>
                <ConsignorFax>{esc(detail.get("consignor_fax", ""))}</ConsignorFax>
                <ConsignorEmail>{esc(detail.get("consignor_email", ""))}</ConsignorEmail>
                <ConsignorContact>{esc(detail.get("consignor_contact") or detail.get("consignor_name", ""))}</ConsignorContact>
                <ConsigneeName>{esc(detail.get("consignee_name", ""))}</ConsigneeName>
                <ConsigneeAddress1>{esc(detail.get("consignee_address_1", ""))}</ConsigneeAddress1>
                <ConsigneeAddress2>{esc(detail.get("consignee_address_2", ""))}</ConsigneeAddress2>
                <ConsigneeAddress3>{esc(detail.get("consignee_address_3", ""))}</ConsigneeAddress3>
                <ConsigneeAddress4>{esc(detail.get("consignee_address_4", ""))}</ConsigneeAddress4>
                <ConsigneeAddress5>{esc(detail.get("consignee_address_5", ""))}</ConsigneeAddress5>
                <ConsigneeLocationName>{esc(detail.get("consignee_location_name", ""))}</ConsigneeLocationName>
                <ConsigneeState>{esc(detail.get("consignee_state", ""))}</ConsigneeState>
                <ConsigneeCountryCode>{esc(detail.get("consignee_country_code", ""))}</ConsigneeCountryCode>
                <ConsigneeCountryName>{esc(detail.get("consignee_country_name", ""))}</ConsigneeCountryName>
                <ConsigneePostCode>{esc(detail.get("consignee_postcode", ""))}</ConsigneePostCode>
                <ConsigneeAddressGeoLat>0</ConsigneeAddressGeoLat>
                <ConsigneeAddressGeoLng>0</ConsigneeAddressGeoLng>
                <ConsigneeContact>{esc(detail.get("consignee_contact") or detail.get("consignee_name", ""))}</ConsigneeContact>
                <ConsigneePhone>{esc(detail.get("consignee_phone", ""))}</ConsigneePhone>
                <ConsigneeFax>{esc(detail.get("consignee_fax", ""))}</ConsigneeFax>
                <ConsigneeEmail>{esc(detail.get("consignee_email", ""))}</ConsigneeEmail>
                <OriginCountryCode>{esc(detail.get("origin_country_code", ""))}</OriginCountryCode>
                <OriginCountryName>{esc(detail.get("origin_country_name", ""))}</OriginCountryName>
                <OriginLocationCode>{esc(origin["code"])}</OriginLocationCode>
                <OriginLocationName>{esc(origin["name"])}</OriginLocationName>
                <DestLocationCode>{esc(dest["code"])}</DestLocationCode>
                <DestLocationName>{esc(dest["name"])}</DestLocationName>
                <ShipperCode>{esc(FFDX_UPDATE_ENTITY_ID)}</ShipperCode>
                <ShipperName>Logicentrix Pvt Ltd</ShipperName>
                <Weight>{weight_grams}</Weight>
                <WeightMeasure>G</WeightMeasure>
                <DeadWeight>{dead_weight_grams}</DeadWeight>
                <CustomerDeclaredWeight>{declared_weight_grams}</CustomerDeclaredWeight>
                <CubicLength>{detail.get("cubic_length", 0) or 0}</CubicLength>
                <CubicWidth>{detail.get("cubic_width", 0) or 0}</CubicWidth>
                <CubicHeight>{detail.get("cubic_height", 0) or 0}</CubicHeight>
                <CubicWeight>0</CubicWeight>
                <CubicMeasure>{esc(detail.get("cubic_measure") or "G")}</CubicMeasure>
                <BagNumber>{esc(bag_number)}</BagNumber>
                <NumofItems>{int(num(detail, "num_of_items", 1) or 1)}</NumofItems>
                <ServiceType>{esc(detail.get("service_type", ""))}</ServiceType>
                <ShipmentType>{esc(detail.get("shipment_type", ""))}</ShipmentType>
                <GoodsDesc>{esc(detail.get("goods_desc", ""))}</GoodsDesc>
                <HarmonisedCode>{esc(detail.get("harmonised_code", ""))}</HarmonisedCode>
                <Notes>{esc(detail.get("notes", ""))}</Notes>
                <CustomsValue>{customs_value}</CustomsValue>
                <CustomsCurrencyCode>{esc(customs_currency)}</CustomsCurrencyCode>
                <CODAmount>{detail.get("cod_amount") or "0.0000"}</CODAmount>
                <CODCurrencyCode>{esc(cod_currency)}</CODCurrencyCode>
                <SecurityValue>{detail.get("security_value") or "0.0000"}</SecurityValue>
                <InsuranceValue>{detail.get("insurance_value") or "0.0000"}</InsuranceValue>
                <InsuranceCurrencyCode>{esc(insurance_currency)}</InsuranceCurrencyCode>
                <DeliveryInstructions>{esc(detail.get("delivery_instructions", ""))}</DeliveryInstructions>
                <ClearanceReference>{esc(detail.get("clearance_reference", ""))}</ClearanceReference>
                <ReasonExport>{esc(detail.get("reason_export", ""))}</ReasonExport>
                <ShipTerms>{esc(detail.get("ship_terms", ""))}</ShipTerms>
                <Surcharge>{detail.get("surcharge") or "0"}</Surcharge>
                <ConsigneeTaxID>{esc(detail.get("consignee_tax_id", ""))}</ConsigneeTaxID>
                <ConsigneeKYCType>{esc(detail.get("consignee_kyc_type", ""))}</ConsigneeKYCType>
                <ConsigneeKYCNumber>{esc(detail.get("consignee_kyc_number", ""))}</ConsigneeKYCNumber>
                <ConsignorKYCType>{esc(detail.get("consignor_kyc_type", ""))}</ConsignorKYCType>
                <ConsignorKYCNumber>{esc(detail.get("consignor_kyc_number", ""))}</ConsignorKYCNumber>
                <ConsignorTaxID>{esc(detail.get("consignor_tax_id", ""))}</ConsignorTaxID>
                <ConsignorIEC>{esc(detail.get("consignor_iec", ""))}</ConsignorIEC>
                <EcomShipment>{esc(detail.get("ecom_shipment", ""))}</EcomShipment>
                <MEIS>{esc(detail.get("meis", ""))}</MEIS>
                <TotalGST>{detail.get("total_gst", 0) or 0}</TotalGST>
                <TotalGSTCurrencyCode>{esc(gst_currency)}</TotalGSTCurrencyCode>
                <FOBValue>{detail.get("fob_value", 0) or 0}</FOBValue>
                <FOBCurrencyCode>{esc(fob_currency)}</FOBCurrencyCode>
                <ConnoteExportInvoiceNum>{esc(detail.get("connote_export_invoice_num", ""))}</ConnoteExportInvoiceNum>
                <ConnoteExportInvoiceDate>{esc(detail.get("connote_export_invoice_date", ""))}</ConnoteExportInvoiceDate>
                <FreightCost>0</FreightCost>
                <FreightCostCurrencyCode></FreightCostCurrencyCode>
                <DeliveryAgentCode>{esc(detail.get("delivery_agent_code", ""))}</DeliveryAgentCode>
                <DeliveryRouteCode>{esc(detail.get("delivery_route_code", ""))}</DeliveryRouteCode>
                <BusinessType>{esc(detail.get("business_type", ""))}</BusinessType>
                <CPCCode></CPCCode>
                <SKUNumber></SKUNumber>
                <ATENumber></ATENumber>
                <ProductURL></ProductURL>
                <GoodsValue>0</GoodsValue>
                <GoodsCurrencyCode></GoodsCurrencyCode>
                <DutyValue>0</DutyValue>
                <DutyCurrencyCode></DutyCurrencyCode>
                <EORINumber></EORINumber>
                <Items>
                    <Item>
                        <ItemReference>{esc(ref)}</ItemReference>
                        <ItemAlternateReference></ItemAlternateReference>
                        <ItemCubicLength>{detail.get("cubic_length", 0) or 0}</ItemCubicLength>
                        <ItemCubicWidth>{detail.get("cubic_width", 0) or 0}</ItemCubicWidth>
                        <ItemCubicHeight>{detail.get("cubic_height", 0) or 0}</ItemCubicHeight>
                        <ItemCubicMeasure>{esc(detail.get("cubic_measure") or "G")}</ItemCubicMeasure>
                        <ItemWeight>{weight_grams}</ItemWeight>
                        <ItemDeadWeight>{dead_weight_grams}</ItemDeadWeight>
                        <ItemWeightMeasure>G</ItemWeightMeasure>
                        <ItemNotes>{esc(detail.get("notes", ""))}</ItemNotes>
                        <ItemBagNumber>{esc(bag_number)}</ItemBagNumber>
                        <Pieces>
                            <Piece>
                                <PieceRef>{esc(sender_ref or ref)}</PieceRef>
                                <PieceAltRef></PieceAltRef>
                                <PieceHarmonisedCode>{esc(detail.get("harmonised_code", ""))}</PieceHarmonisedCode>
                                <PieceGoodsDescription>{esc(detail.get("goods_desc", ""))}</PieceGoodsDescription>
                                <PieceWeight>{weight_grams}</PieceWeight>
                                <PieceDeadWeight>0</PieceDeadWeight>
                                <PieceQty>1</PieceQty>
                                <PieceContent></PieceContent>
                                <PieceNotes>{esc(detail.get("notes", ""))}</PieceNotes>
                                <PieceSize></PieceSize>
                                <PieceCountryCodeOfManufacture>{esc(detail.get("origin_country_code", ""))}</PieceCountryCodeOfManufacture>
                                <PieceCountryCodeOfOrigin>{esc(detail.get("origin_country_code", ""))}</PieceCountryCodeOfOrigin>
                                <PieceCustomsValue>{customs_value}</PieceCustomsValue>
                                <PieceCurrencyCode>{esc(customs_currency)}</PieceCurrencyCode>
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
            </Shipment>"""


def build_upload_xml(manifest_reference: str, shipment_blocks: list, header: dict) -> str:
    message_id = generate_message_id()
    now = now_formatted()
    shipments_content = "\n".join(shipment_blocks)

    return f"""<?xml version='1.0' encoding='iso-8859-1' ?>
<WSGET>
    <AccessRequest>
        <WSVersion>1.0a</WSVersion>
        <FileType>1</FileType>
        <Action>upload</Action>
        <EntityID>{esc(FFDX_ENTITY_ID)}</EntityID>
        <EntityPIN>{esc(FFDX_ENTITY_PIN)}</EntityPIN>
        <MessageID>{message_id}</MessageID>
    </AccessRequest>
    <Mawb>
        <MawbReference>{esc(manifest_reference)}</MawbReference>
        <UpliftDate>{now}</UpliftDate>
        <TravelID>{esc(header["travelId"])}</TravelID>
        <CarrierCode>{esc(header["carrierCode"])}</CarrierCode>
        <Carrier>{esc(header["carrierName"])}</Carrier>
        <FromLoc>{esc(header["fromLoc"])}</FromLoc>
        <FromLocName>{esc(header["fromLocName"])}</FromLocName>
        <ToLoc>{esc(header["toLoc"])}</ToLoc>
        <ToLocName>{esc(header["toLocName"])}</ToLocName>
        <ShipperCode>{esc(header["shipperCode"])}</ShipperCode>
        <ShipperName>{esc(header["shipperName"])}</ShipperName>
        <ReceiverCode>{esc(header["receiverCode"])}</ReceiverCode>
        <ReceiverName>{esc(header["receiverName"])}</ReceiverName>
        <Notes>{esc(header.get("notes", ""))}</Notes>
        <ScheduledArrival>{esc(header.get("scheduledArrival", ""))}</ScheduledArrival>
        <DeclaredWt>{header["declaredWt"]}</DeclaredWt>
        <ManifestedBy>{esc(header["manifestedBy"])}</ManifestedBy>
        <WeightMeasure>{esc(header.get("weightMeasure") or "K")}</WeightMeasure>
        <Shipments>
{shipments_content}
        </Shipments>
    </Mawb>
</WSGET>"""


def post_to_ffdx(xml_stream: str) -> dict:
    form = urllib.parse.urlencode(
        {
            "Username": FFDX_USERNAME,
            "Password": FFDX_PASSWORD,
            "xmlStream": xml_stream,
            "LevelConfirm": "summary",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        FFDX_BASE_URL,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            body = res.read().decode("utf-8", errors="replace")
            return {"http_status": res.status, "raw": body}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"http_status": e.code, "raw": body}


def print_sanitisation_check(shipment: dict):
    print("-- Sanitisation check --------------------------------------")
    checks = [
        ("origin_location_code", shipment.get("origin_location_code")),
        ("dest_location_code", shipment.get("dest_location_code")),
        ("cod_currency_code", shipment.get("cod_currency_code")),
        ("insurance_currency_code", shipment.get("insurance_currency_code")),
        ("total_gst_currency_code", shipment.get("total_gst_currency_code")),
        ("fob_currency_code", shipment.get("fob_currency_code")),
    ]
    any_placeholders = False
    for field, val in checks:
        cleaned = clean_code(val)
        if not cleaned and val:
            any_placeholders = True
            print(f'  ! {field}="{val}" looks like a placeholder -> will be sent blank / replaced')
    if not any_placeholders:
        print("  (no obvious placeholder codes found in this row)")
    print()


def build_variant(shipment: dict, ref_suffix: str, fix_weight: bool = True,
                   shipment_overrides: dict = None, header_overrides: dict = None) -> str:
    """Build a full upload XML for one shipment, with optional field overrides
    and a unique reference suffix so repeated test runs don't collide with
    each other or with real data on FFDX."""
    s = dict(shipment)
    if shipment_overrides:
        s.update(shipment_overrides)

    ref = (s.get("reference_number") or "TEST") + ref_suffix
    s["reference_number"] = ref
    if s.get("sender_reference"):
        s["sender_reference"] = s["sender_reference"] + ref_suffix

    bag_number = "TEST-BAG-1"
    shipment_xml = build_shipment_xml(s, bag_number, fix_weight=fix_weight)

    origin = resolve_location(
        s.get("origin_location_code"),
        s.get("origin_location_name"),
        s.get("origin_country_code") or s.get("consignor_country_code"),
    )
    dest = resolve_location(
        s.get("dest_location_code"),
        s.get("dest_location_name"),
        s.get("consignee_country_code"),
    )

    header = {
        "travelId": "TEST",
        "carrierCode": "CX",
        "carrierName": "Cathay Pacific",
        "fromLoc": origin["code"],
        "fromLocName": origin["name"],
        "toLoc": dest["code"],
        "toLocName": dest["name"],
        "shipperCode": FFDX_UPDATE_ENTITY_ID,
        "shipperName": "Logicentrix Pvt Ltd",
        "receiverCode": "PICKME",
        "receiverName": "PickMe",
        "notes": "",
        "manifestedBy": FFDX_UPDATE_ENTITY_ID,
        "declaredWt": f'{num(s, "weight", 0.1) or 0.1:.2f}',
        "weightMeasure": "K",
        "scheduledArrival": "",
    }
    if header_overrides:
        header.update(header_overrides)

    manifest_ref = (s.get("mawb_reference") or "TEST-MAWB") + ref_suffix
    return build_upload_xml(manifest_ref, [shipment_xml], header)


def submit_and_report(label: str, xml: str, show_xml: bool = False) -> tuple:
    if show_xml:
        print(f"\n-- XML for: {label} ------------------------------------")
        print(xml)
    m = re.search(r"<MessageID>(\d+)</MessageID>", xml)
    message_id = m.group(1) if m else "?"
    result = post_to_ffdx(xml)
    clean_text = re.sub(r"<[^>]+>", "", result["raw"]).strip()
    rejected = "object reference" in clean_text.lower() or bool(re.search(r"\|-1\|", clean_text))
    status = "REJECTED" if rejected else "ACCEPTED"
    print(f"[{status}] {label}  (MessageID {message_id})")
    print(f"    HTTP {result['http_status']} -> {clean_text[:200]}")
    return (not rejected, message_id)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    bisect_mode = "--bisect" in sys.argv
    file_arg = args[0] if args else None

    if file_arg:
        with open(file_arg, "r", encoding="utf-8") as f:
            parsed = json.load(f)
    else:
        parsed = SAMPLE_SHIPMENT

    shipment = parsed[0] if isinstance(parsed, list) else parsed
    print_sanitisation_check(shipment)

    print("-- Credentials being used (verify these are REAL, live FFDX creds, --")
    print("   not the placeholder fallback values baked into route.ts) ----------")
    print(f"   FFDX_USERNAME  = {FFDX_USERNAME}")
    print(f"   FFDX_ENTITY_ID = {FFDX_ENTITY_ID}")
    print(f"   FFDX_UPDATE_ENTITY_ID = {FFDX_UPDATE_ENTITY_ID}")
    print("   (password/PIN not printed)\n")

    if not bisect_mode:
        # Single best-guess attempt: placeholder codes sanitised + weight-unit
        # bug fixed (see to_grams() docstring for why the old *1000 was wrong).
        xml = build_variant(shipment, ref_suffix="-FIX", fix_weight=True)
        print("-- XML being sent --------------------------------------------")
        print(xml)
        print("\n-- Posting to FFDX ---------------------------------------------")
        ok, _ = submit_and_report("weight-fixed + sanitised codes", xml)
        if ok:
            print("\nAccepted.")
        else:
            print("\nStill rejected. Re-run with --bisect to test several other")
            print("suspect fields (ReceiverCode, ShipperCode, ConsigneeState,")
            print("HarmonisedCode format, etc.) against FFDX in one pass:")
            print(f"    python3 {os.path.basename(__file__)} --bisect" + (f" {file_arg}" if file_arg else ""))
        return

    # ── Bisect mode: fire several targeted variants, each with a unique ref
    #    suffix, and report which ones FFDX accepts. This hits FFDX's LIVE
    #    endpoint once per variant below - only run this against a test/UAT
    #    entity, or be ready to void the resulting test shipments afterward.
    print("-- Bisect mode: testing candidate fixes against FFDX --------\n")

    variants = [
        ("baseline (sanitised codes only, old *1000 weight bug)",
         dict(ref_suffix="-B0", fix_weight=False)),

        ("weight-unit fix (respect weight_measure instead of blind *1000)",
         dict(ref_suffix="-B1", fix_weight=True)),

        ("weight fix + blank ConsigneeState",
         dict(ref_suffix="-B2", fix_weight=True,
              shipment_overrides={"consignee_state": ""})),

        ("weight fix + ShipperCode = FFDX_ENTITY_ID (instead of UPDATE_ENTITY_ID)",
         dict(ref_suffix="-B3", fix_weight=True,
              header_overrides={"shipperCode": FFDX_ENTITY_ID, "manifestedBy": FFDX_ENTITY_ID})),

        ("weight fix + HarmonisedCode without the dot (441214 not 4412.14)",
         dict(ref_suffix="-B4", fix_weight=True,
              shipment_overrides={"harmonised_code": re.sub(r"[^0-9]", "", str(shipment.get("harmonised_code") or ""))})),

        ("weight fix + blank ServiceType/ShipmentType",
         dict(ref_suffix="-B5", fix_weight=True,
              shipment_overrides={"service_type": "", "shipment_type": ""})),

        ("weight fix + blank CustomsCurrencyCode",
         dict(ref_suffix="-B6", fix_weight=True,
              shipment_overrides={"customs_currency_code": ""})),

        # Every variant above changed shipment-level data and still failed
        # identically -> next suspects are things constant across all of
        # them: ReceiverCode and the account/entity itself.
        ("weight fix + blank ReceiverCode/ReceiverName",
         dict(ref_suffix="-B7", fix_weight=True,
              header_overrides={"receiverCode": "", "receiverName": ""})),

        ("weight fix + TravelID blank (was hardcoded 'TEST')",
         dict(ref_suffix="-B8", fix_weight=True,
              header_overrides={"travelId": ""})),

        ("bare-minimum shipment (only reference/consignor/consignee names + weight)",
         dict(ref_suffix="-B9", fix_weight=True,
              shipment_overrides={
                  "origin_location_code": "", "origin_location_name": "",
                  "dest_location_code": "", "dest_location_name": "",
                  "consignee_state": "", "consignor_state": "",
                  "cod_currency_code": "", "insurance_currency_code": "",
                  "total_gst_currency_code": "", "fob_currency_code": "",
                  "customs_currency_code": "", "harmonised_code": "",
                  "service_type": "", "shipment_type": "", "ship_terms": "",
                  "goods_desc": "PARCEL",
              })),
    ]

    results = []
    for label, kwargs in variants:
        xml = build_variant(shipment, **kwargs)
        ok, message_id = submit_and_report(label, xml)
        results.append((label, ok, message_id))
        time.sleep(1)  # be gentle with FFDX between calls

    print("\n-- Summary -----------------------------------------------------")
    any_ok = False
    for label, ok, message_id in results:
        any_ok = any_ok or ok
        print(f'  {"ACCEPTED" if ok else "rejected"}  (MessageID {message_id})  -  {label}')
    if not any_ok:
        print("\nNone of these variants were accepted, including ones that blanked")
        print("ReceiverCode and stripped the shipment to bare-minimum fields. The")
        print("only things constant across every single attempt are: the FFDX")
        print("account credentials (Username/Password/EntityID/EntityPIN) and the")
        print("live endpoint itself. That strongly points to the account/entity")
        print("side rather than any shipment field:")
        print("  1. Confirm FFDX_USERNAME/PASSWORD/ENTITY_ID/ENTITY_PIN in your")
        print("     real deployment env vars are current, FFDX-issued production")
        print("     values - not the hardcoded fallback strings baked into")
        print("     route.ts as defaults (those look like placeholder/sample")
        print("     values, not real credentials, and hardcoding them in source")
        print("     is also a security issue worth fixing regardless).")
        print("  2. Confirm with FFDX/your account manager that this EntityID is")
        print("     currently active and that 'PICKME' is a ReceiverCode actually")
        print("     provisioned for it.")
        print("  3. Open a ticket with FFDX support and give them the MessageIDs")
        print("     above - the null-reference happens inside their service, so")
        print("     only their own server logs can show the actual stack trace.")


if __name__ == "__main__":
    main()