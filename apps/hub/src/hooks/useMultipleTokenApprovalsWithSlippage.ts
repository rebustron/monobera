"use client";

import { useMemo } from "react";
import { usePollAllowances, type Token } from "@bera/berajs";
import { Address, parseUnits } from "viem";

import { type TokenInput } from "./useMultipleTokenInput";

export type NeedsApprovalToken = Token & {
  maxAmountIn: bigint;
};

const useMultipleTokenApprovalsWithSlippage = (
  tokenInput: TokenInput[],
  spender: Address,
  slippage?: number,
) => {
  const tokens = useMemo(
    () =>
      tokenInput
        .filter((token: TokenInput) => token !== undefined)
        .filter((token) => token.amount !== "0")
        .map((token) => token),
    [tokenInput],
  );

  const { data: allowances, refresh } = usePollAllowances({
    spender: spender,
    tokens,
  });

  const needsApproval = useMemo(() => {
    return (
      (allowances
        ?.map((allowance) => {
          const token = tokens.find(
            (token: TokenInput) => token?.address === allowance.address,
          );
          const sI = parseUnits(token?.amount as string, token?.decimals ?? 18);
          const s = parseUnits(
            (slippage ?? 0).toString(),
            token?.decimals ?? 18,
          );
          const maxAmountIn =
            (sI ?? 0n) +
            ((sI ?? 0n) * s) / BigInt(100 * 10 ** (token?.decimals ?? 18));

          if (allowance.allowance === 0n || allowance.allowance < maxAmountIn) {
            return { ...allowance, maxAmountIn };
          }
        })
        .filter((token) => token !== undefined) as NeedsApprovalToken[]) ?? []
    );
  }, [allowances, slippage, tokenInput]);

  return {
    needsApproval,
    refresh,
  };
};

export default useMultipleTokenApprovalsWithSlippage;
