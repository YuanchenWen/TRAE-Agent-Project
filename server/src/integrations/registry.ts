import { BaseIntegration } from './base.integration';

export class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private integrations: Map<string, BaseIntegration>;

  private constructor() {
    this.integrations = new Map<string, BaseIntegration>();
  }

  static getInstance(): IntegrationRegistry {
    if (!IntegrationRegistry.instance) {
      IntegrationRegistry.instance = new IntegrationRegistry();
    }
    return IntegrationRegistry.instance;
  }

  register(integration: BaseIntegration): void {
    this.integrations.set(integration.getId(), integration);
  }

  get(id: string): BaseIntegration | undefined {
    return this.integrations.get(id);
  }

  getAll(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }
}
