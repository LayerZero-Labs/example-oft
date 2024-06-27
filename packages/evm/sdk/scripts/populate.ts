import { CopyTargets, populate, populateErrors } from '@layerzerolabs/evm-sdks-build'

const copyTargets = {
    '@layerzerolabs/oft-evm-contracts': {
        artifacts: ['contracts/!(mocks)/**/+([a-zA-Z0-9_]).json'],
        deployments: ['**/!(solcInputs)/*.json'],
    },
} as const satisfies CopyTargets

const rootFile = require.resolve('../package.json')
populate(copyTargets, rootFile)
    .then(async () => populateErrors(rootFile))
    .catch((err) => {
        console.error(err)
        process.exitCode = 1
    })
