import './styles.css';
import { analyzeRobotLogs } from './api/anthropic';
import { parseDslog, parseDsevents, parseJavaFile, type ParsedLog } from './parsers/logs';
import { setupUploadZone } from './components/upload';
import { setupAccordion, createAccordion } from './components/accordion';
import { renderResults, showError, hideError, hideResults } from './components/results';
import { initSettings } from './components/settings';
import { performanceGuide } from './content/guide';
import type { LogFiles } from './types/analysis';

// State
let dslogFile: ParsedLog | null = null;
let dseventsFile: ParsedLog | null = null;
let robotJavaFile: ParsedLog | null = null;

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

  setupUploadZone(dslogZone, async (file) => {
    dslogFile = await parseDslog(file);
  });

  setupUploadZone(dseventsZone, async (file) => {
    dseventsFile = await parseDsevents(file);
  });

  // Robot.java upload handling
  robotJavaInput.addEventListener('change', async () => {
    const file = robotJavaInput.files?.[0];
    if (file) {
      robotJavaFile = await parseJavaFile(file);
      // Re-run analysis with Robot.java
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

  if (robotJavaFile) {
    logs.robotJava = {
      filename: robotJavaFile.filename,
      content: robotJavaFile.content,
    };
  }

  return logs;
}

// Run analysis
async function runAnalysis(): Promise<void> {
  const problem = problemText.value.trim();
  const logs = buildLogFiles();

  if (!problem && !logs.dslog && !logs.dsevents) {
    showError(analyzeTab, 'Please describe the problem or upload at least one log file.');
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.classList.add('loading');
  hideError(analyzeTab);
  hideResults(analyzeTab);

  try {
    const analysis = await analyzeRobotLogs(logs, problem);

    renderResults(analyzeTab, analysis, !!robotJavaFile, () => {
      robotJavaInput.click();
    });
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

  analyzeBtn.addEventListener('click', runAnalysis);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
