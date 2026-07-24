// Helper functions for Google Drive REST API integration

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
}

/**
 * List files from Google Drive
 * Allows customizing search query and filtering by a parent folder
 */
export async function listDriveFiles(
  accessToken: string,
  searchQuery?: string,
  folderId?: string
): Promise<DriveFile[]> {
  try {
    let querySpecStr = "trashed = false";
    
    if (folderId) {
      // Escape folderId
      const safeFolderId = folderId.replace(/'/g, "\\'");
      querySpecStr += ` and '${safeFolderId}' in parents`;
    }

    if (searchQuery) {
      // Escape single quotes in search query
      const safeQuery = searchQuery.replace(/'/g, "\\'");
      querySpecStr += ` and (name contains '${safeQuery}' or mimeType contains '${safeQuery}')`;
    }

    // Include supportsAllDrives & includeItemsFromAllDrives to query custom team drives and workspace project shortcuts
    const baseUrl = "https://www.googleapis.com/drive/v3/files";
    const params = new URLSearchParams({
      pageSize: "40",
      q: querySpecStr,
      fields: "files(id,name,mimeType,webViewLink,createdTime)",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true"
    });

    const url = `${baseUrl}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive list error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
}

/**
 * Upload a text file to Google Drive using multipart upload
 */
export async function uploadTextFile(
  accessToken: string,
  fileName: string,
  content: string
): Promise<DriveFile> {
  try {
    const metadata = {
      name: fileName,
      mimeType: "text/plain",
    };

    const boundary = "papita_multipart_boundary_12345";
    const delimiter = `\r\n--${boundary}\r\n`;
    const endDelimiter = `\r\n--${boundary}--`;

    const body = 
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
      content +
      endDelimiter;

    const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive upload failed: ${res.status} - ${errText}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Error uploading text file to Drive:", error);
    throw error;
  }
}

/**
 * Retrieve text content of a plain text file or export a Google Doc as plain text
 */
export async function getFileContentText(accessToken: string, fileId: string, mimeType: string): Promise<string> {
  try {
    let url = "";
    
    if (mimeType === "application/vnd.google-apps.document") {
      // Export Google Doc as plain text
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else {
      // Regular plain text file or generic source download
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error fetching file content: ${res.status} - ${errText}`);
    }

    return await res.text();
  } catch (error) {
    console.error("Error reading Google Drive file content:", error);
    throw error;
  }
}
