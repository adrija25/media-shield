const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");
const previewContainer = document.getElementById("previewContainer");
const statusTitle = document.getElementById("statusTitle");
const statusDescription = document.getElementById("statusDescription");
const evidenceList = document.getElementById("evidenceList");
const checkAnotherButton = document.getElementById("checkAnotherButton");

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createEvidenceItem(type, title, description) {
  const article = document.createElement("article");
  article.className = "evidence-item";

  const indicator = document.createElement("div");
  indicator.className = `indicator ${type}`;

  const content = document.createElement("div");

  const heading = document.createElement("h4");
  heading.textContent = title;

  const text = document.createElement("p");
  text.textContent = description;

  content.appendChild(heading);
  content.appendChild(text);

  article.appendChild(indicator);
  article.appendChild(content);

  return article;
}

function showNoImageMessage() {
  previewContainer.innerHTML =
    "<p>No image is currently available for analysis.</p>";

  fileName.textContent = "No image selected";
  fileDetails.textContent = "";

  statusTitle.textContent = "No analysis available";
  statusDescription.textContent =
    "Return to Media Shield and select an image to begin a check.";

  evidenceList.innerHTML = "";
}

function buildMetadataDescription(metadata) {
  const findings = [];

  if (metadata.hasExif) {
    findings.push("EXIF metadata container detected");
  }

  if (metadata.hasXmp) {
    findings.push("XMP metadata detected");
  }

  if (metadata.hasIccProfile) {
    findings.push("ICC colour profile detected");
  }

  if (metadata.hasPhotoshopResource) {
    findings.push("Photoshop resource metadata detected");
  }

  if (metadata.softwareIndicators.length > 0) {
    findings.push(
      `Software references found: ${metadata.softwareIndicators.join(", ")}`
    );
  }

  if (metadata.comments.length > 0) {
    findings.push("Embedded JPEG comment data detected");
  }

  if (findings.length === 0) {
    return (
      "No supported metadata markers were detected by this local check. " +
      "This is not evidence that the image is AI-generated or manipulated. " +
      "Legitimate images often have metadata removed by websites, apps, or editing workflows."
    );
  }

  return (
    `${findings.join(". ")}. ` +
    "Metadata can describe how a file was created or processed, but it does not by itself prove whether the visual content is authentic or manipulated."
  );
}

async function analyzeImageRecord(record) {
  if (!record || !record.dataUrl) {
    showNoImageMessage();
    return;
  }

  fileName.textContent = record.name || "Selected image";

  const details = [];

  if (record.type) {
    details.push(record.type);
  }

  if (typeof record.size === "number") {
    details.push(formatFileSize(record.size));
  }

  fileDetails.textContent = details.join(" · ");

  const image = new Image();

  image.onload = async () => {
    previewContainer.innerHTML = "";
    previewContainer.appendChild(image);

    evidenceList.innerHTML = "";

    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "File characteristics",
        `Image dimensions: ${image.naturalWidth} × ${image.naturalHeight} pixels. ${
          record.type ? `File type: ${record.type}.` : ""
        }`
      )
    );

    let metadata;

    try {
      metadata = await inspectImageMetadata(
        record.dataUrl,
        record.type
      );

      evidenceList.appendChild(
        createEvidenceItem(
          metadata.aiIndicators.length > 0 ? "warning" : "info",
          "Metadata",
          buildMetadataDescription(metadata)
        )
      );

      if (metadata.aiIndicators.length > 0) {
        evidenceList.appendChild(
          createEvidenceItem(
            "warning",
            "AI-generation metadata indicator",
            `Explicit references associated with AI-generation software were found in the file: ${metadata.aiIndicators.join(
              ", "
            )}. This is a meaningful metadata indicator, but it should not be treated as standalone proof that the displayed image is AI-generated.`
          )
        );
      }
    } catch (error) {
      evidenceList.appendChild(
        createEvidenceItem(
          "neutral",
          "Metadata",
          "Media Shield could not complete the local metadata inspection for this file. No conclusion should be drawn from this."
        )
      );
    }

    evidenceList.appendChild(
      createEvidenceItem(
        "neutral",
        "Provenance",
        "Content Credentials and cryptographically verifiable provenance have not yet been checked. Absence of a provenance result does not mean the image is fake."
      )
    );

    if (metadata && metadata.aiIndicators.length > 0) {
      statusTitle.textContent = "Metadata indicator detected";

      statusDescription.textContent =
        "The file contains an explicit reference associated with AI-generation software. This warrants additional verification, but Media Shield does not treat metadata alone as proof that the image is AI-generated or manipulated.";
    } else {
      statusTitle.textContent = "Local inspection complete";

      statusDescription.textContent =
        "File characteristics and supported metadata markers were inspected locally. No conclusion about authenticity can be made from these checks alone.";
    }
  };

  image.onerror = () => {
    showNoImageMessage();

    statusTitle.textContent = "Image could not be read";
    statusDescription.textContent =
      "Media Shield could not safely read the selected image.";
  };

  image.src = record.dataUrl;
}

checkAnotherButton.addEventListener("click", () => {
  chrome.storage.local.remove("mediaShieldPendingImage", () => {
    window.location.href = "popup.html";
  });
});

chrome.storage.local.get(["mediaShieldPendingImage"], (result) => {
  analyzeImageRecord(result.mediaShieldPendingImage);
});
