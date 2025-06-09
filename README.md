# PR Diff Exporter

A Chrome extension that exports GitHub Pull Request diffs as Markdown files in a ZIP archive.

## Features

- Automatically generates Markdown files for each changed file in a PR
- Preserves code syntax highlighting
- Shows progress during export
- Works with large PRs (300+ files)
- One-click ZIP download
- Client-side only - no data leaves your machine

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/ehsankolivand/pr-diff-exporter.git
   cd pr-diff-exporter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## Usage

1. Navigate to any GitHub Pull Request's "Files changed" tab
2. Click the "Export diffs → ZIP" button in the bottom right corner
3. Wait for the export to complete
4. The ZIP file will be automatically downloaded

## Development

- Run in development mode with hot reloading:
  ```bash
  npm run dev
  ```

- Run tests:
  ```bash
  npm test
  ```

## Security

- No analytics or tracking
- Only runs on GitHub PR pages
- All processing happens client-side
- Minimal permissions required

## License

MIT License - see LICENSE file for details 
