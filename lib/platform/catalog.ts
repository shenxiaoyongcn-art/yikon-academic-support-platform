import { moduleDefinitions } from './modules';

export type { HomeModuleCard, ModuleSlug, PlatformModule } from './modules';

export const platformModules = moduleDefinitions.map((definition) => definition.platform);
export const homeModules = moduleDefinitions.map((definition) => definition.home);

export function getPlatformModule(slug: string) {
  return platformModules.find((item) => item.slug === slug);
}
