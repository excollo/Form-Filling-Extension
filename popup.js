class ExcelFormFiller {
  constructor() {
    this.fileInput = document.getElementById("fileInput");
    this.fillFormButton = document.getElementById("fillFormButton");
    this.statusElement = document.getElementById("status");
    this.currentUserDisplay = document.getElementById("currentUser");
    this.currentIndex = 0;
    this.jsonData = null;

    this.initializeEventListeners();
    this.loadStoredData();
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get([
        "excelData",
        "currentIndex",
      ]);
      if (result.excelData) {
        this.jsonData = result.excelData;
        this.currentIndex = result.currentIndex || 0;
        this.fillFormButton.disabled = false;
        this.displayCurrentUser();
        this.updateStatus(`Loaded ${this.jsonData.length} records`);
      }
    } catch (error) {
      console.error("Error loading stored data:", error);
      this.updateStatus("Error loading stored data");
    }
  }

  initializeEventListeners() {
    this.fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        await this.handleFileUpload(file);
      }
    });

    this.fillFormButton.addEventListener("click", () => {
      this.handleFormFill();
    });
  }

  async handleFileUpload(file) {
    try {
      this.updateStatus("Reading file...");
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      this.jsonData = XLSX.utils.sheet_to_json(sheet);

      if (this.jsonData && this.jsonData.length > 0) {
        // Store in chrome.storage.local
        await chrome.storage.local.set({
          excelData: this.jsonData,
          currentIndex: 0,
        });

        this.currentIndex = 0;
        this.fillFormButton.disabled = false;
        this.displayCurrentUser();
        this.updateStatus(
          `Successfully loaded ${this.jsonData.length} records`
        );
      } else {
        throw new Error("No data found in Excel file");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      this.updateStatus(`Error: ${error.message}`);
      this.fillFormButton.disabled = true;
    }
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("File reading failed"));
      reader.readAsArrayBuffer(file);
    });
  }

  displayCurrentUser() {
    if (!this.jsonData || !this.jsonData[this.currentIndex]) {
      this.currentUserDisplay.innerHTML = "<p>No user data available</p>";
      return;
    }

    const user = this.jsonData[this.currentIndex];
    this.currentUserDisplay.innerHTML = `
      <div class="user-info">
        <h3>Current Record (${this.currentIndex + 1}/${
      this.jsonData.length
    })</h3>
        <table>
          <tr>
            <td><strong>Name:</strong></td>
            <td>${user["Full Name"] || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Mobile:</strong></td>
            <td>${user["Mobile No"] || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Identity:</strong></td>
            <td>${user["Identity No"] || "N/A"}</td>
          </tr>
        </table>
      </div>
    `;
  }

  async ensureContentScriptInjected(tabId) {
    try {
      // First try to check if content script is already running
      try {
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        console.log("Content script is already running");
        return true;
      } catch (err) {
        console.log("Content script not detected, will inject");
      }

      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });

      // Wait for the content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the injection
      try {
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
        console.log("Content script successfully injected");
        return true;
      } catch (err) {
        throw new Error("Content script injection verification failed");
      }
    } catch (error) {
      console.error("Error in ensureContentScriptInjected:", error);
      throw new Error(`Content script injection failed: ${error.message}`);
    }
  }

  sendMessageWithTimeout(tabId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async handleFormFill() {
    if (!this.jsonData || !this.jsonData[this.currentIndex]) {
      this.updateStatus("No data available to fill");
      return;
    }

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      // Update status to show progress
      this.updateStatus("Preparing to fill form...");

      // Ensure content script is injected
      await this.ensureContentScriptInjected(tab.id);

      // Get the current user data
      const userData = this.jsonData[this.currentIndex];

      // Attempt to fill the form
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Form filling timed out"));
        }, 5000);

        chrome.tabs.sendMessage(
          tab.id,
          { action: "fillForm", data: userData },
          (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.success) {
        this.updateStatus(`Form filled for record ${this.currentIndex + 1}`);

        // Move to next record if available
        if (this.currentIndex < this.jsonData.length - 1) {
          this.currentIndex++;
          await chrome.storage.local.set({ currentIndex: this.currentIndex });
          this.displayCurrentUser();
        } else {
          this.updateStatus("All records processed!");
        }
      } else {
        throw new Error(response?.error || "Failed to fill form");
      }
    } catch (error) {
      console.error("Error in handleFormFill:", error);
      this.updateStatus(`Error: ${error.message}`);
    }
  }

  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }

  // Your existing ensureContentScriptInjected and sendMessageWithTimeout methods...
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ExcelFormFiller();
});
