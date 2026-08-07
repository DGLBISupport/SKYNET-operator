import { apiPost } from './client';
import { OutboundLmdBag, SkyNetParcelData } from '../types';

interface BagResponse {
  success: boolean;
  bag?: OutboundLmdBag;
  message?: string;
  error?: string;
}

export function createOutboundBag(params: {
  mawbRef: string;
  partner: string;
  operator: string;
  destinationHub?: string;
  customBagNumber?: string;
}) {
  return apiPost<BagResponse>('/api/lmd-bags', { ...params, action: 'create' });
}

export function addParcelToBag(params: {
  mawbRef: string;
  bagNumber: string;
  partner: string;
  operator: string;
  parcel: SkyNetParcelData;
}) {
  return apiPost<BagResponse>('/api/lmd-bags', { ...params, action: 'add-parcel' });
}

export function sealBag(params: {
  mawbRef: string;
  bagNumber: string;
  operator: string;
  parcelCount: number;
  totalWeight: number;
}) {
  return apiPost<BagResponse>('/api/lmd-bags', { ...params, action: 'seal' });
}
