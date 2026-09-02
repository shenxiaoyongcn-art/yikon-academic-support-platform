import { moduleDefinitions } from './modules';
import type { MaintenanceConfig, MaintenanceModuleSlug } from './modules';

export type {
  MaintenanceConfig,
  MaintenanceField,
  MaintenanceFieldType,
  MaintenanceModuleSlug,
  WorkItemModule,
} from './modules';

export const maintenanceModules = moduleDefinitions
  .map((definition) => definition.maintenance)
  .filter((config): config is MaintenanceConfig => Boolean(config));

const configs = Object.fromEntries(
  maintenanceModules.map((config) => [config.slug, config]),
) as Record<MaintenanceModuleSlug, MaintenanceConfig>;

export function getMaintenanceConfig(slug: string) {
  return configs[slug as MaintenanceModuleSlug];
}

export function getMaintenanceConfigByDbModule(module: string) {
  return maintenanceModules.find((item) => item.dbModule === module);
}
