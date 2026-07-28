function readAscii(bytes, start, length) {
  let result = "";

  for (
    let i = start;
    i < start + length &&
    i < bytes.length;
    i++
  ) {
    result += String.fromCharCode(
      bytes[i]
    );
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
    return new TextDecoder(
      "latin1"
    ).decode(bytes);
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

  searchTerms.forEach((term) => {
    if (
      lowerText.includes(
        term.toLowerCase()
      )
    ) {
      findings.push(term);
    }
  });

  return [
    ...new Set(findings)
  ];
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

  while (
    offset + 4 <= bytes.length
  ) {
    if (
      bytes[offset] !== 0xff
    ) {
      offset++;
      continue;
    }

    const marker =
      bytes[offset + 1];

    if (
      marker === 0xd9 ||
      marker === 0xda
    ) {
      break;
    }

    if (
      marker === 0x01 ||
      (
        marker >= 0xd0 &&
        marker <= 0xd7
      )
    ) {
      offset += 2;
      continue;
    }

    if (
      offset + 3 >= bytes.length
    ) {
      break;
    }

    const segmentLength =
      (
        bytes[offset + 2] << 8
      ) |
      bytes[offset + 3];

    if (
      segmentLength < 2
    ) {
      break;
    }

    const dataStart =
      offset + 4;

    const dataLength =
      segmentLength - 2;

    if (
      dataStart + dataLength >
      bytes.length
    ) {
      break;
    }


    /*
      APP1

      Common location for EXIF
      and XMP metadata.
    */

    if (marker === 0xe1) {
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
        header.startsWith(
          "Exif"
        )
      ) {
        result.hasExif = true;
      }

      if (
        header.includes(
          "http://ns.adobe.com/xap/1.0/"
        ) ||
        header.includes(
          "http://ns.adobe.com/xmp/"
        ) ||
        header.includes(
          "XMP"
        )
      ) {
        result.hasXmp = true;
      }
    }


    /*
      APP2

      Common location for ICC
      colour profiles.
    */

    if (marker === 0xe2) {
      const header =
        readAscii(
          bytes,
          dataStart,
          Math.min(
            dataLength,
            40
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
      APP13

      Photoshop resource
      information may appear here.
    */

    if (marker === 0xed) {
      const header =
        readAscii(
          bytes,
          dataStart,
          Math.min(
            dataLength,
            60
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
      JPEG comment marker.
    */

    if (marker === 0xfe) {
      const comment =
        cleanMetadataText(
          readAscii(
            bytes,
            dataStart,
            dataLength
          )
        );

      if (comment) {
        result.comments.push(
          comment.slice(
            0,
            300
          )
        );
      }
    }

    offset +=
      2 + segmentLength;
  }

  return result;
}


async function inspectImageMetadata(
  dataUrl,
  mimeType
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

  let bytes;


  /*
    Convert the data URL back
    into raw file bytes.
  */

  if (
    header.includes(
      ";base64"
    )
  ) {
    const binaryString =
      atob(encodedData);

    bytes =
      new Uint8Array(
        binaryString.length
      );

    for (
      let i = 0;
      i <
      binaryString.length;
      i++
    ) {
      bytes[i] =
        binaryString.charCodeAt(
          i
        );
    }
  } else {
    const decodedText =
      decodeURIComponent(
        encodedData
      );

    bytes =
      new TextEncoder().encode(
        decodedText
      );
  }


  const result = {
    format:
      mimeType ||
      "Unknown",

    hasExif: false,
    hasXmp: false,
    hasIccProfile: false,
    hasPhotoshopResource:
      false,

    comments: [],

    softwareIndicators: [],

    aiIndicators: []
  };


  /*
    Structured JPEG marker
    inspection.
  */

  if (
    mimeType ===
      "image/jpeg" ||
    mimeType ===
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
    General editing-software
    references.

    These indicate that software
    names are present somewhere
    in the file.

    They MUST NOT be interpreted
    as evidence that the image
    was AI-generated.
  */

  result.softwareIndicators =
    findTextOccurrences(
      bytes,
      [
        "Adobe Photoshop",
        "Adobe Lightroom",
        "GIMP",
        "Canva",
        "Affinity Photo",
        "Pixelmator"
      ]
    );


  /*
    AI-associated workflow
    references.

    These are deliberately
    limited to relatively
    distinctive names associated
    with generative-image tools
    or workflows.

    Even when detected, they are
    indicators only — not proof
    that the displayed image was
    generated or manipulated by AI.
  */

  result.aiIndicators =
    findTextOccurrences(
      bytes,
      [
        "Stable Diffusion",
        "Midjourney",
        "DALL-E",
        "DALL·E",
        "ComfyUI",
        "AUTOMATIC1111",
        "InvokeAI",
        "Fooocus"
      ]
    );


  return result;
}
