import { IntegrationRegistry } from '../integrations/registry';
import { GmailIntegration } from '../integrations/gmail.integration';

export const registerIntegrations = () => {
  const registry = IntegrationRegistry.getInstance();
  registry.register(new GmailIntegration());
  // Register other integrations here
  console.log("Integrations registered.");
};
