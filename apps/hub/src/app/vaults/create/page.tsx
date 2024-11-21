import React from "react";
import { Icons } from "@bera/ui/icons";

import { CreateGaugeCard } from "./components/create-gauge-card";

export default function Page() {
  return (
    <div className="flex flex-col">
      <CreateGaugeCard />
    </div>
  );
}
