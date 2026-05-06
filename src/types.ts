import { Timestamp } from 'firebase/firestore';

export interface KeyData {
  id: string; // the key string itself often used as ID
  key: string;
  durationHours: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  isActive: boolean;
  deviceId?: string;
  maxDevices: number;
  usedDevices?: string[];
}

export interface DeviceData {
  deviceId: string;
  isBlocked: boolean;
  lastSeenAt: Timestamp;
}

export interface PredictionResult {
  period: string;
  pred: 'Big' | 'Small';
  actual: 'Big' | 'Small' | null;
  status: 'Pending' | 'Win' | 'Loss';
}

export interface HistoryItem {
  period: string;
  number: number;
  size: 'Big' | 'Small';
}

export interface AdminSettings {
  wingo30sEnabled: boolean;
  wingo1mEnabled: boolean;
  globalNotice: string;
  totalWins: number;
  totalLosses: number;
  updatedAt: Timestamp;
}
