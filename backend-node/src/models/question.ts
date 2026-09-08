import { randomUUID } from "node:crypto";
import { QuestionType } from "./question-type.js";

export class Question {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;

  constructor(opts?: {
    id?: string;
    text?: string;
    questionType?: QuestionType;
    order?: number;
  }) {
    this.id = opts?.id ?? randomUUID();
    this.text = opts?.text ?? "";
    this.questionType = opts?.questionType ?? QuestionType.PRIMARY;
    this.order = opts?.order ?? 0;
  }
}
