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
 * Trigger the check on load of the DOM
 */
document.addEventListener("DOMContentLoaded", function (event) {
  checkfile();
});


/**
 * Check that the filetype is allowed
 * @returns void
 */
async function checkfile() {
  const filetypes = await getStorage('blocktypes');
  if (!filetypes || filetypes.length == 0) return
  let block = false
  const url = window.href
  filetypes.forEach(type => {
    const ext = `${type}$`
    const re = new RegExp(ext)
    const schema = new RegExp('file://')
    if (!block) {
      if (schema.test(url) && re.test(url)) {
        block = true
        rewrite()
      }
    }
  })
}

/**
 * Rewrite the site if the file is blocked
 */
function rewrite() {
  newHTML = `<html>
<head>
  <title>Blocked File</title>
</head>
<body>
  <p>This file type is not allowed.</p>
</body>
</html>`;

  document.open();
  document.write(newHTML);
  document.close();
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
