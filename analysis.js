const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");
const previewContainer = document.getElementById("previewContainer");
const statusTitle = document.getElementById("statusTitle");
const statusDescription = document.getElementById("statusDescription");
const evidenceList = document.getElementById("evidenceList");
const checkAnotherButton = document.getElementById("checkAnotherButton");

const VISUAL_ANALYSIS_API =
  "https://media-shield-analysis.adrijachoudhury25.workers.dev/";

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

    if (
      !response.ok ||
      !data.ok ||
      typeof data.analysis !== "string"
    ) {
      throw new Error(
        data.error ||
        "Visual analysis could not be completed."
      );
    }

    return {
      ok: true,
      analysis: data.analysis
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

function parseVisualAnalysis(rawAnalysis) {
  const result = {
    assessment: "Inconclusive",
    summary: "",
    indicators: [],
    limitation:
      "Visual inspection alone cannot prove whether an image is authentic, AI-generated, AI-edited, or otherwise manipulated."
  };

  if (
    typeof rawAnalysis !== "string" ||
    !rawAnalysis.trim()
  ) {
    return result;
  }

  const cleaned = rawAnalysis.trim();

  const assessmentMatch = cleaned.match(
    /ASSESSMENT:\s*(.+?)(?=\n|SUMMARY:|$)/i
  );

  if (assessmentMatch) {
    result.assessment =
      assessmentMatch[1].trim();
  }

  const summaryMatch = cleaned.match(
    /SUMMARY:\s*([\s\S]*?)(?=\n\s*INDICATORS:|INDICATORS:|$)/i
  );

  if (summaryMatch) {
    result.summary =
      summaryMatch[1]
        .replace(/\s+/g, " ")
        .trim();
  }

  const indicatorsMatch = cleaned.match(
    /INDICATORS:\s*([\s\S]*?)(?=\n\s*LIMITATION:|LIMITATION:|$)/i
  );

  if (indicatorsMatch) {
    result.indicators =
      indicatorsMatch[1]
        .split("\n")
        .map((line) =>
          line
            .replace(/^\s*[-•]\s*/, "")
            .trim()
        )
        .filter(Boolean);
  }

  const limitationMatch = cleaned.match(
    /LIMITATION:\s*([\s\S]*?)$/i
  );

  if (limitationMatch) {
    const limitation =
      limitationMatch[1]
        .replace(/\s+/g, " ")
        .trim();

    if (limitation) {
      result.limitation = limitation;
    }
  }

  return result;
}

function normaliseAssessment(assessment) {
  const value =
    String(assessment || "")
      .toLowerCase()
      .trim();

  if (value.includes("strong")) {
    return "strong";
  }

  if (value.includes("some")) {
    return "some";
  }

  if (value.includes("low")) {
    return "low";
  }

  return "inconclusive";
}

function addVisualAnalysisEvidence(parsedAnalysis) {
  const assessmentType =
    normaliseAssessment(
      parsedAnalysis.assessment
    );

  let indicatorType = "neutral";

  if (
    assessmentType === "some" ||
    assessmentType === "strong"
  ) {
    indicatorType = "warning";
  } else if (assessmentType === "low") {
    indicatorType = "info";
  }

  evidenceList.appendChild(
    createEvidenceItem(
      indicatorType,
      "Visual manipulation analysis",
      parsedAnalysis.summary ||
        "The visual analysis did not provide a summary."
    )
  );

  if (parsedAnalysis.indicators.length > 0) {
    parsedAnalysis.indicators.forEach(
      (indicatorText) => {
        evidenceList.appendChild(
          createEvidenceItem(
            indicatorType,
            "Visual indicator",
            indicatorText
          )
        );
      }
    );
  }

  evidenceList.appendChild(
    createEvidenceItem(
      "neutral",
      "Visual-analysis limitation",
      parsedAnalysis.limitation
    )
  );

  return assessmentType;
}

function updateFinalStatus(
  aiMetadataDetected,
  provenance,
  visualResult
) {
  if (aiMetadataDetected) {
    statusTitle.textContent =
      "Potential manipulation indicators detected";

    statusDescription.textContent =
      "Media Shield found one or more indicators that may be consistent with AI generation, AI editing, or digital manipulation. These indicators warrant additional verification but are not proof that the image is manipulated.";

    return;
  }

  if (
    visualResult === "some" ||
    visualResult === "strong"
  ) {
    statusTitle.textContent =
      "Potential manipulation indicators detected";

    statusDescription.textContent =
      "Media Shield found one or more indicators that may be consistent with AI generation, AI editing, or digital manipulation. These indicators warrant additional verification but are not proof that the image is manipulated.";

    return;
  }

  if (visualResult === "low") {
    statusTitle.textContent =
      "No strong manipulation indicators detected";

    statusDescription.textContent =
      "The available checks did not identify strong indicators of AI generation or manipulation. This does not establish that the image is authentic or unedited.";

    return;
  }

  if (provenance?.hasManifest) {
    statusTitle.textContent =
      "Content Credentials detected";

    statusDescription.textContent =
      "Media Shield found C2PA provenance information in this file. Review the provenance information together with the other available evidence.";

    return;
  }

  statusTitle.textContent =
    "Analysis inconclusive";

  statusDescription.textContent =
    "Media Shield completed the available checks, but the evidence does not support a reliable conclusion about whether the image is authentic, AI-generated, AI-edited, or otherwise manipulated.";
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
    "Media Shield is examining locally available file evidence, metadata, provenance, and visible image characteristics.";

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
      console.error(
        "Metadata inspection error:",
        error
      );

      evidenceList.appendChild(
        createEvidenceItem(
          "neutral",
          "Metadata",
          "Media Shield could not complete the local metadata inspection for this file. No conclusion should be drawn from this."
        )
      );
    }

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

    statusTitle.textContent =
      "Analysing image…";

    statusDescription.textContent =
      "Media Shield is examining the visible image for potential AI-generation or manipulation indicators.";

    const visualAnalysis =
      await runVisualAnalysis(
        record.dataUrl
      );

    let visualResult =
      "inconclusive";

    if (visualAnalysis.ok) {
      const parsedAnalysis =
        parseVisualAnalysis(
          visualAnalysis.analysis
        );

      visualResult =
        addVisualAnalysisEvidence(
          parsedAnalysis
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

    updateFinalStatus(
      aiMetadataDetected,
      provenance,
      visualResult
    );
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
