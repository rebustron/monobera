import { useEffect, useState } from "react";
import { PoolType } from "@berachain-foundation/berancer-sdk";

import { wrapNativeTokens } from "~/utils/tokenWrapping";
import { SubgraphTokenInformations } from "~/actions";
import { TokenWithAmount } from "~/types";

const DEFAULT_LIQUIDITY_MISMATCH_TOLERANCE_PERCENT = 0.05; // 5%

export type LiquidityMismatchInfo = {
  title: string | null;
  message: string | null;
};

interface UseLiquidityMismatchParams {
  tokenPrices?: SubgraphTokenInformations;
  isLoadingTokenPrices: boolean;
  tokens: TokenWithAmount[] | null;
  weights: bigint[] | null;
  weightsError: string | null;
  poolType: PoolType;
  liquidityMismatchTolerancePercent?: number;
}

/**
 * A hook that checks for liquidity mismatches in a pool. It evaluates whether the USD value of tokens
 * added aligns with the pool's specified weights or type (e.g., Stable, Weighted). If a mismatch is
 * detected, it provides a title and message to warn the user.
 *
 * @param {SubgraphTokenInformations} tokenPrices - Pricing information for tokens, including USD values.
 * @param {boolean} isLoadingTokenPrices - Indicates if token prices are still loading.
 * @param {TokenWithAmount[]} tokens - Array of tokens with addresses & amounts.
 * @param {bigint[]} weights - Array of weights for each token, used for proportional calculations.
 * @param {string | null} weightsError - Message inidicating there's an error with token weights (don't fire hook if true).
 * @param {PoolType} poolType - The type of pool being created (Stable, Weighted, etc.).
 * @returns {LiquidityMismatchInfo} An object containing a title and message if a mismatch is detected.
 */
export const useLiquidityMismatch = ({
  tokenPrices,
  isLoadingTokenPrices,
  tokens,
  weights,
  weightsError,
  poolType,
  liquidityMismatchTolerancePercent = DEFAULT_LIQUIDITY_MISMATCH_TOLERANCE_PERCENT,
}: UseLiquidityMismatchParams): LiquidityMismatchInfo => {
  const [liquidityMismatchInfo, setLiquidityMismatchInfo] = useState<{
    title: string | null;
    message: string | null;
  }>({ title: null, message: null });

  useEffect(() => {
    if (
      !tokenPrices ||
      isLoadingTokenPrices ||
      !tokens ||
      !weights ||
      weightsError ||
      tokens.some((token) => !token.address) // TODO: stateful input so we dont need to check for EmptyToken like this
    ) {
      setLiquidityMismatchInfo({ title: null, message: null });
      return;
    }

    if (
      Object.keys(tokenPrices).length !== tokens.length ||
      Object.values(tokenPrices).some((price) => Number(price) === 0 || !price)
    ) {
      // Display a generic warning since price information is either incomplete or isn't available.
      // TODO: the hook should return a flag if the results are incomplete
      setLiquidityMismatchInfo({
        title: "Token price data not available",
        message: `Please ensure that the value of each token is proportional to its assigned weight in the pool. 
        If there is a mismatch the pool may be at risk of arbitrage after creation.`,
      });
      return;
    }

    let totalLiquidityUSD = 0;
    const tokenUSDValues: number[] = [];
    let totalMismatchedLiquidityUSD = 0;

    const wrappedTokens = wrapNativeTokens(tokens); // NOTE: pricing will only exist for WBERA not BERA

    wrappedTokens.forEach((token) => {
      const tokenPriceUSD = tokenPrices[token.address];
      const tokenAmount = parseFloat(token.amount);
      if (!tokenPriceUSD || tokenAmount <= 0) return;
      const tokenLiquidityUSD = Number(tokenPriceUSD) * tokenAmount;
      tokenUSDValues.push(tokenLiquidityUSD);
      totalLiquidityUSD += tokenLiquidityUSD;
    });

    if (totalLiquidityUSD === 0) {
      setLiquidityMismatchInfo({ title: null, message: null });
      return;
    }

    let liquidityMismatch = false;

    if (
      poolType === PoolType.Stable ||
      poolType === PoolType.ComposableStable
    ) {
      const averageLiquidityUSD = totalLiquidityUSD / tokenUSDValues.length;

      tokenUSDValues.forEach((value) => {
        const absoluteDifference = Math.abs(value - averageLiquidityUSD);
        const percentageDifference = absoluteDifference / averageLiquidityUSD;

        if (percentageDifference > liquidityMismatchTolerancePercent) {
          liquidityMismatch = true;
          totalMismatchedLiquidityUSD += absoluteDifference;
        }
      });
    } else if (poolType === PoolType.Weighted) {
      tokenUSDValues.forEach((value, index) => {
        const weightProportion = Number(weights[index]) / Number(BigInt(1e18));
        const expectedWeightUSD = totalLiquidityUSD * weightProportion;

        const absoluteDifference = Math.abs(value - expectedWeightUSD);
        const percentageDifference = absoluteDifference / expectedWeightUSD;

        if (percentageDifference > liquidityMismatchTolerancePercent) {
          liquidityMismatch = true;
          totalMismatchedLiquidityUSD += absoluteDifference;
        }
      });
    }

    // Check if the total mismatched liquidity exceeds the tolerance
    const totalMismatchPercentage =
      totalMismatchedLiquidityUSD / totalLiquidityUSD;

    if (
      !liquidityMismatch ||
      totalMismatchPercentage <= liquidityMismatchTolerancePercent
    ) {
      setLiquidityMismatchInfo({ title: null, message: null });
      return;
    }

    setLiquidityMismatchInfo({
      title: `You could lose up to $${totalMismatchedLiquidityUSD.toFixed(
        2,
      )} (${(totalMismatchPercentage * 100).toFixed(2)}%)`,
      message: `Based on the market token prices, the value of tokens does not align with the specified pool weights. 
      This discrepancy could expose you to potential losses from arbitrageurs.`,
    });
  }, [
    tokenPrices,
    tokens,
    weights,
    weightsError,
    poolType,
    liquidityMismatchTolerancePercent,
  ]);

  return liquidityMismatchInfo;
};
