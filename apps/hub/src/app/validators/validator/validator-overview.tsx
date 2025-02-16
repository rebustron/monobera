import {
  usePollAllValidators,
  usePollValidatorAllBlockStats,
  usePollValidatorBlockStats,
  useTokenHoneyPrices,
  type Token,
  type Validator,
} from "@bera/berajs";
import { FormattedNumber, Tooltip } from "@bera/shared-ui";
import { cn } from "@bera/ui";
import { Card } from "@bera/ui/card";
import { Icons } from "@bera/ui/icons";
import { Skeleton } from "@bera/ui/skeleton";
import { type Address } from "viem";

import { type ActiveIncentiveWithVault } from "~/types/validators";
// import Uptime from "../components/charts/validator-uptime";
import { UserDelegation } from "./user-delegation";
import { getActiveIncentivesArray } from "./validator-pol-data";

export const ValidatorDataCard = ({
  title,
  value,
  tooltipText,
  className,
}: {
  title: string;
  value: React.ReactNode;
  tooltipText?: string | undefined;
  className?: string;
}) => {
  return (
    <Card className={cn(className, "p-5")}>
      <div className="flex w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-foreground">
        {title}
        {tooltipText && <Tooltip text={tooltipText} />}
      </div>
      <div className="mt-2 text-foreground">{value}</div>
    </Card>
  );
};

export const ValidatorOverview = ({ validator }: { validator: Validator }) => {
  const activeIncentivesArray: ActiveIncentiveWithVault[] =
    getActiveIncentivesArray(validator);

  const { data, isLoading } = usePollValidatorBlockStats(validator.id);
  const blocksSigned =
    data?.blockStatsByValidators?.[0]?.allTimeblockCount ?? 0;
  const totalBlocks = data?.blockStats_collection?.[0]?.allTimeblockCount ?? 0;
  const {
    data: allValidatorBlockData,
    isLoading: isLoadingAllValidatorBlockData,
  } = usePollValidatorAllBlockStats();
  const { data: allValidators, isLoading: isLoadingValidators } =
    usePollAllValidators();

  const totalValidators = allValidators?.validators?.length ?? 0;
  let valStakedRanking = -1;
  allValidators?.validators?.find((v, index: number) => {
    if (v.coinbase === validator.coinbase.toLowerCase()) {
      valStakedRanking = index + 1;
      return true;
    }
    return;
  });

  let valSignedRanking = -1;
  allValidatorBlockData?.blockStatsByValidators?.find((v, index: number) => {
    if (v.validator.coinbase === validator.coinbase.toLowerCase()) {
      valSignedRanking = index + 1;
      return true;
    }
    return;
  });

  const activeIncentivesTokens = [
    ...new Set(activeIncentivesArray?.map((incentive) => incentive.token)),
  ];
  const { data: tokenHoneyPrices } = useTokenHoneyPrices({
    tokenAddresses: activeIncentivesTokens.map(
      (t: Token) => t.address,
    ) as Address[],
  });

  const returnPerBgt: number = activeIncentivesArray?.reduce(
    (acc: number, ab: ActiveIncentiveWithVault) => {
      const tokenPrice = parseFloat(
        tokenHoneyPrices?.[ab.token.address] ?? "0",
      );
      return acc + ab.incentiveRate * tokenPrice;
    },
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="mt-2 flex flex-col gap-2">
        {/* TODO: Binary Version?!? */}
        {/* <div className="flex justify-end text-sm text-muted-foreground">
          {"Binary Version: V9.41"}
        </div> */}
        <div className="grid w-full grid-cols-1 gap-x-0 gap-y-4 md:grid-cols-2 md:gap-x-4">
          <ValidatorDataCard
            className="h-[130px]"
            title="Validator Ranking"
            value={
              <div className="flex flex-col items-start gap-1">
                <div className="relative flex w-full flex-row justify-between">
                  {isLoadingValidators ? (
                    <Skeleton className="mt-1 h-8 w-40" />
                  ) : (
                    <span className="text-2xl font-semibold">
                      {valStakedRanking === -1
                        ? "Unranked"
                        : `${valStakedRanking} of ${totalValidators}`}
                    </span>
                  )}
                  <Icons.logo className="absolute right-0 h-16 w-16 self-center text-muted" />
                </div>
                {/* TODO */}
                {/* <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
                  {"+14 from last month"}
                </span> */}
              </div>
            }
          />
          <ValidatorDataCard
            className="h-[130px]"
            title="Block Signing"
            value={
              <div className="flex flex-col items-start gap-1">
                <div className="relative flex w-full flex-row justify-between">
                  {isLoading || isLoadingValidators ? (
                    <Skeleton className="mt-1 h-8 w-44" />
                  ) : (
                    <span className="text-2xl font-semibold">
                      {valSignedRanking === -1
                        ? "Unranked"
                        : `${valSignedRanking} of ${totalValidators}`}
                    </span>
                  )}
                  <Icons.cube className="absolute right-0 h-16 w-16 self-center text-muted" />
                </div>

                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-full" />
                ) : (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
                    {`Signed: ${blocksSigned} / ${totalBlocks}`}
                  </span>
                )}
              </div>
            }
          />
          <ValidatorDataCard
            className="h-[130px]"
            title="Avg. Reward Rate (Per Block Proposal)"
            value={
              <div className="flex flex-col items-start gap-1">
                <div className="relative flex w-full flex-row gap-1">
                  <FormattedNumber
                    value={validator.rewardRate ?? 0}
                    className="text-2xl font-semibold"
                  />
                  <Icons.bgt className="h-6 w-6 self-center" />
                </div>
                {/* TODO: Ask to get delta by month of reward rate on subgraph */}
                {/* <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
                  {"+2.5% from last month"}
                </span> */}
              </div>
            }
          />
          <ValidatorDataCard
            className="h-[130px]"
            title="Est. Return per BGT"
            value={
              <div className="flex flex-row gap-1 text-2xl font-semibold">
                $
                <FormattedNumber
                  value={returnPerBgt}
                  compact
                  showIsSmallerThanMin
                />
                <Icons.honey className="h-6 w-6 self-center" />
              </div>
            }
          />
        </div>
        {/* TODO: Uptime need work on beaconkit to add */}
        {/* <Uptime address={validator.id} /> */}
      </div>
      <UserDelegation validator={validator.id} />
    </div>
  );
};
