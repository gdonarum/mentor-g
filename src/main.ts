/**
 * Mentor G - FRC Robot Diagnostics Application
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

import './styles.css';

declare const __COMMIT_SHA__: string;
import { analyzeRobotLogs } from './api/anthropic';
import { parseDslog, parseDsevents, parseWpilog, parseJavaFile, type ParsedLog } from './parsers/logs';
import { setupUploadZone } from './components/upload';
import { setupAccordion, createAccordion } from './components/accordion';
import { renderResults, showError, hideError, hideResults } from './components/results';
import { initSettings } from './components/settings';
import { initFeedbackForm } from './components/feedback';
import { performanceGuide } from './content/guide';
import type { LogFiles } from './types/analysis';

// State
let dslogFile: ParsedLog | null = null;
let dseventsFile: ParsedLog | null = null;
let wpilogFile: ParsedLog | null = null;
let javaFiles: ParsedLog[] = [];

// DOM Elements
const analyzeTab = document.getElementById('analyze')!;
const guideTab = document.getElementById('guide')!;
const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
const problemText = document.getElementById('problem-text') as HTMLTextAreaElement;
const robotJavaInput = document.getElementById('robot-java-input') as HTMLInputElement;

// Initialize tabs
function initTabs(): void {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.tab;
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId!)?.classList.add('active');
    });
  });
}

// Initialize upload zones
function initUploadZones(): void {
  const dslogZone = document.getElementById('dslog-zone')!;
  const dseventsZone = document.getElementById('dsevents-zone')!;
  const wpilogZone = document.getElementById('wpilog-zone')!;

  setupUploadZone(dslogZone, async (file) => {
    dslogFile = await parseDslog(file);
  });

  setupUploadZone(dseventsZone, async (file) => {
    dseventsFile = await parseDsevents(file);
  });

  setupUploadZone(wpilogZone, async (file) => {
    wpilogFile = await parseWpilog(file);
  });

  // Java files upload handling (supports multiple files)
  robotJavaInput.addEventListener('change', async () => {
    const files = robotJavaInput.files;
    if (files && files.length > 0) {
      javaFiles = [];
      for (const file of Array.from(files)) {
        const parsed = await parseJavaFile(file);
        javaFiles.push(parsed);
      }
      // Re-run analysis with Java files
      await runAnalysis();
    }
  });
}

// Initialize performance guide accordion
function initGuide(): void {
  const faqSection = guideTab.querySelector('.faq-section')!;
  const accordion = createAccordion(performanceGuide);
  faqSection.appendChild(accordion);
  setupAccordion(faqSection as HTMLElement);
}

// Build log files object for API
function buildLogFiles(): LogFiles {
  const logs: LogFiles = {};

  if (dslogFile) {
    logs.dslog = {
      filename: dslogFile.filename,
      content: dslogFile.content,
    };
  }

  if (dseventsFile) {
    logs.dsevents = {
      filename: dseventsFile.filename,
      content: dseventsFile.content,
    };
  }

  if (wpilogFile) {
    logs.wpilog = {
      filename: wpilogFile.filename,
      content: wpilogFile.content,
    };
  }

  if (javaFiles.length > 0) {
    logs.javaFiles = javaFiles.map((f) => ({
      filename: f.filename,
      content: f.content,
    }));
  }

  return logs;
}

// Run analysis
async function runAnalysis(): Promise<void> {
  const problem = problemText.value.trim();
  const logs = buildLogFiles();

  if (!problem && !logs.dslog && !logs.dsevents && !logs.wpilog) {
    showError(analyzeTab, 'Please describe the problem or upload at least one log file.');
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.classList.add('loading');
  hideError(analyzeTab);
  hideResults(analyzeTab);

  try {
    const analysis = await analyzeRobotLogs(logs, problem);

    const uploadedFilenames = [
      dslogFile?.filename,
      dseventsFile?.filename,
      wpilogFile?.filename,
      ...javaFiles.map((f) => f.filename),
    ].filter((n): n is string => !!n);

    renderResults(analyzeTab, analysis, javaFiles.length > 0, () => {
      robotJavaInput.click();
    }, uploadedFilenames);
  } catch (error) {
    showError(analyzeTab, `Analysis failed: ${(error as Error).message}`);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('loading');
  }
}

// Initialize
function init(): void {
  initTabs();
  initUploadZones();
  initGuide();
  initSettings();
  initFeedbackForm();

  analyzeBtn.addEventListener('click', runAnalysis);

  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = `build: ${__COMMIT_SHA__}`;
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
