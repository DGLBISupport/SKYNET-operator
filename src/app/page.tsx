'use client';

import { useState, useRef, useEffect } from 'react';
import { AllocationResponse } from '@/types';

export default function WorkstationDashboard() {
    const [barcodeInput, setBarcodeInput] = useState('');
    const [currentScan, setCurrentScan] = useState<AllocationResponse | null>(null);
    const [history, setHistory] = useState<AllocationResponse[]>([]);
    const [status, setStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [errorMessage, setErrorMessage] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep focus locked to the barcode text field to catch rapid continuous hardware scanning
    useEffect(() => {
        inputRef.current?.focus();
    }, [status]);

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanBarcode = barcodeInput.trim();
        if (!cleanBarcode) return;

        setStatus('FETCHING');
        setBarcodeInput('');

        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: cleanBarcode }),
            });

            const data: AllocationResponse = await response.json();

            if (data.success) {
                setCurrentScan(data);
                setHistory((prev) => [data, ...prev]);
                setStatus('SUCCESS');
            } else {
                throw new Error(data.error || 'Unknown parsing validation failure');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Network connection exception');
            setStatus('ERROR');
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '24px', borderBottom: '1px solid #ccc', paddingBottom: '12px' }}>
                <h2>Warehouse BRS Routing Interface</h2>
                <p>Status: <strong>{status}</strong></p>
            </header>

            {/* Main Barcode Capture Input */}
            <form onSubmit={handleScanSubmit} style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Scan Tracking Barcode:</label>
                <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Awaiting hardware scanner keyboard stream..."
                    disabled={status === 'FETCHING'}
                    style={{ width: '100%', padding: '12px', fontSize: '16px', boxSizing: 'border-box' }}
                />
            </form>

            {/* Dynamic Status Alert Indicator */}
            {status === 'ERROR' && (
                <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: '24px', borderRadius: '4px' }}>
                    <strong>Scan Failure Alert:</strong> {errorMessage}
                </div>
            )}

            {/* Large Operational Indicator Badge */}
            {status === 'SUCCESS' && currentScan?.assignedPartner && (
                <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    color: '#ffffff',
                    backgroundColor: currentScan.assignedPartner === 'PickMe' ? '#16a34a' : '#2563eb'
                }}>
                    <span style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>ROUTE DESTINATION COURIER</span>
                    <h1 style={{ fontSize: '48px', margin: '8px 0 0 0', fontWeight: 'bold' }}>{currentScan.assignedPartner}</h1>
                    <p style={{ margin: '4px 0 0 0' }}>Assigned Allocation Group: {currentScan.assignedZone}</p>
                </div>
            )}

            {/* Extracted Structural Data Specifications */}
            {status === 'SUCCESS' && currentScan?.parcel && (
                <section style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '24px' }}>
                    <h3 style={{ marginTop: '0' }}>Parcel Verification Specifications</h3>
                    <ul style={{ listStyleType: 'none', paddingLeft: '0', margin: '0' }}>
                        <li style={{ padding: '6px 0' }}><strong>Tracking ID:</strong> {currentScan.parcel.trackingNumber}</li>
                        <li style={{ padding: '6px 0' }}><strong>Consignee Name:</strong> {currentScan.parcel.recipientName}</li>
                        <li style={{ padding: '6px 0' }}><strong>Geographic Destination:</strong> {currentScan.parcel.city}, {currentScan.parcel.district} ({currentScan.parcel.province} Prov)</li>
                        <li style={{ padding: '6px 0' }}><strong>Payload Weight Metrics:</strong> {currentScan.parcel.weight} KG</li>
                    </ul>
                </section>
            )}

            {/* Log History */}
            <section>
                <h4>Active Workstation Processing Session Log</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: '8px' }}>Tracking Number</th>
                            <th style={{ padding: '8px' }}>Destination City</th>
                            <th style={{ padding: '8px' }}>Assigned courier</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px' }}>{item.parcel?.trackingNumber}</td>
                                <td style={{ padding: '8px' }}>{item.parcel?.city}</td>
                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.assignedPartner}</td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#888' }}>No scans registered in this active browser run.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}