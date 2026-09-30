import { coreFiles } from './plugin/coreFiles';
import { frontendFiles } from './plugin/frontendFiles';
import { gatewayFiles } from './plugin/gatewayFiles';
import { serviceFiles } from './plugin/serviceFiles';
import { modelFiles } from './plugin/modelFiles';
import { apiFiles } from './plugin/apiFiles';
import { adminFiles } from './plugin/adminFiles';
import { configFiles } from './plugin/configFiles';

export interface PluginFile {
  path: string;
  name: string;
  category: 'core' | 'service' | 'model' | 'api' | 'gateway' | 'admin' | 'config';
  description: string;
  content: string;
}

export const PLUGIN_FILES: PluginFile[] = [
  ...coreFiles,
  ...frontendFiles,
  ...gatewayFiles,
  ...serviceFiles,
  ...modelFiles,
  ...apiFiles,
  ...adminFiles,
  ...configFiles,
];
