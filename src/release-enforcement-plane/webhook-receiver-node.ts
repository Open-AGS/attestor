import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import {
  ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER,
  type NodeReleaseWebhookReceiverHandler,
  type NodeReleaseWebhookReceiverOptions,
  type NodeReleaseWebhookReceiverRequest,
  type ReleaseWebhookReceiverOptions,
  type ReleaseWebhookReceiverResult,
} from './webhook-receiver-types.js';
import {
  evaluateReleaseWebhookRequest,
} from './webhook-receiver-core.js';
import {
  releaseWebhookReceiverDeniedBody,
  releaseWebhookReceiverResponseHeaders,
} from './webhook-receiver-result.js';
import {
  headerValue,
  normalizeMethod,
} from './webhook-receiver-utils.js';

function forwardedProto(headers: IncomingHttpHeaders): string | null {
  const value = headerValue(headers, 'x-forwarded-proto');
  return value?.split(',')[0]?.trim().toLowerCase() ?? null;
}

function nodeRequestUrl(
  request: IncomingMessage,
  options: NodeReleaseWebhookReceiverOptions | undefined,
): string {
  const rawUrl = request.url ?? '/';
  if (/^https?:\/\//iu.test(rawUrl)) {
    return rawUrl;
  }

  const protocol =
    options?.trustForwardedProto === true
      ? forwardedProto(request.headers) ?? 'http'
      : (request.socket as { readonly encrypted?: boolean }).encrypted
        ? 'https'
        : 'http';
  const host = headerValue(request.headers, 'host') ?? 'localhost';
  return new URL(rawUrl, options?.baseUrl ?? `${protocol}://${host}`).toString();
}

function readNodeBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('error', reject);
    request.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function writeNodeRejectedResponse(
  response: ServerResponse,
  result: ReleaseWebhookReceiverResult,
): void {
  const headers = releaseWebhookReceiverResponseHeaders(result);
  headers.forEach((value, name) => {
    response.setHeader(name, value);
  });
  response.statusCode = result.responseStatus;
  response.end(JSON.stringify(releaseWebhookReceiverDeniedBody(result)));
}

export function createNodeReleaseWebhookReceiver(
  options: ReleaseWebhookReceiverOptions,
  handler: NodeReleaseWebhookReceiverHandler,
  nodeOptions?: NodeReleaseWebhookReceiverOptions,
): (request: NodeReleaseWebhookReceiverRequest, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    const body = await readNodeBody(request);
    const result = await evaluateReleaseWebhookRequest(
      {
        method: normalizeMethod(request.method),
        url: nodeRequestUrl(request, nodeOptions),
        headers: request.headers,
        body,
      },
      options,
      'node',
      request,
    );
    request.releaseWebhookReceiver = result;
    request.releaseWebhookBody = body;
    response.setHeader(ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER, result.status);

    if (result.status === 'rejected') {
      writeNodeRejectedResponse(response, result);
      return;
    }

    await handler(request, response, result, body);
  };
}
