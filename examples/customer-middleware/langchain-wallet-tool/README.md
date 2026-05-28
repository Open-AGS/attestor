# LangChain Wallet Tool Wrapper

Use this shape when an agent tool is about to call a wallet-facing function.

Source anchor: LangChain tools are callable functions that agents can invoke to
query systems or take actions:
https://docs.langchain.com/oss/javascript/langchain/tools

```ts
const guardedWalletTool = wrapWalletToolWithAttestor({
  attestor,
  tool: walletTool,
});

const result = await guardedWalletTool(inputFromAgent);
```

Outcomes:

- `admit` -> original tool input may proceed.
- `narrow` -> only the bounded tool input may proceed.
- `review` -> return a held result to the agent or reviewer path.
- `block` -> reject before the wallet-facing tool is called.

This example uses synthetic references only. It does not sign, broadcast,
settle, call a wallet, or prove production no-bypass enforcement. Attestor is
not a wallet, custodian, signer, bundler, or broadcaster.
