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
    const rawValue = value.replace("%", ""); // NOTE: we need to remove '%' for parsing the actual value
    const parsedValue = parseFloat(rawValue);

    if (!Number(parsedValue)) {
      setFee(parsedValue);
      if (parsedValue >= 0.00001 && parsedValue <= 10) {
        setIsInvalid(false);
        onFeeChange(parsedValue);
      } else {
        setIsInvalid(true);
      }
    }
  };

  const handlePredefinedFeeClick = (value: number) => {
    setFee(value);
    setIsInvalid(false);
    onFeeChange(value);
  };

  return (
    <section
      className={cn(
        "flex w-full flex-col gap-6 rounded-md border border-border",
        isInvalid
          ? "border-destructive-foreground text-destructive-foreground"
          : "border-border",
      )}
    >
      <div className="relative flex h-14 flex-row items-center gap-6 text-sm">
        <Input
          type="text"
          variant="black"
          value={`${fee}%`}
          onChange={(e) => handleFeeChange(e.target.value)}
          placeholder="Enter swap fee"
          className="w-full border-none bg-transparent pr-10 font-semibold"
          aria-label="Swap Fee Input"
        />
        <div className="flex gap-1 pr-4">
          {predefinedFees.map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => handlePredefinedFeeClick(preset)}
              className={cn(
                "h-8 w-12 rounded-xs border text-xs font-medium text-muted-foreground",
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
