import { useMemo, useState } from "react";
import { usePollGaugesData } from "@bera/berajs";
import { Combobox } from "@bera/shared-ui";
import { BeraChart } from "@bera/ui/bera-chart";
import { Button } from "@bera/ui/button";
import { Icons } from "@bera/ui/icons";
import { Input } from "@bera/ui/input";

function generateColor(index: number, palette: number[]) {
  return `hsl(${
    palette[index] ? palette[index] : Math.random() * 360
  }, 70%, 40%)`;
}

function formatDistributionValue(value: string): string {
  const [integerPart, decimalPart] = value.split(".");
  return decimalPart ? `${integerPart}.${decimalPart.slice(0, 2)}` : value;
}

export const CuttingBoardConfiguration = () => {
  const [gauges, setGauges] = useState<
    { address: string; distribution: number; color: number }[]
  >([{ address: "", distribution: 0, color: Math.random() * 360 }]);
  const { data, isLoading } = usePollGaugesData();

  const colourPalette = [0, 240, 120, 300, 60, 180, 270];

  const gaugesData = useMemo(() => {
    return data?.vaults?.map((gauge: any) => ({
      vaultAddress: gauge.vaultAddress,
      stakingTokenAddress: gauge.stakingToken.stakingTokenAddress,
      symbol: gauge.stakingToken.symbol,
      name: gauge.stakingToken.name,
    }));
  }, [data]);

  const handleAddGauge = () => {
    setGauges([
      ...gauges,
      { address: "", distribution: 0, color: Math.random() * 360 },
    ]);
  };

  const handleDeleteGauge = (index: number) => {
    setGauges(gauges.filter((_, i) => i !== index));
  };

  const handleGaugeChange = (
    index: number,
    field: "address" | "distribution",
    value: string | number,
  ) => {
    const updatedGauges = gauges.map((gauge, i) => {
      if (i === index) {
        return { ...gauge, [field]: value };
      }
      return gauge;
    });
    setGauges(updatedGauges);
  };

  const totalDistribution = gauges.reduce(
    (sum, gauge) => sum + gauge.distribution,
    0,
  );

  const pieChartData = useMemo(() => {
    return {
      labels: gauges.map((gauge) => gauge.address || "Unassigned"),
      datasets: [
        {
          data: gauges.map((gauge) => gauge.distribution),
          hoverBorderWidth: 5,
          borderRadius: 8,
          spacing: 5,
          borderWidth: 0,
          backgroundColor: gauges.map((gauge, index) => generateColor(index, colourPalette)),
          hoverBorderColor: gauges.map((gauge, index) => generateColor(index, colourPalette)),
          // borderColor: "colours",
        },
      ],
    };
  }, [gauges]);

  const pieChartOptions = {
    responsive: true,
    cutout: "70%",
    radius: "95%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            return `${label}: ${value}%`;
          },
        },
      },
    },
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-0">
      <div className="flex flex-grow flex-col gap-4">
        {gauges.map((gauge, index) => (
          <div key={index} className="flex w-full gap-4">
            <Combobox
              items={
                gaugesData?.map((gaugeData: any) => ({
                  value: gaugeData.vaultAddress,
                  label: `${gaugeData.symbol} - ${gaugeData.name}`,
                })) || []
              }
              onSelect={(selectedValue) =>
                handleGaugeChange(index, "address", selectedValue)
              }
            />
            <Input
              type="number"
              value={gauge.distribution}
              onChange={(e) => {
                const formattedValue = formatDistributionValue(e.target.value);
                handleGaugeChange(index, "distribution", parseFloat(formattedValue));
              }}
              placeholder="Distribution"
              outerClassName="w-fit"
              className="w-48 text-right"
              onKeyDown={(e) =>
                (e.key === "-" || e.key === "e" || e.key === "E") &&
                e.preventDefault()
              }
              maxLength={3}
              min={0}
              max={100}
              // endAdornment={
              //   <span className="absolute right-3 top-1/2 -translate-y-1/2 transform">
              //     %
              //   </span>
              // }
            />
            <Button
              className="flex border border-border p-2 font-semibold text-foreground"
              size={"sm"}
              variant={"outline"}
              onClick={() => handleDeleteGauge(index)}
            >
              <Icons.close className="h-6 w-6" />
            </Button>
          </div>
        ))}
        <div className="flex justify-between">
          <Button
            className="flex w-[124px] border border-border p-2 font-semibold text-foreground"
            size={"sm"}
            variant={"outline"}
            onClick={handleAddGauge}
          >
            {<Icons.plusCircle className="mr-2 h-4 w-4" />}
            Add Gauge
          </Button>
          <Button
            className="flex w-12 border border-border p-2 font-semibold text-foreground"
            size={"sm"}
            variant={"outline"}
            onClick={handleAddGauge}
          >
            {<Icons.squareEqual className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="ml-8 flex w-[300px] flex-shrink-0 flex-col gap-4">
        <div className="relative mx-auto h-[200px] w-[200px]">
          <BeraChart
            data={pieChartData}
            options={pieChartOptions}
            type="doughnut"
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center">
            <div className="text-xs font-medium uppercase leading-5 tracking-wide text-muted-foreground">
              Total
            </div>
            <div className="text-lg font-bold leading-6">
              {totalDistribution}%
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          Total Distribution: {totalDistribution}%
          {totalDistribution !== 100 && (
            <span className="ml-2 text-red-500">Total must equal 100%</span>
          )}
        </div>
      </div>
    </div>
  );
};
