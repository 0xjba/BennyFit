/**
 * Choosing an engine.
 *
 * One environment variable decides which engine answers. With no key configured the
 * local fixture answers instead, and everything downstream is marked as a fixture run
 * so a run without a key can never be presented as a measurement.
 */

import { MockEngine } from './mock';
import { RemoteEngine } from './remote';
import { EngineClient } from './types';

export * from './types';
export { MockEngine } from './mock';
export { RemoteEngine, WIRE_FORMAT_UNCONFIRMED } from './remote';

export type EngineName = 'jev' | 'openjev' | 'fixture';

export function engineFromEnv(env: NodeJS.ProcessEnv = process.env): EngineClient {
  const requested = (env.ENGINE ?? '').toLowerCase() as EngineName | '';

  if (requested === 'fixture') return new MockEngine();

  // TYPESAFE_API_KEY is the name TypeSafe's own SDKs read; JEV_API_KEY still works.
  const jevKey = env.TYPESAFE_API_KEY ?? env.JEV_API_KEY;
  if (requested === 'jev' || (!requested && jevKey)) {
    if (!jevKey) {
      throw new Error('ENGINE=jev was requested but TYPESAFE_API_KEY is not set.');
    }
    return new RemoteEngine({
      name: 'jev',
      baseUrl: env.JEV_BASE_URL ?? 'https://api.typesafe.ai',
      // Pinned rather than jev-latest. The alias moves when a release ships, and the
      // confidence threshold is tuned against one version's answers; TypeSafe's model
      // docs recommend pinning for exactly this reason.
      model: env.JEV_MODEL ?? 'jev-1.13.0',
      apiKey: jevKey,
      // Jev has no per-request question limit, only a 64k-token context. A full
      // screening is about 63 questions and 7k tokens at most, so it never splits.
      maxQuestionsPerRequest: 400,
    });
  }

  if (requested === 'openjev' || (!requested && env.OPENJEV_API_KEY)) {
    if (!env.OPENJEV_API_KEY) {
      throw new Error('ENGINE=openjev was requested but OPENJEV_API_KEY is not set.');
    }
    return new RemoteEngine({
      name: 'openjev',
      baseUrl: env.OPENJEV_BASE_URL ?? 'https://api.codiv.ai',
      model: env.OPENJEV_MODEL ?? 'openjev-latest',
      apiKey: env.OPENJEV_API_KEY,
      maxQuestionsPerRequest: 128,
    });
  }

  return new MockEngine();
}
