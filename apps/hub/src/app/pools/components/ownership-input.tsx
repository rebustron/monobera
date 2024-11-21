"use client";

import React from "react";
import { SwapFeeInput } from "@bera/shared-ui";
import { cn } from "@bera/ui";
import { Alert, AlertDescription, AlertTitle } from "@bera/ui/alert";
import { Card } from "@bera/ui/card";
import { InputWithLabel } from "@bera/ui/input";
import { PoolType } from "@berachain-foundation/berancer-sdk";

import BeraTooltip from "~/components/bera-tooltip";

export enum OwnershipType {
  Governance = "governance",
  Fixed = "fixed",
  Custom = "custom",
}

interface OwnershipInputProps {
  ownershipType: OwnershipType;
  owner: string;
  onChangeOwnershipType: (type: OwnershipType) => void;
  onOwnerChange: (address: string) => void;
  invalidAddressErrorMessage: string | null;
  onSwapFeeChange: (fee: number) => void;
  swapFee: number;
  poolType: PoolType;
}

const OwnershipInput: React.FC<OwnershipInputProps> = ({
  ownershipType,
  owner,
  onChangeOwnershipType,
  onOwnerChange,
  invalidAddressErrorMessage,
  swapFee,
  onSwapFeeChange,
  poolType,
}) => {
  // NOTE: Balancer support more types of ownership than the ones we are supporting here: Delegated, Fixed and Custom.
  // ... you can still create Pools with those types of ownership from the contract, but we are not supporting them in the UI.

  let predefinedFees = [0.3, 0.5, 1];
  if (
    poolType === PoolType.ComposableStable ||
    poolType === PoolType.MetaStable
  ) {
    predefinedFees = [0.01, 0.05, 0.1];
  }
  return (
    <section className="flex w-full flex-col gap-4">
      <h3 className="self-start text-3xl font-semibold">Set Swap Fee</h3>
      <SwapFeeInput
        initialFee={swapFee}
        onFeeChange={onSwapFeeChange}
        predefinedFees={predefinedFees}
      />

      <div className="flex hidden items-center gap-1">
        <div className="self-start font-semibold">Fee Ownership</div>
        <div className="pt-[-1]">
          <BeraTooltip
            size="lg"
            wrap
            text={`The owner of the pool can make changes such as setting the swap fee. 
                   Use address 0x0000...0000 to fix the fee or allow governance by using 
                   the delegated address.`}
          />
        </div>
      </div>

      <div className="flex hidden w-full flex-row gap-6">
        <Card
          onClick={() => onChangeOwnershipType(OwnershipType.Governance)}
          className={cn(
            "flex w-full cursor-pointer flex-col gap-0 border border-border p-4",
            ownershipType === OwnershipType.Governance &&
              "border-info-foreground ",
          )}
        >
          <span className="text-lg font-semibold">Governance</span>
          <span className="-mt-1 text-sm text-muted-foreground">
            Enables fee modification through governance
          </span>
        </Card>
        <Card
          onClick={() => onChangeOwnershipType(OwnershipType.Fixed)}
          className={cn(
            "flex w-full cursor-pointer flex-col gap-0 border border-border p-4",
            ownershipType === OwnershipType.Fixed && "border-info-foreground ",
          )}
        >
          <span className="text-lg font-semibold">Fixed</span>
          <span className="-mt-1 text-sm text-muted-foreground">
            Fee is fixed and unmodifiable
          </span>
        </Card>
        <Card
          onClick={() => onChangeOwnershipType(OwnershipType.Custom)}
          className={cn(
            "flex w-full cursor-pointer flex-col gap-0 border border-border p-4",
            ownershipType === OwnershipType.Custom && "border-info-foreground ",
          )}
        >
          <span className="text-lg font-semibold">Custom Address</span>
          <span className="-mt-1 text-sm text-muted-foreground">
            Update fees through a custom address
          </span>
        </Card>
      </div>
      {ownershipType === OwnershipType.Custom && (
        <div className="pt-2">
          <InputWithLabel
            label="Owner Address"
            disabled={ownershipType !== OwnershipType.Custom}
            variant="black"
            className="bg-transparent"
            value={owner}
            maxLength={42}
            onChange={(e) => {
              const value = e.target.value;
              onOwnerChange(value);
            }}
          />
          {invalidAddressErrorMessage && (
            <Alert variant="destructive" className="my-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{invalidAddressErrorMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </section>
  );
};

export default OwnershipInput;
