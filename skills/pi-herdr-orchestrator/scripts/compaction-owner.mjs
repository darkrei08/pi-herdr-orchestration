export function resolveCompactionOwner({ configuredVcc, configuredCodexContext }) {
  if (configuredVcc && configuredCodexContext) {
    return { owner: "conflict", status: "incompatible" };
  }
  if (configuredVcc) {
    return { owner: "pi-vcc", status: "installed" };
  }
  if (configuredCodexContext) {
    return { owner: "pi-codex-context", status: "installed" };
  }
  return { owner: "pi-core", status: "installed" };
}
