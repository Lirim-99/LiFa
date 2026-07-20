/**
 * Triggers a PDF download by fetching the document through the BFF proxy
 * and creating a temporary blob URL for the browser download.
 */
export async function downloadPdf(apiPath: string, filename: string): Promise<void> {
  const url = `/api/proxy${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to download PDF (${response.status})`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
