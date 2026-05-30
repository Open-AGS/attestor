# License And Use

Attestor is source-available under the Business Source License 1.1.

The short version:

- You can read the code.
- You can run the local demos.
- You can evaluate it.
- You can modify it for non-production use.
- You can share non-production changes under the license terms.
- You need a commercial license for production use before the Change Date.

The legal version is [LICENSE](../../LICENSE). If this page and the license file ever disagree, the license file controls.

## Why This Shape

Attestor is meant to be inspectable before it is trusted.

That means the source is visible. Reviewers can read the guard logic, proof
shape, tests, docs, and current limitations.

It also means the production control surface is protected. A company should not
take the code, run it as a production service, sell it, or use it as a hosted
control plane without a commercial license.

## What Is Allowed Today

| Use | Status |
|---|---|
| Read the source | Allowed |
| Run local demos | Allowed |
| Evaluate the engine | Allowed |
| Test a non-production integration | Allowed |
| Modify for non-production evaluation | Allowed |
| Use in production before the Change Date | Commercial license required |
| Resell or host Attestor as a service | Commercial license required |

## What This Does Not Mean

Source-available is not the same as OSI open source.

Do not describe the current release as open source. The accurate wording is:

```text
source-available under Business Source License 1.1
```

The Change Date and Change License are defined in [LICENSE](../../LICENSE).

## Practical Rule

If you are learning, testing, reviewing, or building a non-production proof of
concept, the license is meant to let you do that.

If real users, real money, real customer data, production operations, or a
hosted/commercial service are involved, talk to the maintainer first.
