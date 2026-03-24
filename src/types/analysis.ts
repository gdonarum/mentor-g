/**
 * Mentor G - Type Definitions
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

export type Severity = 'critical' | 'warning' | 'info' | 'good';

export interface Finding {
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  codeSnippet?: string;
}

export interface AnalysisResponse {
  summary: string;
  needsRobotJava: boolean;
  robotJavaReason?: string;
  findings: Finding[];
}

export interface LogFiles {
  dslog?: {
    filename: string;
    content: string;
  };
  dsevents?: {
    filename: string;
    content: string;
  };
  wpilog?: {
    filename: string;
    content: string;
  };
  javaFiles?: Array<{
    filename: string;
    content: string;
  }>;
}
