function readAscii(bytes, start, length) {
  let result = "";

  for (
    let i = start;
    i < start + length && i < bytes.length;
    i++
  ) {
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


function decodeBytesForSearch(bytes) {
  try {
    return new TextDecoder("latin1").decode(bytes);
  } catch (error) {
    console.error(
      "Metadata text decoding failed:",
      error
    );

    return "";
  }
}


function findTextOccurrences(
  bytes,
  searchTerms
) {
  const text =
    decodeBytesForSearch(bytes);

  if (!text) {
    return [];
  }

  const lowerText =
    text.toLowerCase();

  const findings = [];

  searchTerms.forEach(
    (term) => {
      if (
        typeof term !== "string" ||
        !term
      ) {
        return;
      }

      if (
        lowerText.includes(
          term.toLowerCase()
        )
      ) {
        findings.push(term);
      }
    }
  );

  return [
    ...new Set(findings)
  ];
}


/*
  ============================================================
  JPEG MARKER INSPECTION
  ============================================================
*/


function inspectJpegMarkers(bytes) {
  const result = {
    hasExif: false,
    hasXmp: false,
    hasIccProfile: false,
    hasPhotoshopResource: false,
    comments: []
  };

  if (
    !bytes ||
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return result;
  }

  let offset = 2;

  while (
    offset + 4 <= bytes.length
  ) {
    /*
      Find the next JPEG marker.
    */

    if (
      bytes[offset] !== 0xff
    ) {
      offset++;
      continue;
    }

    /*
      JPEG files can contain repeated FF
      padding bytes before a marker.
    */

    while (
      offset < bytes.length &&
      bytes[offset] === 0xff
    ) {
      offset++;
    }

    if (
      offset >= bytes.length
    ) {
      break;
    }

    const marker =
      bytes[offset];

    /*
      Start of Scan and End of Image.
    */

    if (
      marker === 0xda ||
      marker === 0xd9
    ) {
      break;
    }

    /*
      Standalone markers do not have a
      segment length.
    */

    if (
      marker === 0x01 ||
      (
        marker >= 0xd0 &&
        marker <= 0xd7
      )
    ) {
      offset++;
      continue;
    }

    /*
      A normal JPEG segment requires
      two bytes for its length.
    */

    if (
      offset + 2 >= bytes.length
    ) {
      break;
    }

    const segmentLength =
      (
        bytes[offset + 1] << 8
      ) |
      bytes[offset + 2];

    if (
      segmentLength < 2
    ) {
      break;
    }

    const dataStart =
      offset + 3;

    const dataLength =
      segmentLength - 2;

    if (
      dataStart + dataLength >
      bytes.length
    ) {
      break;
    }


    /*
      ========================================================
      APP1
      ========================================================
    */

    if (
      marker === 0xe1
    ) {
      const header =
        readAscii(
          bytes,
          dataStart,
          Math.min(
            dataLength,
            100
          )
        );

      if (
        header.startsWith(
          "Exif"
        )
      ) {
        result.hasExif =
          true;
      }

      if (
        header.includes(
          "http://ns.adobe.com/xap/1.0/"
        ) ||
        header.includes(
          "http://ns.adobe.com/xmp/"
        ) ||
        header.includes(
          "http://ns.adobe.com/xap/1.0"
        ) ||
        header.includes(
          "XMP"
        )
      ) {
        result.hasXmp =
          true;
      }
    }


    /*
      ========================================================
      APP2
      ========================================================
    */

    if (
      marker === 0xe2
    ) {
      const header =
        readAscii(
          bytes,
          dataStart,
          Math.min(
            dataLength,
            50
          )
        );

      if (
        header.includes(
          "ICC_PROFILE"
        )
      ) {
        result.hasIccProfile =
          true;
      }
    }


    /*
      ========================================================
      APP13
      ========================================================
    */

    if (
      marker === 0xed
    ) {
      const header =
        readAscii(
          bytes,
          dataStart,
          Math.min(
            dataLength,
            80
          )
        );

      if (
        header.includes(
          "Photoshop 3.0"
        )
      ) {
        result.hasPhotoshopResource =
          true;
      }
    }


    /*
      ========================================================
      JPEG COMMENT
      ========================================================
    */

    if (
      marker === 0xfe
    ) {
      const comment =
        cleanMetadataText(
          readAscii(
            bytes,
            dataStart,
            dataLength
          )
        );

      if (
        comment
      ) {
        result.comments.push(
          comment.slice(
            0,
            300
          )
        );
      }
    }


    /*
      Move to the next JPEG segment.

      offset currently points at the
      marker byte, while segmentLength
      includes the two length bytes.
    */

    offset +=
      1 + segmentLength;
  }

  return result;
}


/*
  ============================================================
  DATA URL → BYTES
  ============================================================
*/


function dataUrlToBytes(
  dataUrl
) {
  if (
    typeof dataUrl !== "string"
  ) {
    throw new Error(
      "Invalid image data."
    );
  }

  const commaIndex =
    dataUrl.indexOf(",");

  if (
    commaIndex === -1
  ) {
    throw new Error(
      "Invalid image data URL."
    );
  }

  const header =
    dataUrl.slice(
      0,
      commaIndex
    );

  const encodedData =
    dataUrl.slice(
      commaIndex + 1
    );

  if (
    !encodedData
  ) {
    throw new Error(
      "Image data is empty."
    );
  }


  /*
    Base64 data URL.
  */

  if (
    header.includes(
      ";base64"
    )
  ) {
    let binaryString;

    try {
      binaryString =
        atob(
          encodedData
        );
    } catch (error) {
      throw new Error(
        "Image data could not be decoded."
      );
    }

    const bytes =
      new Uint8Array(
        binaryString.length
      );

    for (
      let i = 0;
      i < binaryString.length;
      i++
    ) {
      bytes[i] =
        binaryString.charCodeAt(
          i
        );
    }

    return bytes;
  }


  /*
    Non-base64 data URL.

    This is uncommon for image files but
    remains supported for compatibility.
  */

  try {
    const decodedText =
      decodeURIComponent(
        encodedData
      );

    return new TextEncoder().encode(
      decodedText
    );

  } catch (error) {
    throw new Error(
      "Image data could not be decoded."
    );
  }
}


/*
  ============================================================
  SOFTWARE / AI INDICATORS
  ============================================================
*/


const GENERAL_SOFTWARE_INDICATORS = [
  "Adobe Photoshop",
  "Adobe Lightroom",
  "GIMP",
  "Canva",
  "Affinity Photo",
  "Pixelmator"
];


/*
  These are deliberately restricted to relatively distinctive
  generative-image tools/workflows.

  Detection means only that the text exists somewhere in the
  file bytes. It does NOT establish that the visible image was
  generated or manipulated by that software.
*/

const AI_SOFTWARE_INDICATORS = [
  "Stable Diffusion",
  "Midjourney",
  "DALL-E",
  "DALL·E",
  "ComfyUI",
  "AUTOMATIC1111",
  "InvokeAI",
  "Fooocus"
];


/*
  ============================================================
  METADATA INSPECTION
  ============================================================
*/


async function inspectImageMetadata(
  dataUrl,
  mimeType
) {
  const bytes =
    dataUrlToBytes(
      dataUrl
    );

  const normalisedMimeType =
    typeof mimeType === "string"
      ? mimeType.toLowerCase().trim()
      : "";


  const result = {
    format:
      mimeType ||
      "Unknown",

    hasExif:
      false,

    hasXmp:
      false,

    hasIccProfile:
      false,

    hasPhotoshopResource:
      false,

    comments:
      [],

    softwareIndicators:
      [],

    aiIndicators:
      []
  };


  /*
    ==========================================================
    JPEG STRUCTURED METADATA
    ==========================================================
  */

  if (
    normalisedMimeType ===
      "image/jpeg" ||
    normalisedMimeType ===
      "image/jpg"
  ) {
    const jpegResult =
      inspectJpegMarkers(
        bytes
      );

    result.hasExif =
      jpegResult.hasExif;

    result.hasXmp =
      jpegResult.hasXmp;

    result.hasIccProfile =
      jpegResult.hasIccProfile;

    result.hasPhotoshopResource =
      jpegResult.hasPhotoshopResource;

    result.comments =
      jpegResult.comments;
  }


  /*
    ==========================================================
    GENERAL SOFTWARE REFERENCES
    ==========================================================

    These are informational only.

    Photoshop, Lightroom, GIMP, Canva, etc. do not imply
    AI generation.
    ==========================================================
  */

  result.softwareIndicators =
    findTextOccurrences(
      bytes,
      GENERAL_SOFTWARE_INDICATORS
    );


  /*
    ==========================================================
    AI-ASSOCIATED REFERENCES
    ==========================================================

    These are meaningful file-level indicators but NOT proof
    of the image's origin.
    ==========================================================
  */

  result.aiIndicators =
    findTextOccurrences(
      bytes,
      AI_SOFTWARE_INDICATORS
    );


  return result;
}
