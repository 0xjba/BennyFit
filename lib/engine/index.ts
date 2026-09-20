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

  if (requested === 'jev' || (!requested && env.JEV_API_KEY)) {
    if (!env.JEV_API_KEY) {
      throw new Error('ENGINE=jev was requested but JEV_API_KEY is not set.');
    }
    return new RemoteEngine({
      name: 'jev',
      baseUrl: env.JEV_BASE_URL ?? 'https://api.typesafe.ai',
      model: env.JEV_MODEL ?? 'jev-latest',
      apiKey: env.JEV_API_KEY,
      maxQuestionsPerRequest: 255,
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
