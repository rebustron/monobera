import { nativeTokenAddress } from "@bera/config";
import { wBeraToken } from "@bera/wagmi";

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
