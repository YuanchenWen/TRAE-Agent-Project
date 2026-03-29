import { IntegrationRegistry } from '../integrations/registry'
import { GmailIntegration } from '../integrations/gmail.integration'

let integrationsRegistered = false

export const registerIntegrations = (): void => {
  if (integrationsRegistered) {
    return
  }

  const registry = IntegrationRegistry.getInstance()
  registry.register(new GmailIntegration())
  integrationsRegistered = true
}
