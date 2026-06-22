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

        // 1. Fetch from the SkyNet API
        // Note: Replace this placeholder with the actual endpoint & credentials provided by the client
        const apiKey = process.env.SKYNET_API_KEY || 'MOCK_TOKEN_SECRET';

        // For demonstration, simulating the payload for '710251521582'
        let skynetData: SkyNetParcelData;

        if (trackingNumber === '710251521582') {
            skynetData = {
                trackingNumber: '710251521582',
                recipientName: 'A.R. Mohamed',
                province: 'Eastern',
                district: 'Batticaloa',
                city: 'Kattankudy',
                weight: 1.25
            };
        } else {
            // Fallback fallback simulated data response
            skynetData = {
                trackingNumber,
                recipientName: 'Walk-in Client',
                province: 'Eastern',
                district: 'Batticaloa',
                city: 'Kattankudy',
                weight: 0.5
            };
        }

        // 2. Load Local Zone and Allocation Rule configurations
        const configPath = path.join(process.cwd(), 'src', 'data', 'configuration.json');
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configRaw);

        // 3. Perform Zone Lookup Mapping
        const match = config.zoneMappings.find(
            (m: any) =>
                m.province.toLowerCase() === skynetData.province.toLowerCase() &&
                m.city.toLowerCase() === skynetData.city.toLowerCase()
        );

        const assignedZone = match ? match.zoneName : 'Default-Zone';

        // 4. Run Weighted Allocation Engine
        const rules = config.allocationRules[assignedZone] || [
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