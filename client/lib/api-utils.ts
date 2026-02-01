import * as FileSystem from "expo-file-system";
import { getApiUrl } from "./query-client";

// Enable photo upload to server
export const uploadPhotoToServer = async (uri: string, fileName: string): Promise<string | null> => {
  if (!uri) return null;
  
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const response = await fetch(`${getApiUrl()}/api/upload-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photoBase64: base64,
        fileName: fileName,
      }),
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.photoPath || fileName;
  } catch (error) {
    console.error('Error uploading photo:', error);
    return null;
  }
};
