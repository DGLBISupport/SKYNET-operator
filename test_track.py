import xml.etree.ElementTree as ET
from datetime import datetime
import requests

# 1. Configuration & Credentials
FFDX_VERSION = "v12"
API_URL = f"https://ws05.ffdx.net/ffdx_ws/{FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer"

FFDX_USERNAME = "26AFE6A6F99D1300F43071AE6219FD79"
FFDX_PASSWORD = "6044F95F8F096B06083F35DE08A5641B"
FFDX_ENTITY_ID = "4B71FB68246CD8FD8EBE0D79FAF5273E"
FFDX_ENTITY_PIN = "VeeVA4?37kd"
WS_VERSION = "WS1.0"

def build_tracking_xml(reference_number):
    root = ET.Element("WSGET")
    
    # Access Request Block
    access = ET.SubElement(root, "AccessRequest")
    ET.SubElement(access, "WSVersion").text = WS_VERSION
    ET.SubElement(access, "FileType").text = "2"
    ET.SubElement(access, "Action").text = "upload"
    ET.SubElement(access, "EntityID").text = FFDX_ENTITY_ID
    ET.SubElement(access, "EntityPIN").text = FFDX_ENTITY_PIN
    ET.SubElement(access, "MessageID").text = "0001"
    
    # Event Block
    event = ET.SubElement(root, "Event")
    ET.SubElement(event, "ReferenceNumber").text = str(reference_number)
    ET.SubElement(event, "ReferenceType").text = "C"
    ET.SubElement(event, "EventDateTime").text = datetime.now().strftime("%Y/%m/%d %I:%M:%S %p")
    ET.SubElement(event, "EventID").text = "1558"
    ET.SubElement(event, "Remarks").text = "Skynet Warehouse"
    ET.SubElement(event, "OriginByPrefix").text = "0"
    ET.SubElement(event, "OriginEntityID").text = ""
    ET.SubElement(event, "UpdateEntityID").text = "LK7171"
    ET.SubElement(event, "UpdateEntityLocationName").text = "Colombo"
    
    xml_inner = ET.tostring(root, encoding='utf-8').decode('utf-8')
    return f"<?xml version='1.0' encoding='ISO-8859-1' ?>\n{xml_inner}"

def parse_ffdx_response(raw_response_text):
    """Parses both wrapped ASMX strings and direct WSGET XML responses."""
    try:
        # First attempt: Clean ASMX string wrapper if present
        root = ET.fromstring(raw_response_text)
        
        # If the root is <string>, parse the inner text
        if root.tag.endswith('string'):
            inner_text = root.text
            if inner_text and inner_text.startswith("<?xml") or "<WSGET>" in str(inner_text):
                root = ET.fromstring(inner_text)
            else:
                return f"Pipe Response: {inner_text}"

        # Extract ReturnStatus from <WSGET>
        status_code = root.find(".//ReturnStatus/StatusCode")
        status_desc = root.find(".//ReturnStatus/StatusDesc")
        
        if status_code is not None and status_desc is not None:
            code = status_code.text
            desc = status_desc.text
            if code == "0":
                return f"✅ SUCCESS (Code 0): {desc}"
            else:
                return f"❌ FAILED (Code {code}): {desc}"
        
        return f"Raw Response: {raw_response_text}"

    except ET.ParseError:
        return f"Raw Response (Non-XML): {raw_response_text}"

def upload_tracking(reference_number):
    xml_data = build_tracking_xml(reference_number)
    
    payload = {
        'Username': FFDX_USERNAME,
        'Password': FFDX_PASSWORD,
        'xmlStream': xml_data,
        'LevelConfirm': 'Summary'
    }
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    try:
        print(f"🚀 Sending tracking update for [{reference_number}]...")
        response = requests.post(API_URL, data=payload, headers=headers, timeout=15)
        
        print(f"HTTP Status: {response.status_code}")
        result_message = parse_ffdx_response(response.text.strip())
        print(result_message)

    except requests.exceptions.RequestException as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    upload_tracking("710283698471")