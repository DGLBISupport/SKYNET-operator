import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export interface UnknownParcelItem {
    id: string | number;
    created_at: string;
    scan_date: string;
    barcode: string;
    scanned_by: string;
    bag_number?: string;
    mawb_reference?: string;
    scan_source?: string;
    status: 'PENDING' | 'EMAILED' | 'RESOLVED';
    is_email_sent: boolean;
    email_sent_at?: string | null;
    email_sent_to?: string | null;
    notes?: string;
}

// In-memory / JSON fallback store
let localStore: UnknownParcelItem[] = [];

const getLocalFilePath = () => {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'unknown_parcels.json');
};

const loadLocalData = () => {
    try {
        const filePath = getLocalFilePath();
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            localStore = JSON.parse(content);
        }
    } catch (e) {
        console.warn('Failed to load local unknown parcels store:', e);
    }
};

const saveLocalData = () => {
    try {
        const filePath = getLocalFilePath();
        fs.writeFileSync(filePath, JSON.stringify(localStore, null, 2), 'utf-8');
    } catch (e) {
        console.warn('Failed to save local unknown parcels store:', e);
    }
};

loadLocalData();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date'); // YYYY-MM-DD or empty for all

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && key) {
            try {
                const headers = {
                    apikey: key,
                    Authorization: `Bearer ${key}`
                };

                // Explicit column list — matches UnknownParcelItem interface, avoids select=*
                let queryUrl = `${supabaseUrl}/rest/v1/unknown_parcels?select=id,created_at,scan_date,barcode,scanned_by,bag_number,mawb_reference,scan_source,status,is_email_sent,email_sent_at,email_sent_to,notes&order=created_at.desc`;
                if (dateParam) {
                    queryUrl += `&scan_date=eq.${dateParam}`;
                }

                const res = await fetch(queryUrl, {
                    headers,
                    cache: 'no-store',
                    signal: AbortSignal.timeout(10000)
                });
                if (res.ok) {
                    const data: UnknownParcelItem[] = await res.json();
                    return NextResponse.json({
                        success: true,
                        parcels: data,
                        totalCount: data.length,
                        pendingCount: data.filter(p => !p.is_email_sent).length,
                        sentCount: data.filter(p => p.is_email_sent).length
                    });
                }
            } catch (err) {
                console.warn('Supabase fetch failed, falling back to local store:', err);
            }
        }

        // Fallback to local store
        loadLocalData();
        let filtered = localStore;
        if (dateParam) {
            filtered = localStore.filter(item => item.scan_date === dateParam);
        }

        return NextResponse.json({
            success: true,
            parcels: filtered,
            totalCount: filtered.length,
            pendingCount: filtered.filter(p => !p.is_email_sent).length,
            sentCount: filtered.filter(p => p.is_email_sent).length
        });
    } catch (error: any) {
        loadLocalData();
        return NextResponse.json({
            success: true,
            parcels: localStore,
            totalCount: localStore.length,
            pendingCount: localStore.filter(p => !p.is_email_sent).length,
            sentCount: localStore.filter(p => p.is_email_sent).length
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { barcode, barcodes, scannedBy, bagNumber, mawbReference, scanSource, notes, scanDate } = body;

        const barcodeList: string[] = Array.isArray(barcodes)
            ? barcodes.filter(b => typeof b === 'string' && b.trim().length > 0)
            : barcode
                ? [String(barcode).trim()]
                : [];

        if (barcodeList.length === 0) {
            return NextResponse.json({ success: false, error: 'At least one barcode is required' }, { status: 400 });
        }

        const todayDate = scanDate || new Date().toISOString().split('T')[0];
        const operator = scannedBy || 'System Operator';

        const newItems: UnknownParcelItem[] = barcodeList.map((code, idx) => ({
            id: `UNK-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            created_at: new Date().toISOString(),
            scan_date: todayDate,
            barcode: code.trim(),
            scanned_by: operator,
            bag_number: bagNumber || undefined,
            mawb_reference: mawbReference || undefined,
            scan_source: scanSource || 'UNKNOWN_SCAN_TAB',
            status: 'PENDING',
            is_email_sent: false,
            email_sent_at: null,
            email_sent_to: null,
            notes: notes || ''
        }));

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && key) {
            try {
                const headers = {
                    apikey: key,
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                };

                const res = await fetch(`${supabaseUrl}/rest/v1/unknown_parcels`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(newItems.map(item => ({
                        barcode: item.barcode,
                        scan_date: item.scan_date,
                        scanned_by: item.scanned_by,
                        bag_number: item.bag_number || null,
                        mawb_reference: item.mawb_reference || null,
                        scan_source: item.scan_source,
                        status: item.status,
                        is_email_sent: item.is_email_sent,
                        notes: item.notes || null
                    })))
                });

                if (res.ok) {
                    const inserted = await res.json();
                    loadLocalData();
                    localStore.unshift(...newItems);
                    saveLocalData();
                    return NextResponse.json({ success: true, count: inserted.length, items: inserted });
                }
            } catch (err) {
                console.warn('Supabase insert failed, falling back to local store:', err);
            }
        }

        // Local storage fallback
        loadLocalData();
        // Prepend and avoid duplicate active entries on the same date within a minute
        for (const item of newItems) {
            const exists = localStore.some(
                stored => stored.barcode.toLowerCase() === item.barcode.toLowerCase() && stored.scan_date === item.scan_date
            );
            if (!exists) {
                localStore.unshift(item);
            }
        }
        saveLocalData();

        return NextResponse.json({ success: true, count: newItems.length, items: newItems });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Failed to save unknown parcel' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const ids = searchParams.get('ids'); // comma separated
        const date = searchParams.get('date');

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && key) {
            const headers = {
                apikey: key,
                Authorization: `Bearer ${key}`
            };

            let deleteUrl = `${supabaseUrl}/rest/v1/unknown_parcels`;
            if (id) {
                deleteUrl += `?id=eq.${id}`;
            } else if (ids) {
                deleteUrl += `?id=in.(${ids})`;
            } else if (date) {
                deleteUrl += `?scan_date=eq.${date}`;
            }

            if (id || ids || date) {
                await fetch(deleteUrl, { method: 'DELETE', headers });
            }
        }

        loadLocalData();
        if (id) {
            localStore = localStore.filter(item => String(item.id) !== String(id));
        } else if (ids) {
            const idSet = new Set(ids.split(','));
            localStore = localStore.filter(item => !idSet.has(String(item.id)));
        } else if (date) {
            localStore = localStore.filter(item => item.scan_date !== date);
        }
        saveLocalData();

        return NextResponse.json({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
