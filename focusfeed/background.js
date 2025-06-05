// focusfeed/background.js
console.log("FocusFeed background script loaded.");

const UNLOCK_DURATION_MINUTES = 5; // Default unlock time

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['focusFeedEnabled', 'dailyTimeLog'], (result) => {
    if (result.focusFeedEnabled === undefined) {
      chrome.storage.local.set({ focusFeedEnabled: true });
      console.log("FocusFeed: Extension enabled by default.");
    }
    if (result.dailyTimeLog === undefined) {
      chrome.storage.local.set({ dailyTimeLog: {} });
      console.log("FocusFeed: Initialized empty daily time log.");
    }
  });
});

// --- Timer Management ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "unlockTimerExpired") {
    console.log("FocusFeed: Unlock timer expired. Re-hiding feed.");
    chrome.storage.local.remove('unlockEndTime'); // Clear the unlock end time
    // Notify active tabs on supported sites to re-hide the feed
    notifyTabsToToggleFeed(true);
  } else if (alarm.name === "dailyReset") {
    console.log("FocusFeed: Daily reset triggered. Clearing time log.");
    chrome.storage.local.set({ dailyTimeLog: {} });
  }
});

function startUnlockTimer(durationMinutes) {
  const endTime = new Date().getTime() + durationMinutes * 60 * 1000;
  chrome.storage.local.set({ unlockEndTime: endTime }, () => {
    chrome.alarms.create("unlockTimerExpired", { delayInMinutes: durationMinutes });
    console.log(`FocusFeed: Unlock timer started for ${durationMinutes} minutes. Ends at ${new Date(endTime).toLocaleTimeString()}`);
    notifyTabsToToggleFeed(false); // Notify to show feed
  });
}

function clearUnlockTimer() {
  chrome.alarms.clear("unlockTimerExpired", (wasCleared) => {
    if (wasCleared) console.log("FocusFeed: Unlock timer cleared.");
  });
  chrome.storage.local.remove('unlockEndTime');
  notifyTabsToToggleFeed(true); // Notify to hide feed
}

function notifyTabsToToggleFeed(hide) {
  chrome.tabs.query({
    url: [
      "*://*.twitter.com/*",
      "*://*.facebook.com/*",
      "*://*.instagram.com/*",
      "*://*.tiktok.com/*"
    ]
  }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_FEED", hide: hide })
        .catch(error => console.log(`FocusFeed: Could not send message to tab ${tab.id}`, error)); // Add catch for tabs that might not have content script ready
    });
  });
}

// --- Time Tracking ---
let activeTabId = null;
let currentSiteHost = null;
let siteStartTime = null;

// Track when a tab is activated
chrome.tabs.onActivated.addListener(activeInfo => {
  updateActiveTab(activeInfo.tabId);
});

// Track when a tab is updated (e.g., URL change)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    updateActiveTab(tabId);
  }
});

// Track when a window focus changes
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // No window focused, stop tracking
    stopTrackingCurrentSite();
  } else {
    chrome.tabs.query({ active: true, windowId: windowId }, tabs => {
      if (tabs.length > 0) {
        updateActiveTab(tabs[0].id);
      }
    });
  }
});

function updateActiveTab(tabId) {
  stopTrackingCurrentSite(); // Stop tracking previous site first
  activeTabId = tabId;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      // Tab might be closed or inaccessible
      console.log("FocusFeed: Error getting tab or tab URL, stopping tracking for this tab.");
      currentSiteHost = null;
      siteStartTime = null;
      return;
    }

    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;

      if (isSupportedSite(hostname)) {
        currentSiteHost = hostname;
        siteStartTime = new Date().getTime();
        console.log(`FocusFeed: Started tracking time on ${currentSiteHost}`);
      } else {
        currentSiteHost = null;
        siteStartTime = null;
      }
    } catch (e) {
      // Invalid URL
      console.log("FocusFeed: Invalid URL, stopping tracking.", tab.url, e);
      currentSiteHost = null;
      siteStartTime = null;
    }
  });
}

