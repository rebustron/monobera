"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SWRFallback,
  truncateHash,
  useBeraJs,
  usePollBalance,
  ADDRESS_ZERO,
  useRewardVaultBalanceFromStakingToken,
  useSelectedGauge,
  usePoolHistoricalData,
} from "@bera/berajs";
import { beraTokenAddress, blockExplorerUrl } from "@bera/config";
import {
  FormattedNumber,
  PoolHeader,
  TokenIcon,
  TokenIconList,
  getRewardsVaultUrl,
} from "@bera/shared-ui";
import { Button } from "@bera/ui/button";
import { Card, CardContent } from "@bera/ui/card";
import { Separator } from "@bera/ui/separator";
import { Skeleton } from "@bera/ui/skeleton";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bera/ui/tabs";
import { Address, formatUnits } from "viem";

import { EventTable } from "./PoolEventTable";
import { getPoolAddLiquidityUrl, getPoolWithdrawUrl } from "../../fetchPools";
import { usePool } from "~/b-sdk/usePool";
import { GqlPoolEventType, GqlPoolType } from "@bera/graphql/dex/api";
import { usePoolUserPosition } from "~/b-sdk/usePoolUserPosition";
import { unstable_serialize } from "swr";
import { Icons } from "@bera/ui/icons";
import { PoolCreateRewardVault } from "./PoolCreateRewardVault";
import { useOnChainPoolData } from "~/b-sdk/useOnChainPoolData";
import { PoolChart } from "./PoolChart";

enum Selection {
  AllTransactions = "allTransactions",
  Swaps = "swaps",
  AddsWithdrawals = "addsWithdrawals",
}

const poolTypeLabels = {
  ComposableStable: "Stable",
  MetaStable: "Meta Stable",
  Weighted: "Weighted",
};

