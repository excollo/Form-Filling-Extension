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

      // Handle Tourist Type dropdown
      if (formData["Tourist Type"]) {
        fillTouristTypeDropdown(formData["Tourist Type"])
          .then((result) => {
            console.log(result);
            filledFields.set("Tourist Type", true);
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        console.warn("Tourist Type data not provided.");
      }

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

async function fillTouristTypeDropdown(touristTypeValue) {
  return new Promise((resolve, reject) => {
    try {
      // Comprehensive dropdown trigger selection
      const dropdownTriggers = [
        () => document.querySelector('div[role="combobox"][tabindex="0"]'),
        () => document.querySelector(".MuiSelect-select"),
        () => document.querySelector('[aria-haspopup="listbox"]'),
      ];

      let dropdownTrigger;
      for (let findTrigger of dropdownTriggers) {
        dropdownTrigger = findTrigger();
        if (dropdownTrigger) break;
      }

      if (!dropdownTrigger) {
        console.error("NO DROPDOWN TRIGGER FOUND. Detailed DOM Analysis:");
        console.log(
          "All combobox elements:",
          Array.from(document.querySelectorAll('[role="combobox"]')).map(
            (el) => ({
              textContent: el.textContent,
              classes: el.className,
              attributes: Array.from(el.attributes).map(
                (a) => `${a.name}="${a.value}`
              ),
            })
          )
        );
        return reject("No dropdown trigger found");
      }

      console.log("Dropdown Trigger Found:", {
        text: dropdownTrigger.textContent,
        classes: dropdownTrigger.className,
      });

      // Advanced interaction to open dropdown
      dropdownTrigger.click();
      dropdownTrigger.dispatchEvent(
        new MouseEvent("mousedown", {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      );

      // Multiple strategies to find options
      const optionSelectors = [
        '[role="option"]',
        ".MuiMenuItem-root",
        'li[role="option"]',
        'ul[role="listbox"] > li',
        ".MuiList-root > li",
      ];

      const findOptions = () => {
        let foundOptions = [];
        for (let selector of optionSelectors) {
          foundOptions = Array.from(document.querySelectorAll(selector));
          if (foundOptions.length > 0) break;
        }
        return foundOptions;
      };

      // Multiple attempts to find options
      const attemptFindOptions = (attempt = 0) => {
        const options = findOptions();

        console.log(`Attempt ${attempt + 1}: Found ${options.length} options`);

        if (options.length > 0) {
          console.log(
            "Option Details:",
            options.map((opt) => ({
              text: opt.textContent.trim(),
              classes: opt.className,
            }))
          );

          const matchingOption = options.find(
            (option) => option.textContent.trim() === touristTypeValue
          );

          if (matchingOption) {
            matchingOption.click();

            // Verify selection
            setTimeout(() => {
              const currentSelection = document.querySelector(
                'div[role="combobox"]'
              );
              console.log("Current Selection:", currentSelection.textContent);
              resolve("Tourist Type selected successfully");
            }, 300);
            return;
          } else {
            console.warn(`No exact match for "${touristTypeValue}"`);
            console.warn(
              "Available options:",
              options.map((opt) => opt.textContent.trim())
            );
          }
        }

        // Retry mechanism
        if (attempt < 3) {
          setTimeout(() => attemptFindOptions(attempt + 1), 500);
        } else {
          reject(`Could not find option: ${touristTypeValue}`);
        }
      };

      // Start the option finding process
      attemptFindOptions();
    } catch (error) {
      console.error("Dropdown Error:", error);
      reject(error.message);
    }
  });
}

// Helper function to trigger events after filling fields
function triggerEvents(element) {
  const event = new Event("input", { bubbles: true });
  element.dispatchEvent(event);
}

// Helper function to clear all fields
function clearForm() {
  const fields = document.querySelectorAll("input, textarea, select");
  fields.forEach((field) => {
    if (field.type !== "submit" && field.type !== "button") {
      field.value = "";
      triggerEvents(field);
    }
  });
}
