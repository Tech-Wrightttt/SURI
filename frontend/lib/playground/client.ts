import {
  checkPlaygroundAnswer,
  getPlaygroundSitting,
  getPlaygroundTopics,
  revealPlaygroundAnswer,
  type PlaygroundCheckResult,
  type PlaygroundDifficulty,
  type PlaygroundReveal,
  type PlaygroundSitting,
  type PlaygroundTopics,
} from "../api";
import { mockPlayground } from "./mock";

export interface PlaygroundClient {
  getTopics(): Promise<PlaygroundTopics>;
  getSitting(nodeId: string, difficulty: PlaygroundDifficulty): Promise<PlaygroundSitting>;
  check(problemId: string, answerLatex: string): Promise<PlaygroundCheckResult>;
  reveal(problemId: string): Promise<PlaygroundReveal>;
}

const realPlayground: PlaygroundClient = {
  getTopics: getPlaygroundTopics,
  getSitting: getPlaygroundSitting,
  check: checkPlaygroundAnswer,
  reveal: revealPlaygroundAnswer,
};

const USE_MOCK = true; // <- flip to false once the backend /api/playground routes are live

export const playground: PlaygroundClient = USE_MOCK ? mockPlayground : realPlayground;
