import { useMemo } from "react";
import { balancerPoolCreationHelper, nativeTokenAddress } from "@bera/config";
import { bexSubgraphClient } from "@bera/graphql";
import {
  GetDedupedSubgraphPools,
  GetDedupedSubgraphPoolsQuery,
  SubgraphPoolFragment,
} from "@bera/graphql/dex/subgraph";
import { PoolType } from "@berachain-foundation/berancer-sdk";
import useSWRImmutable from "swr/immutable";
import { formatUnits, keccak256, parseUnits } from "viem";

import { generatePoolName, generatePoolSymbol } from "~/utils/poolNamings";
import { wrapNativeTokens } from "~/utils/tokenWrapping";
import { balancerPoolCreationHelperAbi } from "~/abi";
import { ADDRESS_ZERO } from "~/config";
import { IContractWrite } from "~/hooks/useContractWrite";
import { TokenWithAmount } from "~/types";

const DEFAULT_WEIGHTS_DUPLICATION_THRESHOLD = 0.005;

interface UseCreatePoolProps {
  tokens: TokenWithAmount[];
  normalizedWeights: bigint[]; // NOTE: if you pass weights that have off-by-1 errors pool create will fail (ex: 0.3 repeating)
  poolType: PoolType;
  swapFee: number;
  owner: string;
  poolSymbol: string;
  poolName: string;
  amplification: number;
  weightsDuplicationThreshold?: number;
}

interface UseCreatePoolReturn {
  generatedPoolName: string;
  generatedPoolSymbol: string;
  isDupePool: boolean;
  dupePool?: SubgraphPoolFragment | null;
  createPoolArgs: any;
  isLoadingPools: boolean;
  errorLoadingPools: boolean;
}

