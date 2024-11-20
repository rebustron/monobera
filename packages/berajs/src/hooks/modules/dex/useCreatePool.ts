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
import { wrapNativeToken, wrapNativeTokens } from "~/utils/tokenWrapping";
import { balancerPoolCreationHelperAbi } from "~/abi";
import { ADDRESS_ZERO } from "~/config";
import { IContractWrite } from "~/hooks/useContractWrite";
import { TokenWithAmount } from "~/types";

const DEFAULT_WEIGHTS_DUPLICATION_THRESHOLD = 0.005;
const DEFAULT_POOL_CREATE_GAS_LIMIT = 7920027n; // NOTE: this is the metamask gas limit, in experiments we find we can easily use 75% of this.

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

const createStablePoolArgs = (
  tokens: TokenWithAmount[],
  swapFeePercentage: bigint,
  salt: string,
  poolName: string,
  poolSymbol: string,
  owner: string,
  amplification: number,
  gasLimit: bigint = DEFAULT_POOL_CREATE_GAS_LIMIT,
) => {
  // When joining stable pools with BERA we pass value = the amount, wrap it to WBERA in createPoolTokens & we set the joinWBERAPoolWithBERA true.
  const wrappedTokens = wrapNativeTokens(tokens);

  // Sort tokens and their corresponding amounts together
  const sortedTokensAndAmounts = wrappedTokens
    .map((token) => ({
      address: token.address.toLowerCase(),
      amount: parseUnits(token.amount, token.decimals ?? 18),
      decimals: token.decimals,
    }))
    .sort((a, b) => (a.address < b.address ? -1 : 1));

  const createPoolTokens = sortedTokensAndAmounts.map((item) => item.address);
  const sortedAmountsIn = sortedTokensAndAmounts.map((item) => item.amount);

  // Determine if the native token (BERA) is included and set value/flag accordingly
  const nativeTokenIndex = tokens.findIndex(
    (token) => token.address.toLowerCase() === nativeTokenAddress.toLowerCase(),
  );
  const value =
    nativeTokenIndex !== -1 ? sortedAmountsIn[nativeTokenIndex] : 0n;
  const joinWBERAPoolWithBERA = value > 0n;

  // Default rate providers and cache durations for stable pools TODO: these should be set and sorted if we are metastable.
  const rateProviders = Array(createPoolTokens.length).fill(ADDRESS_ZERO);
  const cacheDurations = Array(createPoolTokens.length).fill(BigInt(100)); // default safe duration

  return {
    address: balancerPoolCreationHelper,
    abi: balancerPoolCreationHelperAbi,
    functionName: "createAndJoinStablePool",
    params: [
      poolName,
      poolSymbol,
      createPoolTokens,
      BigInt(amplification),
      rateProviders,
      cacheDurations,
      false, // Exempt from yield protocol fee NOTE: this should be false for stable pools if rate providers are 0x0
      swapFeePercentage,
      sortedAmountsIn,
      owner as `0x${string}`,
      salt,
      joinWBERAPoolWithBERA,
    ],
    value,
    gasLimit,
  } as IContractWrite<
    typeof balancerPoolCreationHelperAbi,
    "createAndJoinStablePool"
  >;
};

const createWeightedPoolArgs = (
  tokens: TokenWithAmount[],
  normalizedWeights: bigint[],
  swapFeePercentage: bigint,
  salt: string,
  poolName: string,
  poolSymbol: string,
  owner: string,
  gasLimit: bigint = DEFAULT_POOL_CREATE_GAS_LIMIT,
) => {
  // When joining weighted pools with BERA, we allow it as a joinPoolToken but never as a createPoolToken.
  const createPoolTokens: string[] = [];
  const joinPoolTokens: string[] = [];
  const sortedWeights: bigint[] = [];
  const sortedAmountsIn: bigint[] = [];

  tokens
    .map((token, index) => {
      // NOTE: would prefer to use isBera here... but it's not accessible as it's in wagmi package.
      const isNativeToken = token.address === nativeTokenAddress;
      const wrappedAddress = isNativeToken
        ? wrapNativeToken(token).address
        : token.address;

      return {
        createToken: wrappedAddress, // Use wrapped token for pool creation
        joinToken: token.address, // Allow native token for joining
        weight: normalizedWeights[index], // Normalized weight
        amountIn: parseUnits(token.amount || "0", token.decimals ?? 18), // Token amount
      };
    })
    .sort((a, b) =>
      a.createToken.toLowerCase() < b.createToken.toLowerCase() ? -1 : 1,
    )
    .forEach((item) => {
      createPoolTokens.push(item.createToken);
      joinPoolTokens.push(item.joinToken);
      sortedWeights.push(item.weight);
      sortedAmountsIn.push(item.amountIn);
    });

  // Determine if native token (BERA) is involved and calculate its value, that is the value of this tx
  const nativeTokenIndex = joinPoolTokens.indexOf(nativeTokenAddress);
  const value =
    nativeTokenIndex !== -1 ? sortedAmountsIn[nativeTokenIndex] : 0n;

  return {
    address: balancerPoolCreationHelper,
    abi: balancerPoolCreationHelperAbi,
    functionName: "createAndJoinWeightedPool",
    params: [
      poolName,
      poolSymbol,
      createPoolTokens,
      joinPoolTokens,
      sortedWeights,
      Array(createPoolTokens.length).fill(ADDRESS_ZERO),
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
};

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
  // 1. identify if the pool is a duplicate
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
        const tokensSorted = wrapNativeTokens(tokens)
          .map((token) => token.address.toLowerCase())
          .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

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
              ? // in weighted pools, a dupe is if tokens and weights match within tolerance FIXME: we aren't getting weighted pools returned here
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

  // Generated names
  const { generatedPoolName, generatedPoolSymbol } = useMemo(() => {
    if (!tokens) {
      return {
        generatedPoolName: "",
        generatedPoolSymbol: "",
      };
    }
    const wrappedTokens = wrapNativeTokens(tokens);
    const generatedPoolName = generatePoolName(wrappedTokens);
    const generatedPoolSymbol = generatePoolSymbol(
      wrappedTokens,
      normalizedWeights,
      poolType,
    );

    return {
      generatedPoolName,
      generatedPoolSymbol,
    };
  }, [tokens, normalizedWeights, poolType]);

  // Pool create tx
  const createPoolArgs = useMemo(() => {
    if (!owner || poolName === "" || poolSymbol === "") {
      return null;
    }

    const swapFeePercentage = parseUnits(swapFee.toString(), 16);
    const salt = keccak256(Buffer.from(`${poolName}-${owner}`));

    if (poolType === PoolType.Weighted) {
      return createWeightedPoolArgs(
        tokens,
        normalizedWeights,
        swapFeePercentage,
        salt,
        poolName,
        poolSymbol,
        owner,
      );
    }

    if (
      poolType === PoolType.ComposableStable ||
      poolType === PoolType.MetaStable
    ) {
      return createStablePoolArgs(
        tokens,
        swapFeePercentage,
        salt,
        poolName,
        poolSymbol,
        owner,
        amplification,
      );
    }

    return null;
  }, [
    tokens,
    normalizedWeights,
    poolType,
    swapFee,
    poolName,
    poolSymbol,
    owner,
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
