// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fillForm") {
    try {
      const formData = request.data;
      console.log("Received form data:", formData);

      clearForm();

      const filledFields = new Map();

      // Input field mappings
      const inputMappings = {
        "Full Name": 'input[placeholder="Enter Full name"]',
        "Mobile No": 'input[placeholder="Enter Mobile No."]',
        "Identity No": 'input[placeholder="Enter Identity No."]',
      };

      // Function to trigger events on elements
      function triggerEvents(element) {
        ["input", "change", "blur"].forEach((eventType) => {
          element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
      }

      // Fill input fields
      Object.entries(inputMappings).forEach(([fieldName, selector]) => {
        const field = document.querySelector(selector);
        if (field && formData[fieldName]) {
          field.value = formData[fieldName];
          triggerEvents(field);
          filledFields.set(fieldName, [field]);
        } else {
          console.warn(`Field "${fieldName}" not found or no data provided.`);
        }
      });

      async function fillDropdowns() {
        for (const [fieldName, config] of Object.entries(dropdownMappings)) {
          console.log(
            `Attempting to fill "${fieldName}" with "${config.value}"`
          );
          const success = await handleCustomDropdown(
            config.selector,
            config.value
          );
          if (success) {
            console.log(`Successfully filled "${fieldName}"`);
            filledFields.set(fieldName, ["custom-dropdown"]);
          } else {
            console.warn(`Failed to fill "${fieldName}"`);
          }
          // Delay to ensure smooth dropdown selection
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Start filling dropdowns and send response
      fillDropdowns().then(() => {
        sendResponse({
          success: true,
          message: `Fields filled: ${filledFields.size}`,
          filledFieldsInfo: Array.from(filledFields.entries()).map(
            ([label, types]) => ({
              label,
              types,
            })
          ),
        });
      });

      // Observer for dynamic content changes
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            console.log("DOM updated, rechecking unfilled dropdowns.");
            fillDropdowns();
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });

      // Cleanup observer after a timeout
      setTimeout(() => {
        observer.disconnect();
        console.log("MutationObserver disconnected after timeout.");
      }, 10000);
    } catch (error) {
      console.error("Error filling form:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  }
  return true; // Keep the message channel open for async responses
});

function clearForm() {
  const inputs = document.querySelectorAll("input, select, textarea");
  inputs.forEach((input) => {
    if (input.type !== "submit") {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
