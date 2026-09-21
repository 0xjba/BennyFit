/**
 * The author, as shown on /research and in the technical report.
 *
 * A field left null is not rendered: the page shows what is known rather than
 * placeholder text.
 */
export const AUTHOR = {
  name: 'Jobin Ayathil',
  /** A sentence or two in the first person. */
  bio:
    "I'm a developer relations engineer and founder in Mumbai who likes off-beat problems, like a 54-hour poker match between AI agents played entirely on-chain, and now and then one that reaches a wide public, like Defeit, an anti-counterfeit drug system." as string | null,
  /** Why BennyFit exists, in the first person. */
  why:
    "BennyFit started with welfare schemes in India: looking at how other countries connect people to the benefits they are owed, I found that in the US billions go unclaimed every year simply because finding out what you qualify for is hard. It was a problem with real scale and real lives behind it, and while looking for a model that could make those eligibility calls reliably and cheaply, I found Jev." as string | null,
  github: 'https://github.com/0xjba',
  linkedin: 'https://www.linkedin.com/in/0xjba/' as string | null,
  email: 'jobinb6444@gmail.com',
};
