const selectImageButton = document.getElementById("selectImageButton");
const imageInput = document.getElementById("imageInput");

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

  alert(
    `Selected: ${selectedFile.name}\n\n` +
    "Media Shield analysis will be added in the next development stage."
  );

  imageInput.value = "";
});
