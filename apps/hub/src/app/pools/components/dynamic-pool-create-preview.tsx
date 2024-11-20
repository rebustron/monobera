"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  balancerVaultAbi,
  formatUsd,
  getSafeNumber,
  useBeraJs,
  wrapNativeTokens,
} from "@bera/berajs";
import { SubgraphTokenInformations } from "@bera/berajs/actions";
import {
  balancerPoolCreationHelper,
  balancerVaultAddress,
  cloudinaryUrl,
} from "@bera/config";
import {
  ActionButton,
  ApproveButton,
  TokenIcon,
  useTxn,
} from "@bera/shared-ui";
import { Alert, AlertDescription, AlertTitle } from "@bera/ui/alert";
import { Button } from "@bera/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@bera/ui/dialog";
import { PoolType } from "@berachain-foundation/berancer-sdk";
import { formatUnits, parseUnits } from "viem";

import { TokenInput } from "~/hooks/useMultipleTokenInput";
import { usePollPoolCreationRelayerApproval } from "~/hooks/usePollPoolCreationRelayerApproval";
import { getPoolUrl } from "../fetchPools";
import { OwnershipType } from "./ownership-input";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  tokens: TokenInput[];
  tokenPrices?: SubgraphTokenInformations;
  weights: bigint[];
  poolName: string;
  poolSymbol: string;
  poolType: string;
  poolId: string;
  swapFee: number;
  ownerAddress: string;
  ownershipType: OwnershipType;
  amplification: number;
  isLoadingCreatePoolTx: boolean;
  isSubmittingCreatePoolTx: boolean;
  isSuccessCreatePoolTx: boolean;
  createPoolErrorMessage: string | null;
  writeCreatePool: () => void;
  tokensNeedApproval: any[];
  refreshAllowances: () => void;
};

