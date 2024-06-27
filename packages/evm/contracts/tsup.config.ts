import { defineConfig, getDefaultConfig } from '@layerzerolabs/tsup-config-next'

export default defineConfig({
    ...getDefaultConfig(),
    entry: {
        index: 'src/index.ts',
        ops: 'ops/index.ts',
    },
})
