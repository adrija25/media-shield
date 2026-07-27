const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");
const previewContainer = document.getElementById("previewContainer");
const statusTitle = document.getElementById("statusTitle");
const statusDescription = document.getElementById("statusDescription");
const evidenceList = document.getElementById("evidenceList");
const checkAnotherButton = document.getElementById("checkAnotherButton");

const VISUAL_ANALYSIS_API =
  "https://media-shield-analysis.adrijachoudhury25.workers.dev";

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

  evidenceList.appendChild(
    createEvidenceItem(
      "neutral",
      "No evidence available",
      "Select an image to begin a Media Shield check."
    )
  );
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

function buildProvenanceDescription(provenance) {
  if (!provenance) {
    return (
      "The provenance checker did not return a result. " +
      "No conclusion about authenticity should be drawn from this."
    );
  }

  if (provenance.error) {
    return (
      "Content Credentials could not be verified for this file. " +
      "This does not mean the image is fake or manipulated."
    );
  }

  if (provenance.hasManifest) {
    return (
      "Content Credentials or C2PA provenance information was detected. " +
      "Cryptographically verifiable provenance can provide useful information about the origin and editing history of supported media."
    );
  }

  return (
    "No C2PA Content Credentials were detected in this file. " +
    "Many legitimate images do not contain Content Credentials, so their absence is not evidence that an image is fake or manipulated."
  );
}

async function runProvenanceCheck(dataUrl) {
  const provenanceApi = window.MediaShieldProvenance;

  if (
    !provenanceApi ||
    typeof provenanceApi.inspectProvenance !== "function"
  ) {
    return {
      checked: false,
      hasManifest: false,
      manifestStore: null,
      error: "Provenance checker unavailable."
    };
  }

  try {
    return await provenanceApi.inspectProvenance(dataUrl);
  } catch (error) {
    return {
      checked: true,
      hasManifest: false,
      manifestStore: null,
      error:
        error instanceof Error
          ? error.message
          : "C2PA inspection could not be completed."
    };
  }
}

async function runVisualAnalysis(dataUrl) {
  try {
    const response = await fetch(
      VISUAL_ANALYSIS_API,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          image: dataUrl
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error(
        "The visual analysis service returned an unreadable response."
      );
    }

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Visual analysis could not be completed."
      );
    }

    if (
      typeof data.analysis !== "string" ||
      !data.analysis.trim()
    ) {
      throw new Error(
        "The visual analysis service returned no assessment."
      );
    }

    return {
      ok: true,
      analysis: data.analysis.trim(),
      error: null
    };
  } catch (error) {
    console.error(
      "Media Shield visual analysis error:",
      error
    );

    return {
      ok: false,
      analysis: "",
      error:
        error instanceof Error
          ? error.message
          : "Visual analysis could not be completed."
    };
  }
}

function getVisualIndicatorType(analysis) {
  const normalized =
    analysis.toLowerCase();

  if (
    normalized.includes(
      "assessment: strong indicators"
    ) ||
    normalized.includes(
      "assessment: some indicators"
    )
  ) {
    return "warning";
  }

  return "neutral";
}

function hasSuspiciousVisualIndicators(analysis) {
  const normalized =
    analysis.toLowerCase();

  return (
    normalized.includes(
      "assessment: strong indicators"
    ) ||
    normalized.includes(
      "assessment: some indicators"
    )
  );
}