export default function DynamicPoolCreationPreview({
  open,
  setOpen,
  tokens,
  tokenPrices,
  weights,
  poolName,
  poolSymbol,
  poolType,
  poolId,
  swapFee,
  ownerAddress,
  ownershipType,
  amplification,
  isLoadingCreatePoolTx,
  isSubmittingCreatePoolTx,
  isSuccessCreatePoolTx,
  createPoolErrorMessage,
  writeCreatePool,
  tokensNeedApproval,
  refreshAllowances,
}: Props) {
  // Get relayer approval status and refresh function
  const router = useRouter();
  const { account } = useBeraJs();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // NOTE: if useTxn isnt here we dont receive updates properly for out submit button
  const {
    data: isRelayerApproved,
    isLoading: isLoadingRelayerStatus,
    error: isRelayerApprovalError,
    refreshPoolCreationApproval,
  } = usePollPoolCreationRelayerApproval();

  // Use useTxn for the approval
  const {
    write,
    ModalPortal: ModalPortalRelayerApproval,
    isLoading: isRelayerApprovalLoading,
    isSubmitting: isRelayerApprovalSubmitting,
  } = useTxn({
    message: "Approving the Pool Creation Helper...",
    onSuccess: () => {
      refreshPoolCreationApproval();
    },
    onError: (e) => {
      setErrorMessage("Error approving relayer.");
    },
  });

  const handleRelayerApproval = async () => {
    if (!account || !balancerVaultAddress) {
      console.error("Missing account or balancerVaultAddress");
      return;
    }
    try {
      await write({
        address: balancerVaultAddress,
        abi: balancerVaultAbi,
        functionName: "setRelayerApproval",
        params: [account, balancerPoolCreationHelper, true],
      });
    } catch (error) {
      setErrorMessage(
        "Error approving PoolCreationHelper as a Relayer on Vault contract",
      );
    }
  };

  useEffect(() => {
    if (isRelayerApprovalError) {
      setErrorMessage("Error loading relayer approval status");
    }
  }, [isRelayerApprovalError]);

  const formattedOwnerAddress = `${ownerAddress.slice(
    0,
    6,
  )}...${ownerAddress.slice(-4)} (${ownershipType})`;

  const poolDetails = [
    { label: "Pool Name", value: poolName },
    { label: "Pool Symbol", value: poolSymbol },
    { label: "Pool Type", value: poolType },
    { label: "Swap Fee", value: `${swapFee}%` },
    { label: "Owner Address", value: formattedOwnerAddress },
    // TODO (#): we will want to display rate providers here
  ];

  if (
    poolType === PoolType.ComposableStable ||
    poolType === PoolType.MetaStable
  ) {
    poolDetails.push({
      label: "Amplification",
      value: amplification.toString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-lg bg-black p-8 text-foreground sm:w-[500px]">
        <DialogHeader>
          {isSuccessCreatePoolTx ? (
            <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
              <Image
                src={`${cloudinaryUrl}/DEX/ycllsahokol33hfs8yx6.png`}
                alt="Success Polar Bear"
                width={240}
                height={150}
              />
              <div className="flex flex-row items-center gap-2">
                {wrapNativeTokens(tokens).map((token, idx: number) => (
                  <TokenIcon
                    key={`${token}-${idx}`}
                    address={token.address}
                    size={"2xl"}
                    className="ml-[-18px]"
                  />
                ))}
              </div>
              <h3 className="text-center text-xl font-bold">{`${poolName} has been successfully created`}</h3>
            </div>
          ) : (
            <>
              <DialogTitle className="mb-1 text-sm font-semibold text-foreground">
                {poolType}
              </DialogTitle>
              <h2 className="text-3xl font-bold">{poolName}</h2>
            </>
          )}
        </DialogHeader>
        {ModalPortalRelayerApproval}

        <div className="mt-4 space-y-6">
          {/* Initial Liquidity Section */}
          <section>
            <h3 className="mb-2 text-lg font-medium">Initial Liquidity</h3>
            {tokens.map((token, index) => (
              <div
                key={index}
                className="mb-2 flex items-center justify-between text-foreground"
              >
                <div className="flex items-center gap-2">
                  {/* FIXME: do we want to display some kind tooltip explaining the BERA -> WBERA case? */}
                  <TokenIcon address={token.address} symbol={token.symbol} />
                  <span className="font-semibold">{token.symbol}</span>
                  {poolType === PoolType.Weighted && (
                    <span className="text-sm text-foreground">
                      {Number(formatUnits(weights[index], 16)).toFixed(2)}%
                    </span>
                  )}
                </div>
                <span className="text-sm text-foreground">
                  {Number(token.amount).toFixed(2)}{" "}
                  <span className="text-foreground">
                    {tokenPrices?.[token.address] &&
                      `(${formatUsd(
                        tokenPrices[token.address] *
                          getSafeNumber(token.amount),
                      )})`}
                  </span>
                </span>
              </div>
            ))}
          </section>

          <hr className="my-4 border-t" />

          {/* Pool Details Section */}
          <section className="space-y-2 text-sm text-foreground">
            {poolDetails.map((detail, index) => (
              <div key={index} className="flex justify-between">
                <span className="font-semibold">{detail.label}</span>
                <span className="w-2/3 text-right">{detail.value}</span>
              </div>
            ))}
          </section>

          {/* NOTE: we display pool creation tx errors in this dialog, and not in the background page. */}
          {(createPoolErrorMessage || errorMessage) && (
            <Alert
              variant="destructive"
              className="my-4 text-destructive-foreground"
            >
              <AlertTitle>Error</AlertTitle>
              {createPoolErrorMessage && (
                <AlertDescription>{createPoolErrorMessage}</AlertDescription>
              )}
              {errorMessage && (
                <AlertDescription>{errorMessage}</AlertDescription>
              )}
            </Alert>
          )}

          {/* Conditional Approve and Create Pool Buttons */}
          {!isSuccessCreatePoolTx ? (
            <>
              {!isRelayerApproved ? (
                <ActionButton>
                  <Button
                    disabled={
                      isRelayerApprovalLoading ||
                      isLoadingRelayerStatus ||
                      isRelayerApprovalSubmitting
                    }
                    onClick={handleRelayerApproval}
                    className="w-full"
                  >
                    Approve Pool Creation Helper
                    {(isRelayerApprovalLoading ||
                      isRelayerApprovalSubmitting) &&
                      "..."}
                  </Button>
                </ActionButton>
              ) : tokensNeedApproval.length > 0 ? (
                (() => {
                  const approvalTokenIndex = tokens.findIndex(
                    (t) => t.address === tokensNeedApproval[0]?.address,
                  );
                  const approvalToken = tokens[approvalTokenIndex];
                  const approvalAmount = parseUnits(
                    approvalToken.amount,
                    approvalToken?.decimals ?? 18,
                  );

                  return (
                    <ActionButton>
                      <ApproveButton
                        amount={approvalAmount}
                        disabled={approvalAmount === BigInt(0)}
                        token={approvalToken}
                        spender={balancerVaultAddress}
                        onApproval={() => refreshAllowances()}
                      />
                    </ActionButton>
                  );
                })()
              ) : (
                <ActionButton>
                  <Button
                    onClick={writeCreatePool}
                    disabled={isLoadingCreatePoolTx || isSubmittingCreatePoolTx}
                    className="w-full bg-white font-semibold text-black"
                  >
                    {isLoadingCreatePoolTx || isSubmittingCreatePoolTx
                      ? "Creating Pool..."
                      : "Create Pool"}
                  </Button>
                </ActionButton>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                onClick={() => {
                  router.push(getPoolUrl({ id: poolId }));
                }}
              >
                View Pool
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  router.push("/pools");
                }}
              >
                Back to all Pools
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
