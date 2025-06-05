// focusfeed/content.js

console.log("FocusFeed content script loaded.");

const SITES = {
  TWITTER: 'twitter.com',
  FACEBOOK: 'facebook.com',
  INSTAGRAM: 'instagram.com',
  TIKTOK: 'tiktok.com',
};

let currentSite = null;
let feedHidden = false;
let observer = null; // MutationObserver

// Store selectors for each site
const SITE_SELECTORS = {
  [SITES.TWITTER]: {
    feedContainers: ['[data-testid="primaryColumn"] section[role="region"] > div[style*="transform: translateY"] > div', '[data-testid="primaryColumn"] div[aria-label*="Timeline"]'],
    alternativeFeedContainers: ['[data-testid="primaryColumn"]']
  },
  [SITES.FACEBOOK]: {
    feedContainers: [
      'div[aria-label="News Feed"] div[role="feed"]', // New Facebook UI
      'div[aria-label="Fil d’actualité"] div[role="feed"]', // French version of "News Feed"
      'div[role="feed"][aria-label]', // General feed with any label
      '#stories_pagelet_below_composer', // Common container for feed items
      'div[data-pagelet^="FeedUnit"]', // Individual feed items
      'div[data-pagelet="MainFeed"] div > div > div[class=""] > div[class=""] > div[class=""]' // A very specific selector that might work for some layouts, highly fragile
    ],
    alternativeFeedContainers: [
      'div[role="main"]' // Fallback to hide the entire main content area
    ]
  },
  [SITES.INSTAGRAM]: {
    feedContainers: [
      // Main feed on homepage (targets the container holding posts)
      'main section > div > div[style*="flex-direction: column;"] > div[style*="flex-direction: column;"]',
      // Individual posts, reels, or explore items (often within <article>)
      'main article',
      // Specifically for Reels tab or when Reels are prominent
      'main div[style*="flex-direction: column;"] > div > div[class]:has(a[href*="/reels/"])',
      // Posts when opened in a modal/dialog view
      'div[role="dialog"] article'
    ],
    alternativeFeedContainers: [
      'main[role="main"]' // Fallback to hide the entire main content area
    ]
  },
  // TIKTOK will be added later
};

function identifySite() {
  const hostname = window.location.hostname;
  if (hostname.includes(SITES.TWITTER)) {
    currentSite = SITES.TWITTER;
  } else if (hostname.includes(SITES.FACEBOOK)) {
    currentSite = SITES.FACEBOOK;
  } else if (hostname.includes(SITES.INSTAGRAM)) {
    currentSite = SITES.INSTAGRAM;
  } else if (hostname.includes(SITES.TIKTOK)) {
    currentSite = SITES.TIKTOK;
  }
  console.log("FocusFeed: Current site identified as:", currentSite);
}

function actualHideFeedImplementation() {
  if (!currentSite || !SITE_SELECTORS[currentSite]) {
    console.log("FocusFeed: Site not supported or selectors not defined for hiding.");
    return false; // Indicate failure or not applicable
  }

  let feedFoundAndHidden = false;
  const selectors = SITE_SELECTORS[currentSite].feedContainers;
  const altSelectors = SITE_SELECTORS[currentSite].alternativeFeedContainers;

  // Try primary selectors
  if (selectors && selectors.length > 0) {
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`FocusFeed: Hiding element ${selector}`, element);
        element.classList.add('focusfeed-hidden');
        feedFoundAndHidden = true;
      });
    });
  }

  // If primary selectors didn't find anything, try alternative selectors
  if (!feedFoundAndHidden && altSelectors && altSelectors.length > 0) {
     altSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`FocusFeed: Hiding element using alternative selector ${selector}`, element);
        element.classList.add('focusfeed-hidden');
        feedFoundAndHidden = true;
      });
    });
  }

  if (!feedFoundAndHidden) {
    console.log(`FocusFeed: No feed elements found to hide for ${currentSite} with given selectors.`);
    return false;
  }
  return true; // Indicate success
}

function actualShowFeedImplementation() {
  if (!currentSite || !SITE_SELECTORS[currentSite]) {
    console.log("FocusFeed: Site not supported or selectors not defined for showing.");
    return;
  }

  const selectors = SITE_SELECTORS[currentSite].feedContainers;
  const altSelectors = SITE_SELECTORS[currentSite].alternativeFeedContainers;

  if (selectors && selectors.length > 0) {
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`FocusFeed: Showing element ${selector}`, element);
        element.classList.remove('focusfeed-hidden');
      });
    });
  }
  if (altSelectors && altSelectors.length > 0) {
    altSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        console.log(`FocusFeed: Showing element using alternative selector ${selector}`, element);
        element.classList.remove('focusfeed-hidden');
      });
    });
  }
}