async function analyzeImageRecord(record) {
  if (!record || !record.dataUrl) {
    showNoImageMessage();
    return;
  }

  fileName.textContent =
    record.name || "Selected image";

  const details = [];

  if (record.type) {
    details.push(record.type);
  }

  if (typeof record.size === "number") {
    details.push(
      formatFileSize(record.size)
    );
  }

  fileDetails.textContent =
    details.join(" · ");

  statusTitle.textContent =
    "Analysing image…";

  statusDescription.textContent =
    "Media Shield is inspecting file characteristics, metadata, provenance, and visual manipulation indicators.";

  const image = new Image();

  image.onload = async () => {
    previewContainer.innerHTML = "";
    previewContainer.appendChild(image);

    evidenceList.innerHTML = "";

    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "File characteristics",
        `Image dimensions: ${image.naturalWidth} × ${image.naturalHeight} pixels.${
          record.type
            ? ` File type: ${record.type}.`
            : ""
        }`
      )
    );

    let metadata = null;

    try {
      metadata =
        await inspectImageMetadata(
          record.dataUrl,
          record.type
        );

      evidenceList.appendChild(
        createEvidenceItem(
          metadata.aiIndicators.length > 0
            ? "warning"
            : "info",
          "Metadata",
          buildMetadataDescription(metadata)
        )
      );

      if (
        metadata.aiIndicators.length > 0
      ) {
        evidenceList.appendChild(
          createEvidenceItem(
            "warning",
            "AI-generation metadata indicator",
            `Explicit references associated with AI-generation software were found in the file: ${metadata.aiIndicators.join(
              ", "
            )}. This is a meaningful metadata indicator, but it should not be treated as standalone proof that the displayed image is AI-generated or manipulated.`
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

    statusDescription.textContent =
      "Media Shield is checking available Content Credentials and provenance.";

    const provenance =
      await runProvenanceCheck(
        record.dataUrl
      );

    evidenceList.appendChild(
      createEvidenceItem(
        provenance.hasManifest
          ? "info"
          : "neutral",
        "Provenance",
        buildProvenanceDescription(
          provenance
        )
      )
    );

    statusDescription.textContent =
      "Media Shield is examining the visible image for potential AI-generation or manipulation indicators.";

    const visualAnalysis =
      await runVisualAnalysis(
        record.dataUrl
      );

    if (visualAnalysis.ok) {
      evidenceList.appendChild(
        createEvidenceItem(
          getVisualIndicatorType(
            visualAnalysis.analysis
          ),
          "Visual manipulation analysis",
          visualAnalysis.analysis
        )
      );
    } else {
      evidenceList.appendChild(
        createEvidenceItem(
          "neutral",
          "Visual manipulation analysis",
          "The visual analysis service could not complete this check. No conclusion should be drawn from the missing result."
        )
      );
    }

    const aiMetadataDetected =
      metadata &&
      Array.isArray(
        metadata.aiIndicators
      ) &&
      metadata.aiIndicators.length > 0;

    const visualIndicatorsDetected =
      visualAnalysis.ok &&
      hasSuspiciousVisualIndicators(
        visualAnalysis.analysis
      );

    if (
      aiMetadataDetected ||
      visualIndicatorsDetected
    ) {
      statusTitle.textContent =
        "Potential manipulation indicators detected";

      statusDescription.textContent =
        "Media Shield found one or more indicators that may be consistent with AI generation, AI editing, or digital manipulation. These indicators warrant additional verification but are not proof that the image is manipulated.";

      return;
    }

    if (provenance.hasManifest) {
      statusTitle.textContent =
        "Content Credentials detected";

      statusDescription.textContent =
        "Media Shield found C2PA provenance information in this file and completed its available visual checks. Review all evidence together before deciding whether to trust the media.";

      return;
    }

    if (!visualAnalysis.ok) {
      statusTitle.textContent =
        "Partial analysis complete";

      statusDescription.textContent =
        "Media Shield completed the local metadata and provenance checks, but visual-content analysis was unavailable. No authenticity conclusion can be made.";

      return;
    }

    statusTitle.textContent =
      "Available checks complete";

    statusDescription.textContent =
      "Media Shield inspected file characteristics, supported metadata, available Content Credentials, and visible manipulation indicators. No single check can prove that an image is authentic or manipulated.";
  };

  image.onerror = () => {
    previewContainer.innerHTML =
      "<p>The selected image could not be displayed.</p>";

    evidenceList.innerHTML = "";

    evidenceList.appendChild(
      createEvidenceItem(
        "neutral",
        "Image reading",
        "Media Shield could not safely read the selected image. No analysis result is available."
      )
    );

    statusTitle.textContent =
      "Image could not be read";

    statusDescription.textContent =
      "Media Shield could not safely read the selected image.";
  };

  image.src = record.dataUrl;
}

if (checkAnotherButton) {
  checkAnotherButton.addEventListener(
    "click",
    () => {
      chrome.storage.local.remove(
        "mediaShieldPendingImage",
        () => {
          window.location.href =
            "popup.html";
        }
      );
    }
  );
}

chrome.storage.local.get(
  ["mediaShieldPendingImage"],
  (result) => {
    if (chrome.runtime.lastError) {
      statusTitle.textContent =
        "Image could not be accessed";

      statusDescription.textContent =
        "Media Shield could not access the selected image.";

      return;
    }

    analyzeImageRecord(
      result.mediaShieldPendingImage
    );
  }
);
