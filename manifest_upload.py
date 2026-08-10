import httpx
import logging
import asyncio
import random
import string
import os
import requests
import pandas as pd
import json

from io import BytesIO
from datetime import datetime
from typing import List
from supabase import create_client, Client
from dotenv import load_dotenv


load_dotenv()

logger = logging.getLogger(__name__)

FFDX_VERSION = "v12"
API_URL = f"https://ws05.ffdx.net/ffdx_ws/{FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer"

FFDX_USERNAME = "26AFE6A6F99D1300F43071AE6219FD79"
FFDX_PASSWORD = "6044F95F8F096B06083F35DE08A5641B"
FFDX_ENTITY_ID = "4B71FB68246CD8FD8EBE0D79FAF5273E"
FFDX_ENTITY_PIN = "VeeVA4?37kd"
WS_VERSION = "WS1.0"

FFDX_REQUEST_RETRIES = 3
FFDX_RETRY_BACKOFF = 5.0
FFDX_REQUEST_TIMEOUT = httpx.Timeout(None)

FFDX_BASE_URL = f"https://ws05.ffdx.net/ffdx_ws/{FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_random_message_id() -> str:
    """Generate a random 10-digit message ID so each request is traceable in FFDX's logs."""
    return ''.join(random.choices(string.digits, k=10))

