// content.js
console.log("Content script loaded");

// Handle extension messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request.action);

  // Handle ping message to verify content script is loaded
  if (request.action === "ping") {
    sendResponse({ status: "ok" });
    return true;
  }

  // Handle form filling
  if (request.action === "fillForm") {
    try {
      const formData = request.data;
      console.log("Received form data:", formData);

      // Clear existing form data
      clearForm();

      // Track filled fields
      const filledFields = new Map();

      // Input field mappings
      const inputMappings = {
        "Full Name": 'input[placeholder="Enter Full name"]',
        "Mobile No": 'input[placeholder="Enter Mobile No."]',
        "Identity No": 'input[placeholder="Enter Identity No."]',
      };

      // Fill input fields
      Object.entries(inputMappings).forEach(([fieldName, selector]) => {
        const field = document.querySelector(selector);
        if (field && formData[fieldName]) {
          field.value = formData[fieldName];
          triggerEvents(field);
          filledFields.set(fieldName, true);
          console.log(`Filled field: ${fieldName}`);
        } else {
          console.warn(`Field "${fieldName}" not found or no data provided.`);
        }
      });

      // Send success response
      sendResponse({
        success: true,
        message: `Fields filled: ${filledFields.size}`,
        filledFields: Array.from(filledFields.keys()),
      });
    } catch (error) {
      console.error("Error filling form:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
    return true;
  }
});

// Helper function to trigger events on form fields
function triggerEvents(element) {
  ["input", "change", "blur"].forEach((eventType) => {
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}

// Helper function to clear form fields
function clearForm() {
  const inputs = document.querySelectorAll(
    "input:not([type='submit']), select, textarea"
  );
  inputs.forEach((input) => {
    input.value = "";
    triggerEvents(input);
  });
}

// Log that content script is ready
console.log("Content script initialized and ready");
