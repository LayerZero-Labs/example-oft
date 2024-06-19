# oft ops

## deploy

check and update deploy-config in [deploy-configs](../config/src/deploy/config.ts)

```bash
OFT_TOKEN=TokenOne yarn :oft-ops deploy -s sandbox -e local -c metis,solana
OFT_TOKEN=TokenTwo yarn :oft-ops deploy -s sandbox -e local -c bsc,solana
```

## wire

check and update wire-config in [wire-configs](../config/src/wire)

```bash
OFT_TOKEN=TokenOne yarn :oft-ops config --tags v2 -f metis:v2,solana:v2 -t metis:v2,solana:v2 -e local -s sandbox -np

OFT_TOKEN=TokenTwo yarn :oft-ops config --tags v2 -f bsc:v2,solana:v2 -t bsc:v2,solana:v2 -e local -s sandbox -np
```

### TASKS

#### quote send tokens

```bash
yarn :oft-cli tasks v2 quote -s sandbox -e local -token TokenOne -f metis -t solana -a 10 -r 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf

yarn :oft-cli tasks v2 quote -s sandbox -e local -token TokenOne -f solana -t metis -a 2 -r 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

yarn :oft-cli tasks v2 quote -s sandbox -e local -token TokenTwo -f bsc -t solana -a 10 -r 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf

yarn :oft-cli tasks v2 quote -s sandbox -e local -token TokenTwo -f solana -t bsc -a 2 -r 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
```

#### send tokens

```bash
yarn :oft-cli tasks v2 send -s sandbox -e local -token TokenOne -f metis -t solana -a 10 -r 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf

yarn :oft-cli tasks v2 send -s sandbox -e local -token TokenOne -f solana -t metis -a 2 -r 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

yarn :oft-cli tasks v2 send -s sandbox -e local -token TokenTwo -f solana -t bsc -a 2 -r 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

yarn :oft-cli tasks v2 send -s sandbox -e local -token TokenTwo -f bsc -t solana -a 10 -r 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf

```

#### print balance

```bash
yarn :oft-cli tasks v2 print-balance -s sandbox -e local -token TokenOne -f metis -addr 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

yarn :oft-cli tasks v2 print-balance -s sandbox -e local -token TokenOne -f solana -addr 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf

yarn :oft-cli tasks v2 print-balance -s sandbox -e local -token TokenTwo -f bsc -addr 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

yarn :oft-cli tasks v2 print-balance -s sandbox -e local -token TokenTwo -f solana -addr 2dh2G3zSEjQ14suomJvmrxV3QCoqcD6xzNjzbPuidxWf
```