def create_upload_request():
    now = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    message_id = generate_random_message_id()

    upload_req = f"""<?xml version='1.0' encoding='iso-8859-1' ?>
<WSGET>
    <AccessRequest>
        <WSVersion>1.0a</WSVersion>
        <FileType>1</FileType>
        <Action>upload</Action>
        <EntityID>{FFDX_ENTITY_ID}</EntityID>
        <EntityPIN>{FFDX_ENTITY_PIN}</EntityPIN>
        <MessageID>{message_id}</MessageID>
    </AccessRequest>
    <Mawb>
        <MawbReference>LK-SP-SKYNET-1-TEST-20260804-2</MawbReference>
        <UpliftDate>{now}</UpliftDate>
        <TravelID>PICKME</TravelID>
        <CarrierCode>UL</CarrierCode>
        <Carrier>Sri Lankan Airlines</Carrier>
        <FromLoc>CMB</FromLoc>
        <FromLocName>Colombo</FromLocName>
        <ToLoc>CMB</ToLoc>
        <ToLocName>Colombo</ToLocName>
        <ShipperCode>LK7171</ShipperCode>
        <ShipperName>Logicentrix Pvt Ltd</ShipperName>
        <ReceiverCode>PICKME</ReceiverCode>
        <ReceiverName>PickMe</ReceiverName>
        <Notes></Notes>
        <ScheduledArrival></ScheduledArrival>
        <DeclaredWt></DeclaredWt>
        <ManifestedBy>LK7171</ManifestedBy>
        <WeightMeasure>K</WeightMeasure>
        <Shipments>
            <Shipment>
                <ReferenceNumber>710283701234</ReferenceNumber>
                <SenderReference>LK 260714 Test 15</SenderReference>
                <SenderReference2></SenderReference2>
                <SenderReference3></SenderReference3>
                <AlternateReference></AlternateReference>
                <ConsignorName>Test Sender 15</ConsignorName>
                <ConsignorAddress1>15. no. 88 minzu road, xingqing district, yinchuan, ningxia hui autonomous </ConsignorAddress1>
                <ConsignorAddress2></ConsignorAddress2>
                <ConsignorAddress3></ConsignorAddress3>
                <ConsignorAddress4></ConsignorAddress4>
                <ConsignorAddress5></ConsignorAddress5>
                <ConsignorLocationName>China</ConsignorLocationName>
                <ConsignorCountryCode>CN</ConsignorCountryCode>
                <ConsignorCountryName>CHINA</ConsignorCountryName>
                <ConsignorState></ConsignorState>
                <ConsignorPostcode>10400</ConsignorPostcode>
                <ConsignorAddressGeoLat>0</ConsignorAddressGeoLat>
                <ConsignorAddressGeoLng>0</ConsignorAddressGeoLng>
                <ConsignorPhone>85223712699</ConsignorPhone>
                <ConsignorFax></ConsignorFax>
                <ConsignorEmail>Sender@sample.com</ConsignorEmail>
                <ConsignorContact>Test Sender LLL</ConsignorContact>
                <ConsigneeName>Skynet LK</ConsigneeName>
                <ConsigneeAddress1>No. 14, River View, Batticaloa, 30000</ConsigneeAddress1>
                <ConsigneeAddress2></ConsigneeAddress2>
                <ConsigneeAddress3></ConsigneeAddress3>
                <ConsigneeAddress4></ConsigneeAddress4>
                <ConsigneeAddress5></ConsigneeAddress5>
                <ConsigneeLocationName>Sri Lanka</ConsigneeLocationName>
                <ConsigneeState>North Western Province</ConsigneeState>
                <ConsigneeCountryCode>LK</ConsigneeCountryCode>
                <ConsigneeCountryName>SRI LANKA</ConsigneeCountryName>
                <ConsigneePostCode></ConsigneePostCode>
                <ConsigneeAddressGeoLat>0</ConsigneeAddressGeoLat>
                <ConsigneeAddressGeoLng>0</ConsigneeAddressGeoLng>
                <ConsigneeContact>12123</ConsigneeContact>
                <ConsigneePhone>(260) 010-1248</ConsigneePhone>
                <ConsigneeFax></ConsigneeFax>
                <ConsigneeEmail>test@gmail.com</ConsigneeEmail>
                <OriginCountryCode>CN</OriginCountryCode>
                <OriginCountryName>CHINA</OriginCountryName>
                <OriginLocationCode>TBA1</OriginLocationCode>
                <OriginLocationName>TBA</OriginLocationName>
                <DestLocationCode>TBA1</DestLocationCode>
                <DestLocationName>Sri Lanka</DestLocationName>
                <ShipperCode>LK7171</ShipperCode>
                <ShipperName>Logicentrix Pvt Ltd</ShipperName>
                <Weight>14270</Weight>
                <WeightMeasure>G</WeightMeasure>
                <DeadWeight>0</DeadWeight>
                <CustomerDeclaredWeight>0</CustomerDeclaredWeight>
                <CubicLength>0</CubicLength>
                <CubicWidth>0</CubicWidth>
                <CubicHeight>0</CubicHeight>
                <CubicWeight>0</CubicWeight>
                <CubicMeasure>G</CubicMeasure>
                <BagNumber>LK Test 0715 11-20-PICKME-BAG-01</BagNumber>
                <NumofItems>1</NumofItems>
                <ServiceType>EN</ServiceType>
                <ShipmentType>N</ShipmentType>
                <GoodsDesc>TEST</GoodsDesc>
                <HarmonisedCode>1513.11</HarmonisedCode>
                <Notes></Notes>
                <CustomsValue>532</CustomsValue>
                <CustomsCurrencyCode>LKR</CustomsCurrencyCode>
                <CODAmount>0.0000</CODAmount>
                <CODCurrencyCode>TBA</CODCurrencyCode>
                <SecurityValue>0.0000</SecurityValue>
                <InsuranceValue>0.0000</InsuranceValue>
                <InsuranceCurrencyCode>TBA</InsuranceCurrencyCode>
                <DeliveryInstructions></DeliveryInstructions>
                <ClearanceReference></ClearanceReference>
                <ReasonExport></ReasonExport>
                <ShipTerms>DDP</ShipTerms>
                <Surcharge></Surcharge>
                <Incoterms></Incoterms>
                <ConsigneeTaxID></ConsigneeTaxID>
                <ConsigneeKycType></ConsigneeKycType>
                <ConsigneeKycNumber></ConsigneeKycNumber>
                <ConsignorKycType></ConsignorKycType>
                <ConsignorKycNumber></ConsignorKycNumber>
                <ConsignorTaxID></ConsignorTaxID>
                <ConsignorIEC></ConsignorIEC>
                <ConsignorReceivingCountryTaxID></ConsignorReceivingCountryTaxID>
                <CSB></CSB>
                <InvoiceType></InvoiceType>
                <BondUT></BondUT>
                <EcomShipment></EcomShipment>
                <MEIS></MEIS>
                <TotalGST>0</TotalGST>
                <TotalGSTCurrencyCode>TBA</TotalGSTCurrencyCode>
                <FOBValue>0</FOBValue>
                <FOBCurrencyCode>TBA</FOBCurrencyCode>
                <ConnoteExportInvoiceNum></ConnoteExportInvoiceNum>
                <ConnoteExportInvoiceDate></ConnoteExportInvoiceDate>
                <FreightCost>0</FreightCost>
                <FreightCostCurrencyCode>TBA</FreightCostCurrencyCode>
                <DeliveryAgentCode></DeliveryAgentCode>
                <DeliveryRouteCode></DeliveryRouteCode>
                <BusinessType></BusinessType>
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
                        <ItemReference>710283701190</ItemReference> 
                        <ItemAlternateReference></ItemAlternateReference>
                        <ItemCubicLength>0</ItemCubicLength>
                        <ItemCubicWidth>0</ItemCubicWidth>
                        <ItemCubicHeight>0</ItemCubicHeight>
                        <ItemCubicMeasure>G</ItemCubicMeasure>
                        <ItemWeight>2860</ItemWeight>
                        <ItemDeadWeight>2860</ItemDeadWeight>
                        <ItemWeightMeasure>G</ItemWeightMeasure>
                        <ItemNotes></ItemNotes>
                        <ItemBagNumber></ItemBagNumber>
                        <Pieces>
                            <Piece>
                                <PieceRef>SKU015</PieceRef>
                                <PieceAltRef></PieceAltRef>
                                <PieceHarmonisedCode>1513.11</PieceHarmonisedCode>
                                <PieceGoodsDescription>TEST</PieceGoodsDescription>
                                <PieceWeight>2860</PieceWeight>
                                <PieceDeadWeight>0</PieceDeadWeight>
                                <PieceQty>1</PieceQty>
                                <PieceContent></PieceContent>
                                <PieceNotes></PieceNotes>
                                <PieceSize></PieceSize>
                                <PieceCountryCodeOfManufacture>0</PieceCountryCodeOfManufacture>
                                <PieceCountryCodeOfOrigin>CN</PieceCountryCodeOfOrigin>
                                <PieceCustomsValue>34.00</PieceCustomsValue>
                                <PieceCurrencyCode>USD</PieceCurrencyCode>
                                <PieceSenderRef1></PieceSenderRef1>
                                <PieceSenderRef2></PieceSenderRef2>
                                <PieceCPCCode></PieceCPCCode>
                                <PieceATENumber></PieceATENumber>
                                <PieceProductURL></PieceProductURL>
                                <PieceGoodsValue>0.00</PieceGoodsValue>
                                <PieceGoodsCurrencyCode>TBA</PieceGoodsCurrencyCode>
                                <PieceDutyValue>0.00</PieceDutyValue>
                                <PieceDutyCurrencyCode>TBA</PieceDutyCurrencyCode>
                                <PieceGSTValue>0.00</PieceGSTValue>
                                <PieceGSTCurrencyCode>TBA</PieceGSTCurrencyCode>
                            </Piece>
                        </Pieces>
                    </Item>
                </Items> 
                <Reference1></Reference1>
                <Reference2></Reference2>
                <Reference3></Reference3>
                <Reference4></Reference4>
                <Reference5></Reference5>
            </Shipment>
        </Shipments>
    </Mawb>
</WSGET>"""
    return upload_req

