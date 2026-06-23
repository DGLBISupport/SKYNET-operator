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

        // Simulated database of parcel details
        const parcelDatabase: { [key: string]: SkyNetParcelData } = {
            '710251521582': {
                trackingNumber: '710251521582',
                recipientName: 'A.L.M Fahim Fahim',
                province: 'Eastern',
                district: 'Eastern',
                city: 'Kattankudy',
                weight: 0.65,
                value: 'USD 19.15',
                account: 'HK24018',
                apiSync: 'Synced'
            },
            '502194821034': {
                trackingNumber: '502194821034',
                recipientName: 'Mohamed Ansar',
                province: 'Western',
                district: 'Colombo',
                city: 'Colombo 03',
                weight: 1.45,
                value: 'USD 42.50',
                account: 'HK24020',
                apiSync: 'Synced'
            },
            '301982741982': {
                trackingNumber: '301982741982',
                recipientName: 'Shashini Silva',
                province: 'Southern',
                district: 'Galle',
                city: 'Hikkaduwa',
                weight: 0.95,
                value: 'USD 12.00',
                account: 'HK24025',
                apiSync: 'Synced'
            },
            '804918274912': {
                trackingNumber: '804918274912',
                recipientName: 'Priyantha Bandara',
                province: 'Central',
                district: 'Kandy',
                city: 'Peradeniya',
                weight: 2.10,
                value: 'USD 65.80',
                account: 'HK24032',
                apiSync: 'Synced'
            }
        };

        let skynetData = parcelDatabase[trackingNumber];

        if (!skynetData) {
            // Fallback fallback simulated data response for any other scanned barcode
            skynetData = {
                trackingNumber,
                recipientName: 'Walk-in Client',
                province: 'Eastern',
                district: 'Eastern',
                city: 'Kattankudy',
                weight: 0.50,
                value: 'USD 10.00',
                account: 'HK24001',
                apiSync: 'Synced'
            };
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