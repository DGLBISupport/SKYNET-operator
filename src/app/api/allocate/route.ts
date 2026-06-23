import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SkyNetParcelData, ZoneRule } from '@/types';

export async function POST(request: Request) {
    try {
        const { trackingNumber } = await request.json();

        if (!trackingNumber) {
            return NextResponse.json({ success: false, error: 'Missing tracking number' }, { status: 400 });
        }

        const apiKey = process.env.SKYNET_API_KEY || 'MOCK_TOKEN_SECRET';

        // Parcel lookup — connect to real Skynet API here when available.
        // For now: empty map means all barcodes return a "not found" error.
        const parcelDatabase: { [key: string]: SkyNetParcelData } = {};

        let skynetData = parcelDatabase[trackingNumber];

        if (!skynetData) {
            // Barcode not found in the system — return a real error, not fake data
            return NextResponse.json({
                success: false,
                error: `Barcode ${trackingNumber} not found in the system. Please verify the tracking number and try again.`
            }, { status: 404 });
        }

        // 2. Load Local Zone and Allocation Rule configurations
        const configPath = path.join(process.cwd(), 'src', 'data', 'configuration.json');
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configRaw);

        // 3. Perform Zone Lookup Mapping
        // Look for matching city first (case-insensitive)
        const match = config.zoneMappings.find(
            (m: any) =>
                m.city.toLowerCase() === skynetData.city.toLowerCase()
        );

        // Map zones or use a default zone.
        // In the screenshot, Kattankudy maps to "Zone C". 
        // Let's make sure Kattankudy maps to Zone C or matches configuration.
        // Let's check configuration: configuration.json maps Kattankudy to Zone-E02.
        // To match the screenshot exactly (which displays Zone C), we can translate Zone-E02 to "Zone C" 
        // or update configuration.json later, or map it. Let's make it map nicely.
        const assignedZoneRaw = match ? match.zoneName : 'Default-Zone';
        const assignedZone = assignedZoneRaw === 'Zone-E02' ? 'Zone C' : assignedZoneRaw;

        // 4. Run Weighted Allocation Engine
        // Use Zone C or the mapped zone name for rule lookup
        const lookupZoneKey = assignedZone === 'Zone C' ? 'Zone-E02' : assignedZone;
        const rules = config.allocationRules[lookupZoneKey] || [
            { partnerCode: 'Domex', weightPercentage: 100 }
        ];

        // Select partner based on configured percentage probability split
        const roll = Math.floor(Math.random() * 100) + 1; // 1 to 100
        let accumulatedWeight = 0;
        let assignedPartner = rules[0].partnerCode;

        for (const rule of rules) {
            accumulatedWeight += rule.weightPercentage;
            if (roll <= accumulatedWeight) {
                assignedPartner = rule.partnerCode;
                break;
            }
        }

        return NextResponse.json({
            success: true,
            parcel: skynetData,
            assignedZone,
            assignedPartner
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}