const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");
const previewContainer = document.getElementById("previewContainer");
const statusTitle = document.getElementById("statusTitle");
const statusDescription = document.getElementById("statusDescription");
const evidenceList = document.getElementById("evidenceList");
const checkAnotherButton = document.getElementById("checkAnotherButton");

// Immediate proof that analysis.js loaded successfully.
fileName.textContent = "analysis.js loaded";

statusTitle.textContent = "Diagnostic running";

statusDescription.textContent =
  "Media Shield is checking whether the stored image can be accessed.";

previewContainer.innerHTML =
  "<p>Analysis script loaded successfully.</p>";

evidenceList.innerHTML = "";

evidenceList.appendChild(
  (() => {
    const article = document.createElement("article");
    article.className = "evidence-item";

    const indicator = document.createElement("div");
    indicator.className = "indicator info";

    const content = document.createElement("div");

    const heading = document.createElement("h4");
    heading.textContent = "Diagnostic";

    const text = document.createElement("p");
    text.textContent = "Waiting for Chrome storage response.";

    content.appendChild(heading);
    content.appendChild(text);

    article.appendChild(indicator);
    article.appendChild(content);

    return article;
  })()
);

if (checkAnotherButton) {
  checkAnotherButton.addEventListener("click", () => {
    chrome.storage.local.remove("mediaShieldPendingImage", () => {
      window.location.href = "popup.html";
    });
  });
}

if (typeof chrome === "undefined") {
  statusTitle.textContent = "Chrome API unavailable";

  statusDescription.textContent =
    "The Chrome extension API is not available on this page.";
} else if (!chrome.storage || !chrome.storage.local) {
  statusTitle.textContent = "Storage API unavailable";

  statusDescription.textContent =
    "Media Shield cannot access chrome.storage.local.";
} else {
  chrome.storage.local.get(
    ["mediaShieldPendingImage"],
    (result) => {
      if (chrome.runtime.lastError) {
        statusTitle.textContent = "Storage error";

        statusDescription.textContent =
          chrome.runtime.lastError.message;

        return;
      }

      const record = result.mediaShieldPendingImage;

      if (!record) {
        fileName.textContent = "No stored image";

        statusTitle.textContent = "Storage works";

        statusDescription.textContent =
          "analysis.js is running correctly, but no pending image was found.";

        return;
      }

      fileName.textContent =
        record.name || "Stored image found";

      fileDetails.textContent =
        record.type || "";

      statusTitle.textContent = "Storage works";

      statusDescription.textContent =
        "analysis.js loaded and successfully retrieved the selected image.";

      if (record.dataUrl) {
        const image = new Image();

        image.onload = () => {
          previewContainer.innerHTML = "";
          previewContainer.appendChild(image);

          statusTitle.textContent = "Image loaded successfully";

          statusDescription.textContent =
            "The script, Chrome storage, and image preview are all working.";
        };

        image.onerror = () => {
          statusTitle.textContent = "Image preview failed";

          statusDescription.textContent =
            "The stored image was found, but Chrome could not display its data.";
        };

        image.src = record.dataUrl;
      }
    }
  );
}
