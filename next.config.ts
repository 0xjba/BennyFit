import type { NextConfig } from "next";

// Pages read the latest evaluation results and the answer key from disk at request
// time, so a deployment has to ship those files alongside the server code.
const RUNTIME_DATA = [
  "./eval/results.json",
  "./eval/baseline-results.json",
  "./eval/reading-holdout.json",
  "./eval/runs/2026-09-21-jev-holdout-compared.json",
  "./data/gold/households.jsonl",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": RUNTIME_DATA,
    "/*": RUNTIME_DATA,
  },
};

export default nextConfig;
