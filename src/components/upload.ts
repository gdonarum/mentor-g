import { uploadIconSvg } from './mascot';

export interface UploadZoneConfig {
  id: string;
  title: string;
  subtitle: string;
  accept: string;
}

// 10 MB — large enough for any realistic FRC log, small enough to prevent browser DoS
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Returns true if the file's extension matches one of the comma-separated
 * patterns in the input's `accept` attribute (e.g. ".dslog,.dsevents").
 * This replicates the browser's own `accept` filtering for drag-and-drop,
 * which the browser does NOT enforce on its own.
 */
function isFileTypeAccepted(file: File, input: HTMLInputElement): boolean {
  const accepted = input.accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (accepted.length === 0) return true; // no restriction configured

  const name = file.name.toLowerCase();
  return accepted.some((pattern) => {
    if (pattern.startsWith('.')) return name.endsWith(pattern); // extension match
    if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -1)); // MIME prefix
    return file.type === pattern; // exact MIME
  });
}

export function createUploadZone(config: UploadZoneConfig): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'upload-zone';
  zone.id = `${config.id}-zone`;

  zone.innerHTML = `
    ${uploadIconSvg}
    <h4>${config.title}</h4>
    <p>${config.subtitle}</p>
    <p class="filename"></p>
    <input type="file" id="${config.id}-input" accept="${config.accept}">
  `;

  return zone;
}

export function setupUploadZone(
  zone: HTMLElement,
  onFileSelected: (file: File) => void
): void {
  const input = zone.querySelector('input[type="file"]') as HTMLInputElement;
  const filenameEl = zone.querySelector('.filename') as HTMLElement;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) {
      // Enforce the `accept` filter for drag-and-drop (browser skips this automatically)
      if (!isFileTypeAccepted(file, input)) {
        filenameEl.textContent = `Unsupported file type: ${file.name}`;
        return;
      }
      handleFile(file, zone, filenameEl, onFileSelected);
    }
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      handleFile(file, zone, filenameEl, onFileSelected);
    }
  });
}

function handleFile(
  file: File,
  zone: HTMLElement,
  filenameEl: HTMLElement,
  onFileSelected: (file: File) => void
): void {
  // Reject files large enough to freeze the browser tab before any parsing begins
  if (file.size > MAX_FILE_SIZE) {
    filenameEl.textContent = `File too large: ${file.name} (max 10 MB)`;
    return;
  }

  zone.classList.add('has-file');
  filenameEl.textContent = file.name;
  onFileSelected(file);
}
