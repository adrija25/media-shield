import { createC2pa } from "@contentauth/c2pa-web/inline";

let c2paInstancePromise = null;

function getC2paInstance() {
  if (!c2paInstancePromise) {
    c2paInstancePromise = createC2pa();
  }

  return c2paInstancePromise;
}

function dataUrlToBlob(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("Invalid image data URL.");
  }

  const header = dataUrl.slice(0, commaIndex);
  const encodedData = dataUrl.slice(commaIndex + 1);

  const mimeMatch = header.match(/^data:([^;,]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";

  let bytes;

  if (header.includes(";base64")) {
    const binaryString = atob(encodedData);

    bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } else {
    const decodedText = decodeURIComponent(encodedData);
    bytes = new TextEncoder().encode(decodedText);
  }

  return new Blob([bytes], {
    type: mimeType
  });
}

export async function inspectProvenance(dataUrl) {
  const result = {
    checked: false,
    hasManifest: false,
    manifestStore: null,
    error: null
  };

  try {
    const c2pa = await getC2paInstance();
    const blob = dataUrlToBlob(dataUrl);

    const manifestStore = await c2pa.read(blob);

    result.checked = true;

    if (manifestStore) {
      result.hasManifest = true;
      result.manifestStore = manifestStore;
    }

    return result;
  } catch (error) {
    result.checked = true;

    result.error =
      error instanceof Error
        ? error.message
        : "C2PA inspection could not be completed.";

    return result;
  }
}

// Expose the bundled provenance checker to Media Shield's
// non-module analysis.js without requiring analysis.js itself
// to become part of the Vite module bundle.
window.MediaShieldProvenance = {
  inspectProvenance
};
