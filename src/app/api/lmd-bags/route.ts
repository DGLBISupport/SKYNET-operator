import { NextResponse } from 'next/server';

// In-memory store for outbound LMD dispatch bags (synchronized across multi-device sessions)
interface OutboundBag {
    bagNumber: string;
    mawbRef: string;
    targetPartner?: 'PickMe' | 'Domex' | 'Pronto' | 'ALL';
    destinationHub?: string;
    status: 'OPEN' | 'SEALED';
    parcelCount: number;
    totalWeight: number;
    createdAt: string;
    sealedAt?: string;
    operator?: string;
    parcels: any[];
}

interface ManifestSession {
    mawbRef: string;
    status: 'OPEN' | 'CLOSED';
    closedAt?: string;
}

const outboundBagsMap = new Map<string, OutboundBag>();
const manifestsMap = new Map<string, ManifestSession>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mawbRef = searchParams.get('mawbRef');
    const bagNumber = searchParams.get('bagNumber');

    if (bagNumber) {
        const bag = outboundBagsMap.get(bagNumber);
        if (!bag) {
            return NextResponse.json({ success: false, error: `Bag "${bagNumber}" not found.` }, { status: 404 });
        }
        return NextResponse.json({ success: true, bag });
    }

    if (mawbRef) {
        const bags = Array.from(outboundBagsMap.values()).filter(b => b.mawbRef.toLowerCase() === mawbRef.toLowerCase());
        const manifestSession = manifestsMap.get(mawbRef) || { mawbRef, status: 'OPEN' };
        return NextResponse.json({
            success: true,
            mawbRef,
            manifestStatus: manifestSession.status,
            bags
        });
    }

    return NextResponse.json({
        success: true,
        bags: Array.from(outboundBagsMap.values()),
        manifests: Array.from(manifestsMap.values())
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, mawbRef, bagNumber, partner, destinationHub, operator, parcelCount, totalWeight, parcels } = body;

        if (!mawbRef) {
            return NextResponse.json({ success: false, error: 'Missing mawbRef parameter' }, { status: 400 });
        }

        // Check if manifest is closed
        const manifestSession = manifestsMap.get(mawbRef);
        if (manifestSession && manifestSession.status === 'CLOSED' && action === 'create') {
            return NextResponse.json({
                success: false,
                error: `Manifest "${mawbRef}" is CLOSED. No additional bags can be created under this manifest.`
            }, { status: 400 });
        }

        // ACTION: CREATE NEW LMD OUTBOUND BAG
        if (action === 'create') {
            // Find existing bags for this MAWB to calculate next index number
            const existingBags = Array.from(outboundBagsMap.values()).filter(b => b.mawbRef.toLowerCase() === mawbRef.toLowerCase());
            const nextIndex = existingBags.length + 1;
            const formattedIndex = String(nextIndex).padStart(2, '0');
            const partnerCode = partner && partner !== 'ALL' ? `-${partner.toUpperCase()}` : '';
            const defaultBagNumber = `${mawbRef}${partnerCode}-BAG-${formattedIndex}`;
            const newBagNumber = (body.customBagNumber || body.bagNumber || defaultBagNumber).trim();

            const newBag: OutboundBag = {
                bagNumber: newBagNumber,
                mawbRef,
                targetPartner: partner || 'ALL',
                destinationHub: destinationHub || (partner ? `${partner} Hub` : 'Main Sort Hub'),
                status: 'OPEN',
                parcelCount: 0,
                totalWeight: 0,
                createdAt: new Date().toISOString(),
                operator: operator || 'Staff',
                parcels: []
            };

            outboundBagsMap.set(newBagNumber, newBag);
            if (!manifestsMap.has(mawbRef)) {
                manifestsMap.set(mawbRef, { mawbRef, status: 'OPEN' });
            }

            return NextResponse.json({
                success: true,
                message: `New Outbound LMD Bag "${newBagNumber}" created successfully.`,
                bag: newBag
            });
        }

        // ACTION: ADD PARCEL TO ACTIVE BAG
        if (action === 'add-parcel') {
            if (!bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            }
            const bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                return NextResponse.json({ success: false, error: `Bag "${bagNumber}" not found.` }, { status: 404 });
            }

            if (bag.status === 'SEALED') {
                return NextResponse.json({
                    success: false,
                    error: `Bag "${bagNumber}" is SEALED & CLOSED. No additional parcels can be added.`
                }, { status: 400 });
            }

            // Append parcel and update metrics
            const newParcel = body.parcel;
            if (newParcel) {
                bag.parcels.unshift(newParcel);
                bag.parcelCount = bag.parcels.length;
                bag.totalWeight = Number((bag.parcels.reduce((acc, p) => acc + (Number(p.weight) || 0.1), 0)).toFixed(2));
            }

            outboundBagsMap.set(bagNumber, bag);
            return NextResponse.json({ success: true, bag });
        }

        // ACTION: SEAL & CLOSE BAG
        if (action === 'seal') {
            if (!bagNumber) {
                return NextResponse.json({ success: false, error: 'Missing bagNumber' }, { status: 400 });
            }
            const bag = outboundBagsMap.get(bagNumber);
            if (!bag) {
                return NextResponse.json({ success: false, error: `Bag "${bagNumber}" not found.` }, { status: 404 });
            }

            bag.status = 'SEALED';
            bag.sealedAt = new Date().toISOString();
            if (parcelCount !== undefined) bag.parcelCount = parcelCount;
            if (totalWeight !== undefined) bag.totalWeight = totalWeight;
            if (parcels) bag.parcels = parcels;

            outboundBagsMap.set(bagNumber, bag);
            return NextResponse.json({
                success: true,
                message: `Outbound Bag "${bagNumber}" has been SEALED & CLOSED.`,
                bag
            });
        }

        // ACTION: CLOSE MANIFEST
        if (action === 'close-manifest') {
            manifestsMap.set(mawbRef, {
                mawbRef,
                status: 'CLOSED',
                closedAt: new Date().toISOString()
            });

            return NextResponse.json({
                success: true,
                message: `Manifest "${mawbRef}" has been CLOSED. No additional bags can be created.`,
                manifest: manifestsMap.get(mawbRef)
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid action parameter' }, { status: 400 });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
    }
}
