import { describe, expect, it } from "vitest";
import type { EnvConfig as EnvConfigType } from "@/types";
import { EnvConfig } from "./env-config.model";

describe("EnvConfig", () => {
  const mockConfig: EnvConfigType = {
    shared: {
      variables: {
        API_URL: "https://api.example.com",
        DB_HOST: "localhost",
      },
    },
    apps: {
      backend: {
        path: "/apps/backend",
        environments: {
          local: {
            variables: {
              PORT: "3000",
              DATABASE_URL: "postgres://localhost:5432/mydb",
            },
          },
          production: {
            variables: {
              PORT: "8080",
              DATABASE_URL: "postgres://prod:5432/mydb",
            },
          },
        },
      },
      frontend: {
        environments: {
          local: {
            variables: {
              VITE_API_URL: "http://localhost:3000",
            },
          },
        },
      },
    },
  };

  describe("from", () => {
    it("should create EnvConfig instance from data", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config).toBeInstanceOf(EnvConfig);
      expect(config.shared).toEqual(mockConfig.shared);
      expect(config.apps).toEqual(mockConfig.apps);
    });

    it("should handle config without shared variables", () => {
      const configWithoutShared: EnvConfigType = {
        apps: {
          backend: {
            environments: {
              local: {
                variables: {
                  PORT: "3000",
                },
              },
            },
          },
        },
      };
      const config = EnvConfig.from(configWithoutShared);
      expect(config.shared).toBeUndefined();
      expect(config.apps).toEqual(configWithoutShared.apps);
    });
  });

  describe("getAppNames", () => {
    it("should return all app names", () => {
      const config = EnvConfig.from(mockConfig);
      const appNames = config.getAppNames();
      expect(appNames).toEqual(["backend", "frontend"]);
    });

    it("should return empty array when no apps", () => {
      const emptyConfig: EnvConfigType = {
        apps: {},
      };
      const config = EnvConfig.from(emptyConfig);
      expect(config.getAppNames()).toEqual([]);
    });
  });

  describe("getApp", () => {
    it("should return app config when app exists", () => {
      const config = EnvConfig.from(mockConfig);
      const app = config.getApp("backend");
      expect(app).toBeDefined();
      expect(app?.path).toBe("/apps/backend");
      expect(app?.environments).toBeDefined();
    });

    it("should return undefined when app does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      const app = config.getApp("nonexistent");
      expect(app).toBeUndefined();
    });
  });

  describe("getEnvironmentNames", () => {
    it("should return environment names for existing app", () => {
      const config = EnvConfig.from(mockConfig);
      const envNames = config.getEnvironmentNames("backend");
      expect(envNames).toEqual(["local", "production"]);
    });

    it("should return empty array when app does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      const envNames = config.getEnvironmentNames("nonexistent");
      expect(envNames).toEqual([]);
    });
  });

  describe("getEnvironment", () => {
    it("should return environment config when app and env exist", () => {
      const config = EnvConfig.from(mockConfig);
      const env = config.getEnvironment("backend", "local");
      expect(env).toBeDefined();
      expect(env).toHaveProperty("variables");
    });

    it("should return undefined when app does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      const env = config.getEnvironment("nonexistent", "local");
      expect(env).toBeUndefined();
    });

    it("should return undefined when environment does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      const env = config.getEnvironment("backend", "nonexistent");
      expect(env).toBeUndefined();
    });
  });

  describe("getSharedVariables", () => {
    it("should return shared variables when they exist", () => {
      const config = EnvConfig.from(mockConfig);
      const sharedVars = config.getSharedVariables();
      expect(sharedVars).toEqual({
        API_URL: "https://api.example.com",
        DB_HOST: "localhost",
      });
    });

    it("should return empty object when shared variables do not exist", () => {
      const configWithoutShared: EnvConfigType = {
        apps: {
          backend: {
            environments: {
              local: {
                variables: {
                  PORT: "3000",
                },
              },
            },
          },
        },
      };
      const config = EnvConfig.from(configWithoutShared);
      const sharedVars = config.getSharedVariables();
      expect(sharedVars).toEqual({});
    });

    it("should return empty object when shared is undefined", () => {
      const configWithUndefinedShared: EnvConfigType = {
        apps: {
          backend: {
            environments: {
              local: {
                variables: {
                  PORT: "3000",
                },
              },
            },
          },
        },
      };
      const config = EnvConfig.from(configWithUndefinedShared);
      const sharedVars = config.getSharedVariables();
      expect(sharedVars).toEqual({});
    });
  });

  describe("hasApp", () => {
    it("should return true when app exists", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config.hasApp("backend")).toBe(true);
      expect(config.hasApp("frontend")).toBe(true);
    });

    it("should return false when app does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config.hasApp("nonexistent")).toBe(false);
    });
  });

  describe("hasEnvironment", () => {
    it("should return true when app and environment exist", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config.hasEnvironment("backend", "local")).toBe(true);
      expect(config.hasEnvironment("backend", "production")).toBe(true);
      expect(config.hasEnvironment("frontend", "local")).toBe(true);
    });

    it("should return false when app does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config.hasEnvironment("nonexistent", "local")).toBe(false);
    });

    it("should return false when environment does not exist", () => {
      const config = EnvConfig.from(mockConfig);
      expect(config.hasEnvironment("backend", "nonexistent")).toBe(false);
    });
  });
});
