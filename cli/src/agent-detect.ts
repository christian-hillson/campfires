import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AgentDetectionResult {
  detected: boolean;
  agentName: string | null;
}

interface DetectionSignal {
  name: string;
  dirName: string;
}

// Extensible list of agent detection signals
const DETECTION_SIGNALS: DetectionSignal[] = [
  { name: 'Claude', dirName: '.claude' },
  // Future: { name: 'Cursor', dirName: '.cursor' },
  // Future: { name: 'Aider', dirName: '.aider' },
];

export function detectAgent(workDir: string): AgentDetectionResult {
  for (const signal of DETECTION_SIGNALS) {
    const signalPath = join(workDir, signal.dirName);
    if (existsSync(signalPath)) {
      return { detected: true, agentName: signal.name };
    }
  }

  return { detected: false, agentName: null };
}