const TokenView = ({
  tokens,
  isLoading,
  showWeights,
}: {
  showWeights?: boolean;
  tokens: {
    address: string;
    symbol: string;
    value: string | number;
    valueUSD?: string | number | null;
    weight?: string | number;
  }[];
  isLoading: boolean;
}) => {
  return (
    <>
      <div>
        {isLoading ? (
          <div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
          </div>
        ) : (
          tokens.map((token, index) => {
            return (
              <div
                className="flex h-8 items-center justify-between"
                key={`token-list-${index}-${token.address}-${token.value}`}
              >
                <div className=" flex gap-1">
                  <TokenIcon address={token.address} symbol={token.symbol} />
                  <a
                    href={
                      token.address
                        ? `${blockExplorerUrl}/address/${token.address}`
                        : "#"
                    }
                    target="_blank"
                    className="ml-1 font-medium uppercase hover:underline"
                    rel="noreferrer"
                  >
                    {token.address === beraTokenAddress
                      ? "wbera"
                      : token.symbol}
                  </a>{" "}
                  {showWeights && token.weight && (
                    <span className="text-muted-foreground ml-2">
                      {(Number(token.weight) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="font-medium">
                    <FormattedNumber value={token.value} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {token.valueUSD === null ? (
                      "–"
                    ) : (
                      <FormattedNumber
                        value={token.valueUSD ?? 0}
                        symbol="USD"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export const PoolPageWrapper = ({
  children,
  pool,
}: {
  children: React.ReactNode;
  pool: any | undefined;
}) => {
  return (
    <SWRFallback
      fallback={
        pool
          ? { [unstable_serialize(`usePool-subgraph-${pool?.id}`)]: pool }
          : {}
      }
    >
      {children}
    </SWRFallback>
  );
};
export default function PoolPageContent({
  poolId,
}: {
  poolId: string;
}) {
  const { data, isLoading: isPoolLoading } = usePool({
    id: poolId,
  });

  const { data: onChainPool } = useOnChainPoolData(poolId);

  const [subgraphPool, v3Pool] = data ?? [];

  const pool = useMemo(() => {
    if (!subgraphPool) return onChainPool;

    const merge = { ...subgraphPool };

    if (onChainPool) {
      merge.swapFee = onChainPool.swapFee;
      merge.totalShares = onChainPool.totalShares;
      merge.createTime = onChainPool.createTime ?? merge.createTime;
    }

    return merge;
  }, [onChainPool, subgraphPool]);

  const { isConnected } = useBeraJs();

  const { data: userLpBalance, isLoading: isUserLpBalanceLoading } =
    usePollBalance({
      address: pool?.address,
    });

  const isLoading = isPoolLoading;

  const tvlInUsd = pool
    ? pool?.totalLiquidity
      ? Number(pool?.totalLiquidity ?? 0)
      : null
    : undefined;

  const { data: userPositionBreakdown } = usePoolUserPosition({ pool: pool });
  const { data: rewardVault } = useRewardVaultBalanceFromStakingToken({
    stakingToken: pool?.address as Address,
  });

  const { data: gauge } = useSelectedGauge(rewardVault?.address as Address);
  const userSharePercentage = userPositionBreakdown?.userSharePercentage ?? 0;

  const didUserDeposit =
    userSharePercentage || (rewardVault?.balance && rewardVault?.balance > 0n);

  useEffect(() => {
    console.log("POOL", pool, v3Pool);
  }, [v3Pool, pool]);

  const poolType =
    (pool?.type ?? "") in poolTypeLabels
      ? poolTypeLabels[pool?.type as keyof typeof poolTypeLabels]
      : undefined;

  return (
    <div className="flex flex-col gap-8">
      <PoolHeader
        backHref="/pools/"
        title={
          pool ? (
            <>
              <TokenIconList
                tokenList={
                  pool?.tokens
                    ?.filter((t) => t.address !== pool.address)
                    .map((t) => ({
                      address: t.address as Address,
                      symbol: t.symbol!,
                      decimals: t.decimals!,
                      name: t.symbol!,
                    })) ?? []
                }
                size="xl"
              />
              {pool?.name}
            </>
          ) : (
            <Skeleton className="h-10 w-40" />
          )
        }
        subtitles={[
          {
            title: "Type",
            content: poolType,
          },
          {
            title: "Fee",
            content: pool ? (
              <FormattedNumber
                suffixText="%"
                value={Number(pool?.swapFee ?? 0) * 100}
              />
            ) : (
              <Skeleton className="h-4 w-8" />
            ),
            color: "success",
          },
          {
            title: "Pool Contract",
            content: pool ? (
              truncateHash(pool?.address ?? "")
            ) : (
              <Skeleton className="h-4 w-16" />
            ),
            externalLink: `${blockExplorerUrl}/address/${pool?.address}`,
          },
        ]}
      />
      <Separator />
      {/* {isPoolLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <BgtStationBanner
          isHub
          receiptTokenAddress={pool?.address as Address}
          vaultAddress={pool?.id as Address}
        />
      )} */}
      <div className="w-full grid-cols-1 lg:grid-cols-12 gap-4 grid auto-rows-min ">
        <div className="grid grid-cols-1 lg:col-span-7 auto-rows-auto gap-4">
          <PoolChart
            pool={pool}
            currentTvl={tvlInUsd}
            timeCreated={pool?.createTime}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="px-4 py-2">
              <div className="flex flex-row items-center justify-between">
                <div className="overflow-hidden truncate whitespace-nowrap text-sm ">
                  TVL
                </div>
              </div>
              <div className="overflow-hidden truncate whitespace-nowrap text-lg font-semibold">
                {tvlInUsd !== null ? (
                  <FormattedNumber value={tvlInUsd ?? 0} symbol="USD" />
                ) : (
                  "–"
                )}
              </div>
            </Card>
            <Card className="px-4 py-2">
              <div className="flex flex-row items-center justify-between">
                <div className="overflow-hidden truncate whitespace-nowrap text-sm ">
                  Volume (24h)
                </div>
              </div>
              <div className="overflow-hidden truncate whitespace-nowrap text-lg font-semibold">
                <FormattedNumber value={v3Pool?.volume24h ?? 0} symbol="USD" />
              </div>
            </Card>
            <Card className="px-4 py-2">
              <div className="flex flex-row items-center justify-between">
                <div className="overflow-hidden truncate whitespace-nowrap text-sm ">
                  Fees (24h)
                </div>
              </div>
              <div className="overflow-hidden truncate whitespace-nowrap text-lg font-semibold">
                <FormattedNumber value={v3Pool?.fees24h ?? 0} symbol="USD" />
              </div>
            </Card>
            <Card className="px-4 py-2">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-1 overflow-hidden truncate whitespace-nowrap text-sm ">
                  APR
                </div>
              </div>
              <div className="overflow-hidden truncate whitespace-nowrap text-lg font-semibold text-warning-foreground">
                <FormattedNumber
                  value={v3Pool?.aprItems.at(0)?.apr ?? 0}
                  colored
                  percent
                />
              </div>
            </Card>
          </div>
          <Card className="p-4">
            <div className="mb-4 flex h-8 w-full items-center justify-between text-lg font-semibold">
              Pool Liquidity
              <div className="text-2xl">
                {pool === undefined ? (
                  <Skeleton className="h-10 w-20" />
                ) : tvlInUsd === null ? (
                  "–"
                ) : (
                  <FormattedNumber value={tvlInUsd ?? 0} symbol="USD" />
                )}
              </div>
            </div>
            <TokenView
              showWeights
              isLoading={pool === undefined}
              tokens={
                pool?.tokens
                  ?.filter((t) => t.address !== pool.address)
                  .map((t) => ({
                    address: t.address!,
                    symbol: t.symbol!,
                    weight: t.weight,
                    value: parseFloat(t.balance),
                    valueUSD: t.token?.latestUSDPrice
                      ? parseFloat(t.balance) *
                        parseFloat(t.token?.latestUSDPrice ?? "0")
                      : null,
                  })) ?? []
              }
            />
          </Card>
        </div>
        {isConnected && (
          <div className="lg:col-span-5 grid grid-cols-1 gap-4 lg:row-start-1 lg:col-start-8 auto-rows-min lg:row-span-2">
            <Card>
              <CardContent className="flex h-full items-center flex-col justify-between gap-4 p-4">
                <div className="flex h-8 w-full items-center justify-between text-lg font-semibold">
                  <h3 className="text-md font-semibold capitalize">
                    My deposits
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      as={Link}
                      href={getPoolAddLiquidityUrl(pool)}
                    >
                      Deposit
                    </Button>
                    {userSharePercentage ? (
                      <Button
                        variant="outline"
                        size="md"
                        as={Link}
                        href={getPoolWithdrawUrl(pool)}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </div>
                </div>
                {didUserDeposit ? (
                  <>
                    <div className="mt-4 grow self-stretch">
                      <TokenView
                        isLoading={isUserLpBalanceLoading || isPoolLoading}
                        tokens={
                          pool?.tokens
                            ?.filter((t) => t.address !== pool.address)
                            ?.map((t) => ({
                              address: t.address!,
                              symbol: t.symbol!,
                              value:
                                parseFloat(t.balance) * userSharePercentage,
                              valueUSD:
                                parseFloat(t.balance) *
                                parseFloat(t.token?.latestUSDPrice ?? "0") *
                                userSharePercentage,
                            })) ?? []
                        }
                      />
                    </div>
                    <div className="flex justify-between w-full font-medium">
                      <span>Total</span>
                      {isUserLpBalanceLoading || tvlInUsd === undefined ? (
                        <Skeleton className="h-[32px] w-[150px]" />
                      ) : tvlInUsd === null ? (
                        "–"
                      ) : (
                        <FormattedNumber
                          value={tvlInUsd * userSharePercentage}
                          symbol="USD"
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-48 text-muted-foreground text-sm text-center flex flex-col justify-center items-center">
                    <h4 className="mb-2">Earn APY</h4>
                    <p className="max-w-48">
                      You have no current deposits in this pool
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            {didUserDeposit ? (
              rewardVault && rewardVault.address !== ADDRESS_ZERO ? (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex w-full items-center justify-between text-lg font-semibold">
                        <h3 className="text-md font-semibold capitalize">
                          Receipt Tokens
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="block disabled:pointer-events-none disabled:opacity-50"
                            size="md"
                            disabled={userLpBalance?.balance === 0n}
                            as={Link}
                            href={getRewardsVaultUrl(
                              rewardVault?.address ?? "0x",
                            )}
                          >
                            Stake
                          </Button>
                          <Button
                            variant="outline"
                            className="block"
                            size="md"
                            disabled={rewardVault?.balance === 0n}
                            as={Link}
                            href={getRewardsVaultUrl(
                              rewardVault?.address ?? "0x",
                            )}
                          >
                            Unstake
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grow self-stretch font-medium">
                        <div className="flex justify-between w-full">
                          <h4 className="font-semibold">Available</h4>
                          <FormattedNumber
                            className="text-muted-foreground"
                            value={userLpBalance?.formattedBalance ?? 0}
                          />
                        </div>
                        <div className="flex justify-between w-full">
                          <h4 className="font-semibold">Staked</h4>
                          <FormattedNumber
                            className="text-muted-foreground"
                            value={formatUnits(
                              BigInt(rewardVault?.balance ?? "0"),
                              userLpBalance?.decimals ?? 18,
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex justify-between w-full">
                        <div>
                          <h3 className="text-md font-semibold capitalize">
                            Reward Vault
                          </h3>
                          <div className="flex w-fit items-center gap-1 text-sm">
                            <Link
                              href={getRewardsVaultUrl(
                                rewardVault?.address ?? "",
                              )}
                              className="hover:underline align-middle"
                            >
                              <span>
                                {truncateHash(rewardVault?.address ?? "")}
                              </span>{" "}
                              <Icons.externalLink className="inline-block h-3 w-3 text-muted-foreground" />
                            </Link>
                          </div>
                        </div>

                        {rewardVault?.isWhitelisted ? (
                          <div>
                            <h4 className="font-semibold">BGT capture</h4>
                            <p className="text-success-foreground font-semibold">
                              {gauge ? (
                                <FormattedNumber
                                  compact={false}
                                  compactThreshold={999_999_999}
                                  percent
                                  value={
                                    gauge?.bgtInflationCapture / 10000 ?? 0
                                  }
                                />
                              ) : (
                                "–"
                              )}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center text-muted-foreground">
                            Not whitelisted
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <PoolCreateRewardVault />
              )
            ) : null}
          </div>
        )}
      </div>
      <Separator />
      <section>
        <Tabs
          defaultValue={Selection.AllTransactions}
          // onValueChange={(value: string) => setSelectedTab(value as Selection)}
        >
          <TabsList className="w-full" variant="compact">
            <TabsTrigger
              value={Selection.AllTransactions}
              className="w-full text-xs sm:text-sm"
              variant="compact"
            >
              All transactions
            </TabsTrigger>
            <TabsTrigger
              value={Selection.Swaps}
              variant="compact"
              className="w-full text-xs sm:text-sm"
            >
              Swaps
            </TabsTrigger>
            <TabsTrigger
              value={Selection.AddsWithdrawals}
              variant="compact"
              className="w-full text-xs sm:text-sm"
            >
              Adds &amp; Withdraws
            </TabsTrigger>
          </TabsList>
          <Card className="mt-4">
            <TabsContent
              value={Selection.AllTransactions}
              className="mt-0 overflow-x-auto"
            >
              <EventTable pool={pool} isLoading={isLoading} />
            </TabsContent>
            <TabsContent
              value={Selection.Swaps}
              className="mt-0 overflow-x-auto"
            >
              <EventTable
                pool={pool}
                types={[GqlPoolEventType.Swap]}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent
              value={Selection.AddsWithdrawals}
              className="mt-0 overflow-x-auto"
            >
              <EventTable
                pool={pool}
                types={[GqlPoolEventType.Add, GqlPoolEventType.Remove]}
                isLoading={isLoading}
              />
            </TabsContent>
          </Card>
          {/* <div className="mt-4 flex justify-center">{getLoadMoreButton()}</div> */}
        </Tabs>
      </section>
    </div>
  );
}
