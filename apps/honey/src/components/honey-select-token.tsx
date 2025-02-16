import React from "react";
import { type Token } from "@bera/berajs";
import { TokenDialog, TokenIcon } from "@bera/shared-ui";
import { cn } from "@bera/ui";
import { Button } from "@bera/ui/button";
import { Icons } from "@bera/ui/icons";

type Props = {
  token: Token | undefined;
  onTokenSelection?: (token: Token | undefined) => void;
  selectedTokens?: (Token | undefined)[];
  customTokenList?: Token[];
  selectable: boolean;
  weight?: number;
  className?: string;
};

export function SelectToken({
  token = undefined,
  onTokenSelection = undefined,
  selectedTokens = undefined,
  customTokenList = undefined,
  selectable,
  weight = undefined,
  className = "",
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("my-4 w-fit max-w-[150px]", className)}>
      <Button
        className="flex h-10 w-full shrink-0 gap-1 border-border bg-background p-2 text-secondary-foreground shadow"
        variant={"outline"}
        onClick={() => selectable && setOpen(true)}
      >
        {token ? (
          <>
            <TokenIcon address={token.address} className="h-5 w-5" />
            <span className="w-fit max-w-[140px] overflow-hidden truncate text-sm">
              {token?.symbol}{" "}
            </span>
            {weight && <span className="text-muted-foreground">{weight}%</span>}
            {selectable && <Icons.chevronDown className="-ml-1 h-4 w-4" />}
          </>
        ) : (
          <p
            className="flex flex-row items-center whitespace-nowrap px-1 text-base font-medium"
            suppressHydrationWarning
          >
            {" "}
            Select <span className="ml-1 hidden md:inline"> a token</span>
            <Icons.chevronDown className="ml-1 h-4 w-4" />{" "}
          </p>
        )}
      </Button>

      {selectable && (
        <TokenDialog
          open={open}
          onSelectedToken={(token: Token | undefined) =>
            onTokenSelection?.(token)
          }
          setOpen={setOpen}
          selectedTokens={selectedTokens ?? []}
          focusedToken={token}
          customTokens={customTokenList}
        />
      )}
    </div>
  );
}
