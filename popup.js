class ExcelFormFiller {
  constructor() {
    this.fileInput = document.getElementById("fileInput");
    this.fillFormButton = document.getElementById("fillFormButton");
    this.statusElement = document.getElementById("status");
    this.jsonData = null;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.fileInput.addEventListener("change", this.handleFileUpload.bind(this));
    this.fillFormButton.addEventListener(
      "click",
      this.handleFormFill.bind(this)
    );
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.updateStatus("Reading file...");
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      this.jsonData = XLSX.utils.sheet_to_json(sheet);

      if (this.jsonData.length > 0) {
        this.fillFormButton.disabled = false;
        this.updateStatus("File loaded successfully!");
      } else {
        this.updateStatus("Error: The Excel file is empty.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      this.updateStatus("Error processing file. Please try again.");
    }
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e.target.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async ensureContentScriptInjected(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      return true;
    } catch (error) {
      console.error("Error injecting content script:", error);
      return false;
    }
  }

  // Inside the popup.js (ExcelFormFiller class)

async handleFormFill() {
  if (!this.jsonData || this.jsonData.length === 0) {
    this.updateStatus("No data available. Please upload an Excel file first.");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      throw new Error("No active tab found");
    }

    // Ensure content script is injected
    await this.ensureContentScriptInjected(tab.id);

    let currentIndex = 0;
    const totalUsers = this.jsonData.length;

    // Process each user's data
    const processUserData = async () => {
      if (currentIndex < totalUsers) {
        const userData = this.jsonData[currentIndex];

        try {
          const response = await this.sendMessageWithTimeout(tab.id, {
            action: "fillForm",
            data: userData,
          });

          if (response && response.success) {
            this.updateStatus(`Form filled for user ${currentIndex + 1} of ${totalUsers}`);
          } else {
            throw new Error(response?.error || "Failed to fill form");
          }
        } catch (error) {
          console.error("Error filling form for user:", error);
          this.updateStatus(`Error filling form for user ${currentIndex + 1}: ${error.message}`);
        }

        currentIndex++;
        // Add a delay before processing the next user
        setTimeout(processUserData, 2000); // 2-second delay between users
      } else {
        this.updateStatus("All forms filled successfully!");
      }
    };

    processUserData(); // Start the process

  } catch (error) {
    console.error("Error filling form:", error);
    this.updateStatus(`Error filling form: ${error.message}`);
  }
}


  sendMessageWithTimeout(tabId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  updateStatus(message) {
    this.statusElement.textContent = message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ExcelFormFiller();
});
