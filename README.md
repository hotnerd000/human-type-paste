# Human Type Paste

Chrome extension that types your text into a page field like a human — with a random characters-per-minute rate every 10 seconds and optional typos.

## Install

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `human-type-paste`

## Use

1. Open the site with the text field you want to fill
2. Click the extension icon
3. Paste/write your text
4. Set **Min / Max characters per minute** (a new rate is rolled every 10 seconds inside that range)
5. Set **Typo chance (%)**
6. Click **Pick field**, then click the target input/textarea on the page
7. Open the extension again and click **Start typing** (or use the shortcut)
8. **Stop**, press **Esc** on the page, or use the stop shortcut to abort

## Shortcuts

| Action | Default shortcut |
|--------|------------------|
| Start typing | `Alt`+`Shift`+`.` |
| Stop typing | `Alt`+`Shift`+`,` |

Change them anytime at `chrome://extensions/shortcuts`.

Shortcut Start uses the text + settings last saved in the popup, and types into the previously picked (or currently focused) field.

## Notes

- Works on normal `http`/`https` pages (not `chrome://` pages)
- Supports `<input>`, `<textarea>`, and many `contenteditable` fields
- Settings and draft text are saved in extension storage
