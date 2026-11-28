import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function thinkingLevel(model) {
  const lastColon = model.lastIndexOf(":");
  return lastColon === -1 || model.slice(lastColon + 1).includes("/") ? null : model.slice(lastColon + 1);
}

export function resolveTicketSupervision(configPath, rolesSettingsPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const settings = JSON.parse(readFileSync(rolesSettingsPath, "utf8"));
  const aliases = settings.modelAliases ?? {};
  const producerModel = aliases[config.producer.alias];
  const supervisorModel = aliases[config.supervisor.alias];

  if (!producerModel || !supervisorModel) {
    throw new Error("TICKET_SUPERVISION_ALIAS_MISSING");
  }

  const producerEffort = thinkingLevel(producerModel);
  const supervisorEffort = thinkingLevel(supervisorModel);

  if (producerModel === supervisorModel && producerEffort === supervisorEffort) {
    throw new Error("TICKET_SUPERVISION_NOT_DISTINCT");
  }

  return {
    schema: config.schema,
    producer: { role: config.producer.role, alias: config.producer.alias, model: producerModel, effort: producerEffort },
    supervisor: { role: config.supervisor.role, alias: config.supervisor.alias, model: supervisorModel, effort: supervisorEffort },
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) {
  const configPath = process.argv[2] ?? "config/ticket-supervision.json";
  const settingsPath = process.argv[3] ?? process.env.PI_EXT_ROLES_SETTINGS ?? "/root/.pi/agent/pi-ext-roles/settings.json";
  console.log(JSON.stringify(resolveTicketSupervision(configPath, settingsPath), null, 2));
}
