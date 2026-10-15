import { readHistory, readJDCV } from "../record.ts";

export async function generateEvaluationPrompt(uuid: string) {
    const { jd, cv } = await readJDCV(uuid);
    const transcript = await readHistory(uuid);

    return `You are evaluating an English-language mock interview after the session has ended.
The transcript below came from speech recognition, so minor STT artifacts such as punctuation errors
or homophone mistakes should not be nitpicked unless they materially affect meaning.
Use the persisted JD (Job Description) and CV Instruction as the scenario for judging content quality.
Return qualitative feedback only. Do not include numeric scores.
Write markdown with these sections:
1. Language
- CEFR grade (A1-C2)
- Incorrect word usage as what you said -> what a native speaker would say -> why
- Filler-word count plus the actual fillers used
- Recurring grammar patterns only
2. Content
- Short per-question assessment
- Strongest answer
- Weakest answer
3. Overall
- A 2-3 sentence summary
- Top 3 things to practice next

JD Instruction:
${jd}

CV Instruction:
${cv}

Transcript:
${transcript}`;
}
