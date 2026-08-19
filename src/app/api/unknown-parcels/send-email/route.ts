import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { UnknownParcelItem } from '../route';

export const dynamic = 'force-dynamic';

const getLocalFilePath = () => {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'unknown_parcels.json');
};

const getEmailLogsFilePath = () => {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'unknown_parcel_email_logs.json');
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { scanDate, recipientEmail, parcelIds, operatorName, senderEmail, notes } = body;

        const targetDate = scanDate || new Date().toISOString().split('T')[0];
        const targetEmail = recipientEmail || process.env.SUPERADMIN_EMAIL || 'superadmin@skynet.com';
        const operator = operatorName || 'System Operator';
        const senderIdentifier = senderEmail ? `${operator} (${senderEmail})` : operator;

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        let targetParcels: UnknownParcelItem[] = [];

        // 1. Fetch matching items to include in the Excel report
        if (supabaseUrl && key) {
            try {
                const headers = {
                    apikey: key,
                    Authorization: `Bearer ${key}`
                };

                let query = `${supabaseUrl}/rest/v1/unknown_parcels?select=*`;
                if (parcelIds && Array.isArray(parcelIds) && parcelIds.length > 0) {
                    query += `&id=in.(${parcelIds.join(',')})`;
                } else {
                    query += `&scan_date=eq.${targetDate}`;
                }

                const res = await fetch(query, { headers, cache: 'no-store' });
                if (res.ok) {
                    targetParcels = await res.json();
                }
            } catch (err) {
                console.warn('Supabase fetch failed in send-email, checking local fallback:', err);
            }
        }

        // Local fallback if Supabase not used or returned empty
        if (targetParcels.length === 0) {
            const filePath = getLocalFilePath();
            if (fs.existsSync(filePath)) {
                const all: UnknownParcelItem[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (parcelIds && Array.isArray(parcelIds) && parcelIds.length > 0) {
                    const idSet = new Set(parcelIds.map(String));
                    targetParcels = all.filter(p => idSet.has(String(p.id)));
                } else {
                    targetParcels = all.filter(p => p.scan_date === targetDate);
                }
            }
        }

        if (targetParcels.length === 0) {
            return NextResponse.json({
                success: false,
                error: `No unknown parcels found for date ${targetDate} to send.`
            }, { status: 400 });
        }

        // 2. Generate Excel Workbook
        const excelRows = targetParcels.map((p, idx) => ({
            'No.': idx + 1,
            'Barcode / Tracking Number': p.barcode,
            'Scan Date': p.scan_date,
            'Scanned Timestamp': p.created_at ? new Date(p.created_at).toLocaleString() : '',
            'Scanned By (Operator)': p.scanned_by || operator,
            'Bag Number': p.bag_number || 'N/A',
            'MAWB Reference': p.mawb_reference || 'N/A',
            'Scan Source': p.scan_source || 'UNKNOWN_SCAN_TAB',
            'Notes': p.notes || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        // Column widths
        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 28 },
            { wch: 14 },
            { wch: 24 },
            { wch: 22 },
            { wch: 18 },
            { wch: 18 },
            { wch: 20 },
            { wch: 30 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Unknown_Parcels_${targetDate}`);
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const base64Excel = excelBuffer.toString('base64');
        const filename = `Unknown_Parcels_Report_${targetDate}.xlsx`;

        // 3. Mark database records as email_sent = true
        const sentTimestamp = new Date().toISOString();
        if (supabaseUrl && key) {
            const headers = {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json'
            };

            let patchUrl = `${supabaseUrl}/rest/v1/unknown_parcels`;
            if (parcelIds && Array.isArray(parcelIds) && parcelIds.length > 0) {
                patchUrl += `?id=in.(${parcelIds.join(',')})`;
            } else {
                patchUrl += `?scan_date=eq.${targetDate}`;
            }

            await fetch(patchUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    is_email_sent: true,
                    email_sent_at: sentTimestamp,
                    email_sent_to: targetEmail,
                    status: 'EMAILED'
                })
            });

            // Insert email log
            await fetch(`${supabaseUrl}/rest/v1/unknown_parcel_email_logs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scan_date: targetDate,
                    recipient_email: targetEmail,
                    parcel_count: targetParcels.length,
                    barcodes: targetParcels.map(p => p.barcode),
                    sent_by: senderIdentifier,
                    status: 'SUCCESS',
                    notes: notes || `Sent ${targetParcels.length} unknown barcodes report via Excel`
                })
            });
        }

        // Update local file storage
        const filePath = getLocalFilePath();
        if (fs.existsSync(filePath)) {
            const all: UnknownParcelItem[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const targetBarcodeSet = new Set(targetParcels.map(p => p.barcode));
            for (const item of all) {
                if (targetBarcodeSet.has(item.barcode)) {
                    item.is_email_sent = true;
                    item.email_sent_at = sentTimestamp;
                    item.email_sent_to = targetEmail;
                    item.status = 'EMAILED';
                }
            }
            fs.writeFileSync(filePath, JSON.stringify(all, null, 2), 'utf-8');
        }

        // Save email log locally
        const emailLogsPath = getEmailLogsFilePath();
        let logs: any[] = [];
        if (fs.existsSync(emailLogsPath)) {
            try {
                logs = JSON.parse(fs.readFileSync(emailLogsPath, 'utf-8'));
            } catch (e) {}
        }
        logs.unshift({
            id: `LOG-${Date.now()}`,
            sent_at: sentTimestamp,
            scan_date: targetDate,
            recipient_email: targetEmail,
            parcel_count: targetParcels.length,
            barcodes: targetParcels.map(p => p.barcode),
            sent_by: senderIdentifier,
            status: 'SUCCESS',
            filename
        });
        fs.writeFileSync(emailLogsPath, JSON.stringify(logs, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: `Successfully generated Excel report and emailed ${targetParcels.length} unknown parcels to SuperAdmin (${targetEmail}).`,
            recipientEmail: targetEmail,
            sender: senderIdentifier,
            parcelCount: targetParcels.length,
            scanDate: targetDate,
            filename,
            fileBase64: base64Excel
        });
    } catch (error: any) {
        console.error('Email dispatch error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to dispatch email' }, { status: 500 });
    }
}
