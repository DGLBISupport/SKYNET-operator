import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// In-memory fallback storage if Supabase table is not configured
let localUntrackedStore: Array<{
    id: string;
    tracking_number: string;
    scan_mode: 'BAG' | 'UNBAGGED' | 'UNNUMBERED_BAG';
    bag_number?: string;
    mawb_ref?: string;
    operator_name?: string;
    operator_email?: string;
    created_at: string;
    notes?: string;
}> = [];

// Persistent JSON file fallback path in temp data directory
const getLocalFilePath = () => {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'untracked_parcels.json');
};

const loadLocalData = () => {
    try {
        const filePath = getLocalFilePath();
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            localUntrackedStore = JSON.parse(content);
        }
    } catch (e) {
        console.warn('Failed to load local untracked store:', e);
    }
};

const saveLocalData = () => {
    try {
        const filePath = getLocalFilePath();
        fs.writeFileSync(filePath, JSON.stringify(localUntrackedStore, null, 2), 'utf-8');
    } catch (e) {
        console.warn('Failed to save local untracked store:', e);
    }
};

loadLocalData();

export async function GET() {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && key) {
            const headers = {
                apikey: key,
                Authorization: `Bearer ${key}`
            };

            const res = await fetch(`${supabaseUrl}/rest/v1/untracked_parcels?select=*&order=created_at.desc`, { headers, cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                return NextResponse.json({ success: true, untrackedParcels: data });
            }
        }

        // Fallback to local store if Supabase fetch failed or table doesn't exist
        loadLocalData();
        return NextResponse.json({ success: true, untrackedParcels: localUntrackedStore });
    } catch (error: any) {
        return NextResponse.json({ success: true, untrackedParcels: localUntrackedStore });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { trackingNumber, scanMode, bagNumber, mawbRef, operatorName, operatorEmail, notes } = body;

        if (!trackingNumber) {
            return NextResponse.json({ success: false, error: 'Tracking number is required' }, { status: 400 });
        }

        const newItem = {
            id: `UTP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            tracking_number: trackingNumber.trim(),
            scan_mode: scanMode || 'BAG',
            bag_number: bagNumber || 'N/A',
            mawb_ref: mawbRef || 'N/A',
            operator_name: operatorName || 'Unknown Operator',
            operator_email: operatorEmail || '',
            created_at: new Date().toISOString(),
            notes: notes || ''
        };

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && key) {
            const headers = {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            const res = await fetch(`${supabaseUrl}/rest/v1/untracked_parcels`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newItem)
            });

            if (res.ok) {
                const inserted = await res.json();
                loadLocalData();
                localUntrackedStore.unshift(newItem);
                saveLocalData();
                return NextResponse.json({ success: true, item: inserted[0] });
            }
        }

        // Save locally
        loadLocalData();
        // Prevent exact duplicate active untracked parcel insertions within 1 minute
        const isDup = localUntrackedStore.some(item =>
            item.tracking_number.toLowerCase() === newItem.tracking_number.toLowerCase() &&
            (Date.now() - new Date(item.created_at).getTime()) < 60000
        );

        if (!isDup) {
            localUntrackedStore.unshift(newItem);
            saveLocalData();
        }

        return NextResponse.json({ success: true, item: newItem });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            localUntrackedStore = localUntrackedStore.filter(item => item.id !== id);
        } else {
            localUntrackedStore = [];
        }
        saveLocalData();
        return NextResponse.json({ success: true, message: 'Untracked records cleared' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
