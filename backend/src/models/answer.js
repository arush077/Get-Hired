import { randomUUID } from "node:crypto";
import { AnswerStatus } from "./answer-status.js";

export class Answer {
  constructor(opts) {
    this.questionId = opts?.questionId ?? randomUUID();
    this.transcript = opts?.transcript ?? "";
    this.answerStatus = opts?.answerStatus ?? null;
    this.timestamp = opts?.timestamp ?? new Date();
  }
}
