<div align="center">
  <a href="https://layerzero.network">
    <img alt="LayerZero" style="width: 60%" src="https://layerzero.network/static/logo.svg"/>
  </a>

  <h1>LayerZero OFT</h1>

  <p>
    <strong>Omnichain Fungible Token(Beta)</strong>
  </p>

  <p>
    <a href="https://docs.layerzero.network/v2/home/protocol/contract-standards#oft"><img alt="Tutorials" src="https://img.shields.io/badge/docs-tutorials-blueviolet" /></a>
  </p>
</div>

The Omnichain Fungible Token (OFT) Standard allows fungible tokens to be transferred across multiple blockchains without asset wrapping or middlechains.

This standard works by burning tokens on the source chain whenever an omnichain transfer is initiated, sending a message via the protocol, and delivering a function call to the destination contract to mint the same number of tokens burned. This creates a unified supply across all networks LayerZero supports that the OFT is deployed on.

![title](oft.jpg)

[Audit Reports](https://github.com/LayerZero-Labs/Audits)

## Build & Test

```bash
yarn && yarn build && yarn test
```
