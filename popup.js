const selectImageButton = document.getElementById("selectImageButton");
const imageInput = document.getElementById("imageInput");

const MAX_FILE_SIZE = 8 * 1024 * 1024;

selectImageButton.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const selectedFile = imageInput.files[0];

  if (!selectedFile) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(selectedFile.type)) {
    alert("Please select a JPG, JPEG, PNG, or WEBP image.");
    imageInput.value = "";
    return;
  }

  if (selectedFile.size > MAX_FILE_SIZE) {
    alert("Please select an image smaller than 8 MB.");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const imageRecord = {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size,
      dataUrl: reader.result
    };

    chrome.storage.local.set(
      {
        mediaShieldPendingImage: imageRecord
      },
      () => {
        if (chrome.runtime.lastError) {
          alert("Media Shield could not prepare this image for analysis.");
          return;
        }

        window.location.href = "analysis.html";
      }
    );
  };

  reader.onerror = () => {
    alert("Media Shield could not read the selected image.");
  };

  reader.readAsDataURL(selectedFile);
});
