const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");
const previewContainer = document.getElementById("previewContainer");
const statusTitle = document.getElementById("statusTitle");
const statusDescription = document.getElementById("statusDescription");
const evidenceList = document.getElementById("evidenceList");
const checkAnotherButton = document.getElementById("checkAnotherButton");

const VISUAL_ANALYSIS_API =
  "https://media-shield-analysis.adrijachoudhury25.workers.dev/";


/*
  ============================================================
  PRO STATUS
  ============================================================
*/


function getProStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "mediaShieldProActive",
        "mediaShieldProToken",
        "mediaShieldProProduct",
        "mediaShieldProOffer"
      ],
      (result) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Could not read Media Shield Pro status:",
            chrome.runtime.lastError
          );

          resolve(false);
          return;
        }

        const isPro =
          result.mediaShieldProActive === true &&
          typeof result.mediaShieldProToken === "string" &&
          result.mediaShieldProToken.trim().length > 0 &&
          (
            !result.mediaShieldProProduct ||
            result.mediaShieldProProduct === "media-shield"
          ) &&
          (
            !result.mediaShieldProOffer ||
            result.mediaShieldProOffer === "pro"
          );

        resolve(isPro);
      }
    );
  });
}


/*
  ============================================================
  GENERAL HELPERS
  ============================================================
*/


function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


function createEvidenceItem(
  type,
  title,
  description
) {
  const article =
    document.createElement("article");

  article.className =
    "evidence-item";

  const indicator =
    document.createElement("div");

  indicator.className =
    `indicator ${type}`;

  const content =
    document.createElement("div");

  const heading =
    document.createElement("h4");

  heading.textContent =
    title;

  const text =
    document.createElement("p");

  text.textContent =
    description;

  content.appendChild(
    heading
  );

  content.appendChild(
    text
  );

  article.appendChild(
    indicator
  );

  article.appendChild(
    content
  );

  return article;
}


function showNoImageMessage() {
  previewContainer.innerHTML =
    "<p>No image is currently available for analysis.</p>";

  fileName.textContent =
    "No image selected";

  fileDetails.textContent =
    "";

  statusTitle.textContent =
    "No analysis available";

  statusDescription.textContent =
    "Return to Media Shield and select an image to begin a check.";

  evidenceList.innerHTML =
    "";

  evidenceList.appendChild(
    createEvidenceItem(
      "neutral",
      "No evidence available",
      "Select an image to begin a Media Shield check."
    )
  );
}


/*
  ============================================================
  IMAGE RELIABILITY
  ============================================================
*/


function assessImageReliability(
  image
) {
  const width =
    Number(
      image?.naturalWidth || 0
    );

  const height =
    Number(
      image?.naturalHeight || 0
    );

  const result = {
    level: "good",
    width,
    height,
    pixelCount:
      width * height,
    aspectRatio:
      0,
    reasons: []
  };

  if (
    !width ||
    !height
  ) {
    result.level =
      "limited";

    result.reasons.push(
      "Image dimensions could not be determined."
    );

    return result;
  }

  result.aspectRatio =
    Math.max(
      width,
      height
    ) /
    Math.min(
      width,
      height
    );


  /*
    Low-resolution images.
  */

  if (
    width < 400 ||
    height < 400
  ) {
    result.level =
      "limited";

    result.reasons.push(
      "The image has relatively low pixel dimensions."
    );
  }


  /*
    Very small total image area.
  */

  if (
    result.pixelCount < 250000
  ) {
    result.level =
      "limited";

    if (
      !result.reasons.includes(
        "The image has relatively low pixel dimensions."
      )
    ) {
      result.reasons.push(
        "The total available pixel area is limited."
      );
    }
  }


  /*
    Extremely unusual aspect ratio.

    This is a caution, not a manipulation signal.
  */

  if (
    result.aspectRatio > 5
  ) {
    if (
      result.level === "good"
    ) {
      result.level =
        "caution";
    }

    result.reasons.push(
      "The image has an unusually wide or tall aspect ratio."
    );
  }

  return result;
}


