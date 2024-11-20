import { nativeTokenAddress } from "@bera/config";
import { PoolType } from "@berachain-foundation/berancer-sdk";
import { formatUnits } from "viem";

import { Token } from "~/types";

export const generatePoolName = (tokens: Token[]): string => {
  if (tokens.length === 0) {
    return "";
  }
  return tokens.map((token) => token.symbol).join(" | ");
};

export const generatePoolSymbol = (
  tokens: Token[],
  weights: bigint[],
  poolType: PoolType,
): string => {
  const poolTypeString = poolType.toString().toUpperCase();
  if (poolType === PoolType.Weighted) {
    if (weights.length === 0) {
      return "";
    }
    return `${tokens
      .map((token, index) => {
        const weight = weights[index];
        const weightPercentage = parseFloat(formatUnits(weight, 18)) * 100;
        return `${weightPercentage.toFixed(0)}${token.symbol}`;
      })
      .join("-")}-${poolTypeString}`;
  }
  return `${tokens.map((token) => token.symbol).join("-")}-${poolTypeString}`;
};
