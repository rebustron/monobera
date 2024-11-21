import Link from "next/link";
import { ValidatorIcon } from "@bera/shared-ui";
import { Icons } from "@bera/ui/icons";

export const GaugeCreation = () => {
  return (
    <Link className="mb-10 rounded-sm border px-4 py-6" href="/vaults/create">
      <div className="flex items-center gap-3 text-2xl font-semibold leading-loose">
        Add your protocol's Reward Vault <Icons.arrowRight />
      </div>
      <div className="text-sm font-medium leading-5 text-muted-foreground">
        LPs will be able to deposit your protocol receipt and earn BGT rewards
      </div>
    </Link>
  );
};
