import type {
  AppConfig,
  AppEnvironmentValue,
  AppsRecord,
  EnvConfig as EnvConfigType,
  EnvField,
  SharedVariables,
} from "@/types";

export class EnvConfig {
  readonly shared?: SharedVariables;
  readonly apps: AppsRecord;

  private constructor(data: EnvConfigType) {
    this.shared = data.shared;
    this.apps = data.apps;
  }

  static from(data: EnvConfigType): EnvConfig {
    return new EnvConfig(data);
  }

  getAppNames(): string[] {
    return Object.keys(this.apps);
  }

  getApp(appName: string): AppConfig | undefined {
    return this.apps[appName];
  }

  getEnvironmentNames(appName: string): string[] {
    const app = this.getApp(appName);
    return app ? Object.keys(app.environments) : [];
  }

  getEnvironment(
    appName: string,
    envName: string
  ): AppEnvironmentValue | undefined {
    const app = this.getApp(appName);
    return app?.environments[envName];
  }

  getSharedVariables(): EnvField {
    return this.shared?.variables ?? {};
  }

  hasApp(appName: string): boolean {
    return appName in this.apps;
  }

  hasEnvironment(appName: string, envName: string): boolean {
    const app = this.getApp(appName);
    return app ? envName in app.environments : false;
  }
}