function hideFeed() {
  if (feedHidden) return; // Already hidden

  console.log(`FocusFeed: Attempting to hide feed on ${currentSite}`);
  if (actualHideFeedImplementation()) {
    feedHidden = true;
    // Create and display motivational message container if not already present
    if (!document.getElementById('focusfeed-motivational-message')) {
      const motivationalMessageContainer = document.createElement('div');
      motivationalMessageContainer.id = 'focusfeed-motivational-message';
      motivationalMessageContainer.textContent = 'Your time is valuable. Do you really want to scroll?';
      document.body.appendChild(motivationalMessageContainer);
    }
  } else {
     // If hiding failed, still show message as an overlay
    if (!document.getElementById('focusfeed-motivational-message')) {
      const motivationalMessageContainer = document.createElement('div');
      motivationalMessageContainer.id = 'focusfeed-motivational-message';
      motivationalMessageContainer.textContent = 'FocusFeed: Trying to hide the feed. Your time is valuable!';
      document.body.appendChild(motivationalMessageContainer);
    }
  }
}

function showFeed() {
  if (!feedHidden) return; // Already visible or not managed by us

  console.log(`FocusFeed: Attempting to show feed on ${currentSite}`);
  actualShowFeedImplementation();
  feedHidden = false;

  const messageContainer = document.getElementById('focusfeed-motivational-message');
  if (messageContainer) {
    messageContainer.remove();
  }
}

// --- MutationObserver to handle dynamic content ---
function observeDOMChanges() {
  if (observer) observer.disconnect(); // Disconnect previous observer if any

  observer = new MutationObserver((mutationsList, observerInstance) => {
    // We only care if the feed should be hidden but isn't (e.g. new elements loaded)
    // Or if the message is there but feed elements became visible.
    chrome.storage.local.get(['focusFeedEnabled', 'unlockEndTime'], (result) => {
      const isEnabled = result.focusFeedEnabled === undefined ? true : result.focusFeedEnabled;
      const unlockEndTime = result.unlockEndTime || 0;
      const currentTime = new Date().getTime();

      if (isEnabled && currentTime > unlockEndTime) {
        if (!feedHidden) { // If it's supposed to be hidden but isn't marked as such
            console.log("FocusFeed (Observer): Feed should be hidden, re-applying.");
            hideFeed();
        } else { // It is marked as hidden, ensure elements are actually hidden
            // This check can be expensive, so use sparingly or make it more specific
            // For now, simply re-apply hideFeed if the message is missing for some reason
            if (!document.getElementById('focusfeed-motivational-message')) {
                 console.log("FocusFeed (Observer): Motivational message missing, re-applying hideFeed.");
                 feedHidden = false; // Force re-evaluation
                 hideFeed();
            } else {
                // If message is there, ensure feed elements are still hidden
                // This is a bit redundant if hideFeed() was successful and elements are static
                // But useful for SPAs that might re-render parts.
                actualHideFeedImplementation();
            }
        }
      } else {
        // If extension disabled or unlocked, ensure feed is visible
        if (feedHidden) { // If it's marked as hidden but shouldn't be
            console.log("FocusFeed (Observer): Feed should be visible, re-applying.");
            showFeed();
        }
      }
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  console.log("FocusFeed: MutationObserver started.");
}


// --- Main execution & Message Handling ---
identifySite();

// Initial check and hide/show based on stored state
chrome.storage.local.get(['focusFeedEnabled', 'unlockEndTime'], (result) => {
  const isEnabled = result.focusFeedEnabled === undefined ? true : result.focusFeedEnabled;
  const unlockEndTime = result.unlockEndTime || 0;
  const currentTime = new Date().getTime();

  if (isEnabled) {
    if (currentTime > unlockEndTime) {
      console.log("FocusFeed: Initial load, hiding feed.");
      hideFeed();
    } else {
      console.log("FocusFeed: Initial load, feed is temporarily unlocked.");
      showFeed(); // Ensure feed is visible and message is removed
    }
  } else {
    console.log("FocusFeed: Initial load, extension is disabled.");
    showFeed(); // Ensure feed is visible
  }
  // Start observing after initial setup
  if (currentSite && SITE_SELECTORS[currentSite]) { // Only observe on supported sites
    observeDOMChanges();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("FocusFeed: Message received in content.js", request);
  if (request.action === "TOGGLE_FEED") {
    if (request.hide) {
      hideFeed();
    } else {
      showFeed();
    }
    sendResponse({ status: "ok", visible: !request.hide, hiddenByScript: feedHidden });
  } else if (request.action === "CHECK_FEED_STATUS") {
    // Check if our message is visible as a proxy for hidden status
    // Or rely on the internal feedHidden state
    sendResponse({ isHidden: feedHidden, messageVisible: !!document.getElementById('focusfeed-motivational-message') });
    return true;
  }
});
