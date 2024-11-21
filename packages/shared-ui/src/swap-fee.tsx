"use client";

import React, { useState } from "react";
import { cn } from "@bera/ui";
import { Input } from "@bera/ui/input";

interface SwapFeeInputProps {
  onFeeChange: (fee: number) => void;
  initialFee?: number;
  predefinedFees?: number[];
}

export function SwapFeeInput({
  initialFee = 0,
  onFeeChange,
  predefinedFees = [0.1, 0.2, 0.3],
}: SwapFeeInputProps) {
  const [fee, setFee] = useState<number>(initialFee);
  const [isInvalid, setIsInvalid] = useState<boolean>(false);

  const handleFeeChange = (value: string) => {
    const parsedValue = parseFloat(value);
    setFee(parsedValue);

    // Validate the fee range and update the invalid state
    if (parsedValue >= 0.00001 && parsedValue <= 10) {
      setIsInvalid(false);
      onFeeChange(parsedValue);
    } else {
      setIsInvalid(true);
    }
  };

  const handlePredefinedFeeClick = (value: number) => {
    setFee(value);
    setIsInvalid(false);
    onFeeChange(value);
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="relative flex flex-row gap-6 text-sm">
        <Input
          type="number"
          variant="black"
          value={fee}
          onChange={(e) => handleFeeChange(e.target.value)}
          placeholder="Enter swap fee"
          className={cn(
            "w-full rounded-md border bg-transparent p-2 pr-10",
            isInvalid
              ? "border-destructive-foreground text-destructive-foreground"
              : "border-border",
          )}
          aria-label="Swap Fee Input"
        />
        <span
          className={cn(
            "absolute left-1/2 top-1/2 -translate-y-1/2 transform text-gray-500",
            isInvalid && "text-destructive-foreground",
          )}
        >
          %
        </span>
        <div className="flex gap-2">
          {predefinedFees.map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => handlePredefinedFeeClick(preset)}
              className={cn(
                "w-20 rounded-md border px-4 py-2",
                fee === preset ? "border-info-foreground" : "border-border",
              )}
              aria-label="Swap Fee Input"
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      {isInvalid && (
        <div className="mt-2 rounded-md border border-destructive-foreground p-2 text-sm text-destructive-foreground">
          <i className="mr-2">⚠️</i>
          Invalid fee. Ensure the entered fee is between 0.00001% and 10%.
        </div>
      )}
    </section>
  );
}
