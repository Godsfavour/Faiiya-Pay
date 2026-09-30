import JSZip from 'jszip';
import { PLUGIN_FILES } from './pluginFiles';

/**
 * Triggers browser download from a Blob with delayed revokeObjectURL to prevent corrupt 0-byte downloads.
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // CRITICAL FIX FOR CORRUPT DOWNLOADS:
  // Immediate URL.revokeObjectURL(url) aborts the browser's asynchronous download stream
  // before bytes are written to disk, creating an empty or corrupted archive.
  // Delaying revocation by 60 seconds gives the browser ample time to finish writing.
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if already cleaned up
    }
  }, 60000);
}

/**
 * Downloads the verified WordPress plugin zip archive.
 * Fetches the pre-compiled public/faiiya-pay.zip, verifies the PK ZIP magic header bytes,
 * and falls back to clean in-memory JSZip generation if needed.
 */
export async function downloadPluginZip(): Promise<void> {
  // Strategy 1: Fetch the pre-compiled public/faiiya-pay.zip
  try {
    const res = await fetch(`/faiiya-pay.zip?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/zip, application/octet-stream, */*' },
    });

    if (res.ok) {
      const blob = await res.blob();
      // Verify first 4 magic bytes: 0x50, 0x4B, 0x03, 0x04 ('PK\x03\x04')
      // If the server returned an HTML error or redirect, it will fail this check.
      const slice = await blob.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(slice);
      const isRealZip =
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04;

      if (isRealZip && blob.size > 1000) {
        triggerBlobDownload(blob, 'faiiya-pay.zip');
        return;
      }
    }
  } catch (err) {
    console.warn('Direct static zip fetch did not succeed, generating fresh in-memory zip...', err);
  }

  // Strategy 2: Generate pristine ZIP client-side with JSZip
  const zip = new JSZip();
  const rootFolder = zip.folder('faiiya-pay');

  if (!rootFolder) {
    throw new Error('Failed to create plugin root folder in zip');
  }

  // Iterate over each registered plugin file and add to zip
  for (const file of PLUGIN_FILES) {
    rootFolder.file(file.path, file.content, {
      date: new Date('2026-09-30T12:00:00Z'),
      unixPermissions: '644',
    });
  }

  // Generate the zip blob with explicit application/zip MIME type
  const content = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  triggerBlobDownload(content, 'faiiya-pay.zip');
}

