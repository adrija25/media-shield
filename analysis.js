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
  previewContainer.innerHTML = "<p>No image is currently available for analysis.</p>";

  fileName.textContent = "No image selected";
  fileDetails.textContent = "";

  statusTitle.textContent = "No analysis available";
  statusDescription.textContent =
    "Return to Media Shield and select an image to begin a check.";

  evidenceList.innerHTML = "";
}

function analyzeImageRecord(record) {
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

  image.onload = () => {
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

    evidenceList.appendChild(
      createEvidenceItem(
        "neutral",
        "Metadata",
        "Detailed metadata inspection has not yet been enabled. Missing metadata will never be treated as proof of AI generation or manipulation."
      )
    );

    evidenceList.appendChild(
      createEvidenceItem(
        "neutral",
        "Provenance",
        "Content Credentials and other provenance information have not yet been checked in this development version."
      )
    );

    statusTitle.textContent = "Initial file inspection complete";

    statusDescription.textContent =
      "Basic file characteristics were inspected locally. Media Shield does not yet have enough evidence to assess whether this image may be AI-generated or manipulated.";
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
  window.close();
});

chrome.storage.local.get(["mediaShieldPendingImage"], (result) => {
  analyzeImageRecord(result.mediaShieldPendingImage);
});
