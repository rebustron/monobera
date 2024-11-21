import { MetadataRoute } from "next";
import { isIPFS } from "@bera/config";

export default function robots(): MetadataRoute.Robots {
  if (isIPFS || process.env.DONT_INDEX === "1") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
