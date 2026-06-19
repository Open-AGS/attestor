import {
  createDpopProof,
  generateDpopKeyPair,
  type DpopKeyPair,
} from '../../src/release-enforcement-plane/dpop.js';
import { BASE, pipelineRunHeaders } from './helpers.js';

export { generateDpopKeyPair };
export type { DpopKeyPair };

export async function dpopProofHeader(input: {
  readonly keyPair: DpopKeyPair;
  readonly httpMethod: string;
  readonly httpUri: string;
  readonly proofJti: string;
  readonly accessToken?: string | null;
}): Promise<Record<string, string>> {
  const proof = await createDpopProof({
    privateJwk: input.keyPair.privateJwk,
    publicJwk: input.keyPair.publicJwk,
    httpMethod: input.httpMethod,
    httpUri: input.httpUri,
    proofJti: input.proofJti,
    accessToken: input.accessToken ?? null,
  });

  return { DPoP: proof.proofJwt };
}

export async function dpopPipelineRunHeaders(
  idempotencyKey: string,
  keyPair: DpopKeyPair,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  return pipelineRunHeaders(idempotencyKey, {
    ...headers,
    ...(await dpopProofHeader({
      keyPair,
      httpMethod: 'POST',
      httpUri: `${BASE}/api/v1/pipeline/run`,
      proofJti: `dpop-${idempotencyKey}`,
    })),
  });
}

export async function dpopJsonHeaders(input: {
  readonly keyPair: DpopKeyPair;
  readonly httpUri: string;
  readonly proofJti: string;
  readonly accessToken?: string | null;
  readonly headers?: Record<string, string>;
}): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    ...(input.headers ?? {}),
    ...(await dpopProofHeader({
      keyPair: input.keyPair,
      httpMethod: 'POST',
      httpUri: input.httpUri,
      proofJti: input.proofJti,
      accessToken: input.accessToken ?? null,
    })),
  };
}
