"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  balancerPoolCreationHelperAbi,
  useBeraJs,
  useCreatePool,
  useLiquidityMismatch,
  useSubgraphTokenInformations,
  type Token,
} from "@bera/berajs";
import {
  balancerDelegatedOwnershipAddress,
  balancerVaultAddress,
} from "@bera/config";
import {
  ActionButton,
  TokenInput,
  useAnalytics,
  useTxn,
} from "@bera/shared-ui";
import { cn } from "@bera/ui";
import { Alert, AlertDescription, AlertTitle } from "@bera/ui/alert";
import { Button } from "@bera/ui/button";
import { Icons } from "@bera/ui/icons";
import { InputWithLabel } from "@bera/ui/input";
import { Separator } from "@bera/ui/separator";
import {
  PoolType,
  ZERO_ADDRESS,
  composabableStablePoolV5Abi_V2,
  vaultV2Abi,
  weightedPoolFactoryV4Abi_V2,
} from "@berachain-foundation/berancer-sdk";
import { decodeEventLog, isAddress, parseUnits, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";

import BeraTooltip from "~/components/bera-tooltip";
import { usePoolWeights } from "~/b-sdk/usePoolWeights";
import useMultipleTokenApprovalsWithSlippage from "~/hooks/useMultipleTokenApprovalsWithSlippage";
import { TokenInput as TokenInputType } from "~/hooks/useMultipleTokenInput";
import { usePollPoolCreationRelayerApproval } from "~/hooks/usePollPoolCreationRelayerApproval";
import CreatePoolInput from "../components/create-pool-input";
import DynamicPoolCreationPreview from "../components/dynamic-pool-create-preview";
import OwnershipInput, { OwnershipType } from "../components/ownership-input";
import PoolTypeSelector from "../components/pool-type-selector";
import { getPoolUrl } from "../fetchPools";

const emptyToken: TokenInputType = {
  address: "" as `0x${string}`,
  amount: "0",
  decimals: 18,
  exceeding: false,
  name: "",
  symbol: "",
};

export default function CreatePageContent() {
  const router = useRouter();
  const { captureException, track } = useAnalytics();
  const { account } = useBeraJs();
  const publicClient = usePublicClient();

  const [tokens, setTokens] = useState<TokenInputType[]>([
    emptyToken,
    emptyToken,
  ]); // TODO: we should use useMultipleTokenInput here, but it will need weight handling and the ability to add/remove inputs
  const [poolType, setPoolType] = useState<PoolType>(PoolType.ComposableStable);
  const [swapFee, setSwapFee] = useState<number>(0.1);
  const [owner, setOwner] = useState<string>(ZERO_ADDRESS);
  const [poolName, setPoolName] = useState<string>("");
  const [poolSymbol, setPoolSymbol] = useState<string>("");
  const [amplification, setAmplification] = useState<number>(1); // NOTE: min is 1 max is 5000
  const [ownershipType, setOwnerShipType] = useState<OwnershipType>(
    OwnershipType.Governance,
  );
  const [invalidAddressErrorMessage, setInvalidAddressErrorMessage] = useState<
    string | null
  >(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);

  const { data: tokenPrices, isLoading: isLoadingTokenPrices } =
    useSubgraphTokenInformations({
      tokenAddresses: tokens.map((token) => token?.address),
    });

  async function getPoolIdFromTx(txHash: `0x${string}`) {
    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: txHash,
    });

    try {
      const decodedLogs = receipt?.logs.map((log) => {
        try {
          return decodeEventLog({
            abi: [
              ...balancerPoolCreationHelperAbi,
              ...vaultV2Abi,
              ...(poolType === PoolType.Weighted
                ? weightedPoolFactoryV4Abi_V2
                : composabableStablePoolV5Abi_V2),
            ],
            ...log,
            strict: false,
          });
        } catch (error) {
          return null;
        }
      });

      const event = decodedLogs?.find(
        (decodedLog) => decodedLog?.eventName === "PoolRegistered",
      );

      if (!event || event.eventName !== "PoolRegistered") {
        return null;
      }

      return event.args.poolId ?? null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  const handleOwnershipTypeChange = (type: OwnershipType) => {
    setOwnerShipType(type);
    setOwner(
      type === OwnershipType.Governance
        ? balancerDelegatedOwnershipAddress
        : type === OwnershipType.Fixed
          ? ZERO_ADDRESS
          : account || zeroAddress,
    );
  };

  const handleOwnerChange = (address: string) => {
    setOwner(address);
    setInvalidAddressErrorMessage(
      isAddress(address) ? null : "Invalid custom address",
    );
  };

  // handle max/min tokens per https://docs.balancer.fi/concepts/pools/more/configuration.html
  const minTokensLength = 2; // i.e. for meta/stable/weighted it's 2
  const maxTokensLength = poolType === PoolType.Weighted ? 8 : 5; // i.e. for meta/stable it's 5

  // check for token approvals
  const { needsApproval: tokensNeedApproval, refresh: refreshAllowances } =
    useMultipleTokenApprovalsWithSlippage(tokens, balancerVaultAddress);

  const {
    weights,
    lockedWeights,
    weightsError,
    handleWeightChange,
    toggleLock,
    addWeight,
    removeWeight,
  } = usePoolWeights([500000000000000000n, 500000000000000000n]);

  const addTokenInput = () => {
    if (tokens.length < maxTokensLength) {
      setTokens([...tokens, emptyToken]);
      addWeight();
    }
  };

  const handleRemoveToken = (index: number) => {
    if (tokens.length > minTokensLength) {
      setTokens((prevTokens) => prevTokens.filter((_, i) => i !== index));
      removeWeight(index);
    }
  };

  // Update token selection and reset weights when we change tokens
  const handleTokenSelection = (token: Token | undefined, index: number) => {
    setTokens((prevTokens) => {
      const updatedTokens = [...prevTokens];
      if (token) {
        updatedTokens[index] = {
          amount: "0",
          exceeding: false,
          ...token,
        } as TokenInputType;
      }
      return updatedTokens;
    });
  };

  // Update a specific token's amount and exceeding status (comes from liquidity input)
  const handleTokenChange = (
    index: number,
    newValues: Partial<TokenInputType>,
  ): void => {
    setTokens((prevTokens) => {
      const updatedTokens = [...prevTokens];
      updatedTokens[index] = {
        ...updatedTokens[index],
        ...newValues,
      };
      return updatedTokens;
    });
  };

  // Initialize useCreatePool hook to get pool setup data and arguments for creating pool
  const {
    generatedPoolName,
    generatedPoolSymbol,
    isDupePool,
    dupePool,
    createPoolArgs,
  } = useCreatePool({
    tokens,
    normalizedWeights: weights,
    poolType,
    swapFee,
    poolName,
    poolSymbol,
    owner,
    amplification,
  });

  // Synchronize the generated pool name and symbol with state
  useEffect(() => {
    setPoolName(generatedPoolName);
    setPoolSymbol(generatedPoolSymbol);
  }, [generatedPoolName, generatedPoolSymbol]);

  // Create the pool with UX feedback
  const [createPoolErrorMessage, setCreatePoolErrorMessage] =
    useState<string>("");
  const [poolId, setPoolId] = useState<string>("");
  const {
    write: writeCreatePool,
    ModalPortal,
    isLoading: isLoadingCreatePoolTx,
    isSubmitting: isSubmittingCreatePoolTx,
    isSuccess: isSuccessCreatePoolTx,
  } = useTxn({
    message: `Create pool ${poolName}`,
    onSuccess: async (txHash) => {
      track("create_pool_success");
      const poolId = await getPoolIdFromTx(txHash as `0x${string}`);
      console.log("poolId", poolId);
      if (poolId) {
        setPoolId(poolId);
      }
    },
    onError: (e) => {
      track("create_pool_failed");
      captureException(new Error("Create pool failed"), {
        data: { rawError: e },
      });
      setCreatePoolErrorMessage(`Error creating pool: ${e?.message}`);
    },
  });

  // Reset the error message if you close/reopen the preview
  useEffect(() => {
    if (!isPreviewOpen) {
      setCreatePoolErrorMessage("");
    }
  }, [isPreviewOpen]);

  // Determine if there are any liquidity mismatches in the pool (supply imbalances in terms of pool weights)
  const liquidityMismatchInfo = useLiquidityMismatch({
    tokenPrices,
    isLoadingTokenPrices,
    tokens,
    weights,
    weightsError,
    poolType,
  });

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center justify-center gap-6">
      {ModalPortal}
      <Button
        variant={"ghost"}
        size="sm"
        className="flex items-center gap-1 self-start"
        onClick={() => router.push("/pools")}
      >
        <Icons.arrowLeft className="h-4 w-4" />
        <div className="text-sm font-medium">All Pools</div>
      </Button>
      <div className="flex w-full flex-col items-center justify-center gap-16">
        <PoolTypeSelector poolType={poolType} onPoolTypeChange={setPoolType} />

        <section className="flex w-full flex-col gap-4">
          <h2 className="self-start text-3xl font-semibold">{`Select Tokens ${
            poolType === PoolType.Weighted ? "& Weighting" : ""
          }`}</h2>
          <div className="flex w-full flex-col gap-2">
            {tokens.map((token, index) => (
              <CreatePoolInput
                key={`token-${index}`}
                token={token}
                selectedTokens={tokens}
                weight={weights[index]}
                displayWeight={poolType === PoolType.Weighted}
                locked={lockedWeights[index]}
                displayRemove={tokens.length > minTokensLength}
                index={index}
                onTokenSelection={(selectedToken) =>
                  handleTokenSelection(selectedToken, index)
                }
                onWeightChange={handleWeightChange}
                onLockToggle={toggleLock}
                onRemoveToken={handleRemoveToken}
              />
            ))}
          </div>

          {tokens.length < maxTokensLength && (
            <>
              <Separator className="text-muted-foreground opacity-50" />
              <div className="mr-auto -translate-x-4">
                <Button
                  onClick={addTokenInput}
                  variant="ghost"
                  className="text-foreground"
                >
                  <Icons.plusCircle className="h-6 w-6" />
                  <p className="pl-2"> Add Token</p>
                </Button>
              </div>
            </>
          )}
          {weightsError && (
            <Alert variant="destructive" className="my-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{weightsError}</AlertDescription>
            </Alert>
          )}

          {isDupePool && dupePool && (
            <Alert variant="destructive">
              <AlertTitle>Similar Pool Exists</AlertTitle>
              <AlertDescription className="space-y-4">
                <p>
                  {`Please note that a ${poolType} pool with the same tokens 
                exists, consider adding liquidity instead of creating a new pool:`}
                </p>
                <a
                  href={getPoolUrl(dupePool)}
                  className="text-sky-600 underline"
                >
                  Existing pool
                </a>
              </AlertDescription>
            </Alert>
          )}
        </section>

        <section className="flex w-full flex-col gap-4">
          <h2 className="self-start text-3xl font-semibold">
            Set Initial Liquidity
          </h2>
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-border rounded-lg border">
              {tokens.map((token, index) => (
                // TODO (#): we ought to handle isLoadingTokenPrices in price display
                <TokenInput
                  key={`liq-${index}`}
                  selected={token}
                  amount={token.amount}
                  isActionLoading={isLoadingTokenPrices}
                  price={Number(tokenPrices?.[token?.address] ?? 0)} // TODO (#): this would make more sense as token.usdValue
                  hidePrice={!tokenPrices?.[token?.address]}
                  disabled={false}
                  setAmount={(amount) => handleTokenChange(index, { amount })}
                  onExceeding={(isExceeding) =>
                    handleTokenChange(index, { exceeding: isExceeding })
                  }
                  showExceeding
                  selectable={false}
                  forceShowBalance={true}
                  hideMax={false}
                  className={cn(
                    "w-full grow border-0 bg-transparent pr-4 text-right text-2xl font-semibold outline-none",
                    token.exceeding && "text-destructive-foreground",
                  )}
                />
              ))}
            </ul>
            {!weightsError && liquidityMismatchInfo.message && (
              <Alert variant="warning" className="my-4">
                <AlertTitle>{liquidityMismatchInfo.title}</AlertTitle>
                <AlertDescription>
                  {liquidityMismatchInfo.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>

        <OwnershipInput
          // NOTE: disabling this means that the default (fixed) ownership type is used always
          ownershipType={ownershipType}
          owner={owner}
          onChangeOwnershipType={handleOwnershipTypeChange}
          onOwnerChange={handleOwnerChange}
          invalidAddressErrorMessage={invalidAddressErrorMessage}
          swapFee={swapFee}
          onSwapFeeChange={setSwapFee}
          poolType={poolType}
        />

        <section className="flex w-full flex-col gap-4">
          <InputWithLabel
            label="Pool Name"
            variant="black"
            className="bg-transparent"
            value={poolName}
            maxLength={85}
            onChange={(e) => {
              setPoolName(e.target.value);
            }}
          />

          <InputWithLabel
            label="Pool Symbol"
            variant="black"
            className="bg-transparent"
            value={poolSymbol}
            maxLength={85}
            onChange={(e) => {
              setPoolSymbol(e.target.value.replace(" ", "-"));
            }}
          />

          {(poolType === PoolType.ComposableStable ||
            poolType === PoolType.MetaStable) && (
            <InputWithLabel
              label="Amplification"
              variant="black"
              className="bg-transparent"
              value={amplification}
              maxLength={4}
              onChange={(e) => {
                // NOTE: for some reason max/min dont seem to work in InputWithLabel
                const value = Number(e.target.value);
                if (value >= 1 && value <= 5000) {
                  setAmplification(value);
                }
              }}
              tooltip={
                <BeraTooltip
                  size="lg"
                  wrap={true}
                  text={`
                  Controls the pool's sensitivity to imbalances between assets. A higher value causes slippage to occur sooner 
                  as assets diverge from balance, helping to preserve accurate pricing by discouraging extreme imbalances. 
                  This is often ideal for stable pairs, as it maintains tighter spreads when token values are close, but 
                  increases slippage more rapidly for large disparities, supporting the pool's economic stability.`}
                />
              }
            />
          )}
        </section>

        <ActionButton>
          <Button
            onClick={() => setPreviewOpen(true)}
            className="w-full"
            disabled={
              !poolName ||
              !poolSymbol ||
              !owner ||
              !isAddress(owner) ||
              !tokens.every(
                (token) =>
                  token.address && Number(token.amount) > 0 && !token.exceeding,
              ) ||
              (poolType === PoolType.Weighted
                ? !weights.every((weight) => weight > 0n)
                : !amplification)
            }
          >
            Preview
          </Button>
        </ActionButton>

        <DynamicPoolCreationPreview
          open={isPreviewOpen}
          setOpen={setPreviewOpen}
          tokens={tokens}
          tokenPrices={tokenPrices} // TODO: it would make more sense to set these inside TokenInput.usdValue
          weights={weights}
          poolName={poolName}
          poolSymbol={poolSymbol}
          poolType={poolType}
          poolId={poolId}
          swapFee={swapFee}
          ownerAddress={owner}
          ownershipType={ownershipType}
          amplification={amplification}
          isLoadingCreatePoolTx={isLoadingCreatePoolTx}
          isSubmittingCreatePoolTx={isSubmittingCreatePoolTx}
          writeCreatePool={() => {
            console.log("createPoolArgs", createPoolArgs);
            writeCreatePool(createPoolArgs);
          }}
          isSuccessCreatePoolTx={isSuccessCreatePoolTx}
          createPoolErrorMessage={createPoolErrorMessage}
          tokensNeedApproval={tokensNeedApproval}
          refreshAllowances={refreshAllowances}
        />
      </div>
    </div>
  );
}
