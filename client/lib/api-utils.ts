import * as FileSystem from "expo-file-system/legacy";
import { getApiUrl } from "./query-client";

export const uploadPhotoToServer = async (uri: string, fileName: string): Promise<string | null> => {
  if (!uri) return null;
  
  try {
    console.log(`Reading photo from URI: ${uri}`);
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const baseUrl = getApiUrl();
    const uploadUrl = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}api/upload-photo`;
    console.log(`Uploading to ${uploadUrl}...`);
    const response = await fetch(uploadUrl, {
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
      const errorText = await response.text();
      console.error(`Upload failed with status ${response.status}: ${errorText}`);
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    return data.photoPath || fileName;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
};
