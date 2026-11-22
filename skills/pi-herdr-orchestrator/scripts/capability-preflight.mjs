const MAGIC_SELECTOR = /[*?[\]]/;

function modelCapability(model) {
  return model.split(":", 1)[0];
}

function concreteSelectors(selectors) {
  const baseline = selectors.lastIndexOf("!*");
  return [...new Set(selectors.slice(baseline + 1).filter((selector) =>
    typeof selector === "string" && selector.length > 0 && !selector.startsWith("!") && !MAGIC_SELECTOR.test(selector)
  ))];
}

function inspectResources(selectors, capabilities) {
  const requested = concreteSelectors(selectors);
  const missing = requested.filter((name) => !capabilities.includes(name));
  return {
    requested,
    status: missing.length === 0 ? "available" : "unavailable",
    missing,
  };
}

export function inspectLiveAgentCapabilities({ configuration, context, roleHookAvailable }) {
  const missing = [];
  const role = context.options.role === undefined
    ? { status: "not-requested" }
    : roleHookAvailable
      ? { status: "delegated-to-pi-ext-roles", name: context.options.role }
      : { status: "unavailable", name: context.options.role };
  if (role.status === "unavailable") missing.push({ kind: "role", name: role.name });

  const configuredModel = typeof configuration.model === "string"
    ? configuration.model
    : `${context.defaults.model.provider}/${context.defaults.model.model}`;
  const model = modelCapability(configuredModel);
  const modelStatus = context.availableModels.has(model) ? "available" : "unavailable";
  if (modelStatus === "unavailable") missing.push({ kind: "model", name: model });

  const skills = inspectResources(configuration.skills, context.capabilities.skills);
  const extensions = inspectResources(configuration.extensions, context.capabilities.extensions);
  for (const name of skills.missing) missing.push({ kind: "skill", name });
  for (const name of extensions.missing) missing.push({ kind: "extension", name });

  return {
    source: "AgentPreparationContext",
    live: {
      role,
      model: { name: model, status: modelStatus },
      skills,
      extensions,
    },
    missing,
  };
}

export function assertLiveAgentCapabilities(input) {
  const report = inspectLiveAgentCapabilities(input);
  if (report.missing.length > 0) {
    const missing = report.missing.map(({ kind, name }) => `${kind}=${name}`).join(", ");
    throw new Error(`Live agent capabilities unavailable before dispatch: ${missing}. Installed package presence is not live capability evidence.`);
  }
  return report;
}
