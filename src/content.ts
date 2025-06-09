import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface DiffHunk {
  before: string;
  after: string;
  filePath: string;
  extension: string;
  baseName: string;
  tooLarge?: boolean;
  notInline?: boolean;
  isNewFile?: boolean;
}

class PRDiffExporter {
  private zip: JSZip;
  private progressBar: HTMLDivElement;
  private exportButton: HTMLButtonElement;

  constructor() {
    this.zip = new JSZip();
    this.progressBar = this.createProgressBar();
    this.exportButton = this.createExportButton();
  }

  private createProgressBar(): HTMLDivElement {
    const progressBar = document.createElement('div');
    progressBar.className = 'pr-diff-exporter-progress';
    progressBar.style.display = 'none';
    document.body.appendChild(progressBar);
    return progressBar;
  }

  private createExportButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'pr-diff-exporter-button';
    button.textContent = 'Export diffs → ZIP';
    button.addEventListener('click', () => this.handleExportClick());
    document.body.appendChild(button);
    return button;
  }

  private updateProgress(current: number, total: number, message?: string): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.progressBar.style.display = 'block';
    this.progressBar.textContent = message || `Processing files: ${percentage}% (${current}/${total})`;
  }

  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private getBaseName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private isBinaryFile(file: Element): boolean {
    // GitHub marks binary diffs with .diff-view-binary or .rendered.
    return !!file.querySelector('.diff-view-binary, .rendered');
  }

  private isNewFile(file: Element): boolean {
    // Check for 'new file' label or text
    const info = file.querySelector('.file-info, .file-header');
    if (!info) return false;
    const label = info.querySelector('.Label--success, .Label')?.textContent?.toLowerCase() || '';
    if (label.includes('new file') || label.includes('added')) return true;
    // Fallback: check for text 'new file' in file info
    if (info.textContent?.toLowerCase().includes('new file')) return true;
    return false;
  }

  // Only click on button/summary, not <a> links. If only <a> links, mark as notInline.
  private async tryLoadLargeDiff(file: Element): Promise<'loaded' | 'tooLarge' | 'notInline'> {
    const keywords = [
      'load diff',
      'view file',
      'show diff',
      'display the diff',
      'load this diff',
      'show this diff'
    ];
    let loaded = false;
    let notInline = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      // Only select button or summary (not a)
      const btn = Array.from(file.querySelectorAll('button, summary'))
        .find(el => {
          const txt = el.textContent?.toLowerCase() || '';
          return keywords.some(k => txt.includes(k));
        }) as HTMLElement | undefined;
      // If only <a> links are present
      const aLink = Array.from(file.querySelectorAll('a'))
        .find(el => {
          const txt = el.textContent?.toLowerCase() || '';
          return keywords.some(k => txt.includes(k));
        });
      if (!btn && aLink) {
        notInline = true;
        break;
      }
      if (btn) {
        btn.click();
        await new Promise(res => setTimeout(res, 1200));
      } else {
        // If no button found, check if diff is now loaded
        const beforeBlocks = file.querySelectorAll('.blob-code-deletion');
        const afterBlocks = file.querySelectorAll('.blob-code-addition');
        if (beforeBlocks.length > 0 || afterBlocks.length > 0) {
          loaded = true;
          break;
        }
        // Also check for too large message
        if (file.textContent?.toLowerCase().includes('diff is too large to display')) {
          break;
        }
        await new Promise(res => setTimeout(res, 600));
      }
    }
    if (notInline) return 'notInline';
    if (loaded) return 'loaded';
    return 'tooLarge';
  }

  private async processDiff(file: Element): Promise<DiffHunk | null> {
    const filePath = file.querySelector('.file-info a')?.textContent?.trim();
    if (!filePath) return null;

    if (this.isBinaryFile(file)) {
      return {
        before: '',
        after: '',
        filePath,
        extension: this.getFileExtension(filePath),
        baseName: this.getBaseName(filePath)
      };
    }

    const isNew = this.isNewFile(file);
    let beforeBlocks = Array.from(file.querySelectorAll('.blob-code-deletion'));
    let afterBlocks = Array.from(file.querySelectorAll('.blob-code-addition'));
    let tooLarge = false;
    let notInline = false;
    let after = '';
    let before = '';

    if (isNew) {
      // For new files, get all lines (not just additions)
      const allLines = Array.from(file.querySelectorAll('.blob-code'));
      after = allLines.map(block => block.textContent || '').join('\n');
      before = 'This file did not exist before.';
    } else {
      if (beforeBlocks.length === 0 && afterBlocks.length === 0) {
        const loadResult = await this.tryLoadLargeDiff(file);
        beforeBlocks = Array.from(file.querySelectorAll('.blob-code-deletion'));
        afterBlocks = Array.from(file.querySelectorAll('.blob-code-addition'));
        if (loadResult === 'tooLarge' && (file.textContent?.toLowerCase().includes('diff is too large to display') || file.textContent?.toLowerCase().includes('too large to render'))) {
          tooLarge = true;
        }
        if (loadResult === 'notInline') {
          notInline = true;
        }
      }
      before = beforeBlocks.map(block => block.textContent || '').join('\n');
      after = afterBlocks.map(block => block.textContent || '').join('\n');
    }

    const extension = this.getFileExtension(filePath);
    const baseName = this.getBaseName(filePath);

    return {
      before,
      after,
      filePath,
      extension,
      baseName,
      tooLarge,
      notInline,
      isNewFile: isNew
    };
  }

  private createMarkdownContent(diff: DiffHunk): string {
    if (diff.notInline) {
      return `# ${diff.baseName}\n\nDiff not available inline. Please view the file directly on GitHub.`;
    }
    if (diff.tooLarge) {
      return `# ${diff.baseName}\n\nDiff too large to display on GitHub. Not available for export.`;
    }
    if (diff.isNewFile) {
      return `# ${diff.baseName}\n\n## Before\nThis file did not exist before.\n\n## After\n\`\`\`${diff.extension}\n${diff.after}\n\`\`\`\n`;
    }
    if (diff.before === '' && diff.after === '') {
      return `# ${diff.baseName}\n\nNo textual changes, file is binary, or too large to display.`;
    }
    return `# ${diff.baseName}\n\n## Before\n\`\`\`${diff.extension}\n${diff.before}\n\`\`\`\n\n## After\n\`\`\`${diff.extension}\n${diff.after}\n\`\`\`\n`;
  }

  // --- NEW: Auto-scroll and load all diffs before extraction ---
  private async loadAllDiffs(): Promise<void> {
    let lastFileCount = 0;
    let stableCount = 0;
    let tries = 0;
    const maxTries = 50; // Prevent infinite loop
    while (tries < maxTries) {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      // Click any 'Load more' or 'Show more' buttons
      const moreBtns = Array.from(document.querySelectorAll('button, summary')).filter(
        el => /load more|show more|expand/.test(el.textContent?.toLowerCase() || '')
      ) as HTMLElement[];
      moreBtns.forEach(btn => btn.click());
      // Wait for DOM update
      await new Promise(res => setTimeout(res, 800));
      const files = document.querySelectorAll('.file');
      if (files.length === lastFileCount) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      lastFileCount = files.length;
      this.updateProgress(lastFileCount, 0, `Loading all diffs... (${lastFileCount} files)`);
      if (stableCount >= 3) break; // Consider loaded if count hasn't changed for 3 cycles
      tries++;
    }
    window.scrollTo(0, 0);
    this.progressBar.style.display = 'none';
  }

  private async handleExportClick(): Promise<void> {
    this.exportButton.disabled = true;
    this.updateProgress(0, 0, 'Loading all diffs...');
    await this.loadAllDiffs();
    await this.exportDiffs();
  }

  private async exportDiffs(): Promise<void> {
    try {
      const files = Array.from(document.querySelectorAll('.file'));
      const totalFiles = files.length;
      let processedFiles = 0;
      const folder = this.zip.folder('diffs');

      for (const file of files) {
        const diff = await this.processDiff(file);
        if (diff) {
          const markdownContent = this.createMarkdownContent(diff);
          folder?.file(`${diff.baseName}.md`, markdownContent);
        }
        processedFiles++;
        this.updateProgress(processedFiles, totalFiles);
      }

      const zipBlob = await this.zip.generateAsync({ type: 'blob' });
      const repoName = window.location.pathname.split('/')[2];
      const prNumber = window.location.pathname.split('/')[4];
      saveAs(zipBlob, `${repoName}-pr${prNumber}-diffs.zip`);

    } catch (error) {
      console.error('Error exporting diffs:', error);
      alert('An error occurred while exporting the diffs. Please try again.');
    } finally {
      this.exportButton.disabled = false;
      this.progressBar.style.display = 'none';
    }
  }
}

// Initialize the exporter when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PRDiffExporter());
} else {
  new PRDiffExporter();
} 