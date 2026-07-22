import { createC2pa } from "@contentauth/c2pa-web/inline";

let c2paInstancePromise = null;

function getC2paInstance() {
  if (!c2paInstancePromise) {
    c2paInstancePromise = createC2pa();
  }

  return c2paInstancePromise;
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
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
    const blob = await dataUrlToBlob(dataUrl);

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
