"""
track_upload.py - FFDX GetonLine Tracking Batch Uploader (Batch Fallback Tool)
--------------------------------------------------------------------------------
The primary upload now happens automatically per-scan inside the Next.js API
(allocate/route.ts). This script is a BATCH FALLBACK to:

  1. Retry parcels where track_status = 'FAILED'
  2. Upload parcels scanned before auto-upload was added (track_status IS NULL)
  3. Upload a single reference number on demand (--ref flag)
  4. Preview what would be uploaded without actually sending (--dry-run)

Usage:
  python track_upload.py                # Upload all pending/failed parcels
  python track_upload.py --dry-run      # Preview without uploading
  python track_upload.py --ref <REF>    # Upload a single reference number
  python track_upload.py --retry-failed # Retry only FAILED ones (skip NULL)

Reads credentials from .env.local in the same directory.
"""

import xml.etree.ElementTree as ET
from datetime import datetime
import requests
import argparse
import os
import sys

# ---------------------------------------------------------------------------
# Load .env.local
# ---------------------------------------------------------------------------
def load_env(env_path=None):
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env.local')
    env = {}
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    env[key.strip()] = val.strip()
    return env

_env = load_env()

# ---------------------------------------------------------------------------
# Configuration (from .env.local or fallbacks)
# ---------------------------------------------------------------------------
FFDX_VERSION    = "v12"
FFDX_API_URL    = f"https://ws05.ffdx.net/ffdx_ws/{FFDX_VERSION}/service_ffdx.asmx/WSDataTransfer"
FFDX_USERNAME   = _env.get('FFDX_USERNAME',         '26AFE6A6F99D1300F43071AE6219FD79')
FFDX_PASSWORD   = _env.get('FFDX_PASSWORD',         '6044F95F8F096B06083F35DE08A5641B')
FFDX_ENTITY_ID  = _env.get('FFDX_ENTITY_ID',        '4B71FB68246CD8FD8EBE0D79FAF5273E')
FFDX_ENTITY_PIN = _env.get('FFDX_ENTITY_PIN',       'VeeVA4?37kd')
FFDX_UPDATE_ID  = _env.get('FFDX_UPDATE_ENTITY_ID', 'LK7171')
WS_VERSION      = "WS1.0"

SUPABASE_URL    = _env.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY    = _env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

SUPABASE_HEADERS = {
    'apikey':        SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type':  'application/json'
}


# ---------------------------------------------------------------------------
# FFDX XML Builder
# ---------------------------------------------------------------------------
def build_tracking_xml(reference_number, event_id="1558", remarks="Skynet Warehouse"):
    root   = ET.Element("WSGET")
    access = ET.SubElement(root, "AccessRequest")
    ET.SubElement(access, "WSVersion").text = WS_VERSION
    ET.SubElement(access, "FileType").text  = "2"
    ET.SubElement(access, "Action").text    = "upload"
    ET.SubElement(access, "EntityID").text  = FFDX_ENTITY_ID
    ET.SubElement(access, "EntityPIN").text = FFDX_ENTITY_PIN
    ET.SubElement(access, "MessageID").text = "0001"

    event = ET.SubElement(root, "Event")
    ET.SubElement(event, "ReferenceNumber").text         = str(reference_number)
    ET.SubElement(event, "ReferenceType").text           = "C"
    ET.SubElement(event, "EventDateTime").text           = datetime.now().strftime("%Y/%m/%d %I:%M:%S %p")
    ET.SubElement(event, "EventID").text                 = str(event_id)
    ET.SubElement(event, "Remarks").text                 = str(remarks)
    ET.SubElement(event, "OriginByPrefix").text          = "0"
    ET.SubElement(event, "OriginEntityID").text          = ""
    ET.SubElement(event, "UpdateEntityID").text          = FFDX_UPDATE_ID
    ET.SubElement(event, "UpdateEntityLocationName").text = "Colombo"

    xml_inner = ET.tostring(root, encoding='utf-8').decode('utf-8')
    return f"<?xml version='1.0' encoding='ISO-8859-1' ?>\n{xml_inner}"