function buildReliabilityDescription(
  reliability
) {
  if (
    reliability.level === "limited"
  ) {
    return (
      "The image has limited visual detail for forensic inspection. " +
      "Visual-analysis results should be treated with additional caution. " +
      "Limited image quality is not itself evidence of manipulation."
    );
  }

  if (
    reliability.level === "caution"
  ) {
    return (
      "The image has an unusual visual format that may make some visual characteristics harder to interpret. " +
      "This is not itself evidence of manipulation."
    );
  }

  return (
    "The image provides sufficient basic visual detail for the available visual analysis. " +
    "This does not guarantee that subtle manipulation or AI generation can be detected."
  );
}


function addReliabilityEvidence(
  reliability
) {
  let type =
    "info";

  if (
    reliability.level === "limited"
  ) {
    type =
      "warning";
  }

  if (
    reliability.level === "caution"
  ) {
    type =
      "neutral";
  }

  evidenceList.appendChild(
    createEvidenceItem(
      type,
      "Visual-analysis conditions",
      buildReliabilityDescription(
        reliability
      )
    )
  );
}


/*
  ============================================================
  METADATA
  ============================================================
*/


function buildMetadataDescription(
  metadata
) {
  const findings = [];

  if (
    metadata.hasExif
  ) {
    findings.push(
      "EXIF metadata container detected"
    );
  }

  if (
    metadata.hasXmp
  ) {
    findings.push(
      "XMP metadata detected"
    );
  }

  if (
    metadata.hasIccProfile
  ) {
    findings.push(
      "ICC colour profile detected"
    );
  }

  if (
    metadata.hasPhotoshopResource
  ) {
    findings.push(
      "Photoshop resource metadata detected"
    );
  }

  if (
    metadata.softwareIndicators.length > 0
  ) {
    findings.push(
      `Software references found: ${metadata.softwareIndicators.join(", ")}`
    );
  }

  if (
    metadata.comments.length > 0
  ) {
    findings.push(
      "Embedded JPEG comment data detected"
    );
  }

  if (
    findings.length === 0
  ) {
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


/*
  ============================================================
  PROVENANCE
  ============================================================
*/


function buildProvenanceDescription(
  provenance
) {
  if (!provenance) {
    return (
      "The provenance checker did not return a result. " +
      "No conclusion about authenticity should be drawn from this."
    );
  }

  if (
    provenance.error
  ) {
    return (
      "Content Credentials could not be verified for this file. " +
      "This does not mean the image is fake or manipulated."
    );
  }

  if (
    provenance.hasManifest
  ) {
    return (
      "Content Credentials or C2PA provenance information was detected. " +
      "Available provenance details are shown when they can be read from the credential."
    );
  }

  return (
    "No C2PA Content Credentials were detected in this file. " +
    "Many legitimate images do not contain Content Credentials, so their absence is not evidence that an image is fake or manipulated."
  );
}


function safeString(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function getFirstString(
  object,
  keys
) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return "";
  }

  for (
    const key of keys
  ) {
    const value =
      safeString(
        object[key]
      );

    if (
      value
    ) {
      return value;
    }
  }

  return "";
}


function getActiveManifest(
  manifestStore
) {
  if (
    !manifestStore ||
    typeof manifestStore !== "object"
  ) {
    return null;
  }

  if (
    manifestStore.active_manifest &&
    typeof manifestStore.active_manifest === "object"
  ) {
    return manifestStore.active_manifest;
  }

  if (
    manifestStore.activeManifest &&
    typeof manifestStore.activeManifest === "object"
  ) {
    return manifestStore.activeManifest;
  }

  if (
    manifestStore.active &&
    typeof manifestStore.active === "object"
  ) {
    return manifestStore.active;
  }

  return null;
}


function getManifestFromMap(
  manifestStore,
  activeManifest
) {
  if (
    !manifestStore ||
    typeof manifestStore !== "object"
  ) {
    return activeManifest;
  }

  const manifests =
    manifestStore.manifests;

  if (
    !manifests ||
    typeof manifests !== "object"
  ) {
    return activeManifest;
  }

  const activeLabel =
    getFirstString(
      manifestStore,
      [
        "active_manifest",
        "activeManifest"
      ]
    );

  if (
    activeLabel &&
    manifests[activeLabel] &&
    typeof manifests[activeLabel] === "object"
  ) {
    return manifests[activeLabel];
  }

  if (
    activeManifest
  ) {
    return activeManifest;
  }

  const keys =
    Object.keys(
      manifests
    );

  if (
    keys.length === 1
  ) {
    const onlyManifest =
      manifests[keys[0]];

    if (
      onlyManifest &&
      typeof onlyManifest === "object"
    ) {
      return onlyManifest;
    }
  }

  return null;
}


function extractProvenanceDetails(
  provenance
) {
  const details = {
    available: false,
    claimGenerator: "",
    title: "",
    format: "",
    instanceId: "",
    actions: [],
    ingredients: [],
    validation: ""
  };

  if (
    !provenance ||
    !provenance.manifestStore ||
    typeof provenance.manifestStore !== "object"
  ) {
    return details;
  }

  const manifestStore =
    provenance.manifestStore;

  const activeManifest =
    getActiveManifest(
      manifestStore
    );

  const manifest =
    getManifestFromMap(
      manifestStore,
      activeManifest
    ) ||
    activeManifest;

  if (
    !manifest
  ) {
    return details;
  }

  details.available =
    true;

  details.claimGenerator =
    getFirstString(
      manifest,
      [
        "claim_generator",
        "claimGenerator"
      ]
    );

  if (
    !details.claimGenerator &&
    manifest.claim
  ) {
    details.claimGenerator =
      getFirstString(
        manifest.claim,
        [
          "claim_generator",
          "claimGenerator"
        ]
      );
  }

  details.title =
    getFirstString(
      manifest,
      [
        "title",
        "name"
      ]
    );

  details.format =
    getFirstString(
      manifest,
      [
        "format",
        "media_type",
        "mediaType"
      ]
    );

  details.instanceId =
    getFirstString(
      manifest,
      [
        "instance_id",
        "instanceId"
      ]
    );

  const actionCandidates = [];

  if (
    Array.isArray(
      manifest.actions
    )
  ) {
    actionCandidates.push(
      ...manifest.actions
    );
  }

  if (
    Array.isArray(
      manifest.claim?.actions
    )
  ) {
    actionCandidates.push(
      ...manifest.claim.actions
    );
  }

  actionCandidates.forEach(
    (action) => {
      if (
        typeof action === "string"
      ) {
        const value =
          safeString(
            action
          );

        if (
          value &&
          !details.actions.includes(
            value
          )
        ) {
          details.actions.push(
            value
          );
        }

        return;
      }

      if (
        !action ||
        typeof action !== "object"
      ) {
        return;
      }

      const value =
        getFirstString(
          action,
          [
            "action",
            "name",
            "type"
          ]
        );

      if (
        value &&
        !details.actions.includes(
          value
        )
      ) {
        details.actions.push(
          value
        );
      }
    }
  );

  const ingredientCandidates = [];

  if (
    Array.isArray(
      manifest.ingredients
    )
  ) {
    ingredientCandidates.push(
      ...manifest.ingredients
    );
  }

  if (
    Array.isArray(
      manifest.claim?.ingredients
    )
  ) {
    ingredientCandidates.push(
      ...manifest.claim.ingredients
    );
  }

  ingredientCandidates.forEach(
    (ingredient) => {
      if (
        typeof ingredient === "string"
      ) {
        const value =
          safeString(
            ingredient
          );

        if (
          value &&
          !details.ingredients.includes(
            value
          )
        ) {
          details.ingredients.push(
            value
          );
        }

        return;
      }

      if (
        !ingredient ||
        typeof ingredient !== "object"
      ) {
        return;
      }

      const value =
        getFirstString(
          ingredient,
          [
            "title",
            "name",
            "format",
            "document_id",
            "documentId",
            "instance_id",
            "instanceId"
          ]
        );

      if (
        value &&
        !details.ingredients.includes(
          value
        )
      ) {
        details.ingredients.push(
          value
        );
      }
    }
  );

  const validationCandidates = [
    manifest.validation_status,
    manifest.validationStatus,
    manifestStore.validation_status,
    manifestStore.validationStatus
  ];

  for (
    const candidate of
    validationCandidates
  ) {
    const value =
      safeString(
        candidate
      );

    if (
      value
    ) {
      details.validation =
        value;

      break;
    }
  }

  return details;
}


function addProvenanceEvidence(
  provenance
) {
  if (
    !provenance ||
    !provenance.hasManifest ||
    provenance.error
  ) {
    return;
  }

  const details =
    extractProvenanceDetails(
      provenance
    );

  if (
    !details.available
  ) {
    return;
  }

  const summaryParts = [];

  if (
    details.claimGenerator
  ) {
    summaryParts.push(
      `Claim generator: ${details.claimGenerator}`
    );
  }

  if (
    details.title
  ) {
    summaryParts.push(
      `Title: ${details.title}`
    );
  }

  if (
    details.format
  ) {
    summaryParts.push(
      `Format: ${details.format}`
    );
  }

  if (
    details.validation
  ) {
    summaryParts.push(
      `Validation information: ${details.validation}`
    );
  }

  if (
    summaryParts.length > 0
  ) {
    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "Content Credentials details",
        `${summaryParts.join(". ")}.`
      )
    );
  }

  if (
    details.actions.length > 0
  ) {
    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "Recorded actions",
        details.actions.join(" · ")
      )
    );
  }

  if (
    details.ingredients.length > 0
  ) {
    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "Referenced ingredients",
        details.ingredients.join(" · ")
      )
    );
  }

  if (
    details.instanceId
  ) {
    evidenceList.appendChild(
      createEvidenceItem(
        "info",
        "Credential instance",
        details.instanceId
      )
    );
  }
}


