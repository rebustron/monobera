import React from "react";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { getGauge } from "@bera/berajs/actions";
import { isIPFS } from "@bera/config";
import { Address, isAddress } from "viem";

import { GaugeDetails } from "./components/gauge-details";

export function generateMetadata(): Metadata {
  return {
    title: "Reward Vault",
  };
}

export const revalidate = 10;

export default async function PoolPage({
  params,
}: {
  params: { gaugeAddress: Address };
}) {
  if (isIPFS) {
    return null;
  }

  if (!isAddress(params.gaugeAddress)) {
    console.error("Invalid gauge address", params.gaugeAddress);
    notFound();
  }
  const gauge = await getGauge(params.gaugeAddress);

  if (!gauge) {
    console.error("gauge not found", gauge);
    notFound();
  }

  return <GaugeDetails gaugeAddress={params.gaugeAddress} />;
}

export function generateStaticParams() {
  return [
    {
      gaugeAddress: "0x",
    },
  ];
}
