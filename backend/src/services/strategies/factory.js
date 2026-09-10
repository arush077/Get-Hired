import { InterviewMode } from "../../models/interview-mode.js";
import { ResumeDeepDiveStrategy } from "./resume-deep-dive.js";
import { TechnicalStrategy } from "./technical.js";
import { HRScreeningStrategy } from "./hr-screening.js";
import { MixedInterviewStrategy } from "./mixed.js";

const STRATEGIES = {
  [InterviewMode.RESUME_DEEP_DIVE]: () => new ResumeDeepDiveStrategy(),
  [InterviewMode.TECHNICAL]: () => new TechnicalStrategy(),
  [InterviewMode.HR_SCREENING]: () => new HRScreeningStrategy(),
  [InterviewMode.MIXED]: () => new MixedInterviewStrategy(),
};

export class InterviewStrategyFactory {
  static get(mode) {
    const factory = STRATEGIES[mode];
    if (!factory) {
      throw new Error(`Unsupported interview mode: ${mode}`);
    }
    return factory();
  }
}
