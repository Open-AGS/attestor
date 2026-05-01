# AI Action Authorization Positioning

Use this page as the short positioning source for the current product category.

Attestor should be described externally as:

**an AI action authorization layer**

Attestor should still describe its own operating model as:

**an AI Consequence Gateway**

These are not competing names. They answer different questions.

## Category

AI action authorization is the market category.

The category says what a buyer, platform team, or security reviewer needs to understand quickly:

```text
AI wants to act.
The action needs authorization.
Attestor is the layer before the action reaches the real system.
```

This is clearer than leading with AI governance. Governance is broad, committee-shaped, and often detached from execution. Attestor belongs closer to IAM, API gateway, admission control, and downstream authorization patterns: it is the control point before a high-risk AI action is allowed to become a system change.

The preferred category sentence is:

```text
Attestor is the authorization layer for AI actions before they become consequences.
```

The preferred sharper promise is:

```text
No high-risk AI action should execute without consequence authorization.
```

## Operating Model

AI Consequence Gateway is the Attestor operating model.

It explains what the authorization layer actually controls:

```text
AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains
```

The word "consequence" matters because not every tool call deserves the same treatment. Reading a harmless local document is not the same as issuing a refund, exporting customer data, changing an entitlement, sending a regulated notice, deploying infrastructure, or preparing a wallet transaction.

Attestor should focus on high-risk actions by consequence class:

- Money Movement
- Data Movement
- Authority Change
- External Communication
- Operational Execution
- Programmable Money

This is the pack language. A pack does not say which industry the customer is in; it says what real consequence the AI action is trying to create. Finance and crypto remain proof wedges and adapter families underneath that map, not the top-level product categories.

## Adoption Wedge

The strongest adoption path is shadow mode.

Do not describe this as automatic learning or autonomous policy creation. In enterprise and security settings, that suggests Attestor silently learns what is correct and starts making decisions on its own.

Use this path instead:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

The intended product motion is:

```text
Attestor observes how AI actions would behave, recommends enforceable policy, simulates impact, and lets humans approve before enforcement.
```

Shadow mode should make the work easier for customers by showing policy gaps, not just logs:

- which high-risk AI action surfaces exist
- which actions have no policy
- which downstream tools carry too much authority
- where permissions are broader than the observed task needs
- where human approval happened but no enforceable rule exists
- where Attestor would disagree with the human outcome
- where a proposed policy would create too many false positives

The first useful shadow output should be an action risk inventory:

```text
Detected high-risk AI action surfaces:
- refund-service.issueRefund
- snowflake.runQuery
- crm.exportCustomerData
- admin.grantRole
- github.deployProduction
- wallet.submitTransaction
```

The near-term MVP should be cut into small product PRs:

1. generic admission schema and mode ladder
2. shadow event recorder
3. money movement shadow pack
4. simulation report
5. dashboard and API summary

That sequence keeps adoption low-risk: first visibility, then recommended policy, then simulated impact, then approved enforcement.

The README should expose this adoption path near the top. The first impression should not make teams think they must start by blocking production workflows. The stronger message is:

```text
Start in shadow mode. See what your AI agents would have done before you let them act.
```

Current implementation note: `POST /api/v1/admissions` already has the first mode ladder: `observe`, `warn`, `review`, and `enforce`. Recommendation, simulation, summary, and dashboard surfaces should build on that ladder without claiming autonomous policy learning.

## Why This Shift Matters

Agent and tool ecosystems are moving toward action, not just generation. OpenAI's Agents SDK describes tools as letting agents take actions such as fetching data, calling APIs, executing code, or using a computer. MCP tools are model-controlled and can be discovered and invoked by language models. OWASP's Excessive Agency risk calls out damaging actions caused by too much functionality, permission, or autonomy, and recommends downstream authorization rather than relying on an LLM to decide whether an action is allowed.

That validates the product direction:

```text
The model can propose.
The runtime can route.
The tool can execute.
Attestor authorizes the consequence before execution.
```

## Wording Rules

Use:

- AI action authorization
- authorization layer for high-risk AI actions
- consequence authorization
- AI Consequence Gateway
- proof before consequence
- admit, narrow, review, block

Avoid leading with:

- generic AI governance
- generic policy engine
- prompt guardrail
- proof engine
- agent workspace
- wallet, custody, or payment processor

Attestor is not claiming to know the customer's business rules better than the customer. The stronger claim is:

```text
Attestor enforces that high-risk AI actions meet the customer's policy, authority, evidence, and downstream verification requirements before they execute.
```

For shadow-first language, say:

```text
Start in shadow mode. See what your AI agents would have done before you let them act.
```

Avoid:

```text
Attestor learns your company rules and automatically enforces them.
```

## Research Basis

- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) describes the risk of LLM systems calling functions or interfaces that can perform damaging actions, and recommends complete mediation through downstream authorization.
- [OpenAI Agents SDK tools](https://openai.github.io/openai-agents-js/guides/tools/) expose capabilities that let agents take actions, including API calls, code execution, shell-like execution paths, and computer use.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/draft/server/tools) are model-controlled and can be discovered and invoked by language models.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) frames AI risk management across the design, development, use, and evaluation of AI systems, which supports treating action authorization as an operational control rather than a slogan.
