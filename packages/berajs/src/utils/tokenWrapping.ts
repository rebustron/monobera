import { beraTokenAddress, nativeTokenAddress } from "@bera/config";

// FIXME: this import is not possible in beraJS, we could move this into hub but we need it here too...
// import { wBeraToken } from "@bera/wagmi";

export const wBeraToken: any = {
  address: beraTokenAddress,
  decimals: 18,
  name: "WBera",
  symbol: "WBERA",
  logoURI:
    "https://artio-static-asset-public.s3.ap-southeast-1.amazonaws.com/assets/wbera.png",
};

type BaseToken = {
  address: string;
};

export function wrapNativeToken<T extends BaseToken>(token: T): T {
  return {
    ...token,
    ...(token?.address.toLowerCase() === nativeTokenAddress.toLowerCase() &&
      wBeraToken),
  };
}

export function wrapNativeTokens<T extends BaseToken>(tokens: T[]): T[] {
  return tokens.map((token) => wrapNativeToken(token));
}
