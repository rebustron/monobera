import { Button } from "@bera/ui/button";
import { Card, CardContent } from "@bera/ui/card";
import { Separator } from "@bera/ui/separator";
import { Skeleton } from "@bera/ui/skeleton";
import Link from "next/link";

export const PoolCreateRewardVault = () => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between gap-2 items-center w-full">
          <div>
            <h3 className="text-md font-semibold capitalize">
              No Reward Vault
            </h3>
            <p className="text-muted-foreground font-medium text-sm">
              There is no reward vault connected to this pool
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              size="md"
              as={Link}
              href="/vaults/create/"
            >
              Create
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
