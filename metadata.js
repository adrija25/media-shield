function readAscii(bytes, start, length) {
  let result = "";

  for (let i = start; i < start + length && i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }

  return result;
}

function cleanMetadataText(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findTextOccurrences(bytes, searchTerms) {
  const text = new TextDecoder("latin1").decode(bytes);
  const lowerText = text.toLowerCase();

  const findings = [];

  searchTerms.forEach((term) => {
    if (lowerText.includes(term.toLowerCase())) {
      findings.push(term);
    }
  });

  return [...new Set(findings)];
}

function inspectJpegMarkers(bytes) {
  const result = {
    hasExif: false,
    hasXmp: false,
    hasIccProfile: false,
    hasPhotoshopResource: false,
    comments: []
  };

  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return result;
  }

  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }

    const segmentLength =
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];

    if (segmentLength < 2) {
      break;
    }

    const dataStart = offset + 4;
    const dataLength = segmentLength - 2;

    if (dataStart + dataLength > bytes.length) {
      break;
    }

    if (marker === 0xe1) {
      const header = readAscii(
        bytes,
        dataStart,
        Math.min(dataLength, 40)
      );

      if (header.startsWith("Exif")) {
        result.hasExif = true;
      }

      if (
        header.includes("http://ns.adobe.com/xap/1.0/") ||
        header.includes("XMP")
      ) {
        result.hasXmp = true;
      }
    }

    if (marker === 0xe2) {
      const header = readAscii(
        bytes,
        dataStart,
        Math.min(dataLength, 20)
      );

      if (header.includes("ICC_PROFILE")) {
        result.hasIccProfile = true;
      }
    }

    if (marker === 0xed) {
      const header = readAscii(
        bytes,
        dataStart,
        Math.min(dataLength, 30)
      );

      if (header.includes("Photoshop 3.0")) {
        result.hasPhotoshopResource = true;
      }
    }

    if (marker === 0xfe) {
      const comment = cleanMetadataText(
        readAscii(bytes, dataStart, dataLength)
      );

      if (comment) {
        result.comments.push(comment.slice(0, 300));
      }
    }

    offset += 2 + segmentLength;
  }

  return result;
}

async function inspectImageMetadata(dataUrl, mimeType) {
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const result = {
    format: mimeType || "Unknown",
    hasExif: false,
    hasXmp: false,
    hasIccProfile: false,
    hasPhotoshopResource: false,
    comments: [],
    softwareIndicators: [],
    aiIndicators: []
  };

  if (mimeType === "image/jpeg") {
    const jpegResult = inspectJpegMarkers(bytes);

    result.hasExif = jpegResult.hasExif;
    result.hasXmp = jpegResult.hasXmp;
    result.hasIccProfile = jpegResult.hasIccProfile;
    result.hasPhotoshopResource =
      jpegResult.hasPhotoshopResource;
    result.comments = jpegResult.comments;
  }

  result.softwareIndicators = findTextOccurrences(bytes, [
    "Adobe Photoshop",
    "Adobe Lightroom",
    "GIMP",
    "Canva",
    "Affinity Photo",
    "Pixelmator"
  ]);

  result.aiIndicators = findTextOccurrences(bytes, [
    "Stable Diffusion",
    "Midjourney",
    "DALL-E",
    "DALL·E",
    "ComfyUI",
    "Automatic1111",
    "InvokeAI"
  ]);

  return result;
}
