import type {
  GoldenExternalCommunicationReviewerSandboxSafetyBoundary,
} from './golden-external-communication-reviewer-sandbox-types.js';

export function externalCommunicationReviewerSandboxSafetyBoundary():
GoldenExternalCommunicationReviewerSandboxSafetyBoundary {
  return Object.freeze({
    noTargetSystemCall: true,
    noMessageDelivery: true,
    noProviderCall: true,
    noCrmOrTicketingCall: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawMessageBodyRead: false,
    rawMessageBodyStored: false,
    rawRecipientIdentifiersRead: false,
    rawRecipientIdentifiersStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}

export function externalCommunicationReviewerSandboxNoClaims(): readonly string[] {
  return Object.freeze([
    'not-live-email-or-sms-delivery',
    'not-native-sendgrid-mailgun-crm-or-ticketing-connector',
    'not-commercial-email-compliance-certification',
    'not-legal-review-correctness-proof',
    'not-customer-pep-enforcement-proof',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
  ]);
}
