'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import PaginationControl from '@/app/components/PaginationControl';

export interface UnknownParcel {
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

export default function UnknownParcelsTab({
    card,
    label,
    inputStyle,
    btnPrimary,
    btnSecondary,
    btnDanger,
    user,
    currentUser,
    operator
}: any) {
    // Resolve active logged-in user / operator
    const [localUser, setLocalUser] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('skynet_user');
                if (stored) {
                    setLocalUser(JSON.parse(stored));
                }
            } catch (e) { }
        }
    }, []);

    const activeUser = currentUser || user || localUser;
    const activeOperatorName = activeUser
        ? (`${activeUser.firstName || ''} ${activeUser.lastName || ''}`.trim() || activeUser.name || activeUser.username || activeUser.email || operator || 'Operator')
        : (operator || 'Operator');
    const activeOperatorEmail = activeUser?.email || '';

    const todayStr = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);
    const [filterAllDates, setFilterAllDates] = useState<boolean>(false);
    const [parcels, setParcels] = useState<UnknownParcel[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Scanner state
    const [barcodeInput, setBarcodeInput] = useState<string>('');
    const [mawbInput, setMawbInput] = useState<string>('');
    const [bagInput, setBagInput] = useState<string>('');
    const [notesInput, setNotesInput] = useState<string>('');
    const [batchMode, setBatchMode] = useState<boolean>(false);
    const [batchText, setBatchText] = useState<string>('');
    const [submittingScan, setSubmittingScan] = useState<boolean>(false);
    const [recentScannedBarcode, setRecentScannedBarcode] = useState<string | null>(null);

    // Selected items for bulk operations
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // Delete Confirmation Modal state
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        id?: string | number;
        barcode?: string;
        isBulk?: boolean;
        count?: number;
    }>({ isOpen: false });
    const [deleting, setDeleting] = useState<boolean>(false);

    // Email Modal state
    const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
    const [recipientEmail, setRecipientEmail] = useState<string>('superadmin@skynet.com');
    const [emailNotes, setEmailNotes] = useState<string>('');
    const [sendingEmail, setSendingEmail] = useState<boolean>(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(15);

    const barcodeInputRef = useRef<HTMLInputElement | null>(null);

    // Fallback styles if not provided via props
    const defaultCard: React.CSSProperties = card || {
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    };

    const defaultLabel: React.CSSProperties = label || {
        color: '#dc2626',
        fontSize: '13px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        marginBottom: '14px'
    };

    const defaultInputStyle: React.CSSProperties = inputStyle || {
        backgroundColor: '#f9fafb',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '9px 12px',
        color: '#111827',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
    };

    const defaultBtnPrimary: React.CSSProperties = btnPrimary || {
        backgroundColor: '#e21b22',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    const defaultBtnSecondary: React.CSSProperties = btnSecondary || {
        backgroundColor: '#ffffff',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    const defaultBtnDanger: React.CSSProperties = btnDanger || {
        backgroundColor: '#ffffff',
        color: '#dc2626',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    // Play quick sound for scan feedback
    const playBeep = (isSuccess = true) => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = isSuccess ? 'sine' : 'sawtooth';
            osc.frequency.setValueAtTime(isSuccess ? 880 : 300, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.25));
        } catch (e) {
            // Ignore audio context failures
        }
    };

    // Fetch unknown parcels from API
    const fetchParcels = async () => {
        setLoading(true);
        try {
            const url = filterAllDates
                ? '/api/unknown-parcels'
                : `/api/unknown-parcels?date=${selectedDate}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setParcels(data.parcels || []);
            } else {
                toast.error(data.error || 'Failed to fetch unknown parcels');
            }
        } catch (err: any) {
            console.error('Error fetching unknown parcels:', err);
            toast.error('Network error loading unknown parcels');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParcels();
    }, [selectedDate, filterAllDates]);

    // Focus barcode input on mount and tab activations
    useEffect(() => {
        if (!emailModalOpen && !batchMode) {
            barcodeInputRef.current?.focus();
        }
    }, [emailModalOpen, batchMode]);

    // Handle single barcode submission
    const handleScanSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = barcodeInput.trim();
        if (!code) return;

        setSubmittingScan(true);
        try {
            const operatorName = activeOperatorName;
            const res = await fetch('/api/unknown-parcels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: code,
                    scanDate: selectedDate,
                    scannedBy: operatorName,
                    bagNumber: bagInput.trim() || undefined,
                    mawbReference: mawbInput.trim() || undefined,
                    notes: notesInput.trim() || undefined,
                    scanSource: 'UNKNOWN_SCAN_TAB'
                })
            });

            const data = await res.json();
            if (data.success) {
                playBeep(true);
                toast.success(`Unknown barcode recorded: ${code}`);
                setRecentScannedBarcode(code);
                setBarcodeInput('');
                fetchParcels();
            } else {
                playBeep(false);
                toast.error(data.error || 'Failed to record unknown parcel');
            }
        } catch (err: any) {
            playBeep(false);
            toast.error('Error saving scanned barcode');
        } finally {
            setSubmittingScan(false);
            setTimeout(() => barcodeInputRef.current?.focus(), 50);
        }
    };

    // Handle batch barcodes submission
    const handleBatchSubmit = async () => {
        const rawCodes = batchText
            .split(/[\n,;\t]+/)
            .map(c => c.trim())
            .filter(c => c.length > 0);

        if (rawCodes.length === 0) {
            toast.error('Please enter or paste at least one barcode');
            return;
        }

        setSubmittingScan(true);
        try {
            const operatorName = activeOperatorName;
            const res = await fetch('/api/unknown-parcels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcodes: rawCodes,
                    scanDate: selectedDate,
                    scannedBy: operatorName,
                    bagNumber: bagInput.trim() || undefined,
                    mawbReference: mawbInput.trim() || undefined,
                    notes: notesInput.trim() || undefined,
                    scanSource: 'BATCH_PASTE'
                })
            });

            const data = await res.json();
            if (data.success) {
                playBeep(true);
                toast.success(`Successfully saved ${rawCodes.length} unknown barcodes`);
                setBatchText('');
                setBatchMode(false);
                fetchParcels();
            } else {
                playBeep(false);
                toast.error(data.error || 'Batch import failed');
            }
        } catch (err: any) {
            playBeep(false);
            toast.error('Error submitting batch barcodes');
        } finally {
            setSubmittingScan(false);
        }
    };

    // Confirm deletion of single or selected records
    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            const url = deleteModal.id
                ? `/api/unknown-parcels?id=${deleteModal.id}`
                : `/api/unknown-parcels?ids=${Array.from(selectedIds).join(',')}`;
            const res = await fetch(url, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast.success('Record(s) deleted successfully');
                setSelectedIds(new Set());
                setDeleteModal({ isOpen: false });
                fetchParcels();
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (e) {
            toast.error('Error deleting record');
        } finally {
            setDeleting(false);
        }
    };

    // Client-side Excel Export
    const handleExportExcel = () => {
        const listToExport = selectedIds.size > 0
            ? parcels.filter(p => selectedIds.has(p.id))
            : parcels;

        if (listToExport.length === 0) {
            toast.error('No parcels available to export');
            return;
        }

        const excelRows = listToExport.map((p, idx) => ({
            'No.': idx + 1,
            'Barcode / Tracking Number': p.barcode,
            'Scan Date': p.scan_date,
            'Scanned Timestamp': p.created_at ? new Date(p.created_at).toLocaleString() : '',
            'Scanned By': p.scanned_by,
            'Bag Number': p.bag_number || 'N/A',
            'MAWB Ref': p.mawb_reference || 'N/A',
            'Scan Source': p.scan_source || 'UNKNOWN_SCAN_TAB',
            'Status': p.is_email_sent ? 'EMAILED' : 'PENDING',
            'Email Sent At': p.email_sent_at ? new Date(p.email_sent_at).toLocaleString() : 'N/A',
            'Notes': p.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        ws['!cols'] = [
            { wch: 6 },
            { wch: 28 },
            { wch: 14 },
            { wch: 24 },
            { wch: 20 },
            { wch: 16 },
            { wch: 16 },
            { wch: 20 },
            { wch: 14 },
            { wch: 22 },
            { wch: 30 }
        ];

        const wb = XLSX.utils.book_new();
        const dateTag = filterAllDates ? 'All_Dates' : selectedDate;
        XLSX.utils.book_append_sheet(wb, ws, `Unknown_Parcels_${dateTag}`);
        XLSX.writeFile(wb, `Unknown_Parcels_${dateTag}.xlsx`);
        toast.success(`Exported ${listToExport.length} unknown parcels to Excel!`);
    };

    // Send to Superadmin via Email
    const handleSendEmail = async () => {
        if (!recipientEmail || !recipientEmail.includes('@')) {
            toast.error('Please enter a valid recipient email');
            return;
        }

        setSendingEmail(true);
        try {
            const operatorName = activeOperatorName;
            const parcelIdList = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

            const res = await fetch('/api/unknown-parcels/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanDate: filterAllDates ? undefined : selectedDate,
                    recipientEmail: recipientEmail.trim(),
                    parcelIds: parcelIdList,
                    operatorName,
                    senderEmail: activeOperatorEmail,
                    notes: emailNotes.trim() || undefined
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `Email sent successfully to ${recipientEmail}!`);
                setEmailModalOpen(false);
                setEmailNotes('');
                setSelectedIds(new Set());
                fetchParcels();
            } else {
                toast.error(data.error || 'Failed to send email to SuperAdmin');
            }
        } catch (e: any) {
            toast.error('Error dispatching email to SuperAdmin');
        } finally {
            setSendingEmail(false);
        }
    };

    // Filtered and paginated parcels
    const filteredParcels = useMemo(() => {
        if (!searchQuery.trim()) return parcels;
        const q = searchQuery.toLowerCase().trim();
        return parcels.filter(p =>
            p.barcode.toLowerCase().includes(q) ||
            (p.bag_number && p.bag_number.toLowerCase().includes(q)) ||
            (p.mawb_reference && p.mawb_reference.toLowerCase().includes(q)) ||
            (p.scanned_by && p.scanned_by.toLowerCase().includes(q)) ||
            (p.notes && p.notes.toLowerCase().includes(q))
        );
    }, [parcels, searchQuery]);

    const paginatedParcels = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredParcels.slice(start, start + rowsPerPage);
    }, [filteredParcels, currentPage, rowsPerPage]);

    // Toggle row selection
    const toggleSelect = (id: string | number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedParcels.length && paginatedParcels.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedParcels.map(p => p.id)));
        }
    };

    const pendingCount = parcels.filter(p => !p.is_email_sent).length;
    const emailedCount = parcels.filter(p => p.is_email_sent).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', paddingBottom: '30px' }}>
            {/* ═══ UNIFIED DATE CONTROLS & METRICS SUMMARY BOX (RED & WHITE THEME) ═══ */}
            <div style={{ ...defaultCard, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Top Row: Date Controls on Right Side */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                            Daily Overview & Activity
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Select Date:</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setSelectedDate(e.target.value);
                                        setFilterAllDates(false);
                                        setCurrentPage(1);
                                    }
                                }}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#111827',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={fetchParcels}
                            disabled={loading}
                            style={{ ...defaultBtnSecondary, padding: '6px 14px', fontSize: '12px', fontWeight: '600' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l6 5.67" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #f3f4f6' }} />

                {/* Bottom Row: 3 Metric Stats (Small / Compact) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>

                    {/* Metric 1: Total Scanned */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #eef0f3',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '86px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#5f6b7c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Scanned
                            </span>
                            <div style={{ backgroundColor: '#fef2f2', padding: '4px', borderRadius: '6px', color: '#b91c1c', display: 'flex' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', lineHeight: '1' }}>
                                {parcels.length}
                            </div>
                            <div style={{ marginTop: '5px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{
                                    border: '1px solid #fca5a5',
                                    color: '#991b1b',
                                    backgroundColor: '#ffffff',
                                    fontSize: '9.5px',
                                    fontWeight: '600',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    lineHeight: '1.2'
                                }}>
                                    {filterAllDates ? 'All Dates' : selectedDate}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Metric 2: Pending Email */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #eef0f3',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '86px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#5f6b7c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Pending Email
                            </span>
                            <div style={{ backgroundColor: '#fef2f2', padding: '4px', borderRadius: '6px', color: '#b91c1c', display: 'flex' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="16" x="2" y="4" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', lineHeight: '1' }}>
                                {pendingCount}
                            </div>
                            <div style={{ marginTop: '5px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{
                                    border: '1px solid #fca5a5',
                                    color: '#991b1b',
                                    backgroundColor: '#ffffff',
                                    fontSize: '9.5px',
                                    fontWeight: '600',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    lineHeight: '1.2'
                                }}>
                                    Awaiting Dispatch
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Metric 3: Report Sent */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #eef0f3',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '86px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#5f6b7c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Report Sent
                            </span>
                            <div style={{ backgroundColor: '#fef2f2', padding: '4px', borderRadius: '6px', color: '#b91c1c', display: 'flex' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827', lineHeight: '1' }}>
                                {emailedCount}
                            </div>
                            <div style={{ marginTop: '5px', fontSize: '10px', color: '#6b7280' }}>
                                Status: <strong style={{ color: '#111827' }}>Delivered</strong>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* ═══ SCANNER & INPUT WORKSTATION (RED & WHITE THEME) ═══ */}
            <div style={defaultCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={defaultLabel}>
                        Scan Unknown Parcel Barcode
                    </div>
                </div>

                {/* Batch Mode Input */}
                {batchMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                                Paste Barcodes / Tracking Numbers (One per line or comma-separated):
                            </label>
                            <button
                                type="button"
                                onClick={() => setBatchMode(false)}
                                style={{ ...defaultBtnSecondary, padding: '5px 12px', fontSize: '12px' }}
                            >
                                Switch to Single Barcode Gun
                            </button>
                        </div>
                        <textarea
                            value={batchText}
                            onChange={(e) => setBatchText(e.target.value)}
                            placeholder="e.g.&#10;SN9928172635LK&#10;SN9928172636LK&#10;SN9928172637LK"
                            rows={5}
                            style={{
                                ...defaultInputStyle,
                                fontFamily: 'monospace',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setBatchMode(false)}
                                style={defaultBtnSecondary}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBatchSubmit}
                                disabled={submittingScan}
                                style={{ ...defaultBtnPrimary, opacity: submittingScan ? 0.6 : 1 }}
                            >
                                {submittingScan ? 'Saving...' : 'Add All to List'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Single Barcode Scanner Form */
                    <form onSubmit={handleScanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ flex: '1 1 320px', position: 'relative' }}>
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    placeholder="Scan barcode with scanner gun or type reference..."
                                    autoFocus
                                    style={{
                                        ...defaultInputStyle,
                                        padding: '11px 36px 11px 14px',
                                        fontSize: '15px',
                                        fontWeight: '700',
                                        border: '2px solid #e21b22',
                                        backgroundColor: '#ffffff'
                                    }}
                                />
                                {barcodeInput && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBarcodeInput('');
                                            barcodeInputRef.current?.focus();
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: '#e5e7eb',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '20px',
                                            height: '20px',
                                            cursor: 'pointer',
                                            fontWeight: '700',
                                            fontSize: '11px',
                                            color: '#4b5563',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submittingScan || !barcodeInput.trim()}
                                style={{
                                    ...defaultBtnPrimary,
                                    padding: '11px 22px',
                                    fontSize: '14px',
                                    opacity: submittingScan || !barcodeInput.trim() ? 0.6 : 1
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                {submittingScan ? 'Recording...' : 'Record Unknown'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setBatchMode(true)}
                                style={{
                                    ...defaultBtnSecondary,
                                    padding: '11px 18px',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                Paste Multiple Barcodes
                            </button>
                        </div>

                        {/* Optional Meta Tags */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                                    Bag Number (Optional):
                                </label>
                                <input
                                    type="text"
                                    value={bagInput}
                                    onChange={(e) => setBagInput(e.target.value)}
                                    placeholder="e.g. BAG-8821"
                                    style={defaultInputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                                    MAWB Reference (Optional):
                                </label>
                                <input
                                    type="text"
                                    value={mawbInput}
                                    onChange={(e) => setMawbInput(e.target.value)}
                                    placeholder="e.g. 555-8912736"
                                    style={defaultInputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                                    Notes / Observations:
                                </label>
                                <input
                                    type="text"
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                    placeholder="e.g. Unregistered label, missing manifest"
                                    style={defaultInputStyle}
                                />
                            </div>
                        </div>

                        {recentScannedBarcode && (
                            <div style={{
                                padding: '8px 12px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#991b1b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span>
                                    ✓ Last scanned: <strong style={{ color: '#e21b22' }}>{recentScannedBarcode}</strong> recorded for <strong>{selectedDate}</strong>
                                </span>
                                <span style={{ fontSize: '11px', color: '#b91c1c' }}>Ready for next barcode</span>
                            </div>
                        )}
                    </form>
                )}
            </div>

            {/* ═══ DATA TABLE & EXPORT TOOLBAR (RED & WHITE THEME) ═══ */}
            <div style={defaultCard}>
                {/* Header & Controls Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={defaultLabel}>
                            Unknown & Unregistered Parcels Log Table
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-10px' }}>
                            List of all extra unknown parcel barcodes scanned for {filterAllDates ? 'all dates' : selectedDate}
                        </div>
                    </div>

                    {/* Search & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Search Bar matching other tabs */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search Barcode, Bag, MAWB, Operator..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{
                                    backgroundColor: '#f9fafb',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '7px 12px 7px 30px',
                                    fontSize: '12px',
                                    width: '260px',
                                    outline: 'none',
                                    color: '#111827'
                                }}
                            />
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#9ca3af"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>

                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setDeleteModal({
                                    isOpen: true,
                                    isBulk: true,
                                    count: selectedIds.size
                                })}
                                style={defaultBtnDanger}
                            >
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={parcels.length === 0}
                            style={{
                                ...defaultBtnSecondary,
                                opacity: parcels.length === 0 ? 0.6 : 1
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Export Excel (.xlsx)
                        </button>

                        <button
                            type="button"
                            onClick={() => setEmailModalOpen(true)}
                            disabled={parcels.length === 0}
                            style={{
                                ...defaultBtnPrimary,
                                opacity: parcels.length === 0 ? 0.6 : 1
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            Send to SuperAdmin via Email
                        </button>
                    </div>
                </div>

                {/* Table Container */}
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: '700' }}>
                                <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === paginatedParcels.length && paginatedParcels.length > 0}
                                        onChange={toggleSelectAll}
                                        style={{ accentColor: '#e21b22', cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ padding: '10px 12px' }}>#</th>
                                <th style={{ padding: '10px 12px' }}>Barcode / Reference</th>
                                <th style={{ padding: '10px 12px' }}>Scan Date & Time</th>
                                <th style={{ padding: '10px 12px' }}>Operator</th>
                                <th style={{ padding: '10px 12px' }}>Bag / MAWB</th>
                                <th style={{ padding: '10px 12px' }}>Email Status</th>
                                <th style={{ padding: '10px 12px' }}>Notes</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                                        Loading unknown parcel records...
                                    </td>
                                </tr>
                            ) : paginatedParcels.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                No unknown parcels found {filterAllDates ? '' : `for date ${selectedDate}`}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                Scan an extra parcel barcode above to log it date-wise.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedParcels.map((p, idx) => {
                                    const rowNum = (currentPage - 1) * rowsPerPage + idx + 1;
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <tr
                                            key={p.id}
                                            style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                                                transition: 'background-color 0.15s ease'
                                            }}
                                        >
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(p.id)}
                                                    style={{ accentColor: '#e21b22', cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                                                {rowNum}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#111827' }}>
                                                        {p.barcode}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#374151' }}>
                                                <div>{p.scan_date}</div>
                                                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                    {p.created_at ? new Date(p.created_at).toLocaleTimeString() : ''}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#374151', fontWeight: '600' }}>
                                                {p.scanned_by || activeOperatorName}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                                                {p.bag_number ? <div>Bag: <strong>{p.bag_number}</strong></div> : null}
                                                {p.mawb_reference ? <div style={{ fontSize: '11px', color: '#6b7280' }}>MAWB: {p.mawb_reference}</div> : null}
                                                {!p.bag_number && !p.mawb_reference && <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {p.is_email_sent ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '12px',
                                                        color: '#374151' // neutral text color
                                                    }}>
                                                        {/* Green Checkmark Badge */}
                                                        <span style={{
                                                            backgroundColor: '#f0fdf4',
                                                            color: '#15803d',
                                                            border: '1px solid #bbf7d0',
                                                            borderRadius: '4px',
                                                            width: '18px',
                                                            height: '18px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: '700',
                                                            fontSize: '11px'
                                                        }}>
                                                            ✓
                                                        </span>

                                                        {/* Plain Text */}
                                                        <span>Sent to Admin</span>
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        backgroundColor: '#fef2f2',
                                                        color: '#b91c1c',
                                                        border: '1px solid #fecaca',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        fontWeight: '700',
                                                        fontSize: '11px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        Pending Email
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {p.notes || <span style={{ color: '#d1d5db' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteModal({
                                                        isOpen: true,
                                                        id: p.id,
                                                        barcode: p.barcode,
                                                        isBulk: false
                                                    })}
                                                    title="Delete this record"
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        color: '#dc2626',
                                                        border: '1px solid #fca5a5',
                                                        borderRadius: '4px',
                                                        padding: '3px 8px',
                                                        cursor: 'pointer',
                                                        fontWeight: '600',
                                                        fontSize: '11px'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Control matching system */}
                {filteredParcels.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                        <PaginationControl
                            currentPage={currentPage}
                            totalItems={filteredParcels.length}
                            rowsPerPage={rowsPerPage}
                            onPageChange={(p: number) => setCurrentPage(p)}
                            onRowsPerPageChange={(r: number) => {
                                setRowsPerPage(r);
                                setCurrentPage(1);
                            }}
                            rowsPerPageOptions={[10, 15, 25, 50]}
                        />
                    </div>
                )}
            </div>

            {/* ═══ DELETE CONFIRMATION POPUP MODAL (THEME MATCHING) ═══ */}
            {deleteModal.isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(17, 24, 39, 0.65)',
                    backdropFilter: 'blur(3px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '28px 24px',
                        width: '440px',
                        maxWidth: '92%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                        textAlign: 'center'
                    }}>
                        {/* Warning Trash Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
                            {deleteModal.isBulk ? `Delete ${deleteModal.count} Unknown Parcels?` : 'Delete Unknown Parcel Record?'}
                        </h3>

                        {/* Message */}
                        <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            {deleteModal.isBulk ? (
                                <>Are you sure you want to delete <strong style={{ color: '#e21b22' }}>{deleteModal.count} selected records</strong>? This action cannot be undone.</>
                            ) : (
                                <>Are you sure you want to delete unknown parcel <strong style={{ color: '#e21b22' }}>{deleteModal.barcode}</strong>? This action cannot be undone.</>
                            )}
                        </p>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteModal({ isOpen: false })}
                                disabled={deleting}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: deleting ? 0.7 : 1,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ EMAIL DISPATCH POPUP MODAL (SITE THEME MATCHING & SIMPLE) ═══ */}
            {emailModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(17, 24, 39, 0.65)',
                    backdropFilter: 'blur(3px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '28px 24px',
                        width: '450px',
                        maxWidth: '92%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                        textAlign: 'center'
                    }}>
                        {/* Circular Mail Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
                            Send Unknown Parcels to SuperAdmin
                        </h3>

                        {/* Summary Message */}
                        <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5', margin: '0 0 18px 0' }}>
                            Email Excel list of <strong style={{ color: '#e21b22' }}>{selectedIds.size > 0 ? selectedIds.size : parcels.length} unknown barcode{((selectedIds.size > 0 ? selectedIds.size : parcels.length) !== 1) ? 's' : ''}</strong> for <strong>{selectedDate}</strong> directly to the SuperAdmin.
                        </p>

                        {/* Sender Info (Current Logged-in User) */}
                        <div style={{ textAlign: 'left', marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                Sender (Logged-in Operator):
                            </label>
                            <div style={{
                                padding: '8px 12px',
                                backgroundColor: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#111827',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span>👤 {activeOperatorName}</span>
                                {activeOperatorEmail && (
                                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                                        {activeOperatorEmail}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Form Field */}
                        <div style={{ textAlign: 'left', marginBottom: '22px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                Recipient Email:
                            </label>
                            <input
                                type="email"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                placeholder="superadmin@skynet.com"
                                style={{
                                    ...defaultInputStyle,
                                    backgroundColor: '#f9fafb',
                                    fontWeight: '600',
                                    fontSize: '13px'
                                }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setEmailModalOpen(false)}
                                disabled={sendingEmail}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    cursor: sendingEmail ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: sendingEmail ? 0.7 : 1,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {sendingEmail ? 'Sending...' : 'Yes, Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
