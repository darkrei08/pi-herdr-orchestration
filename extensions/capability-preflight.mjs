import { readFileSync } from "node:fs";
import { assertLiveAgentCapabilities } from "../skills/pi-herdr-orchestrator/scripts/capability-preflight.mjs";

export default async function registerCapabilityPreflight() {
  let registryUrl;
  try {
    registryUrl = import.meta.resolve("pi-extensible-workflows/registry");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") return;
    throw error;
  }
  const registry = await import(registryUrl);
  if (registry.loadingRegistry().frozen) return;
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  registry.registerWorkflowExtension({
    version: manifest.version,
    headline: "Pi Herdr capability preflight",
    source: import.meta.url,
    agentPreparationHooks: {
      capabilityPreflight: {
        priority: Number.MAX_SAFE_INTEGER,
        prepare(configuration, context) {
          assertLiveAgentCapabilities({
            configuration,
            context,
            roleHookAvailable: registry.loadingRegistry().agentPreparationHooks().some((hook) => hook.name === "roles"),
          });
        },
      },
    },
  });
}
