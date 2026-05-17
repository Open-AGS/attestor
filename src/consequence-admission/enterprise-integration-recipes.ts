import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const ENTERPRISE_INTEGRATION_RECIPES_VERSION =
  'attestor.enterprise-integration-recipes.v1';

export const ENTERPRISE_INTEGRATION_RECIPE_FAMILIES = [
  'crm-support',
  'microsoft-power-platform',
  'itsm-workflow',
  'ipaas-orchestration',
  'support-communications',
  'data-ai-platform',
  'iam-authority',
] as const;
export type EnterpriseIntegrationRecipeFamily =
  typeof ENTERPRISE_INTEGRATION_RECIPE_FAMILIES[number];

export const ENTERPRISE_INTEGRATION_RECIPE_TARGETS = [
  'salesforce-agentforce',
  'microsoft-copilot-power-automate',
  'servicenow-integrationhub',
  'workato-agent-studio',
  'mulesoft-agentforce-api',
  'n8n-ai-hitl-tools',
  'zapier-mcp',
  'zendesk-ai-agents',
  'intercom-conversations',
  'snowflake-cortex-agents',
  'databricks-agent-framework',
  'okta-workflows',
  'microsoft-entra-id-governance',
  'sailpoint-identity-security-cloud',
] as const;
export type EnterpriseIntegrationRecipeTarget =
  typeof ENTERPRISE_INTEGRATION_RECIPE_TARGETS[number];

export const ENTERPRISE_INTEGRATION_RECIPE_PATTERNS = [
  'custom-action-gate',
  'custom-connector-gate',
  'flow-action-gate',
  'approval-step-gate',
  'tool-wrapper-gate',
  'mcp-tool-gateway',
  'api-operation-gate',
  'workflow-extension-gate',
] as const;
export type EnterpriseIntegrationRecipePattern =
  typeof ENTERPRISE_INTEGRATION_RECIPE_PATTERNS[number];

export const ENTERPRISE_INTEGRATION_RECIPE_READINESS = [
  'recipe-ready',
  'requires-target-design',
  'watch-surface',
] as const;
export type EnterpriseIntegrationRecipeReadiness =
  typeof ENTERPRISE_INTEGRATION_RECIPE_READINESS[number];

export interface EnterpriseIntegrationRecipe {
  readonly recipeId: string;
  readonly targetSystem: EnterpriseIntegrationRecipeTarget;
  readonly targetFamily: EnterpriseIntegrationRecipeFamily;
  readonly displayName: string;
  readonly primarySourceName: string;
  readonly primarySourceUrl: string;
  readonly pattern: EnterpriseIntegrationRecipePattern;
  readonly readiness: EnterpriseIntegrationRecipeReadiness;
  readonly insertionPoint: string;
  readonly attestorPlacement: string;
  readonly protectedConsequences: readonly string[];
  readonly normalizedFields: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly approvalPath: readonly string[];
  readonly receiptRefs: readonly string[];
  readonly replayAndIdempotencyRefs: readonly string[];
  readonly implementationSteps: readonly string[];
  readonly noGoBoundary: string;
  readonly customerOwnsExecution: true;
  readonly nativeConnectorImplemented: false;
  readonly customerDeploymentRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly digest: string;
}

export interface EnterpriseIntegrationRecipeCatalogCounts {
  readonly crmSupport: number;
  readonly microsoftPowerPlatform: number;
  readonly itsmWorkflow: number;
  readonly ipaasOrchestration: number;
  readonly supportCommunications: number;
  readonly dataAiPlatform: number;
  readonly iamAuthority: number;
  readonly recipeReady: number;
  readonly requiresTargetDesign: number;
  readonly watchSurface: number;
}

