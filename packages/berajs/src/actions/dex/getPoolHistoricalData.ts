import { bexApiGraphqlClient } from "@bera/graphql";
import {
  GetPoolHistoricalDataDocument,
  GetPoolHistoricalDataQuery,
  GetPoolHistoricalDataQueryVariables,
  PoolHistoricalDataFragment,
} from "@bera/graphql/dex/api";

import { BeraConfig } from "~/types";

/** @deprecated */
export type PoolDayData = {
  date: number;
  tvlUsd: string;
  volumeUsd: string;
  feesUsd: string;
};

interface getPoolHistoricalDataProps {
  poolId: string;
  config: BeraConfig;
}

export const getPoolHistoricalData = async ({
  poolId,
  config,
}: getPoolHistoricalDataProps): Promise<
  PoolHistoricalDataFragment[] | undefined
> => {
  if (!poolId) return undefined;

  const { data } = await bexApiGraphqlClient.query<
    GetPoolHistoricalDataQuery,
    GetPoolHistoricalDataQueryVariables
  >({
    query: GetPoolHistoricalDataDocument,
    variables: { poolId },
  });
  return data.poolGetSnapshots;
};
