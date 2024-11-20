import { beraTokenAddress, nativeTokenAddress } from "@bera/config";

type BaseToken = {
  address: string;
};

export function wrapNativeTokens<T extends BaseToken>(tokens: T[]): T[] {
  return tokens.map((token) => ({
    ...token,
    address:
      token.address === nativeTokenAddress ? beraTokenAddress : token.address,
  }));
}

export function wrapNativeToken<T extends BaseToken>(token: T): T {
  return {
    ...token,
    address:
      token?.address === nativeTokenAddress ? beraTokenAddress : token?.address,
  };
}
