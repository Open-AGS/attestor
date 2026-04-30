import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Summary {
  hostname: string;
  staticAddressName: string;
  tlsSecretName: string;
  clusterIssuer: string;
  acmeEmail: string;
  dnsRecord: {
    type: 'A';
    name: string;
    target: string | null;
  };
  bootstrapHostname: string | null;
  verificationUrls: {
    health: string;
    ready: string;
  };
}

function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return fallback;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

function yamlSingleQuote(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`;
}

function normalizeDnsHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (!hostname || hostname.length > 253 || hostname.endsWith('.')) {
    throw new Error('hostname must be a non-empty DNS hostname without a trailing dot.');
  }
  const labels = hostname.split('.');
  if (labels.length < 2) {
    throw new Error('hostname must include at least two DNS labels.');
  }
  for (const label of labels) {
    if (!label || label.length > 63 || label.startsWith('-') || label.endsWith('-')) {
      throw new Error('hostname contains an invalid DNS label.');
    }
    for (const char of label) {
      const code = char.charCodeAt(0);
      const isLowerAscii = code >= 97 && code <= 122;
      const isDigit = code >= 48 && code <= 57;
      if (!isLowerAscii && !isDigit && char !== '-') {
        throw new Error('hostname may only contain DNS label characters.');
      }
    }
  }
  return hostname;
}

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8');
}

function write(path: string, contents: string): void {
  writeFileSync(resolve(path), `${contents.trimEnd()}\n`, 'utf8');
}

function replaceAll(contents: string, search: string, replacement: string): string {
  if (!contents.includes(search)) throw new Error(`Expected to find ${search}.`);
  return contents.split(search).join(replacement);
}

function main(): void {
  const hostname = normalizeDnsHostname(required(arg('hostname', env('ATTESTOR_PUBLIC_HOSTNAME')), 'hostname or ATTESTOR_PUBLIC_HOSTNAME'));
  const staticAddressName = arg('static-address-name', env('ATTESTOR_GKE_STATIC_ADDRESS_NAME') ?? 'attestor-gateway-ip')!;
  const dnsTargetIp = arg('dns-target-ip', env('ATTESTOR_GKE_GATEWAY_IP'));
  const clusterIssuer = arg('cluster-issuer', env('ATTESTOR_TLS_CLUSTER_ISSUER') ?? 'letsencrypt-prod')!;
  const tlsSecretName = arg('tls-secret-name', env('ATTESTOR_TLS_SECRET_NAME') ?? 'attestor-tls')!;
  const acmeEmail = arg('acme-email', env('ATTESTOR_ACME_EMAIL') ?? 'ops@example.com')!;
  const outputDir = resolve(arg('output-dir', `.attestor/ha/gke-domain-cutover/${hostname.split('.').join('-')}`)!);
  mkdirSync(outputDir, { recursive: true });

  const gatewayTemplate = read('ops/kubernetes/ha/providers/gke/https-gateway.example.yaml');
  const routeTemplate = read('ops/kubernetes/ha/providers/gke/https-httproute.example.yaml');
  const certificateTemplate = read('ops/kubernetes/ha/providers/cert-manager/certificate.yaml');
  const clusterIssuerTemplate = read('ops/kubernetes/ha/providers/cert-manager/clusterissuer.example.yaml');

  let gateway = replaceAll(gatewayTemplate, 'attestor.example.com', yamlSingleQuote(hostname));
  gateway = replaceAll(gateway, 'attestor-gateway-ip', staticAddressName);
  gateway = replaceAll(gateway, 'attestor-tls', tlsSecretName);

  const route = replaceAll(routeTemplate, 'attestor.example.com', yamlSingleQuote(hostname));

  let certificate = replaceAll(certificateTemplate, 'attestor.example.com', yamlSingleQuote(hostname));
  certificate = replaceAll(certificate, 'attestor-tls', tlsSecretName);
  certificate = replaceAll(certificate, 'letsencrypt-prod', clusterIssuer);

  let issuer = replaceAll(clusterIssuerTemplate, 'letsencrypt-prod', clusterIssuer);
  issuer = replaceAll(issuer, 'ops@example.com', acmeEmail);

  const kustomization = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: attestor
resources:
  - gateway.yaml
  - httproute.yaml
  - clusterissuer.yaml
  - certificate.yaml
`;

  const bootstrapHostname = dnsTargetIp ? `${dnsTargetIp}.sslip.io` : null;
  const summary: Summary = {
    hostname,
    staticAddressName,
    tlsSecretName,
    clusterIssuer,
    acmeEmail,
    dnsRecord: {
      type: 'A',
      name: hostname,
      target: dnsTargetIp ?? null,
    },
    bootstrapHostname,
    verificationUrls: {
      health: `https://${hostname}/api/v1/health`,
      ready: `https://${hostname}/api/v1/ready`,
    },
  };

  const handoff = `# GKE final domain cutover bundle

Generated by \`npm run render:gke-domain-cutover\`.

## What this emits

- \`gateway.yaml\` with final HTTPS listener hostname
- \`httproute.yaml\` with HTTP 301 redirect + HTTPS service route
- \`clusterissuer.yaml\` for cert-manager Gateway HTTP-01
- \`certificate.yaml\` targeting \`${tlsSecretName}\`
- \`kustomization.yaml\` for one-step apply
- \`summary.json\` with DNS handoff details

## DNS handoff

- Create an \`A\` record for \`${hostname}\`${dnsTargetIp ? ` -> \`${dnsTargetIp}\`` : ' -> <gateway-ip>'}
- Keep the Gateway named address aligned with \`${staticAddressName}\`
${bootstrapHostname ? `- Bootstrap hostname already proven: \`${bootstrapHostname}\`` : '- Optional bootstrap host: <gateway-ip>.sslip.io'}

## Apply

\`\`\`powershell
kubectl apply -k ${outputDir}
\`\`\`

## Verify

- ${summary.verificationUrls.health}
- ${summary.verificationUrls.ready}
`;

  write(resolve(outputDir, 'gateway.yaml'), gateway);
  write(resolve(outputDir, 'httproute.yaml'), route);
  write(resolve(outputDir, 'certificate.yaml'), certificate);
  write(resolve(outputDir, 'clusterissuer.yaml'), issuer);
  write(resolve(outputDir, 'kustomization.yaml'), kustomization);
  write(resolve(outputDir, 'README.md'), handoff);
  write(resolve(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unexpected GKE domain cutover render failure.');
  process.exit(1);
}
