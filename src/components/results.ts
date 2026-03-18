import type { AnalysisResponse, Finding } from '../types/analysis';
import { mascotSmallSvg } from './mascot';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createFindingElement(finding: Finding): HTMLElement {
  const div = document.createElement('div');
  div.className = `finding ${finding.severity}`;

  let html = `
    <div class="finding-header">
      <span class="severity-pill ${finding.severity}">${finding.severity}</span>
      <h4>${escapeHtml(finding.title)}</h4>
    </div>
    <p class="finding-description">${escapeHtml(finding.description)}</p>
    <div class="fix-box">
      <strong>Fix:</strong> ${escapeHtml(finding.fix)}
    </div>
  `;

  if (finding.codeSnippet) {
    html += `<pre class="code-snippet">${escapeHtml(finding.codeSnippet)}</pre>`;
  }

  div.innerHTML = html;
  return div;
}

export function renderResults(
  container: HTMLElement,
  analysis: AnalysisResponse,
  hasRobotJava: boolean,
  onUploadRobotJava: () => void
): void {
  const resultsDiv = container.querySelector('#results') as HTMLElement;
  const summaryText = container.querySelector('#summary-text') as HTMLElement;
  const findingsContainer = container.querySelector('#findings-container') as HTMLElement;
  const robotJavaBanner = container.querySelector('#robot-java-banner') as HTMLElement;
  const robotJavaReason = container.querySelector('#robot-java-reason') as HTMLElement;
  const robotJavaBtn = container.querySelector('#robot-java-btn') as HTMLElement;

  // Summary
  summaryText.textContent = analysis.summary;

  // Robot.java banner
  if (analysis.needsRobotJava && !hasRobotJava) {
    robotJavaReason.textContent =
      analysis.robotJavaReason || "I'd like to see your Robot.java to help diagnose this better!";
    robotJavaBanner.classList.add('visible');
    robotJavaBtn.onclick = onUploadRobotJava;
  } else {
    robotJavaBanner.classList.remove('visible');
  }

  // Findings
  findingsContainer.innerHTML = '';

  if (analysis.findings && analysis.findings.length > 0) {
    analysis.findings.forEach((finding) => {
      findingsContainer.appendChild(createFindingElement(finding));
    });
  }

  resultsDiv.classList.add('visible');
}

export function createResultsSection(): string {
  return `
    <div class="results" id="results">
      <div class="results-header">
        ${mascotSmallSvg}
        <h3>Mentor G's Analysis</h3>
      </div>

      <div class="summary-box" id="summary-box">
        <h4>Summary</h4>
        <p id="summary-text"></p>
      </div>

      <div class="robot-java-banner" id="robot-java-banner">
        <p id="robot-java-reason">I'd like to see your code to help further!</p>
        <button class="upload-btn" id="robot-java-btn">Upload Java File</button>
        <input type="file" id="robot-java-input" accept=".java" style="display: none;">
      </div>

      <div id="findings-container"></div>
    </div>
  `;
}

export function hideResults(container: HTMLElement): void {
  const resultsDiv = container.querySelector('#results') as HTMLElement;
  resultsDiv?.classList.remove('visible');
}

export function showError(container: HTMLElement, message: string): void {
  const errorBox = container.querySelector('#error-box') as HTMLElement;
  const errorText = container.querySelector('#error-text') as HTMLElement;
  errorText.textContent = message;
  errorBox.classList.add('visible');
}

export function hideError(container: HTMLElement): void {
  const errorBox = container.querySelector('#error-box') as HTMLElement;
  errorBox?.classList.remove('visible');
}
