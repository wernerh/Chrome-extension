// focusfeed/popup.js
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const extensionEnabledToggle = document.getElementById('extensionEnabledToggle');
  const extensionStatusText = document.getElementById('extensionStatusText');
  const timeSpentDisplay = document.getElementById('timeSpentDisplay');
  const unlockFeedButton = document.getElementById('unlockFeedButton');
  const lockFeedButton = document.getElementById('lockFeedButton');
  // const settingsButton = document.getElementById('settingsButton');

  // --- Initialize Popup State ---
  // Get enabled state
  chrome.storage.local.get(['focusFeedEnabled', 'unlockEndTime'], (result) => {
    const isEnabled = result.focusFeedEnabled === undefined ? true : result.focusFeedEnabled;
    extensionEnabledToggle.checked = isEnabled;
    updateStatusText(isEnabled);
    updateUnlockButtonVisibility(result.unlockEndTime);

    if (isEnabled) {
      loadTimeSpent();
    } else {
      timeSpentDisplay.innerHTML = "<p>Extension is disabled.</p>";
      unlockFeedButton.disabled = true;
      lockFeedButton.disabled = true;
    }
  });

  // --- Event Listeners ---
  extensionEnabledToggle.addEventListener('change', () => {
    const enabled = extensionEnabledToggle.checked;
    chrome.runtime.sendMessage({ action: "TOGGLE_EXTENSION_ENABLED", enabled: enabled }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error toggling extension:", chrome.runtime.lastError);
        // Revert UI if there was an error
        extensionEnabledToggle.checked = !enabled;
        updateStatusText(!enabled);
        return;
      }
      console.log("FocusFeed: Extension enabled set to", enabled, response);
      updateStatusText(enabled);
      if (enabled) {
        loadTimeSpent();
        unlockFeedButton.disabled = false;
        // Check current unlock status to set button visibility correctly
        chrome.storage.local.get('unlockEndTime', (res) => updateUnlockButtonVisibility(res.unlockEndTime));
      } else {
        timeSpentDisplay.innerHTML = "<p>Extension is disabled.</p>";
        unlockFeedButton.disabled = true;
        lockFeedButton.style.display = 'none';
        unlockFeedButton.style.display = 'inline-block';
        lockFeedButton.disabled = true;
      }
    });
  });

  unlockFeedButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "START_UNLOCK_TIMER", duration: 5 }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error starting unlock timer:", chrome.runtime.lastError);
        return;
      }
      console.log("FocusFeed: Unlock timer started.", response);
      unlockFeedButton.style.display = 'none';
      lockFeedButton.style.display = 'inline-block';
      lockFeedButton.disabled = false;
      // Optionally close popup or give feedback
      // window.close();
    });
  });

  lockFeedButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "CLEAR_UNLOCK_TIMER" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error clearing unlock timer:", chrome.runtime.lastError);
        return;
      }
      console.log("FocusFeed: Feed lock requested.", response);
      lockFeedButton.style.display = 'none';
      unlockFeedButton.style.display = 'inline-block';
      unlockFeedButton.disabled = false; // Re-enable unlock button
       // Optionally close popup or give feedback
      // window.close();
    });
  });

  // if (settingsButton) {
  //   settingsButton.addEventListener('click', () => {
  //     // Open settings page or show settings UI
  //     // For MVP, this might be out of scope or link to a future page
  //     console.log("FocusFeed: Settings button clicked (not implemented).");
  //     // chrome.runtime.openOptionsPage(); // If an options page is defined in manifest
  //   });
  // }

  // --- Helper Functions ---
  function updateStatusText(isEnabled) {
    extensionStatusText.textContent = isEnabled ? 'Extension Enabled' : 'Extension Disabled';
  }

  function updateUnlockButtonVisibility(unlockEndTime) {
    const lockFeedButton = document.getElementById('lockFeedButton');
    const unlockFeedButton = document.getElementById('unlockFeedButton');
    const currentTime = new Date().getTime();

    // Clear any existing interval before reassessing state
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    if (unlockEndTime && currentTime < unlockEndTime) {
      unlockFeedButton.style.display = 'none';
      lockFeedButton.style.display = 'inline-block';
      lockFeedButton.disabled = false;

      function updateTimerDisplay() {
        const now = new Date().getTime();
        const remainingMilliseconds = unlockEndTime - now;

        if (remainingMilliseconds <= 0) {
          if (countdownInterval) { // Ensure it's cleared if somehow called externally
              clearInterval(countdownInterval);
              countdownInterval = null;
          }
          // Timer has expired or was cleared. Re-fetch unlockEndTime to get the true current state.
          // This is important if the background script cleared the timer.
          chrome.storage.local.get('unlockEndTime', (result) => {
              // Call updateUnlockButtonVisibility with potentially new (cleared) unlockEndTime
              // This will then fall into the 'else' block below if timer is truly gone.
              updateUnlockButtonVisibility(result.unlockEndTime);
          });
          return;
        }

        const totalSeconds = Math.floor(remainingMilliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const minutesPadded = String(minutes).padStart(2, '0');
        const secondsPadded = String(seconds).padStart(2, '0');

        lockFeedButton.textContent = `Lock Feed Now (${minutesPadded}:${secondsPadded})`;
      }

      updateTimerDisplay(); // Call immediately to set the text
      countdownInterval = setInterval(updateTimerDisplay, 1000);

    } else {
      // No active timer or timer has expired
      unlockFeedButton.style.display = 'inline-block';
      lockFeedButton.style.display = 'none';
      // Check if extension is enabled before enabling the unlock button
      chrome.storage.local.get('focusFeedEnabled', (result) => {
         unlockFeedButton.disabled = !(result.focusFeedEnabled === undefined ? true : result.focusFeedEnabled);
      });
      lockFeedButton.textContent = 'Lock Feed Now'; // Reset text
    }
  }

  function loadTimeSpent() {
    chrome.runtime.sendMessage({ action: "GET_TIME_LOG" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting time log:", chrome.runtime.lastError);
        timeSpentDisplay.innerHTML = "<p>Error loading time.</p>";
        return;
      }

      if (response && response.timeLog) {
        const timeLog = response.timeLog;
        let html = '';
        const sites = Object.keys(timeLog);
        if (sites.length === 0) {
          html = "<p>No time tracked yet today.</p>";
        } else {
          html += "<ul>";
          for (const site in timeLog) {
            const minutes = Math.round(timeLog[site] / (1000 * 60));
            let cleanSite = site;
            // Remove prefixes
            cleanSite = cleanSite.replace(/^Nll:/i, '');
            cleanSite = cleanSite.replace(/^Fw\./i, '');
            cleanSite = cleanSite.replace(/^Iw\./i, '');

            // Remove www. and .com
            cleanSite = cleanSite.replace(/^www\./i, '');
            cleanSite = cleanSite.replace(/\.com$/i, '');

            // Capitalize first letter
            if (cleanSite.length > 0) {
              cleanSite = cleanSite.charAt(0).toUpperCase() + cleanSite.slice(1);
            }

            html += `<li>${cleanSite}: ${minutes} min</li>`;
          }
          html += "</ul>";
        }
        timeSpentDisplay.innerHTML = html;
      } else {
        timeSpentDisplay.innerHTML = "<p>No time tracked yet today.</p>";
        console.log("FocusFeed: No time log data received or empty.", response);
      }
    });
  }

  // Update timer display on lock button every few seconds if popup is open
  // setInterval(() => {
  //   chrome.storage.local.get(['focusFeedEnabled','unlockEndTime'], (result) => {
  //       if (result.focusFeedEnabled) {
  //           updateUnlockButtonVisibility(result.unlockEndTime);
  //       }
  //   });
  // }, 5000);
});
