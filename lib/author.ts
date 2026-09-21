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
    "I work on the gap between powerful systems and the people who have to use them, turning technology that is hard to reach into something anyone can pick up." as string | null,
  /** Why BennyFit exists, in the first person. */
  why:
    "I was studying how large public systems decide who gets help, to understand how they manage it at the scale of millions, and came away seeing that none of them is perfect. In the US the cracks are wide: billions in benefits go unclaimed every year, largely because working out what you qualify for is harder than it should be, and that is the gap BennyFit closes." as string | null,
  github: 'https://github.com/0xjba',
  linkedin: 'https://www.linkedin.com/in/0xjba/' as string | null,
  email: 'jobinb6444@gmail.com',
};
