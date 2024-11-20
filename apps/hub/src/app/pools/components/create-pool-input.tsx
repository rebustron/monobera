import React from "react";
import { type Token } from "@bera/berajs";
import {
  beraTokenAddress,
  bgtTokenAddress,
  nativeTokenAddress,
} from "@bera/config";
import { SelectToken } from "@bera/shared-ui";
import { Icons } from "@bera/ui/icons";
import { InputWithLabel } from "@bera/ui/input";
import { formatUnits, parseUnits } from "viem";

import { TokenInput } from "~/hooks/useMultipleTokenInput";

type Props = {
  token: TokenInput | undefined;
  selectedTokens: TokenInput[];
  weight?: bigint;
  displayWeight?: boolean;
  displayRemove?: boolean;
  locked: boolean;
  index: number;
  selectable?: boolean;
  onTokenSelection: (token: Token | undefined) => void;
  onWeightChange: (index: number, newWeight: bigint) => void;
  onLockToggle: (index: number) => void;
  onRemoveToken: (index: number) => void;
};

export default function CreatePoolInput({
  token,
  selectedTokens,
  weight,
  displayWeight,
  displayRemove,
  locked,
  index,
  selectable = true,
  onTokenSelection,
  onWeightChange,
  onLockToggle,
  onRemoveToken,
}: Props) {
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const weightInBigInt = parseUnits(e.target.value, 16);
      onWeightChange(index, weightInBigInt);
    } catch (e) {
      // FIXME this fails to let a user type in a decimal value like 0.5 as it doesnt like `###.`
      // NOTE: this is likely a parsing error, ex: user has entered a non-numeric character
    }
  };

  // Do not allow the user to select BERA and WBERA as a token pair. (NOTE: BERA is wrapped during create)
  const filteredTokens = [bgtTokenAddress];
  if (
    selectedTokens.find(
      (selectedToken) => selectedToken.address === nativeTokenAddress,
    )
  ) {
    filteredTokens.push(beraTokenAddress);
  } else if (
    selectedTokens.find(
      (selectedToken) => selectedToken.address === beraTokenAddress,
    )
  ) {
    filteredTokens.push(nativeTokenAddress);
  }

  return (
    <div className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-2">
      <SelectToken
        token={token}
        filter={filteredTokens}
        selectable={selectable}
        onTokenSelection={(selectedToken: Token | undefined) =>
          onTokenSelection(selectedToken)
        }
        selectedTokens={selectedTokens}
        btnClassName="border-none"
      />

      {/* Weight Input */}
      <div className="ml-auto flex items-center">
        {displayWeight && (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-sm text-gray-400">%</span>
            <InputWithLabel
              variant="black"
              type="text"
              // NOTE: weight is 18 decimalized and we input it as a %, so we use 16 decimalized for the input
              // NOTE: if a weight is negative internally we will clamp it to 0 in the display (but an error is shown)
              value={weight ? formatUnits(weight < 0n ? 0n : weight, 16) : "0"}
              onChange={handleWeightChange}
              className="w-52 rounded-md border bg-transparent text-center text-white"
            />

            <button
              type="button"
              onClick={() => onLockToggle(index)}
              className="ml-2 mr-6"
            >
              {locked ? (
                <Icons.lock className="h-4 w-4" />
              ) : (
                <Icons.unlock className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {/* Remove Button */}
        {displayRemove && (
          <button
            type="button"
            onClick={() => onRemoveToken(index)}
            className="mx-2 hover:text-white focus:outline-none"
          >
            <Icons.xCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
