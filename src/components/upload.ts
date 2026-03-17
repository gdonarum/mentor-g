import { uploadIconSvg } from './mascot';

export interface UploadZoneConfig {
  id: string;
  title: string;
  subtitle: string;
  accept: string;
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
  zone.classList.add('has-file');
  filenameEl.textContent = file.name;
  onFileSelected(file);
}
