'use client';

import React, { useState, useEffect } from 'react';

interface Step {
    stepNumber: number;
    title: string;
    subtitle: string;
    status: string;
    date: string;
    time: string;
    location: string;
    activity: string;
    notes: string;
    enteredBy: string;
}

interface TrackingData {
    connoteNo: string;
    serviceType: string;
    destination: string;
    status: string;
    deliveredOn: string;
    signedBy: string;
    steps: Step[];
    trackingHistory: any[];
    manifestInfo: any[];
    senderInfo: any;
    receiverInfo: any;
    shipmentInfo: any;
}

export default function TrackingTab() {
    const [searchQuery, setSearchQuery] = useState('');
    const [lastScanned, setLastScanned] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TrackingData | null>(null);
    const [notFoundError, setNotFoundError] = useState<string | null>(null);
    const [timeFormat, setTimeFormat] = useState<'12H' | '24H'>('12H');
    const [timezone, setTimezone] = useState('Asia/Colombo');
    const [activeSectionTab, setActiveSectionTab] = useState<'all' | 'details' | 'manifest' | 'shipment'>('all');
    const trackingInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const queryUrl = params.get('q') || params.get('tracking');
            const savedQuery = sessionStorage.getItem('last_tracked_barcode');
            const barcodeToSearch = queryUrl || savedQuery;

            if (barcodeToSearch && barcodeToSearch.trim()) {
                const q = barcodeToSearch.trim();
                setSearchQuery(q);
                setLastScanned(q);
                fetchTracking(q);
            }
        }
    }, []);

    const fetchTracking = async (queryToSearch: string) => {
        if (!queryToSearch.trim()) return;
        const q = queryToSearch.trim();
        setLoading(true);
        setNotFoundError(null);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('last_tracked_barcode', q);
        }
        try {
            const res = await fetch(`/api/tracking?q=${encodeURIComponent(q)}&_t=${Date.now()}`);
            const result = await res.json();
            if (result.success) {
                setData(result);
                setActiveQuery(q);
            } else if (result.notFound) {
                setData(null);
                setActiveQuery(q);
                setNotFoundError(result.error || `No parcel found matching barcode "${q}" in Supabase database.`);
            } else {
                setData(null);
                setNotFoundError(result.error || 'Failed to fetch tracking data.');
            }
        } catch (e: any) {
            console.error("Tracking fetch error:", e);
            setData(null);
            setNotFoundError('Network error while querying database.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;
        setLastScanned(query);
        fetchTracking(query);
        setTimeout(() => {
            trackingInputRef.current?.select();
        }, 50);
    };

    const handleQuickSample = (barcode: string) => {
        setSearchQuery(barcode);
        setLastScanned(barcode);
        fetchTracking(barcode);
    };

    // Calculate completed step count (1 to 6)
    const currentStepIndex = data?.steps ? data.steps.filter(s => s.status === 'COMPLETED').length : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>

            {/* Search Header Card (Real Database Querying) */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: '13px', color: '#4b5563', marginTop: 0, marginBottom: '12px' }}>
                    Enter reference number or parcel barcode to track.
                </p>

                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        ref={trackingInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (lastScanned && val.startsWith(lastScanned) && val.length > lastScanned.length) {
                                setSearchQuery(val.slice(lastScanned.length));
                                setLastScanned('');
                            } else {
                                setSearchQuery(val);
                            }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="Enter parcel barcode or tracking number..."
                        className="scan-input-blink"
                        style={{
                            flex: 1,
                            minWidth: '280px',
                            padding: '10px 14px',
                            fontSize: '14px',
                            border: '2px solid #e21b22',
                            borderRadius: '6px',
                            outline: 'none',
                            fontWeight: '600',
                            color: '#111827'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '10px 22px',
                            backgroundColor: '#e21b22',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(226, 27, 34, 0.2)'
                        }}
                    >
                        {loading ? 'Searching ...' : 'Search Parcel'}
                    </button>
                    <button
                        type="button"
                        onClick={() => searchQuery.trim() && fetchTracking(searchQuery.trim())}
                        disabled={loading || !searchQuery.trim()}
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#ffffff',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: loading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: loading || !searchQuery.trim() ? 0.6 : 1
                        }}
                    >
                        Refresh
                    </button>
                </form>
            </div>

            {/* Error / Not Found Alert Card */}
            {notFoundError && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '16px 20px', borderRadius: '10px', color: '#991b1b', fontSize: '14px', fontWeight: '500' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Parcel Not Found in Database
                    </div>
                    <div>{notFoundError}</div>
                </div>
            )}

            {data && (
                <>
                    {/* Summary Bar */}
                    <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                                Parcel Connote: <span style={{ color: '#e21b22' }}>{data.connoteNo}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Time zone:</span>
                                    <select
                                        value={timezone}
                                        onChange={(e) => setTimezone(e.target.value)}
                                        style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }}
                                    >
                                        <option value="Asia/Colombo">Asia/Colombo (GMT+5:30)</option>
                                        <option value="UTC">UTC (GMT+0)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Time format:</span>
                                    <button
                                        onClick={() => setTimeFormat('12H')}
                                        style={{ padding: '2px 6px', fontSize: '11px', fontWeight: '700', borderRadius: '3px', border: '1px solid #d1d5db', backgroundColor: timeFormat === '12H' ? '#e21b22' : '#ffffff', color: timeFormat === '12H' ? '#ffffff' : '#374151', cursor: 'pointer' }}
                                    >
                                        12H
                                    </button>
                                    <button
                                        onClick={() => setTimeFormat('24H')}
                                        style={{ padding: '2px 6px', fontSize: '11px', fontWeight: '700', borderRadius: '3px', border: '1px solid #d1d5db', backgroundColor: timeFormat === '24H' ? '#e21b22' : '#ffffff', color: timeFormat === '24H' ? '#ffffff' : '#374151', cursor: 'pointer' }}
                                    >
                                        24H
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Top Key Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px' }}>
                            <div>
                                <span style={{ fontWeight: '700', color: '#374151' }}>Connote # : </span>
                                <span style={{ fontWeight: '700', color: '#e21b22' }}>{data.connoteNo}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: '700', color: '#374151' }}>Service Type : </span>
                                <span style={{ color: '#111827' }}>{data.serviceType}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: '700', color: '#374151' }}>Destination : </span>
                                <span style={{ color: '#111827' }}>{data.destination}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: '700', color: '#374151' }}>Status : </span>
                                <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    backgroundColor: data.status === 'Dispatched' ? '#dcfce7' : '#fef3c7',
                                    color: data.status === 'Dispatched' ? '#15803d' : '#b45309'
                                }}>
                                    ● {data.status}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Latest Status Timestamp : <strong>{data.deliveredOn}</strong></span>
                            <span style={{ color: '#4b5563', fontWeight: '500' }}>| Assigned Staff/Partner : <strong>{data.signedBy}</strong></span>
                        </div>
                    </div>

                    {/* 6 MAIN STEPS STEPPER FLOW */}
                    <div style={{ backgroundColor: '#ffffff', padding: '24px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#e21b22', display: 'inline-block' }}></span> */}
                                {/* 6 Main Operations Steps (Supabase Tracking) */}
                            </h2>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
                                Progress: {currentStepIndex} of 6 Steps Completed
                            </span>
                        </div>

                        {/* Numbered Stepper Nodes */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: '12px',
                            position: 'relative',
                            paddingTop: '10px'
                        }}>
                            {data.steps.map((step, idx) => {
                                const isCompleted = step.status === 'COMPLETED';
                                const isCurrent = idx + 1 === currentStepIndex;

                                return (
                                    <div
                                        key={step.stepNumber}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            position: 'relative',
                                            zIndex: 1
                                        }}
                                    >
                                        {/* Connector line */}
                                        {idx < 5 && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '24px',
                                                    left: '50%',
                                                    width: '100%',
                                                    height: '4px',
                                                    backgroundColor: isCompleted ? '#c00000' : '#e5e7eb',
                                                    zIndex: -1
                                                }}
                                            />
                                        )}

                                        {/* Circular Badge */}
                                        <div
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                backgroundColor: isCompleted ? '#c00000' : isCurrent ? '#e21b22' : '#f3f4f6',
                                                color: isCompleted || isCurrent ? '#ffffff' : '#6b7280',
                                                border: isCurrent ? '3px solid #fee2e2' : isCompleted ? 'none' : '2px solid #e5e7eb',
                                                fontWeight: '700',
                                                fontSize: '18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginBottom: '10px',
                                                boxShadow: isCompleted ? '0 2px 6px rgba(192, 0, 0, 0.3)' : 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {isCompleted ? (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                step.stepNumber
                                            )}
                                        </div>

                                        {/* Step Title & Subtitle */}
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: isCompleted || isCurrent ? '#111827' : '#6b7280', marginBottom: '2px', lineHeight: '1.2' }}>
                                            {step.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                                            {step.subtitle}
                                        </div>

                                        {/* Step Timestamp Pill */}
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                fontWeight: '600',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: isCompleted ? '#fee2e2' : '#f3f4f6',
                                                color: isCompleted ? '#c00000' : '#9ca3af'
                                            }}
                                        >
                                            {step.date !== '-' ? `${step.date} ${step.time}` : 'Pending'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section Navigation Sub-Tabs */}
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', paddingBottom: '2px' }}>
                        {[
                            { id: 'all', label: 'All Tracking Views' },
                            { id: 'details', label: 'Tracking Details Activity' },
                            { id: 'manifest', label: 'Manifest Information' },
                            { id: 'shipment', label: 'Sender, Receiver & Shipment Info' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveSectionTab(t.id as any)}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: activeSectionTab === t.id ? '700' : '500',
                                    color: activeSectionTab === t.id ? '#e21b22' : '#4b5563',
                                    borderBottom: activeSectionTab === t.id ? '3px solid #e21b22' : '3px solid transparent',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* TRACKING DETAILS ACTIVITY HISTORY TABLE (CONTAINS ONLY OUR 6 STEPS) */}
                    {(activeSectionTab === 'all' || activeSectionTab === 'details') && (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ backgroundColor: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '700', fontSize: '14px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e21b22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                                Tracking Details
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: '700', borderBottom: '1px solid #d1d5db' }}>
                                            <th style={{ padding: '10px 12px' }}>Date</th>
                                            <th style={{ padding: '10px 12px' }}>Time</th>
                                            <th style={{ padding: '10px 12px' }}>Location/Supplied via</th>
                                            <th style={{ padding: '10px 12px' }}>Activity (6 Steps)</th>
                                            <th style={{ padding: '10px 12px' }}>Notes</th>
                                            <th style={{ padding: '10px 12px' }}>Entered by</th>
                                            <th style={{ padding: '10px 12px' }}>Received (UTC)</th>
                                            <th style={{ padding: '10px 12px' }}>Sent (UTC)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.trackingHistory.length > 0 ? (
                                            data.trackingHistory.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: '600' }}>{row.date}</td>
                                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{row.time}</td>
                                                    <td style={{ padding: '10px 12px' }}>{row.location}</td>
                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#e21b22' }}>
                                                        {row.activity}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', color: '#4b5563' }}>{row.notes}</td>
                                                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{row.enteredBy}</td>
                                                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{row.receivedUTC}</td>
                                                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{row.sentUTC}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                                                    No activity logs recorded yet for this parcel.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* MANIFEST INFORMATION TABLE */}
                    {(activeSectionTab === 'all' || activeSectionTab === 'manifest') && (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ backgroundColor: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '700', fontSize: '14px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e21b22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                Manifest Information
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: '700', borderBottom: '1px solid #d1d5db' }}>
                                            <th style={{ padding: '10px 12px' }}>Date</th>
                                            <th style={{ padding: '10px 12px' }}>Docket No</th>
                                            <th style={{ padding: '10px 12px' }}>Sender No</th>
                                            <th style={{ padding: '10px 12px' }}>Receiver</th>
                                            <th style={{ padding: '10px 12px' }}>From</th>
                                            <th style={{ padding: '10px 12px' }}>To</th>
                                            <th style={{ padding: '10px 12px' }}>Flight</th>
                                            <th style={{ padding: '10px 12px' }}>Carrier</th>
                                            <th style={{ padding: '10px 12px' }}>Type</th>
                                            <th style={{ padding: '10px 12px' }}># of Cons</th>
                                            <th style={{ padding: '10px 12px' }}>Status</th>
                                            <th style={{ padding: '10px 12px' }}>Received (UTC)</th>
                                            <th style={{ padding: '10px 12px' }}>Sent (UTC)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.manifestInfo.map((m, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: '600' }}>{m.date}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#e21b22' }}>{m.docketNo}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.senderNo}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.receiver}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.from}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.to}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>{m.flight}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.carrier}</td>
                                                <td style={{ padding: '10px 12px' }}>{m.type}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '700' }}>{m.cons}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e5e7eb', fontSize: '11px', fontWeight: '600' }}>{m.status}</span>
                                                </td>
                                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{m.receivedUTC}</td>
                                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{m.sentUTC}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SENDER & RECEIVER CARDS */}
                    {(activeSectionTab === 'all' || activeSectionTab === 'shipment') && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                            {/* Sender Info */}
                            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '12px', fontWeight: '700', fontSize: '13px', color: '#e21b22', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {/* <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg> */}
                                    Sender Information
                                </div>
                                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#374151' }}>
                                    <div><strong>Name:</strong> {data.senderInfo.name}</div>
                                    <div><strong>Address:</strong> {data.senderInfo.address}</div>
                                    <div><strong>Phone:</strong> {data.senderInfo.phone}</div>
                                    <div><strong>Sender Reference:</strong> <span style={{ color: '#111827', fontWeight: '600' }}>{data.senderInfo.senderReference}</span></div>
                                </div>
                            </div>

                            {/* Receiver Info */}
                            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '12px', fontWeight: '700', fontSize: '13px', color: '#e21b22', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {/* <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg> */}
                                    Receiver Information
                                </div>
                                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#374151' }}>
                                    <div><strong>Name:</strong> {data.receiverInfo.name}</div>
                                    <div><strong>Address:</strong> {data.receiverInfo.address}</div>
                                    <div><strong>Phone/Contact:</strong> {data.receiverInfo.phone}</div>
                                    <div><strong>Email:</strong> <span style={{ color: '#0284c7' }}>{data.receiverInfo.email}</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SHIPMENT SPECIFICATIONS GRID */}
                    {(activeSectionTab === 'all' || activeSectionTab === 'shipment') && (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '16px', fontWeight: '700', fontSize: '14px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e21b22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                </svg>
                                Shipment Information & Item Specifications
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12px' }}>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Type:</span> <strong>{data.shipmentInfo.type}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px', gridColumn: 'span 2' }}>
                                    <span style={{ color: '#6b7280' }}>Good Desc.:</span> <strong>{data.shipmentInfo.goodsDesc}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>No. of Items:</span> <strong>{data.shipmentInfo.itemsCount}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Weight:</span> <strong>{data.shipmentInfo.weight}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Dead Weight:</span> <strong>{data.shipmentInfo.deadWeight}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Declared Weight:</span> <strong>{data.shipmentInfo.cubicWeight}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>COD Amount:</span> <strong>{data.shipmentInfo.codAmount}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Customs Value:</span> <strong>{data.shipmentInfo.customsValue}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Location:</span> <strong>{data.shipmentInfo.location}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>LMD Bag No:</span> <strong style={{ color: '#e21b22' }}>{data.shipmentInfo.bagNo}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Service Provider:</span> <strong style={{ color: '#0284c7' }}>{data.shipmentInfo.partner}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Clearance Ref:</span> <strong>{data.shipmentInfo.clearanceRef}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Created By:</span> <strong>{data.shipmentInfo.createdBy}</strong>
                                </div>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                    <span style={{ color: '#6b7280' }}>Incoterms:</span> <strong>{data.shipmentInfo.incoterms}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