# ---------------------------------------------------------------------------
# FFDX Upload
# ---------------------------------------------------------------------------
def upload_tracking(reference_number, dry_run=False, event_id="1558", remarks="Skynet Warehouse"):
    """Returns True on successful upload, False on failure."""
    if dry_run:
        print(f"  [DRY-RUN] Would upload: {reference_number} (EventID {event_id}: {remarks})")
        return True

    xml_data = build_tracking_xml(reference_number, event_id=event_id, remarks=remarks)
    payload  = {
        'Username':     FFDX_USERNAME,
        'Password':     FFDX_PASSWORD,
        'xmlStream':    xml_data,
        'LevelConfirm': '0'
    }

    try:
        print(f"  Uploading [{reference_number}] ...", end=' ', flush=True)
        resp = requests.post(
            FFDX_API_URL,
            data=payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15
        )
        raw     = resp.text.strip()
        success = resp.ok and '<Status>1</Status>' in raw
        if success:
            print(f"OK  HTTP {resp.status_code}")
        else:
            print(f"FAIL  HTTP {resp.status_code} | {raw[:200]}")
        return success

    except requests.exceptions.RequestException as e:
        print(f"ERROR  Connection: {e}")
        return False


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------
def fetch_pending_parcels(retry_failed_only=False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not found in .env.local")
        return []

    if retry_failed_only:
        url = (f"{SUPABASE_URL}/rest/v1/service_provider_allocation"
               f"?scan_status=eq.1ST_SCAN_DONE&track_status=eq.FAILED"
               f"&select=id,shipment_ref,mawb_ref,track_status")
    else:
        url = (f"{SUPABASE_URL}/rest/v1/service_provider_allocation"
               f"?scan_status=eq.1ST_SCAN_DONE"
               f"&or=(track_status.is.null,track_status.eq.FAILED)"
               f"&select=id,shipment_ref,mawb_ref,track_status")

    try:
        resp = requests.get(url, headers=SUPABASE_HEADERS, timeout=15)
        if not resp.ok:
            print(f"ERROR: Supabase HTTP {resp.status_code} - {resp.text[:200]}")
            return []
        return resp.json()
    except Exception as e:
        print(f"ERROR: Supabase connection - {e}")
        return []


def update_track_status(allocation_id, status):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    url = f"{SUPABASE_URL}/rest/v1/service_provider_allocation?id=eq.{allocation_id}"
    try:
        requests.patch(url, headers=SUPABASE_HEADERS, json={'track_status': status}, timeout=10)
    except Exception as e:
        print(f"    WARNING: Could not update track_status for id={allocation_id}: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='FFDX Batch Tracking Uploader')
    parser.add_argument('--ref',          help='Upload a single reference number')
    parser.add_argument('--event-id',     default='1558', help='Event ID to send (e.g. 1558 for warehouse scan, 85 for damaged)')
    parser.add_argument('--remarks',      default='Skynet Warehouse', help='Event remarks string (e.g. "Skynet Warehouse")')
    parser.add_argument('--dry-run',      action='store_true', help='Preview without uploading')
    parser.add_argument('--retry-failed', action='store_true', help='Retry only FAILED rows')
    args = parser.parse_args()

    # Single reference upload
    if args.ref:
        print(f"\nSingle upload mode: {args.ref} (Event {args.event_id}: {args.remarks})")
        success = upload_tracking(args.ref, dry_run=args.dry_run, event_id=args.event_id, remarks=args.remarks)
        sys.exit(0 if success else 1)

    # Batch upload
    print("\nFetching parcels from Supabase...")
    parcels = fetch_pending_parcels(retry_failed_only=args.retry_failed)

    if not parcels:
        print("No pending parcels to upload.")
        return

    mode_label = "FAILED only" if args.retry_failed else "NULL + FAILED"
    print(f"\nFound {len(parcels)} parcel(s) to upload ({mode_label})")
    if args.dry_run:
        print("   [DRY-RUN mode - no actual uploads]\n")

    succeeded = 0
    failed    = 0

    for row in parcels:
        ref      = row.get('shipment_ref', '')
        alloc_id = row.get('id')
        if not ref:
            continue

        success = upload_tracking(ref, dry_run=args.dry_run)
        if success:
            succeeded += 1
            if not args.dry_run and alloc_id:
                update_track_status(alloc_id, 'UPLOADED')
        else:
            failed += 1
            if not args.dry_run and alloc_id:
                update_track_status(alloc_id, 'FAILED')

    print(f"\n{'='*50}")
    print(f"  Succeeded : {succeeded}")
    print(f"  Failed    : {failed}")
    print(f"  Total     : {succeeded + failed}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