async def upload_manifest(req_xml_stream: str):
    """POST the XML to FFDX and return the raw response text."""
    last_exc = None

    print(repr(FFDX_ENTITY_ID), repr(FFDX_ENTITY_PIN), repr(FFDX_USERNAME), repr(FFDX_PASSWORD))

    for attempt in range(1, FFDX_REQUEST_RETRIES + 1):
        print(f"[attempt {attempt}] sending request...", flush=True)
        try:
            async with httpx.AsyncClient(timeout=FFDX_REQUEST_TIMEOUT) as client:
                response = await client.post(
                    FFDX_BASE_URL,
                    data={
                        "Username": FFDX_USERNAME,
                        "Password": FFDX_PASSWORD,
                        "xmlStream": req_xml_stream,
                        "LevelConfirm": "summary",
                    },
                    timeout=FFDX_REQUEST_TIMEOUT,
                )
                print(response.content)
                print(f"[attempt {attempt}] got response: {response.status_code}", flush=True)
                response.raise_for_status()
                return response.text
        except httpx.ReadTimeout as exc:
            last_exc = exc
            logger.warning(
                "FFDX request timed out on attempt %d/%d. Retrying after %.1f seconds...",
                attempt,
                FFDX_REQUEST_RETRIES,
                FFDX_RETRY_BACKOFF,
            )
        except httpx.HTTPError as exc:
            last_exc = exc
            logger.error(
                "FFDX request failed on attempt %d/%d: %s",
                attempt,
                FFDX_REQUEST_RETRIES,
                exc,
            )
            break

        if attempt < FFDX_REQUEST_RETRIES:
            await asyncio.sleep(FFDX_RETRY_BACKOFF)

    raise RuntimeError(
        f"FFDX request failed after {FFDX_REQUEST_RETRIES} attempts: {last_exc}"
    ) from last_exc


