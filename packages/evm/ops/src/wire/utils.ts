import { TokenInfo } from "@layerzerolabs/oft-runtime-config";

export function getDeployName(tokenInfo: TokenInfo): string {
    return `${tokenInfo.name}${tokenInfo.type}`
}