function stopTrackingCurrentSite() {
  if (currentSiteHost && siteStartTime) {
    const endTime = new Date().getTime();
    const timeSpentMs = endTime - siteStartTime;
    console.log(`FocusFeed: Stopped tracking ${currentSiteHost}, time spent: ${Math.round(timeSpentMs / 1000)}s`);

    chrome.storage.local.get(['dailyTimeLog', 'focusFeedEnabled'], (result) => {
      if (!result.focusFeedEnabled) {
        console.log("FocusFeed: Extension disabled, not logging time.");
        currentSiteHost = null;
        siteStartTime = null;
        return;
      }

      let dailyTimeLog = result.dailyTimeLog || {};
      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD

      if (!dailyTimeLog[today]) {
        dailyTimeLog = { [today]: {} }; // Reset log for a new day
      }

      if (!dailyTimeLog[today][currentSiteHost]) {
        dailyTimeLog[today][currentSiteHost] = 0;
      }
      dailyTimeLog[today][currentSiteHost] += timeSpentMs;

      chrome.storage.local.set({ dailyTimeLog: dailyTimeLog }, () => {
        console.log(`FocusFeed: Updated time log for ${currentSiteHost}: ${Math.round(dailyTimeLog[today][currentSiteHost]/1000)}s total today.`);
      });

      currentSiteHost = null;
      siteStartTime = null;
    });
  }
}

function isSupportedSite(hostname) {
  return hostname.includes('twitter.com') ||
         hostname.includes('facebook.com') ||
         hostname.includes('instagram.com') ||
         hostname.includes('tiktok.com');
}

// --- Message Handling ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("FocusFeed: Message received in background.js", request);
  if (request.action === "START_UNLOCK_TIMER") {
    startUnlockTimer(request.duration || UNLOCK_DURATION_MINUTES);
    sendResponse({ status: "timer started" });
  } else if (request.action === "CLEAR_UNLOCK_TIMER") {
    clearUnlockTimer();
    sendResponse({ status: "timer cleared, feed should hide" });
  } else if (request.action === "GET_TIME_LOG") {
    chrome.storage.local.get('dailyTimeLog', (result) => {
      const today = new Date().toISOString().split('T')[0];
      sendResponse({ timeLog: result.dailyTimeLog ? result.dailyTimeLog[today] : {} });
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "TOGGLE_EXTENSION_ENABLED") {
    chrome.storage.local.set({ focusFeedEnabled: request.enabled }, () => {
      console.log("FocusFeed: Extension enabled state set to", request.enabled);
      if (request.enabled) {
        // If enabling, and no timer is active, hide feeds
        chrome.storage.local.get('unlockEndTime', (res) => {
          if (!res.unlockEndTime || new Date().getTime() > res.unlockEndTime) {
            notifyTabsToToggleFeed(true);
          }
        });
      } else {
        // If disabling, show all feeds
        notifyTabsToToggleFeed(false);
        // also clear any active unlock timer as it's irrelevant if disabled
        chrome.alarms.clear("unlockTimerExpired");
        chrome.storage.local.remove('unlockEndTime');
      }
      sendResponse({ status: "ok", enabled: request.enabled });
    });
    return true;
  }
  return false; // Default for synchronous responses
});

// Schedule a daily reset for the time log
function scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight
    const delayInMilliseconds = tomorrow.getTime() - now.getTime();
    const delayInMinutes = delayInMilliseconds / (1000 * 60);

    chrome.alarms.create("dailyReset", {
        delayInMinutes: delayInMinutes,
        periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
    console.log(`FocusFeed: Daily time log reset scheduled for ${tomorrow.toLocaleTimeString()}.`);
}

// Schedule the daily reset when the background script starts
scheduleDailyReset();

// Ensure time tracking stops when Chrome is closed or extension is disabled/unloaded
chrome.windows.onRemoved.addListener(() => {
    // This might not always run on browser quit, but good for window close
    stopTrackingCurrentSite();
});
// runtime.onSuspend is another place but less reliable for cleanup.
// The onActivated, onUpdated, onFocusChanged listeners should handle most transitions.
