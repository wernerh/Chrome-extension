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
  if (feedHidden) { // If already marked as hidden, ensure blur is applied if body doesn't have it
    if (!document.body.classList.contains('focusfeed-blur-effect')) {
      document.body.classList.add('focusfeed-blur-effect');
    }
    return;
  }

  console.log(`FocusFeed: Attempting to hide feed on ${currentSite}`);
  if (actualHideFeedImplementation()) { // This hides the specific feed elements
    feedHidden = true;
    // Create and display motivational message container if not already present
    if (!document.getElementById('focusfeed-motivational-message')) {
      const motivationalMessageContainer = document.createElement('div');
      motivationalMessageContainer.id = 'focusfeed-motivational-message';
      motivationalMessageContainer.textContent = 'Your time is valuable. Do you really want to scroll?';
      document.body.appendChild(motivationalMessageContainer);
    }
    document.body.classList.add('focusfeed-blur-effect'); // Apply blur
  } else {
     // If hiding specific feed elements failed, still show message and apply blur
    if (!document.getElementById('focusfeed-motivational-message')) {
      const motivationalMessageContainer = document.createElement('div');
      motivationalMessageContainer.id = 'focusfeed-motivational-message';
      motivationalMessageContainer.textContent = 'FocusFeed: Trying to hide the feed. Your time is valuable!';
      document.body.appendChild(motivationalMessageContainer);
    }
    document.body.classList.add('focusfeed-blur-effect'); // Apply blur
  }
}

function showFeed() {
  // If not hidden by us, or if blur is already removed, do nothing extra for this call.
  if (!feedHidden && !document.body.classList.contains('focusfeed-blur-effect')) return;


  console.log(`FocusFeed: Attempting to show feed on ${currentSite}`);
  document.body.classList.remove('focusfeed-blur-effect'); // Remove blur first
  actualShowFeedImplementation(); // This shows the specific feed elements
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

    if (isEnabled && currentTime > unlockEndTime) { // Feed should be hidden
      if (!feedHidden) {
        console.log("FocusFeed (Observer): State indicates feed should be hidden, but not marked. Calling hideFeed().");
        hideFeed(); // This will apply message, hide elements, and apply body blur.
      } else {
        // Feed is marked as hidden. Let's ensure consistency.
        // 1. Ensure message is visible
        if (!document.getElementById('focusfeed-motivational-message')) {
          console.log("FocusFeed (Observer): Motivational message missing, re-applying hideFeed.");
          feedHidden = false; // Force re-evaluation by hideFeed
          hideFeed(); // This will re-add message and ensure blur.
        } else {
          // 2. Message is visible, ensure feed elements are still hidden (SPA might re-render them)
          actualHideFeedImplementation(); // Re-hide specific feed elements
          // 3. Ensure body blur is active
          if (!document.body.classList.contains('focusfeed-blur-effect')) {
            console.log("FocusFeed (Observer): Body blur missing, re-applying.");
            document.body.classList.add('focusfeed-blur-effect');
          }
        }
      }
    } else { // Feed should be shown (extension disabled or unlocked)
      if (feedHidden) {
        console.log("FocusFeed (Observer): State indicates feed should be shown, but marked hidden. Calling showFeed().");
        showFeed(); // This will remove message, show elements, and remove body blur.
      } else {
        // Feed not marked as hidden. Let's ensure no residual blur.
        if (document.body.classList.contains('focusfeed-blur-effect')) {
          console.log("FocusFeed (Observer): Body blur present when it shouldn't be, removing.");
          document.body.classList.remove('focusfeed-blur-effect');
        }
        // Also ensure no residual message if feed is not marked hidden
        const messageContainer = document.getElementById('focusfeed-motivational-message');
        if (messageContainer) {
            console.log("FocusFeed (Observer): Motivational message present when it shouldn't be, removing.");
            messageContainer.remove();
        }
      }
    }
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