def get_unassigned_bags() -> List[dict]:
    """
    Get all bags that have not been assigned to a manifest yet.
    Returns a list of dictionaries, where each dictionary represents a bag.
    """
    query = (
        supabase.table("outbound_lmd_bags")
        .select("bag_number, target_partner")
        .eq("is_bag_in_a_manifest", False)
        .eq("status", "OPEN")
    )
    response = query.execute()

    if (len(response.data) == 0):
        return "No data"
    return response.data

def get_outbound_bag_items(bag_number: str) -> List[dict]:
    """
    Get all items that belong to a specific bag.
    Returns a list of dictionaries, where each dictionary represents an item.
    """
    query = (
        supabase.table("outbound_lmd_bag_items")
        .select("*")
        .eq("bag_number", bag_number)
    )
    response = query.execute()

    if (len(response.data) == 0):
        return "No data"
    return response.data


def get_downloaded_manifest_from_supabase_storage(mawb_ref: str) -> dict:
    query = (
        supabase.table("mawb")
        .select("json_file_path")
        .eq("mawb_reference", mawb_ref)
    )
    response = query.execute()
    json_path = response.data[0]['json_file_path']

    print(json_path)
    response = supabase.storage.from_("skynet_parcel_allocation").download(json_path)

    return response

def normalize_manifest_json(raw_response) -> str:
    """
    Takes the raw manifest response (bytes or str, already valid JSON)
    and returns a clean, pretty-printed JSON string.
    """
    if isinstance(raw_response, bytes):
        raw_response = raw_response.decode("utf-8")

    data = json.loads(raw_response)
    return json.dumps(data, indent=2, ensure_ascii=False)


def load_manifest_data(raw_response):
    """Same as above, but returns the parsed Python object (list/dict) directly
    for further processing (e.g. inserting into Supabase)."""
    if isinstance(raw_response, bytes):
        raw_response = raw_response.decode("utf-8")
    return json.loads(raw_response)

def get_original_manifest(shipment_ref: str):
    query = (
        supabase.table('shipments')
        .select('reference_number, mawb_reference')
        .eq("reference_number", shipment_ref)
    )
    response = query.execute()
    print(response)
    return response.data

async def main():
    # res = get_downloaded_manifest_from_supabase_storage("LK Test 0715 1-10")
    # clean_json = normalize_manifest_json(res)
     # with open("mawb_output.json", "w", encoding="utf-8") as f:
    #     f.write(clean_json)


    res = get_unassigned_bags()
    if (res == "No data"):
        return
        
    for bag in res:
        items = get_outbound_bag_items(bag['bag_number'])
        if (items == "No data"):
            print("No items")
            continue

        for item in items:
            shipment_ref = item['shipment_ref']
            manifest_details = get_original_manifest(shipment_ref)
            print(manifest_details)
            

if __name__ == "__main__":
    asyncio.run(main())