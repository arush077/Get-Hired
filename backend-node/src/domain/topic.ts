import { TopicStatus } from "./topic-status.js";

export class TopicEntry {
  id: string;
  label: string;
  source: string;
  primaryQuestion: string;
  priority: number;
  status: TopicStatus;
  questionsAsked: number;
  exhaustionReason: string | null;

  constructor(opts: {
    id: string;
    label: string;
    source: string;
    primaryQuestion: string;
    priority: number;
    status?: TopicStatus;
    questionsAsked?: number;
    exhaustionReason?: string | null;
  }) {
    this.id = opts.id;
    this.label = opts.label;
    this.source = opts.source;
    this.primaryQuestion = opts.primaryQuestion;
    this.priority = opts.priority;
    this.status = opts.status ?? TopicStatus.AVAILABLE;
    this.questionsAsked = opts.questionsAsked ?? 0;
    this.exhaustionReason = opts.exhaustionReason ?? null;
  }
}
