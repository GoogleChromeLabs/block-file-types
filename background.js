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
 * Block file message
 */
const newHTML = `<html>
<head>
  <title>Blocked File</title>
</head>
<body>
  <p>This file type is not allowed.</p>
</body>
</html>`;

/**
 * Set the blocked file types in the storage
 */
chrome.storage.managed.get('blocktypes', function (data) {
  chrome.storage.local.set(data);
});

/**
 * Listen for activated tab and check the url
 */
chrome.tabs.onActivated.addListener((req) => {
  chrome.tabs.get(req.tabId, (res) => {
    checkUrl(res);
  })
})

/**
 * Listen for tab to be updated and check the url
 */
chrome.tabs.onUpdated.addListener(req => {
  chrome.tabs.get(req, (res) => {
    checkUrl(res);
  })
})

/**
 * Check the url of the tab and block if it is a file://
 * and matches the file extension.
 * @param {Tab} res
 * @returns
 */
async function checkUrl(res) {
  const filetypes = await getStorage('blocktypes');
  if (!filetypes || filetypes.length == 0) return
  let block = false
  filetypes.forEach(type => {
    const ext = `${type}$`;
    const re = new RegExp(ext);
    const schema = new RegExp('file://');
    if (!block) {
      if (schema.test(res.url) && re.test(res.url)) {
        block = true;
      }
    }
  })
  if (!block) return;
  chrome.tabs.remove(res.id);
  const newurl = "data:text/html," + encodeURIComponent(newHTML);
  chrome.tabs.create({ url: newurl });
}

/**
 * Get the values from Storage
 * @param {string} item -Storage item
 * @returns
 */
function getStorage(item) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(item, (res) => {
      resolve(res[item]);
    });
  });
}
