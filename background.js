/* Copyright 2023 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License. */

/**
 * Block file message HTML
 */
const newHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Blocked File</title>
</head>
<body>
  <p>This file type is not allowed.</p>
</body>
</html>`;

const BLOCKED_DATA_URL = "data:text/html," + encodeURIComponent(newHTML);

/**
 * Sync managed storage into local storage on startup and listen for changes (b/528741643)
 */
function syncManagedStorage() {
  chrome.storage.managed.get('blocktypes', function (data) {
    if (chrome.runtime.lastError) {
      console.warn('Managed storage unavailable:', chrome.runtime.lastError.message);
      return;
    }
    if (data && data.blocktypes) {
      chrome.storage.local.set({ blocktypes: data.blocktypes });
    }
  });
}

// Initial sync
syncManagedStorage();

// Listen for managed storage updates (b/528741643)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'managed' && changes.blocktypes) {
    chrome.storage.local.set({ blocktypes: changes.blocktypes.newValue });
  }
});

/**
 * Retrieve blocked file types from managed storage with fallback to local storage (b/528741643)
 * @returns {Promise<string[]>}
 */
async function getBlockedTypes() {
  return new Promise((resolve) => {
    chrome.storage.managed.get('blocktypes', (managedData) => {
      if (!chrome.runtime.lastError && managedData && Array.isArray(managedData.blocktypes)) {
        return resolve(managedData.blocktypes);
      }
      chrome.storage.local.get('blocktypes', (localData) => {
        if (!chrome.runtime.lastError && localData && Array.isArray(localData.blocktypes)) {
          return resolve(localData.blocktypes);
        }
        resolve([]);
      });
    });
  });
}

/**
 * Check if a URL should be blocked based on configured file types
 * @param {string} rawUrl
 * @param {string[]} filetypes
 * @returns {boolean}
 */
function isBlockedUrl(rawUrl, filetypes) {
  if (!rawUrl || !Array.isArray(filetypes) || filetypes.length === 0) {
    return false;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (e) {
    return false;
  }

  // Anchor scheme check to file: protocol only (b/528741836)
  if (parsedUrl.protocol !== 'file:') {
    return false;
  }

  // Extract clean pathname without query string or hash (b/528742317)
  let pathname = parsedUrl.pathname || '';
  try {
    pathname = decodeURIComponent(pathname);
  } catch (e) {
    // Keep raw pathname if decoding fails
  }

  // Normalize Windows trailing dots and spaces (b/528741642)
  pathname = pathname.replace(/[.\s]+$/, '').toLowerCase(); // case-insensitive (b/528741466)

  for (const rawType of filetypes) {
    if (!rawType || typeof rawType !== 'string') continue;
    try {
      // Normalize extension: remove leading dot and whitespace (b/528741466, b/528741827)
      const cleanType = rawType.replace(/^\.+/, '').trim().toLowerCase();
      if (!cleanType) continue;

      // Safe matching: ensure dot precedes the extension or pathname ends with .<ext> (b/528741827)
      const targetExt = '.' + cleanType;
      if (pathname.endsWith(targetExt)) {
        return true;
      }
    } catch (err) {
      // Catch individual malformed type errors so one bad entry never disables enforcement (b/528741827)
      console.warn('Error processing blocked file type:', rawType, err);
    }
  }

  return false;
}

/**
 * Check the URL of the tab and redirect if blocked.
 * @param {number} tabId
 * @param {string} url
 */
async function checkAndBlockTab(tabId, url) {
  if (!url || !tabId) return;
  const filetypes = await getBlockedTypes();
  if (isBlockedUrl(url, filetypes)) {
    // In-place atomic redirection prevents duplicate tab creation and race conditions (b/528741484, b/528741837)
    chrome.tabs.update(tabId, { url: BLOCKED_DATA_URL });
  }
}

/**
 * Listen for activated tab and check the url
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    checkAndBlockTab(tab.id, tab.url);
  });
});

/**
 * Listen for tab updates and block immediately at navigation start (b/528741484, b/528741837)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check on loading status or URL change to prevent multiple duplicate firings
  const urlToCheck = changeInfo.url || (changeInfo.status === 'loading' ? tab.url : null);
  if (urlToCheck) {
    checkAndBlockTab(tabId, urlToCheck);
  }
});