async function runProvenanceCheck(
  dataUrl
) {
  const provenanceApi =
    window.MediaShieldProvenance;

  if (
    !provenanceApi ||
    typeof provenanceApi.inspectProvenance !== "function"
  ) {
    return {
      checked: false,
      hasManifest: false,
      manifestStore: null,
      error:
        "Provenance checker unavailable."
    };
  }

  try {
    return await provenanceApi.inspectProvenance(
      dataUrl
    );
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


/*
  ============================================================
  PRO VISUAL ANALYSIS
  ============================================================
*/


async function getStoredProCredentials() {
  return new Promise(
    (resolve, reject) => {
      chrome.storage.local.get(
        [
          "mediaShieldProToken",
          "mediaShieldInstallationId"
        ],
        (result) => {
          if (
            chrome.runtime.lastError
          ) {
            reject(
              chrome.runtime.lastError
            );

            return;
          }

          resolve(
            result
          );
        }
      );
    }
  );
}


async function runVisualAnalysis(
  dataUrl
) {
  try {
    const stored =
      await getStoredProCredentials();

    const token =
      typeof stored.mediaShieldProToken ===
        "string"
        ? stored.mediaShieldProToken.trim()
        : "";

    const installationId =
      typeof stored.mediaShieldInstallationId ===
        "string"
        ? stored.mediaShieldInstallationId.trim()
        : "";

    if (
      !token ||
      !installationId
    ) {
      throw new Error(
        "Media Shield Pro authorisation information is unavailable. Please activate Media Shield Pro again."
      );
    }

    const response =
      await fetch(
        VISUAL_ANALYSIS_API,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              image:
                dataUrl,

              token:
                token,

              installationId:
                installationId
            })
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch (error) {
      throw new Error(
        "The visual analysis service returned an unreadable response."
      );
    }

    if (
      !response.ok ||
      !data.ok ||
      data.authorised !== true ||
      typeof data.analysis !== "string"
    ) {
      throw new Error(
        data.error ||
        "Visual analysis could not be completed."
      );
    }

    const analysis =
      data.analysis.trim();

    if (
      !analysis
    ) {
      throw new Error(
        "The visual analysis service returned no usable analysis."
      );
    }

    return {
      ok: true,
      analysis
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


/*
  ============================================================
  PARSE VISUAL ANALYSIS
  ============================================================
*/


function parseVisualAnalysis(
  rawAnalysis
) {
  const result = {
    assessment:
      "Inconclusive",

    summary:
      "",

    indicators:
      [],

    limitation:
      "Visual inspection alone cannot prove whether an image is authentic, AI-generated, AI-edited, or otherwise manipulated."
  };

  if (
    typeof rawAnalysis !== "string" ||
    !rawAnalysis.trim()
  ) {
    return result;
  }

  const cleaned =
    rawAnalysis.trim();

  const assessmentMatch =
    cleaned.match(
      /ASSESSMENT:\s*(.+?)(?=\n|SUMMARY:|$)/i
    );

  if (
    assessmentMatch
  ) {
    result.assessment =
      assessmentMatch[1].trim();
  }

  const summaryMatch =
    cleaned.match(
      /SUMMARY:\s*([\s\S]*?)(?=\n\s*INDICATORS:|INDICATORS:|$)/i
    );

  if (
    summaryMatch
  ) {
    result.summary =
      summaryMatch[1]
        .replace(
          /\s+/g,
          " "
        )
        .trim();
  }

  const indicatorsMatch =
    cleaned.match(
      /INDICATORS:\s*([\s\S]*?)(?=\n\s*LIMITATION:|LIMITATION:|$)/i
    );

  if (
    indicatorsMatch
  ) {
    result.indicators =
      indicatorsMatch[1]
        .split("\n")
        .map(
          (line) =>
            line
              .replace(
                /^\s*[-•]\s*/,
                ""
              )
              .trim()
        )
        .filter(Boolean);
  }

  const limitationMatch =
    cleaned.match(
      /LIMITATION:\s*([\s\S]*?)$/i
    );

  if (
    limitationMatch
  ) {
    const limitation =
      limitationMatch[1]
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (
      limitation
    ) {
      result.limitation =
        limitation;
    }
  }

  return result;
}


function normaliseAssessment(
  assessment
) {
  const value =
    String(
      assessment || ""
    )
      .toLowerCase()
      .trim()
      .replace(
        /[.!:;]+$/g,
        ""
      );

  if (
    value === "strong indicators"
  ) {
    return "strong";
  }

  if (
    value === "some indicators"
  ) {
    return "some";
  }

  if (
    value === "low indicators"
  ) {
    return "low";
  }

  return "inconclusive";
}


/*
  ============================================================
  VISUAL EVIDENCE
  ============================================================
*/


function addVisualAnalysisEvidence(
  parsedAnalysis
) {
  const assessmentType =
    normaliseAssessment(
      parsedAnalysis.assessment
    );

  let indicatorType =
    "neutral";

  if (
    assessmentType === "some" ||
    assessmentType === "strong"
  ) {
    indicatorType =
      "warning";
  } else if (
    assessmentType === "low"
  ) {
    indicatorType =
      "info";
  }

  evidenceList.appendChild(
    createEvidenceItem(
      indicatorType,
      "Pro visual manipulation analysis",
      parsedAnalysis.summary ||
        "The visual analysis did not provide a summary."
    )
  );

  if (
    parsedAnalysis.indicators.length >
    0
  ) {
    const article =
      document.createElement(
        "article"
      );

    article.className =
      "evidence-item";

    const indicator =
      document.createElement(
        "div"
      );

    indicator.className =
      `indicator ${indicatorType}`;

    const content =
      document.createElement(
        "div"
      );

    const heading =
      document.createElement(
        "h4"
      );

    heading.textContent =
      "Visual indicators";

    const list =
      document.createElement(
        "ul"
      );

    parsedAnalysis.indicators.forEach(
      (indicatorText) => {
        const item =
          document.createElement(
            "li"
          );

        item.textContent =
          indicatorText;

        list.appendChild(
          item
        );
      }
    );

    content.appendChild(
      heading
    );

    content.appendChild(
      list
    );

    article.appendChild(
      indicator
    );

    article.appendChild(
      content
    );

    evidenceList.appendChild(
      article
    );

  } else {
    evidenceList.appendChild(
      createEvidenceItem(
        "neutral",
        "Visual indicators",
        "No specific visual indicators were returned by the analysis."
      )
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


/*
  ============================================================
  EVIDENCE-AWARE FINAL ASSESSMENT
  ============================================================
*/


function buildEvidenceProfile(
  metadata,
  provenance,
  visualResult,
  reliability,
  visualAnalysisAvailable
) {
  const profile = {
    metadataSignal:
      "none",

    provenanceSignal:
      provenance?.hasManifest
        ? "present"
        : "none",

    visualSignal:
      visualAnalysisAvailable
        ? visualResult
        : "unavailable",

    reliability:
      reliability?.level ||
      "unknown",

    hasAiMetadata:
      Boolean(
        metadata &&
        Array.isArray(
          metadata.aiIndicators
        ) &&
        metadata.aiIndicators.length > 0
      ),

    hasProvenance:
      Boolean(
        provenance &&
        provenance.hasManifest
      )
  };

  if (
    profile.hasAiMetadata
  ) {
    profile.metadataSignal =
      "ai-indicator";
  } else if (
    metadata &&
    (
      metadata.hasExif ||
      metadata.hasXmp ||
      metadata.hasPhotoshopResource ||
      metadata.softwareIndicators.length > 0
    )
  ) {
    profile.metadataSignal =
      "general";
  }

  return profile;
}


function determineFinalAssessment(
  profile
) {
  /*
    Strong visual result is meaningful, but is still described
    as an indicator rather than proof.
  */

  if (
    profile.visualSignal === "strong"
  ) {
    return "potential";
  }

  /*
    Some visual indicators combined with explicit AI metadata
    strengthen the overall concern.
  */

  if (
    profile.visualSignal === "some" &&
    profile.hasAiMetadata
  ) {
    return "potential";
  }

  /*
    Explicit AI metadata alone is a meaningful signal, but not
    proof of what happened to the visible image.
  */

  if (
    profile.hasAiMetadata
  ) {
    return "metadata";
  }

  /*
    Some visual indicators on their own remain potential
    indicators.
  */

  if (
    profile.visualSignal === "some"
  ) {
    return "potential";
  }

  /*
    A limited-quality image must not receive a strong negative
    interpretation from a low visual result.
  */

  if (
    profile.visualSignal === "low" &&
    profile.reliability === "limited"
  ) {
    return "limited";
  }

  /*
    Low visual indicators with no contradictory signal.
  */

  if (
    profile.visualSignal === "low"
  ) {
    return "no-strong";
  }

  /*
    Provenance is informative, but its presence does not mean
    the image is authentic and its absence does not mean it is
    fake.
  */

  if (
    profile.hasProvenance
  ) {
    return "provenance";
  }

  return "inconclusive";
}


function buildWhatThisMeans(
  finalAssessment,
  profile
) {
  if (
    finalAssessment === "potential"
  ) {
    return (
      "Media Shield found visual characteristics that may be consistent with AI generation, AI editing, compositing, retouching, or other digital manipulation. " +
      "These are indicators rather than proof, so the original source and surrounding context should be checked before relying on the image."
    );
  }

  if (
    finalAssessment === "metadata"
  ) {
    return (
      "Media Shield found an explicit metadata reference associated with AI-generation software. " +
      "This can be useful evidence about the file's processing history, but metadata alone cannot establish what happened to the visible image."
    );
  }

  if (
    finalAssessment === "limited"
  ) {
    return (
      "Media Shield did not identify strong manipulation indicators, but the image provides limited visual detail. " +
      "The absence of strong findings should therefore not be interpreted as evidence that the image is authentic."
    );
  }

  if (
    finalAssessment === "no-strong"
  ) {
    return (
      "The available checks did not identify strong indicators of AI generation or manipulation. " +
      "This does not establish that the image is authentic, because subtle manipulation can remain undetectable and evidence may be absent from the file."
    );
  }

  if (
    finalAssessment === "provenance"
  ) {
    return (
      "Media Shield detected Content Credentials associated with the image. " +
      "These credentials can provide useful information about provenance and recorded actions, but their presence should be considered alongside the other evidence."
    );
  }

  return (
    "The available evidence does not support a reliable conclusion about whether the image is authentic, AI-generated, AI-edited, or otherwise manipulated."
  );
}


function addWhatThisMeansEvidence(
  finalAssessment,
  profile
) {
  evidenceList.appendChild(
    createEvidenceItem(
      finalAssessment === "potential" ||
        finalAssessment === "metadata"
        ? "warning"
        : "info",
      "What this means",
      buildWhatThisMeans(
        finalAssessment,
        profile
      )
    )
  );
}


function updateFinalStatus(
  finalAssessment
) {
  if (
    finalAssessment === "potential"
  ) {
    statusTitle.textContent =
      "Potential manipulation indicators detected";

    statusDescription.textContent =
      "Media Shield found one or more signals that may be consistent with AI generation, AI editing, or digital manipulation. These signals are not proof.";
    return;
  }

  if (
    finalAssessment === "metadata"
  ) {
    statusTitle.textContent =
      "AI-related metadata indicator detected";

    statusDescription.textContent =
      "The file contains an explicit metadata reference associated with AI-generation software. This is a meaningful file-level signal, but it is not proof of the visible image's origin.";
    return;
  }

  if (
    finalAssessment === "limited"
  ) {
    statusTitle.textContent =
      "Evidence is limited";

    statusDescription.textContent =
      "No strong manipulation indicators were identified, but the image does not provide enough visual detail for a confident negative assessment.";
    return;
  }

  if (
    finalAssessment === "no-strong"
  ) {
    statusTitle.textContent =
      "No strong manipulation indicators detected";

    statusDescription.textContent =
      "The available checks did not identify strong indicators of AI generation or manipulation. This does not prove that the image is authentic or unedited.";
    return;
  }

  if (
    finalAssessment === "provenance"
  ) {
    statusTitle.textContent =
      "Content Credentials detected";

    statusDescription.textContent =
      "Media Shield found C2PA provenance information in this file. Review the recorded provenance together with the other available evidence.";
    return;
  }

  statusTitle.textContent =
    "Analysis inconclusive";

  statusDescription.textContent =
    "Media Shield completed the available checks, but the evidence does not support a reliable conclusion about whether the image is authentic, AI-generated, AI-edited, or otherwise manipulated.";
}


/*
  ============================================================
  FREE RESULT
  ============================================================
*/


function updateFreeFinalStatus(
  aiMetadataDetected,
  provenance
) {
  if (
    aiMetadataDetected
  ) {
    statusTitle.textContent =
      "AI-related metadata indicator detected";

    statusDescription.textContent =
      "Media Shield found an explicit metadata reference associated with AI-generation software. Metadata alone is not proof that the image is AI-generated or manipulated.";

    return;
  }

  if (
    provenance?.hasManifest
  ) {
    statusTitle.textContent =
      "Content Credentials detected";

    statusDescription.textContent =
      "Media Shield found C2PA provenance information in this file. Free analysis does not include Pro visual manipulation analysis.";

    return;
  }

  statusTitle.textContent =
    "Free checks complete";

  statusDescription.textContent =
    "Media Shield completed the available file, metadata, and provenance checks. Upgrade to Media Shield Pro for visual AI-generation and manipulation analysis.";
}


/*
  ============================================================
  IMAGE ANALYSIS
  ============================================================
*/


async function analyzeImageRecord(
  record
) {
  if (
    !record ||
    !record.dataUrl
  ) {
    showNoImageMessage();
    return;
  }

  const isPro =
    await getProStatus();

  fileName.textContent =
    record.name ||
    "Selected image";

  const details = [];

  if (
    record.type
  ) {
    details.push(
      record.type
    );
  }

  if (
    typeof record.size === "number"
  ) {
    details.push(
      formatFileSize(
        record.size
      )
    );
  }

  fileDetails.textContent =
    details.join(" · ");

  statusTitle.textContent =
    "Analysing image…";

  statusDescription.textContent =
    isPro
      ? "Media Shield Pro is examining file evidence, metadata, provenance, image quality, and visible image characteristics."
      : "Media Shield is examining locally available file evidence, metadata, and provenance.";

  const image =
    new Image();

  image.onload =
    async () => {
      previewContainer.innerHTML =
        "";

      previewContainer.appendChild(
        image
      );

      evidenceList.innerHTML =
        "";


      /*
        ======================================================
        FILE CHARACTERISTICS
        ======================================================
      */

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


      /*
        ======================================================
        VISUAL RELIABILITY
        ======================================================
      */

      const reliability =
        assessImageReliability(
          image
        );

      addReliabilityEvidence(
        reliability
      );


      /*
        ======================================================
        METADATA
        ======================================================
      */

      let metadata =
        null;

      try {
        metadata =
          await inspectImageMetadata(
            record.dataUrl,
            record.type
          );

        evidenceList.appendChild(
          createEvidenceItem(
            metadata.aiIndicators.length >
              0
              ? "warning"
              : "info",
            "Metadata",
            buildMetadataDescription(
              metadata
            )
          )
        );

        if (
          metadata.aiIndicators.length >
          0
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

        metadata = {
          hasExif: false,
          hasXmp: false,
          hasIccProfile: false,
          hasPhotoshopResource: false,
          comments: [],
          softwareIndicators: [],
          aiIndicators: []
        };
      }


      /*
        ======================================================
        PROVENANCE
        ======================================================
      */

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

      if (
        provenance.hasManifest &&
        !provenance.error
      ) {
        addProvenanceEvidence(
          provenance
        );
      }


      /*
        ======================================================
        AI METADATA FLAG
        ======================================================
      */

      const aiMetadataDetected =
        Array.isArray(
          metadata?.aiIndicators
        ) &&
        metadata.aiIndicators.length >
          0;


      /*
        ======================================================
        FREE USER
        ======================================================
      */

      if (
        !isPro
      ) {
        evidenceList.appendChild(
          createEvidenceItem(
            "neutral",
            "Media Shield Pro",
            "Visual AI-generation and manipulation analysis is available with Media Shield Pro. Free analysis includes file characteristics, supported metadata inspection, and available provenance checks."
          )
        );

        updateFreeFinalStatus(
          aiMetadataDetected,
          provenance
        );

        return;
      }


      /*
        ======================================================
        PRO VISUAL ANALYSIS
        ======================================================
      */

      statusTitle.textContent =
        "Running Pro visual analysis…";

      statusDescription.textContent =
        "Media Shield Pro is examining the visible image for potential AI-generation, AI-editing, compositing, and manipulation indicators.";

      const visualAnalysis =
        await runVisualAnalysis(
          record.dataUrl
        );

      let visualResult =
        "inconclusive";

      let visualAnalysisAvailable =
        false;

      if (
        visualAnalysis.ok
      ) {
        visualAnalysisAvailable =
          true;

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
            "Pro visual manipulation analysis",
            "The visual analysis service could not complete this check. The remaining evidence is still available and no conclusion should be drawn from the missing visual result."
          )
        );
      }


      /*
        ======================================================
        EVIDENCE RECONCILIATION
        ======================================================
      */

      const evidenceProfile =
        buildEvidenceProfile(
          metadata,
          provenance,
          visualResult,
          reliability,
          visualAnalysisAvailable
        );

      const finalAssessment =
        determineFinalAssessment(
          evidenceProfile
        );


      /*
        ======================================================
        FINAL INTERPRETATION
        ======================================================
      */

      addWhatThisMeansEvidence(
        finalAssessment,
        evidenceProfile
      );

      updateFinalStatus(
        finalAssessment
      );
    };


  image.onerror =
    () => {
      previewContainer.innerHTML =
        "<p>The selected image could not be displayed.</p>";

      evidenceList.innerHTML =
        "";

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

  image.src =
    record.dataUrl;
}


/*
  ============================================================
  CHECK ANOTHER IMAGE
  ============================================================
*/


if (
  checkAnotherButton
) {
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


/*
  ============================================================
  LOAD IMAGE
  ============================================================
*/


chrome.storage.local.get(
  [
    "mediaShieldPendingImage"
  ],
  (result) => {
    if (
      chrome.runtime.lastError
    ) {
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