export const useCreatePool = ({
  tokens,
  normalizedWeights,
  poolType,
  poolName,
  poolSymbol,
  swapFee,
  owner,
  amplification,
  weightsDuplicationThreshold = DEFAULT_WEIGHTS_DUPLICATION_THRESHOLD,
}: UseCreatePoolProps): UseCreatePoolReturn => {
  const {
    data: dupePool,
    error: errorLoadingPools,
    isLoading: isLoadingPools,
  } = useSWRImmutable<SubgraphPoolFragment | null>(
    ["useCreatePool__deduped_pool", tokens, poolType, normalizedWeights],
    async () => {
      if (tokens.length === 0 || !poolType) {
        return null;
      }
      try {
        const wrappedTokens = wrapNativeTokens(tokens);
        const tokensSorted = wrappedTokens
          .map((token) => token.address.toLowerCase())
          .sort((a, b) => a.localeCompare(b));

        // fetch pools of the same type as the one we are creating
        const res = await bexSubgraphClient.query<GetDedupedSubgraphPoolsQuery>(
          {
            query: GetDedupedSubgraphPools,
            variables: {
              tokens: tokensSorted,
              type: poolType,
            },
          },
        );

        const matchingPools = res.data.pools.filter((pool) => {
          return pool.tokens?.every((token) =>
            poolType === PoolType.Weighted
              ? // in weighted pools, a dupe is if tokens match and weights match within .5% of each other
                tokensSorted.includes(token.address) &&
                Math.abs(
                  Number(token.weight) -
                    Number(
                      formatUnits(
                        normalizedWeights[tokensSorted.indexOf(token.address)],
                        18,
                      ),
                    ),
                ) < weightsDuplicationThreshold
              : // in composable pools a dupe is if the tokens match, handling that the LP token is in the tokens list
                tokensSorted.includes(token.address) ||
                token.address === pool.address,
          );
        });

        return matchingPools?.at(0) ?? null;
      } catch (error) {
        return null;
      }
    },
  );

  const [generatedPoolName, generatedPoolSymbol] = useMemo(() => {
    // NOTE: we will never create a pool with BERA as the token, it will always get wrapped.
    const wrappedTokens = wrapNativeTokens(tokens);
    return [
      generatePoolName(wrappedTokens),
      generatePoolSymbol(wrappedTokens, normalizedWeights, poolType),
    ];
  }, [tokens, poolType, normalizedWeights]);

  const sharedCalculations = useMemo(() => {
    // Shared data preparation for both pool types
    // NOTE: we do support native token here but it's not actually used as a pool token (it is wrapped)
    // TODO (#): add support for rate providers
    const tokensAddresses = tokens.map((token) => token.address);
    const rateProviders = tokens.map(() => ADDRESS_ZERO as `0x${string}`);
    const swapFeePercentage = parseUnits(swapFee.toString(), 16);
    const amountsIn = tokens.map((token) =>
      parseUnits(token.amount || "0", token.decimals ?? 18),
    );

    const sortedData = tokensAddresses
      .map((token, index) => ({
        token,
        amountIn: amountsIn[index],
        rateProvider: rateProviders[index],
        weight: normalizedWeights[index],
        cacheDuration: BigInt(100),
      }))
      .sort((a, b) => (a.token.toLowerCase() < b.token.toLowerCase() ? -1 : 1));

    const sortedTokens = sortedData.map((item) => item.token);
    const sortedAmountsIn = sortedData.map((item) => item.amountIn);
    const sortedRateProviders = sortedData.map((item) => item.rateProvider);
    const sortedWeights = sortedData.map((item) => item.weight);
    const sortedCacheDurations = sortedData.map((item) => item.cacheDuration);

    // Check if the native token is included, if so that amount becomes the value of this tx and we add it to joinPools
    const nativeTokenIndex = sortedTokens.indexOf(nativeTokenAddress);
    const value =
      nativeTokenIndex !== -1 ? sortedAmountsIn[nativeTokenIndex] : 0n;

    // NOTE: we would expect nativeTokenAddress is zero address, but jic...
    const joinPoolTokens = sortedTokens.map((token) =>
      token === nativeTokenAddress ? ADDRESS_ZERO : token,
    );

    return {
      sortedTokens,
      sortedAmountsIn,
      sortedRateProviders,
      sortedWeights,
      sortedCacheDurations,
      joinPoolTokens,
      swapFeePercentage,
      value,
      salt: keccak256(Buffer.from(`${poolName}-${owner}`)),
    };
  }, [tokens, normalizedWeights, swapFee, poolName, owner]);

  const isStablePool =
    poolType === PoolType.ComposableStable || poolType === PoolType.MetaStable;
  const exemptFromYieldProtocolFeeFlag = false;

  const createPoolArgs = useMemo(() => {
    if (!owner || poolName === "" || poolSymbol === "") return null;

    const {
      sortedTokens,
      sortedAmountsIn,
      sortedRateProviders,
      sortedWeights,
      sortedCacheDurations,
      joinPoolTokens,
      swapFeePercentage,
      value,
      salt,
    } = sharedCalculations;

    const gasLimit = 7920027n; // NOTE: this is metamask max, which we use for an upper limit in simulation because this is an expensive tx

    if (isStablePool) {
      return {
        address: balancerPoolCreationHelper,
        abi: balancerPoolCreationHelperAbi,
        functionName: "createAndJoinStablePool",
        params: [
          poolName,
          poolSymbol,
          sortedTokens,
          BigInt(amplification),
          sortedRateProviders,
          sortedCacheDurations,
          exemptFromYieldProtocolFeeFlag,
          swapFeePercentage,
          sortedAmountsIn,
          owner as `0x${string}`,
          salt,
          value > 0n, // joinWBERAPoolWithBERA flag
        ],
        value,
        gasLimit,
      } as IContractWrite<
        typeof balancerPoolCreationHelperAbi,
        "createAndJoinStablePool"
      >;
    }

    return {
      address: balancerPoolCreationHelper,
      abi: balancerPoolCreationHelperAbi,
      functionName: "createAndJoinWeightedPool",
      params: [
        poolName,
        poolSymbol,
        sortedTokens,
        joinPoolTokens,
        sortedWeights,
        sortedRateProviders,
        swapFeePercentage,
        sortedAmountsIn,
        owner as `0x${string}`,
        salt,
      ],
      value,
      gasLimit,
    } as IContractWrite<
      typeof balancerPoolCreationHelperAbi,
      "createAndJoinWeightedPool"
    >;
  }, [
    owner,
    poolName,
    poolSymbol,
    isStablePool,
    sharedCalculations,
    amplification,
  ]);

  return {
    generatedPoolName,
    generatedPoolSymbol,
    isDupePool: !!dupePool,
    dupePool,
    createPoolArgs,
    isLoadingPools,
    errorLoadingPools,
  };
};
