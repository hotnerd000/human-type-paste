# Human Type Paste

Chrome extension that types your text into a page field like a human — with a random characters-per-minute rate each minute and optional typos.

## Install

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `human-type-paste`

## Use

1. Open the site with the text field you want to fill
2. Click the extension icon
3. Paste/write your text
4. Set **Min / Max characters per minute** (a new rate is rolled every minute inside that range)
5. Set **Typo chance (%)**
6. Click **Pick field**, then click the target input/textarea on the page
7. Open the extension again and click **Start typing**
8. **Stop** or press **Esc** on the page to abort

## Notes

- Works on normal `http`/`https` pages (not `chrome://` pages)
- Supports `<input>`, `<textarea>`, and many `contenteditable` fields
- Settings and draft text are saved in extension storage
