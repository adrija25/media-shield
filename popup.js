const selectImageButton = document.getElementById("selectImageButton");
const imageInput = document.getElementById("imageInput");

const upgradeProButton = document.getElementById("upgradeProButton");
const activateProButton = document.getElementById("activateProButton");
const submitActivationButton = document.getElementById("submitActivationButton");
const cancelActivationButton = document.getElementById("cancelActivationButton");

const activationKeyInput = document.getElementById("activationKey");
const activationMessage = document.getElementById("activationMessage");

const proInactiveState = document.getElementById("proInactiveState");
const proActivationState = document.getElementById("proActivationState");
const proActiveState = document.getElementById("proActiveState");


const MAX_FILE_SIZE = 8 * 1024 * 1024;

const CHECKOUT_URL =
  "https://scam-shield-2sn.pages.dev/media-shield-checkout";

const ACTIVATION_API =
  "https://arthiva-labs.pages.dev/api/activate-media-shield";


/*
  ============================================================
  CHROME STORAGE HELPERS
  ============================================================
*/


function getStoredValues(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(result);
    });
  });
}


function setStoredValues(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}


/*
  ============================================================
  INSTALLATION ID
  ============================================================

  Each installation receives its own random ID.

  The server uses this ID together with the activation key
  to enforce the maximum of 2 unique installations.
  ============================================================
*/


async function getInstallationId() {
  const stored = await getStoredValues([
    "mediaShieldInstallationId"
  ]);

  if (stored.mediaShieldInstallationId) {
    return stored.mediaShieldInstallationId;
  }

  const installationId =
    crypto.randomUUID();

  await setStoredValues({
    mediaShieldInstallationId:
      installationId
  });

  return installationId;
}


/*
  ============================================================
  PRO UI
  ============================================================
*/


function showFreeState() {
  proInactiveState.hidden = false;
  proActivationState.hidden = true;
  proActiveState.hidden = true;

  activationMessage.textContent = "";
}


function showActivationState() {
  proInactiveState.hidden = true;
  proActivationState.hidden = false;
  proActiveState.hidden = true;

  activationMessage.textContent = "";

  activationKeyInput.focus();
}


function showProState() {
  proInactiveState.hidden = true;
  proActivationState.hidden = true;
  proActiveState.hidden = false;

  activationMessage.textContent = "";
}


function setActivationMessage(message) {
  activationMessage.textContent = message;
}


/*
  ============================================================
  LOAD EXISTING PRO STATE
  ============================================================
*/


async function loadProState() {
  try {
    const stored = await getStoredValues([
      "mediaShieldProActive",
      "mediaShieldProToken"
    ]);

    if (
      stored.mediaShieldProActive === true &&
      stored.mediaShieldProToken
    ) {
      showProState();
      return;
    }

    showFreeState();

  } catch (error) {
    console.error(
      "Could not load Media Shield Pro state:",
      error
    );

    showFreeState();
  }
}


/*
  ============================================================
  UPGRADE BUTTON
  ============================================================
*/


upgradeProButton.addEventListener("click", () => {
  chrome.tabs.create({
    url: CHECKOUT_URL
  });
});


/*
  ============================================================
  SHOW ACTIVATION FORM
  ============================================================
*/


activateProButton.addEventListener("click", () => {
  showActivationState();
});


cancelActivationButton.addEventListener("click", () => {
  activationKeyInput.value = "";
  showFreeState();
});


/*
  ============================================================
  ACTIVATE MEDIA SHIELD PRO
  ============================================================
*/


submitActivationButton.addEventListener(
  "click",
  async () => {
    const token =
      activationKeyInput.value.trim();

    if (!token) {
      setActivationMessage(
        "Enter your Media Shield Pro activation key."
      );

      return;
    }

    submitActivationButton.disabled = true;
    activationKeyInput.disabled = true;

    setActivationMessage(
      "Checking your activation key..."
    );

    try {
      const installationId =
        await getInstallationId();

      const response =
        await fetch(
          ACTIVATION_API,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                token:
                  token,

                installationId:
                  installationId
              })
          }
        );

      let data;

      try {
        data = await response.json();
      } catch (error) {
        throw new Error(
          "Media Shield could not read the activation response."
        );
      }

      if (
        !response.ok ||
        !data.ok ||
        !data.active
      ) {
        if (data.licenseLimitReached) {
          throw new Error(
            "This activation key has already been used on 2 installations. Purchase another Media Shield Pro licence for another installation."
          );
        }

        throw new Error(
          data.error ||
          "This Media Shield Pro activation key could not be verified."
        );
      }

      await setStoredValues({
        mediaShieldProActive:
          true,

        mediaShieldProToken:
          token,

        mediaShieldProProduct:
          "media-shield",

        mediaShieldProOffer:
          "pro"
      });

      activationKeyInput.value = "";

      showProState();

    } catch (error) {
      console.error(
        "Media Shield activation error:",
        error
      );

      setActivationMessage(
        error.message ||
        "Media Shield Pro activation could not be completed."
      );

    } finally {
      submitActivationButton.disabled = false;
      activationKeyInput.disabled = false;
    }
  }
);


/*
  ============================================================
  ALLOW ENTER KEY TO ACTIVATE
  ============================================================
*/


activationKeyInput.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitActivationButton.click();
    }
  }
);


/*
  ============================================================
  EXISTING IMAGE SELECTION
  ============================================================
*/


selectImageButton.addEventListener("click", () => {
  imageInput.click();
});


imageInput.addEventListener("change", () => {
  const selectedFile =
    imageInput.files[0];

  if (!selectedFile) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(selectedFile.type)) {
    alert(
      "Please select a JPG, JPEG, PNG, or WEBP image."
    );

    imageInput.value = "";
    return;
  }

  if (selectedFile.size > MAX_FILE_SIZE) {
    alert(
      "Please select an image smaller than 8 MB."
    );

    imageInput.value = "";
    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    const imageRecord = {
      name:
        selectedFile.name,

      type:
        selectedFile.type,

      size:
        selectedFile.size,

      dataUrl:
        reader.result
    };

    chrome.storage.local.set(
      {
        mediaShieldPendingImage:
          imageRecord
      },
      () => {
        if (chrome.runtime.lastError) {
          alert(
            "Media Shield could not prepare this image for analysis."
          );

          return;
        }

        window.location.href =
          "analysis.html";
      }
    );
  };

  reader.onerror = () => {
    alert(
      "Media Shield could not read the selected image."
    );
  };

  reader.readAsDataURL(
    selectedFile
  );
});


/*
  ============================================================
  INITIALISE
  ============================================================
*/


loadProState();
