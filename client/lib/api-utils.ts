import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { getApiUrl } from "./query-client";

export const uploadPhotoToServer = async (uri: string, fileName: string): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return fileName;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const response = await fetch(new URL("/api/upload-photo", getApiUrl()).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photoBase64: base64,
        fileName: fileName,
      }),
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const result = await response.json();
    console.log("Photo uploaded to server:", result.photoPath);
    return result.photoPath;
  } catch (error) {
    console.error("Error uploading photo:", error);
    return null;
  }
};
