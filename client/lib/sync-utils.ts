import { getPendingReadingsFromDB, markReadingAsSynced } from "./local-db";
import { uploadPhotoToServer } from "./api-utils";
import { apiRequest } from "./query-client";

export interface SyncResult {
  successCount: number;
  failCount: number;
  errors: string[];
}

export const syncPendingReadings = async (): Promise<SyncResult> => {
  const pendingReadings = getPendingReadingsFromDB();
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  if (pendingReadings.length === 0) {
    return { successCount, failCount, errors };
  }

  for (const reading of pendingReadings) {
    try {
      // Upload photo first if it exists
      let photoPath = reading.photoFileName;
      if (reading.photoUri && reading.photoFileName) {
        console.log(`Uploading photo for reading ${reading.id}...`);
        try {
          const uploadedPath = await uploadPhotoToServer(reading.photoUri, reading.photoFileName);
          if (uploadedPath) {
            photoPath = uploadedPath;
          }
        } catch (photoError) {
          console.error(`Failed to upload photo for reading ${reading.id}:`, photoError);
          // Continue with sync even if photo upload fails
          photoPath = reading.photoFileName;
        }
      }

      const res = await apiRequest("POST", "/api/readings", {
        meterId: reading.meterId,
        readerId: reading.readerId,
        newReading: reading.newReading,
        photoPath: photoPath,
        notes: reading.notes,
        skipReason: reading.skipReason,
        latitude: reading.latitude?.toString(),
        longitude: reading.longitude?.toString(),
      });

      if (res.ok) {
        markReadingAsSynced(reading.id);
        successCount++;
        console.log(`Successfully synced reading ${reading.id}`);
      } else {
        const errorText = await res.text();
        console.log(`Failed to sync reading ${reading.id}:`, errorText);
        failCount++;
        errors.push(`فشل رفع قراءة ${reading.meterId}: ${errorText}`);
      }
    } catch (error) {
      console.error("Sync error for reading:", reading.id, error);
      failCount++;
      errors.push(`خطأ في قراءة ${reading.meterId}: ${(error as Error).message}`);
    }
  }

  return { successCount, failCount, errors };
};
