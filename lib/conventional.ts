/**
 * The conventional path, built from the same criteria files.
 *
 * The comparison is only fair if both sides are asking about the same facts, so the
 * separate application forms are generated from the program files rather than written
 * to look burdensome. Every question in them is a criterion the screener also
 * evaluates, phrased with the same wording a person would be shown.
 *
 * Where the same fact appears in more than one program, it appears in more than one
 * form. That repetition is the point, and it is a property of the federal programs
 * rather than something staged here: income, household size and who receives what all
 * get asked once per application.
 */

import { Criterion, loadPrograms } from './criteria';

export interface FormQuestion {
  id: string;
  programId: string;
  programName: string;
  question: string;
  options: { value: string; label: string }[];
  /** The other programs that ask for this same fact. */
  alsoAskedBy: string[];
}

export interface ConventionalForm {
  programId: string;
  programName: string;
  applyUrl: string;
  questions: FormQuestion[];
}

/**
 * Facts asked for by more than one program, keyed by a rough subject.
 *
 * Criterion ids differ between programs even when the underlying fact is the same, so
 * overlap is matched on what the question is about rather than on the id.
 */
const SHARED_SUBJECTS: [RegExp, string][] = [
  [/income|earn|wage|job|work/i, 'income'],
  [/household|everyone|anyone (here|in your)/i, 'household members'],
  [/ssi|snap|medicaid|tanf|assistance|voucher|pension/i, 'benefits already received'],
  [/child|kid|daughter|son/i, 'children'],
  [/rent|mortgage|hous|utilit/i, 'housing costs'],
  [/60 or older|disab/i, 'age or disability'],
];

function subjectsOf(text: string): string[] {
  return SHARED_SUBJECTS.filter(([re]) => re.test(text)).map(([, subject]) => subject);
}

export function conventionalForms(): ConventionalForm[] {
  const programs = loadPrograms();

  // Which subjects each program asks about, so overlaps can be named on each question.
  const subjectsByProgram = new Map<string, Set<string>>();
  for (const program of programs) {
    const set = new Set<string>();
    for (const c of program.criteria) {
      for (const subject of subjectsOf(c.askIfUnsure)) set.add(subject);
    }
    subjectsByProgram.set(program.id, set);
  }

  return programs.map((program) => ({
    programId: program.id,
    programName: program.name,
    applyUrl: program.applyUrl,
    questions: program.criteria
      // A form cannot ask a question per household member before it knows who they
      // are, so the paper equivalent asks each of these once.
      .filter((c: Criterion) => c.scope !== 'child')
      .map((c: Criterion) => {
        const mine = subjectsOf(c.askIfUnsure);
        const alsoAskedBy = programs
          .filter(
            (other) =>
              other.id !== program.id &&
              mine.some((subject) => subjectsByProgram.get(other.id)?.has(subject))
          )
          .map((other) => other.shortName);

        return {
          id: c.id,
          programId: program.id,
          programName: program.shortName,
          question: c.askIfUnsure,
          options: Object.entries(c.criteria).map(([value, label]) => ({
            value,
            label: c.type === 'noul' ? (value === 'true' ? 'Yes' : 'No') : label,
          })),
          alsoAskedBy,
        };
      }),
  }));
}

export function conventionalQuestionCount(): number {
  return conventionalForms().reduce((sum, f) => sum + f.questions.length, 0);
}
