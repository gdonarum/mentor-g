/**
 * Mentor G - Accordion Component
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

import { chevronDownSvg } from './mascot';

export interface AccordionSection {
  title: string;
  content: string;
}

export function createAccordion(sections: AccordionSection[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'accordion';

  sections.forEach((section) => {
    const item = document.createElement('div');
    item.className = 'accordion-item';

    item.innerHTML = `
      <button class="accordion-header">
        ${section.title}
        ${chevronDownSvg}
      </button>
      <div class="accordion-content">
        ${section.content}
      </div>
    `;

    container.appendChild(item);
  });

  return container;
}

export function setupAccordion(container: HTMLElement): void {
  const headers = container.querySelectorAll('.accordion-header');

  headers.forEach((header) => {
    header.addEventListener('click', () => {
      const isActive = header.classList.contains('active');

      // Close all
      headers.forEach((h) => {
        h.classList.remove('active');
        (h.nextElementSibling as HTMLElement)?.classList.remove('active');
      });

      // Toggle clicked
      if (!isActive) {
        header.classList.add('active');
        (header.nextElementSibling as HTMLElement)?.classList.add('active');
      }
    });
  });
}
