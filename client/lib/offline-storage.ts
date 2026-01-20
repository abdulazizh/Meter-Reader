import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_READINGS_KEY = "pending_readings";

export interface PendingReading {
  id: string; // Internal temporary ID
  meterId: string;
  readerId: string;
  newReading: number | null;
  photoUri: string; // Local URI
  photoFileName: string;
  photoPath?: string; // Server path (if already uploaded)
  notes?: string;
  skipReason?: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
}

export async function savePendingReading(reading: Omit<PendingReading, "id" | "timestamp">) {
  try {
    const pending = await getPendingReadings();
    const newEntry: PendingReading = {
      ...reading,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    pending.push(newEntry);
    await AsyncStorage.setItem(PENDING_READINGS_KEY, JSON.stringify(pending));
    return true;
  } catch (error) {
    console.error("Error saving pending reading:", error);
    return false;
  }
}

export async function getPendingReadings(): Promise<PendingReading[]> {
  try {
    const data = await AsyncStorage.getItem(PENDING_READINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting pending readings:", error);
    return [];
  }
}

export async function removePendingReading(id: string) {
  try {
    const pending = await getPendingReadings();
    const filtered = pending.filter((r) => r.id !== id);
    await AsyncStorage.setItem(PENDING_READINGS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing pending reading:", error);
  }
}