export interface EnterpriseIntegrationRecipeCatalog {
  readonly version: typeof ENTERPRISE_INTEGRATION_RECIPES_VERSION;
  readonly generatedAt: string;
  readonly recipeCount: number;
  readonly targetSystems: readonly EnterpriseIntegrationRecipeTarget[];
  readonly families: readonly EnterpriseIntegrationRecipeFamily[];
  readonly patterns: readonly EnterpriseIntegrationRecipePattern[];
  readonly counts: EnterpriseIntegrationRecipeCatalogCounts;
  readonly recipes: readonly EnterpriseIntegrationRecipe[];
  readonly sourceBacked: true;
  readonly oneEngineAdapterModel: true;
  readonly customerOwnsExecution: true;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface EnterpriseIntegrationRecipeCatalogDescriptor {
  readonly version: typeof ENTERPRISE_INTEGRATION_RECIPES_VERSION;
  readonly targetSystems: typeof ENTERPRISE_INTEGRATION_RECIPE_TARGETS;
  readonly families: typeof ENTERPRISE_INTEGRATION_RECIPE_FAMILIES;
  readonly patterns: typeof ENTERPRISE_INTEGRATION_RECIPE_PATTERNS;
  readonly readiness: typeof ENTERPRISE_INTEGRATION_RECIPE_READINESS;
  readonly sourceBacked: true;
  readonly oneEngineAdapterModel: true;
  readonly customerOwnsExecution: true;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface CreateEnterpriseIntegrationRecipeCatalogInput {
  readonly generatedAt?: string | null;
}

type RecipeDefinition = Omit<EnterpriseIntegrationRecipe, 'digest'>;

const REQUIRED_NORMALIZED_FIELDS = [
  'tenantRefDigest',
  'actorRefDigest',
  'targetSystem',
  'targetAccountRefDigest',
  'actionName',
  'actionKind',
  'consequenceClass',
  'resourceRefDigest',
  'evidenceRefs',
  'approvalRefs',
  'receiptRefDigest',
  'idempotencyRefDigest',
] as const;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Enterprise integration recipes ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function assertNonEmptyList(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  if (values.length === 0) {
    throw new Error(`Enterprise integration recipes ${fieldName} must not be empty.`);
  }
  for (const value of values) {
    if (value.trim().length === 0) {
      throw new Error(`Enterprise integration recipes ${fieldName} must not contain blank values.`);
    }
  }
  return Object.freeze([...values]);
}

function assertOfficialHttpsUrl(value: string, recipeId: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Enterprise integration recipe ${recipeId} source URL must use HTTPS.`);
  }
  return parsed.toString();
}

function recipeDigest(recipe: RecipeDefinition): string {
  return canonicalObject({
    version: ENTERPRISE_INTEGRATION_RECIPES_VERSION,
    recipeId: recipe.recipeId,
    targetSystem: recipe.targetSystem,
    targetFamily: recipe.targetFamily,
    displayName: recipe.displayName,
    primarySourceName: recipe.primarySourceName,
    primarySourceUrl: recipe.primarySourceUrl,
    pattern: recipe.pattern,
    readiness: recipe.readiness,
    insertionPoint: recipe.insertionPoint,
    attestorPlacement: recipe.attestorPlacement,
    protectedConsequences: recipe.protectedConsequences,
    normalizedFields: recipe.normalizedFields,
    evidenceRefs: recipe.evidenceRefs,
    approvalPath: recipe.approvalPath,
    receiptRefs: recipe.receiptRefs,
    replayAndIdempotencyRefs: recipe.replayAndIdempotencyRefs,
    implementationSteps: recipe.implementationSteps,
    noGoBoundary: recipe.noGoBoundary,
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

function createRecipe(input: RecipeDefinition): EnterpriseIntegrationRecipe {
  const normalizedFields = assertNonEmptyList(input.normalizedFields, `${input.recipeId}.normalizedFields`);
  for (const field of REQUIRED_NORMALIZED_FIELDS) {
    if (!normalizedFields.includes(field)) {
      throw new Error(
        `Enterprise integration recipe ${input.recipeId} must include normalized field ${field}.`,
      );
    }
  }
  const recipe: RecipeDefinition = Object.freeze({
    ...input,
    primarySourceUrl: assertOfficialHttpsUrl(input.primarySourceUrl, input.recipeId),
    protectedConsequences: assertNonEmptyList(input.protectedConsequences, `${input.recipeId}.protectedConsequences`),
    normalizedFields,
    evidenceRefs: assertNonEmptyList(input.evidenceRefs, `${input.recipeId}.evidenceRefs`),
    approvalPath: assertNonEmptyList(input.approvalPath, `${input.recipeId}.approvalPath`),
    receiptRefs: assertNonEmptyList(input.receiptRefs, `${input.recipeId}.receiptRefs`),
    replayAndIdempotencyRefs: assertNonEmptyList(
      input.replayAndIdempotencyRefs,
      `${input.recipeId}.replayAndIdempotencyRefs`,
    ),
    implementationSteps: assertNonEmptyList(input.implementationSteps, `${input.recipeId}.implementationSteps`),
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  });
  return Object.freeze({
    ...recipe,
    digest: recipeDigest(recipe),
  });
}

const COMMON_FIELDS = Object.freeze([
  ...REQUIRED_NORMALIZED_FIELDS,
  'dataClass',
  'authorityDelta',
  'reviewContextDigest',
  'policyCandidateDigest',
  'feedbackEventDigest',
] as const);

const ENTERPRISE_INTEGRATION_RECIPE_DEFINITIONS: readonly RecipeDefinition[] = Object.freeze([
  {
    recipeId: 'recipe.salesforce-agentforce.custom-action-gate',
    targetSystem: 'salesforce-agentforce',
    targetFamily: 'crm-support',
    displayName: 'Salesforce Agentforce custom action gate',
    primarySourceName: 'Salesforce Agentforce actions',
    primarySourceUrl: 'https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html',
    pattern: 'custom-action-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'Agentforce Apex REST, AuraEnabled, Named Query, or Apex Invocable action before Salesforce mutation.',
    attestorPlacement: 'Custom action calls Attestor before Apex, REST, SOQL-backed action, or invocable logic writes a record or sends a message.',
    protectedConsequences: ['case.refund', 'case.reply', 'opportunity.update', 'subscription.cancel'],
    normalizedFields: [...COMMON_FIELDS, 'salesforceOrgDigest', 'caseRefDigest', 'recordTypeDigest'],
    evidenceRefs: ['case state proof', 'order/payment proof', 'entitlement proof', 'policy candidate digest'],
    approvalPath: ['review-by-exception item', 'approval/dismiss feedback event', 'Salesforce approval queue or customer-owned review'],
    receiptRefs: ['Salesforce record event digest', 'case/comment id digest', 'platform event digest'],
    replayAndIdempotencyRefs: ['agent action invocation digest', 'Salesforce request id digest', 'customer idempotency digest'],
    implementationSteps: ['wrap custom action', 'project action inputs into canonical shadow event', 'require customer gate before mutation', 'bind Salesforce receipt digest'],
    noGoBoundary: 'No native Salesforce package, org deployment, AppExchange listing, or live Agentforce connector is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.microsoft-copilot-power-automate.custom-connector-gate',
    targetSystem: 'microsoft-copilot-power-automate',
    targetFamily: 'microsoft-power-platform',
    displayName: 'Microsoft Copilot Studio and Power Automate tool gate',
    primarySourceName: 'Microsoft Copilot Studio tools',
    primarySourceUrl: 'https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent',
    pattern: 'custom-connector-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'Copilot Studio REST API, custom connector, agent flow, MCP tool, or Power Automate action before external side effect.',
    attestorPlacement: 'The tool or connector calls Attestor before the flow writes Dataverse, sends Outlook/Teams content, or invokes a downstream API.',
    protectedConsequences: ['dataverse.record.update', 'outlook.email.send', 'teams.message.post', 'powerautomate.flow.run'],
    normalizedFields: [...COMMON_FIELDS, 'environmentDigest', 'connectorDigest', 'flowRunDigest', 'credentialMode'],
    evidenceRefs: ['connector auth mode proof', 'flow input schema digest', 'user or maker credential mode', 'policy candidate digest'],
    approvalPath: ['ask-user confirmation is advisory only', 'review-by-exception item', 'approval/dismiss feedback event', 'Power Platform approval when configured'],
    receiptRefs: ['Power Automate run digest', 'Dataverse row version digest', 'connector response receipt digest'],
    replayAndIdempotencyRefs: ['flow run digest', 'connector operation digest', 'customer replay key digest'],
    implementationSteps: ['create custom connector wrapper', 'disable direct risky tool path', 'project tool call to Attestor admission', 'write only after customer gate proceeds'],
    noGoBoundary: 'No Power Platform connector, tenant deployment, DLP policy, or Microsoft certification is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.servicenow-integrationhub.flow-action-gate',
    targetSystem: 'servicenow-integrationhub',
    targetFamily: 'itsm-workflow',
    displayName: 'ServiceNow IntegrationHub flow action gate',
    primarySourceName: 'ServiceNow IntegrationHub',
    primarySourceUrl: 'https://www.servicenow.com/docs/r/integrate-applications/integration-hub/integrationhub.html',
    pattern: 'flow-action-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'IntegrationHub flow, action, spoke, or Flow Designer component before incident/change/request/CMDB mutation.',
    attestorPlacement: 'A flow action calls Attestor before invoking the ServiceNow action or third-party spoke that mutates the ticket, change, or CI.',
    protectedConsequences: ['incident.remediate', 'change.execute', 'request.approve', 'cmdb.update'],
    normalizedFields: [...COMMON_FIELDS, 'servicenowInstanceDigest', 'flowDigest', 'taskDigest', 'rollbackPlanDigest'],
    evidenceRefs: ['change ticket proof', 'CAB or service owner approval proof', 'rollback evidence ref', 'policy candidate digest'],
    approvalPath: ['review-by-exception item', 'approval/dismiss feedback event', 'ServiceNow task approval or CAB queue'],
    receiptRefs: ['ServiceNow task event digest', 'change state digest', 'flow execution digest'],
    replayAndIdempotencyRefs: ['flow execution digest', 'task sys_id digest', 'customer replay key digest'],
    implementationSteps: ['wrap flow/spoke action', 'map ticket/change context to canonical event', 'hold on review/block', 'record ServiceNow receipt digest'],
    noGoBoundary: 'No ServiceNow spoke, app, store package, MID Server deployment, or live instance proof is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.workato-agent-studio.approval-step-gate',
    targetSystem: 'workato-agent-studio',
    targetFamily: 'ipaas-orchestration',
    displayName: 'Workato Agent Studio business approval gate',
    primarySourceName: 'Workato business approvals',
    primarySourceUrl: 'https://docs.workato.com/en/agentic/agent-studio/business-approvals.html',
    pattern: 'approval-step-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'Skill recipe approval or connector action step before Workato executes the downstream app action.',
    attestorPlacement: 'The recipe writes a pending approval row, calls Attestor for the proposed consequence, and continues only after customer approval and Attestor gate both close.',
    protectedConsequences: ['access.provision', 'vendor.payment.prepare', 'crm.record.sync', 'discount.approve'],
    normalizedFields: [...COMMON_FIELDS, 'workatoWorkspaceDigest', 'recipeRunDigest', 'connectorDigest', 'approvalRecordDigest'],
    evidenceRefs: ['approval data table digest', 'recipe input digest', 'connector action digest', 'policy candidate digest'],
    approvalPath: ['Workato business approval', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Workato job receipt digest', 'approval row digest', 'target connector receipt digest'],
    replayAndIdempotencyRefs: ['recipe run digest', 'approval request digest', 'connector idempotency digest'],
    implementationSteps: ['insert Attestor step before connector action', 'persist approval row before notification', 'bind approval decision digest', 'record connector receipt digest'],
    noGoBoundary: 'No Workato recipe export, connector, or workspace deployment is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.mulesoft-agentforce-api.api-operation-gate',
    targetSystem: 'mulesoft-agentforce-api',
    targetFamily: 'ipaas-orchestration',
    displayName: 'MuleSoft Agentforce API action gate',
    primarySourceName: 'MuleSoft Topic Center Agentforce API actions',
    primarySourceUrl: 'https://docs.mulesoft.com/anypoint-code-builder/ai-enabling-api-project-topic-center',
    pattern: 'api-operation-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'MuleSoft-enabled API operation before the API is exposed as an Agentforce action or topic operation.',
    attestorPlacement: 'API policy or operation wrapper calls Attestor before forwarding the action-enabled operation to the downstream system.',
    protectedConsequences: ['erp.order.update', 'crm.case.write', 'billing.adjust', 'payment.workflow.prepare'],
    normalizedFields: [...COMMON_FIELDS, 'apiSpecDigest', 'operationIdDigest', 'businessGroupDigest', 'gatewayRequestDigest'],
    evidenceRefs: ['OpenAPI spec digest', 'governance rule result digest', 'operation schema digest', 'policy candidate digest'],
    approvalPath: ['review-by-exception item', 'approval/dismiss feedback event', 'API owner approval'],
    receiptRefs: ['gateway request digest', 'downstream API response receipt digest', 'API Catalog action digest'],
    replayAndIdempotencyRefs: ['operation idempotency digest', 'gateway request id digest', 'customer replay key digest'],
    implementationSteps: ['identify action-enabled operation', 'add Attestor pre-forward policy or wrapper', 'bind operation schema digest', 'record gateway/downstream receipt'],
    noGoBoundary: 'No Anypoint policy, Topic Center asset, gateway plugin, or Salesforce API Catalog sync is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.n8n-ai-hitl-tools.tool-wrapper-gate',
    targetSystem: 'n8n-ai-hitl-tools',
    targetFamily: 'ipaas-orchestration',
    displayName: 'n8n AI tool human-review gate',
    primarySourceName: 'n8n human-in-the-loop tools',
    primarySourceUrl: 'https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/',
    pattern: 'tool-wrapper-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'n8n AI Agent tool connector or human-review branch before the selected tool invocation executes.',
    attestorPlacement: 'The tool wrapper calls Attestor, routes review/hold decisions through n8n HITL, and only invokes the tool when the customer gate proceeds.',
    protectedConsequences: ['tool.email.send', 'tool.sheet.update', 'tool.api.request', 'tool.record.delete'],
    normalizedFields: [...COMMON_FIELDS, 'n8nWorkflowDigest', 'nodeDigest', 'toolNameDigest', 'approvalChannelDigest'],
    evidenceRefs: ['tool parameter digest', 'workflow execution digest', 'HITL decision digest', 'policy candidate digest'],
    approvalPath: ['n8n human review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['n8n execution receipt digest', 'tool output receipt digest', 'target API receipt digest'],
    replayAndIdempotencyRefs: ['workflow execution digest', 'tool call digest', 'customer replay key digest'],
    implementationSteps: ['connect risky tools to human review', 'call Attestor before tool execution', 'deny review/block as canceled tool call', 'record execution receipt digest'],
    noGoBoundary: 'No n8n workflow export, credential, or production workflow deployment is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.zapier-mcp.mcp-tool-gateway',
    targetSystem: 'zapier-mcp',
    targetFamily: 'ipaas-orchestration',
    displayName: 'Zapier MCP action gate',
    primarySourceName: 'Zapier MCP',
    primarySourceUrl: 'https://docs.zapier.com/mcp/home',
    pattern: 'mcp-tool-gateway',
    readiness: 'watch-surface',
    insertionPoint: 'MCP tool gateway before Zapier performs an app action such as sending, creating, or updating a record.',
    attestorPlacement: 'A customer-owned MCP proxy calls Attestor before allowing the Zapier MCP tool call to reach Zapier with executable app authority.',
    protectedConsequences: ['zapier.email.send', 'zapier.task.create', 'zapier.crm.update', 'zapier.calendar.create'],
    normalizedFields: [...COMMON_FIELDS, 'mcpServerDigest', 'zapierToolDigest', 'appActionDigest', 'zapierAccountDigest'],
    evidenceRefs: ['MCP tool schema digest', 'Zapier action digest', 'user/app credential posture digest', 'policy candidate digest'],
    approvalPath: ['customer MCP gateway review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['MCP tool result digest', 'Zapier task/action receipt digest', 'downstream app receipt digest'],
    replayAndIdempotencyRefs: ['MCP tool call digest', 'Zapier action id digest', 'customer replay key digest'],
    implementationSteps: ['use customer-owned MCP gateway', 'block direct agent credential path', 'call Attestor before Zapier tool call', 'record Zapier/downstream receipt digest'],
    noGoBoundary: 'No Zapier app, MCP proxy, or production Zapier deployment is implemented; Zapier MCP remains a beta watch surface.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.zendesk-ai-agents.api-operation-gate',
    targetSystem: 'zendesk-ai-agents',
    targetFamily: 'support-communications',
    displayName: 'Zendesk AI Agents support action gate',
    primarySourceName: 'Zendesk AI Agents API',
    primarySourceUrl: 'https://developer.zendesk.com/api-reference/ai-agents/introduction/',
    pattern: 'api-operation-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'Zendesk AI Agents API, ticket workflow, escalation, data export, or user-data operation before support state changes.',
    attestorPlacement: 'A customer app or middleware calls Attestor before Zendesk AI agent workflow updates a ticket, exports data, escalates, or sends customer-facing material.',
    protectedConsequences: ['ticket.reply', 'ticket.escalate', 'conversation.export', 'user.data.update'],
    normalizedFields: [...COMMON_FIELDS, 'zendeskAccountDigest', 'ticketDigest', 'conversationDigest', 'escalationDigest'],
    evidenceRefs: ['ticket state digest', 'customer/order proof digest', 'escalation reason digest', 'policy candidate digest'],
    approvalPath: ['support reviewer queue', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Zendesk ticket event digest', 'conversation workflow receipt digest', 'escalation event digest'],
    replayAndIdempotencyRefs: ['ticket workflow digest', 'AI agent session digest', 'customer replay key digest'],
    implementationSteps: ['place middleware before Zendesk write/export/escalation', 'digest ticket/conversation context', 'hold review/block outcomes', 'record Zendesk event receipt digest'],
    noGoBoundary: 'No Zendesk marketplace app, AI Agents API deployment, or ticketing connector is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.intercom-conversations.api-operation-gate',
    targetSystem: 'intercom-conversations',
    targetFamily: 'support-communications',
    displayName: 'Intercom conversation action gate',
    primarySourceName: 'Intercom Conversations API',
    primarySourceUrl: 'https://developers.intercom.com/docs/references/2.10/rest-api/api.intercom.io/conversations/manageconversation',
    pattern: 'api-operation-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'Intercom conversation reply, assignment, tag, state, or ticket conversion operation before customer communication changes.',
    attestorPlacement: 'A customer middleware calls Attestor before posting a reply, note, assignment change, close/reopen, or ticket conversion to Intercom.',
    protectedConsequences: ['conversation.reply', 'conversation.assign', 'conversation.close', 'conversation.ticket.convert'],
    normalizedFields: [...COMMON_FIELDS, 'intercomWorkspaceDigest', 'conversationDigest', 'adminAssigneeDigest', 'messageDigest'],
    evidenceRefs: ['conversation state digest', 'customer context proof digest', 'reply intent digest', 'policy candidate digest'],
    approvalPath: ['support reviewer queue', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Intercom conversation part digest', 'conversation state receipt digest', 'assignment receipt digest'],
    replayAndIdempotencyRefs: ['conversation operation digest', 'Intercom request digest', 'customer replay key digest'],
    implementationSteps: ['wrap Intercom API client', 'project conversation operation to Attestor', 'hold review/block outcomes', 'record Intercom receipt digest'],
    noGoBoundary: 'No Intercom app, OAuth install, marketplace listing, or live conversation integration is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.snowflake-cortex-agents.tool-wrapper-gate',
    targetSystem: 'snowflake-cortex-agents',
    targetFamily: 'data-ai-platform',
    displayName: 'Snowflake Cortex Agents data-action gate',
    primarySourceName: 'Snowflake Cortex Agents REST API',
    primarySourceUrl: 'https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api',
    pattern: 'tool-wrapper-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'Cortex Agent generic tool, SQL execution tool, external function, or export path before data write/export/external call.',
    attestorPlacement: 'The generic tool or SQL/export wrapper calls Attestor before Cortex Agent-triggered data movement or mutation proceeds.',
    protectedConsequences: ['sql.execute.write', 'customer.export', 'external_function.call', 'semantic.query.publish'],
    normalizedFields: [...COMMON_FIELDS, 'snowflakeAccountDigest', 'databaseSchemaDigest', 'agentDigest', 'warehouseRoleDigest', 'queryDigest'],
    evidenceRefs: ['tool spec digest', 'semantic model digest', 'role/warehouse proof digest', 'policy candidate digest'],
    approvalPath: ['data owner review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Snowflake request id digest', 'query/job receipt digest', 'export receipt digest'],
    replayAndIdempotencyRefs: ['agent request digest', 'query digest', 'customer replay key digest'],
    implementationSteps: ['wrap risky Cortex tool', 'digest query/tool resources', 'block direct write/export without gate', 'record Snowflake receipt digest'],
    noGoBoundary: 'No live Snowflake account, Cortex Agent deployment, SQL execution PEP, or data export connector is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.databricks-agent-framework.tool-wrapper-gate',
    targetSystem: 'databricks-agent-framework',
    targetFamily: 'data-ai-platform',
    displayName: 'Databricks Agent Framework tool gate',
    primarySourceName: 'Databricks AI agent tools',
    primarySourceUrl: 'https://docs.databricks.com/aws/en/generative-ai/agent-framework/agent-tool',
    pattern: 'tool-wrapper-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'Databricks agent UC function tool, custom code tool, external MCP tool, or REST/API tool before data write/export/job/API side effect.',
    attestorPlacement: 'The tool wrapper calls Attestor before Unity Catalog function, Python/code tool, MCP server, REST tool, or job execution performs a protected consequence.',
    protectedConsequences: ['uc.function.execute', 'rest.tool.call', 'workspace.job.run', 'data.export'],
    normalizedFields: [...COMMON_FIELDS, 'databricksWorkspaceDigest', 'unityCatalogObjectDigest', 'toolFunctionDigest', 'servingEndpointDigest'],
    evidenceRefs: ['Unity Catalog permission proof', 'tool schema digest', 'agent trace digest', 'policy candidate digest'],
    approvalPath: ['data/platform owner review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Databricks trace digest', 'job run digest', 'tool result receipt digest'],
    replayAndIdempotencyRefs: ['tool invocation digest', 'job run digest', 'customer replay key digest'],
    implementationSteps: ['wrap UC/custom/MCP tool', 'bind workspace and UC object digests', 'gate write/export/job tools', 'record trace/job receipt digest'],
    noGoBoundary: 'No Databricks app, Unity Catalog function, MCP server, serving endpoint, or workspace deployment is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.okta-workflows.flow-action-gate',
    targetSystem: 'okta-workflows',
    targetFamily: 'iam-authority',
    displayName: 'Okta Workflows authority-change gate',
    primarySourceName: 'Okta Workflows Okta connector',
    primarySourceUrl: 'https://help.okta.com/wf/en-us/Content/Topics/Workflows/connector-reference/okta/okta.htm',
    pattern: 'flow-action-gate',
    readiness: 'recipe-ready',
    insertionPoint: 'Okta Workflows connector action or custom API action before user, group, app, session, or rule authority changes.',
    attestorPlacement: 'The workflow calls Attestor before connector cards add users to groups, assign apps, activate users, clear sessions, or change rules.',
    protectedConsequences: ['user.activate', 'group.add_user', 'app.assign_user', 'session.clear', 'rule.activate'],
    normalizedFields: [...COMMON_FIELDS, 'oktaOrgDigest', 'principalDigest', 'groupOrAppDigest', 'scopeDigest'],
    evidenceRefs: ['HR/source-of-truth proof', 'request ticket digest', 'connector scope digest', 'policy candidate digest'],
    approvalPath: ['identity owner review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Okta workflow execution digest', 'Okta system log event digest', 'connector action receipt digest'],
    replayAndIdempotencyRefs: ['workflow execution digest', 'connector action digest', 'customer replay key digest'],
    implementationSteps: ['insert Attestor card before authority action', 'digest principal/resource/authority delta', 'hold review/block outcomes', 'record Okta receipt digest'],
    noGoBoundary: 'No Okta connector, org authorization, SCIM/OIDC deployment, or live identity operation is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.microsoft-entra-id-governance.workflow-extension-gate',
    targetSystem: 'microsoft-entra-id-governance',
    targetFamily: 'iam-authority',
    displayName: 'Microsoft Entra ID Governance workflow extension gate',
    primarySourceName: 'Microsoft Entra ID Governance Lifecycle Workflows',
    primarySourceUrl: 'https://learn.microsoft.com/en-us/entra/id-governance/',
    pattern: 'workflow-extension-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'Lifecycle Workflow custom task extension, Logic App, or REST extension before lifecycle or access side effects continue.',
    attestorPlacement: 'The custom task extension or Logic App calls Attestor before lifecycle workflow changes access packages, groups, users, or downstream identity state.',
    protectedConsequences: ['access.assign', 'user.lifecycle.change', 'group.membership.update', 'custom.task.continue'],
    normalizedFields: [...COMMON_FIELDS, 'tenantDirectoryDigest', 'workflowDigest', 'logicAppDigest', 'accessPackageDigest'],
    evidenceRefs: ['HR/lifecycle proof', 'manager approval digest', 'workflow task digest', 'policy candidate digest'],
    approvalPath: ['identity governance review', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['Lifecycle workflow history digest', 'Logic App run digest', 'Graph operation receipt digest'],
    replayAndIdempotencyRefs: ['workflow run digest', 'custom task extension digest', 'customer replay key digest'],
    implementationSteps: ['create custom task extension wrapper', 'call Attestor before continuation', 'bind lifecycle/access package evidence', 'record workflow/Graph receipt digest'],
    noGoBoundary: 'No Entra app registration, Graph integration, Logic App deployment, or tenant governance proof is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
  {
    recipeId: 'recipe.sailpoint-identity-security-cloud.workflow-extension-gate',
    targetSystem: 'sailpoint-identity-security-cloud',
    targetFamily: 'iam-authority',
    displayName: 'SailPoint Identity Security Cloud workflow gate',
    primarySourceName: 'SailPoint workflow triggers',
    primarySourceUrl: 'https://documentation.sailpoint.com/saas/help/workflows/workflow-triggers.html',
    pattern: 'workflow-extension-gate',
    readiness: 'requires-target-design',
    insertionPoint: 'SailPoint workflow trigger/action or external trigger before access request, account, identity, or entitlement side effects proceed.',
    attestorPlacement: 'The workflow or external trigger path calls Attestor before access-request handling, account updates, entitlement changes, or third-party workflow actions continue.',
    protectedConsequences: ['access.request.route', 'account.update', 'entitlement.change', 'identity.lifecycle.process'],
    normalizedFields: [...COMMON_FIELDS, 'sailpointTenantDigest', 'identityDigest', 'accessItemDigest', 'sourceAccountDigest'],
    evidenceRefs: ['access request proof', 'identity/source proof', 'entitlement proof digest', 'policy candidate digest'],
    approvalPath: ['identity governance approval', 'review-by-exception item', 'approval/dismiss feedback event'],
    receiptRefs: ['SailPoint workflow execution digest', 'access request decision digest', 'source account event digest'],
    replayAndIdempotencyRefs: ['workflow execution digest', 'access request digest', 'customer replay key digest'],
    implementationSteps: ['add Attestor HTTP/external action in workflow', 'digest identity/access/source material', 'block review/hold outcomes', 'record workflow and access decision receipt'],
    noGoBoundary: 'No SailPoint workflow JSON, API client, tenant deployment, or access governance certification is implemented.',
    customerOwnsExecution: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  },
]);

const ENTERPRISE_INTEGRATION_RECIPES = Object.freeze(
  ENTERPRISE_INTEGRATION_RECIPE_DEFINITIONS.map(createRecipe),
);

function countByFamily(
  recipes: readonly EnterpriseIntegrationRecipe[],
  family: EnterpriseIntegrationRecipeFamily,
): number {
  return recipes.filter((recipe) => recipe.targetFamily === family).length;
}

function countByReadiness(
  recipes: readonly EnterpriseIntegrationRecipe[],
  readiness: EnterpriseIntegrationRecipeReadiness,
): number {
  return recipes.filter((recipe) => recipe.readiness === readiness).length;
}

function validateRecipeSet(recipes: readonly EnterpriseIntegrationRecipe[]): void {
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const recipe of recipes) {
    if (ids.has(recipe.recipeId)) {
      throw new Error(`Enterprise integration recipe duplicate id ${recipe.recipeId}.`);
    }
    ids.add(recipe.recipeId);
    if (targets.has(recipe.targetSystem)) {
      throw new Error(`Enterprise integration recipe duplicate target ${recipe.targetSystem}.`);
    }
    targets.add(recipe.targetSystem);
  }
  for (const target of ENTERPRISE_INTEGRATION_RECIPE_TARGETS) {
    if (!targets.has(target)) {
      throw new Error(`Enterprise integration recipes missing target ${target}.`);
    }
  }
}

export function createEnterpriseIntegrationRecipeCatalog(
  input: CreateEnterpriseIntegrationRecipeCatalogInput = {},
): EnterpriseIntegrationRecipeCatalog {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const recipes = ENTERPRISE_INTEGRATION_RECIPES;
  validateRecipeSet(recipes);

  const counts: EnterpriseIntegrationRecipeCatalogCounts = Object.freeze({
    crmSupport: countByFamily(recipes, 'crm-support'),
    microsoftPowerPlatform: countByFamily(recipes, 'microsoft-power-platform'),
    itsmWorkflow: countByFamily(recipes, 'itsm-workflow'),
    ipaasOrchestration: countByFamily(recipes, 'ipaas-orchestration'),
    supportCommunications: countByFamily(recipes, 'support-communications'),
    dataAiPlatform: countByFamily(recipes, 'data-ai-platform'),
    iamAuthority: countByFamily(recipes, 'iam-authority'),
    recipeReady: countByReadiness(recipes, 'recipe-ready'),
    requiresTargetDesign: countByReadiness(recipes, 'requires-target-design'),
    watchSurface: countByReadiness(recipes, 'watch-surface'),
  });

  const body = {
    version: ENTERPRISE_INTEGRATION_RECIPES_VERSION,
    generatedAt,
    recipeCount: recipes.length,
    targetSystems: ENTERPRISE_INTEGRATION_RECIPE_TARGETS,
    families: ENTERPRISE_INTEGRATION_RECIPE_FAMILIES,
    patterns: ENTERPRISE_INTEGRATION_RECIPE_PATTERNS,
    counts,
    recipes,
    sourceBacked: true,
    oneEngineAdapterModel: true,
    customerOwnsExecution: true,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function enterpriseIntegrationRecipeCatalogDescriptor():
EnterpriseIntegrationRecipeCatalogDescriptor {
  return Object.freeze({
    version: ENTERPRISE_INTEGRATION_RECIPES_VERSION,
    targetSystems: ENTERPRISE_INTEGRATION_RECIPE_TARGETS,
    families: ENTERPRISE_INTEGRATION_RECIPE_FAMILIES,
    patterns: ENTERPRISE_INTEGRATION_RECIPE_PATTERNS,
    readiness: ENTERPRISE_INTEGRATION_RECIPE_READINESS,
    sourceBacked: true,
    oneEngineAdapterModel: true,
    customerOwnsExecution: true,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}
