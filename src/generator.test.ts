import { describe, expect, it } from "vitest";
import { generateAllEnvFiles, generateEnvFile } from "./generator";
import { EnvConfig } from "./models/env-config.model";
import type { EnvConfig as EnvConfigType } from "./types";

describe("generateEnvFile", () => {
  const baseConfig = EnvConfig.from({
    apps: {
      backend: {
        environments: {
          local: {
            variables: {
              PORT: "3000",
              DATABASE_URL: "postgres://localhost:5432/mydb",
            },
          },
        },
      },
    },
  });

  it("should generate env file content for valid config", () => {
    const result = generateEnvFile(
      baseConfig,
      "backend",
      "local",
      "/tmp/test.env"
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("PORT=3000");
      expect(result.value).toContain(
        "DATABASE_URL=postgres://localhost:5432/mydb"
      );
    }
  });

  it("should return error when app not found", () => {
    const result = generateEnvFile(
      baseConfig,
      "frontend",
      "local",
      "/tmp/test.env"
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("App 'frontend' not found");
      expect(result.error.message).toContain("backend");
    }
  });

  it("should return error when environment not found", () => {
    const result = generateEnvFile(
      baseConfig,
      "backend",
      "production",
      "/tmp/test.env"
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain(
        "Environment 'production' not found"
      );
      expect(result.error.message).toContain("local");
    }
  });

  it("should resolve shared variables", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          API_URL: "https://api.example.com",
          DB_HOST: "localhost",
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                API_ENDPOINT: "${shared:API_URL}/v1",
                DATABASE_URL: "postgres://${shared:DB_HOST}:5432/mydb",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("API_ENDPOINT=https://api.example.com/v1");
      expect(result.value).toContain(
        "DATABASE_URL=postgres://localhost:5432/mydb"
      );
    }
  });

  it("should return error when single shared variable not found", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          API_URL: "https://api.example.com",
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                MISSING_VAR: "${shared:NOT_FOUND}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain(
        "Shared variable 'NOT_FOUND' not found"
      );
    }
  });

  it("should return error with all missing shared variables", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          API_URL: "https://api.example.com",
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                VAR1: "${shared:NOT_FOUND_1}",
                VAR2: "${shared:NOT_FOUND_2}",
                VAR3: "value with ${shared:NOT_FOUND_3} and ${shared:NOT_FOUND_1}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Shared variables not found");
      expect(result.error.message).toContain("'NOT_FOUND_1'");
      expect(result.error.message).toContain("'NOT_FOUND_2'");
      expect(result.error.message).toContain("'NOT_FOUND_3'");
      // Should not have duplicates
      const matches = result.error.message.match(/'NOT_FOUND_1'/g);
      expect(matches?.length).toBe(1);
    }
  });

  it("should handle variable with comment", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: {
                  value: "3000",
                  comment: "Server port number",
                },
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("# Server port number");
      expect(result.value).toContain("PORT=3000");
    }
  });

  it("should handle variable without comment", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: {
                  value: "3000",
                },
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).not.toContain("#");
      expect(result.value).toContain("PORT=3000");
    }
  });

  it("should handle legacy format (flat object)", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              PORT: "3000",
              DATABASE_URL: "postgres://localhost:5432/mydb",
            },
          },
        },
      },
    } as unknown as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("PORT=3000");
      expect(result.value).toContain(
        "DATABASE_URL=postgres://localhost:5432/mydb"
      );
    }
  });

  it("should handle multiple shared variable references", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          HOST: "example.com",
          PORT: "8080",
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                API_URL: "https://${shared:HOST}:${shared:PORT}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("API_URL=https://example.com:8080");
    }
  });
});

describe("generateAllEnvFiles", () => {
  it("should generate all env files for all apps and environments", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          API_URL: "https://api.example.com",
        },
      },
      apps: {
        frontend: {
          environments: {
            local: {
              variables: {
                VITE_API_URL: "${shared:API_URL}",
              },
            },
            production: {
              variables: {
                VITE_API_URL: "${shared:API_URL}",
              },
            },
          },
        },
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
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(3);

      const frontendLocal = result.value.find(
        (f) => f.path.includes("frontend") && f.path.includes("local")
      );
      expect(frontendLocal).toBeDefined();
      if (frontendLocal) {
        expect(frontendLocal.content).toContain(
          "VITE_API_URL=https://api.example.com"
        );
      }

      const frontendProd = result.value.find(
        (f) => f.path.includes("frontend") && f.path.includes("production")
      );
      expect(frontendProd).toBeDefined();

      const backendLocal = result.value.find(
        (f) => f.path.includes("backend") && f.path.includes("local")
      );
      expect(backendLocal).toBeDefined();
      if (backendLocal) {
        expect(backendLocal.content).toContain("PORT=3000");
      }
    }
  });

  it("should return error when shared variable not found in any env", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          API_URL: "https://api.example.com",
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                MISSING: "${shared:NOT_FOUND}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain(
        "Failed to generate env for backend.local"
      );
      expect(result.error.message).toContain(
        "Shared variable 'NOT_FOUND' not found"
      );
    }
  });

  it("should handle path configuration at env level", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: "3000",
              },
              path: "apps/backend",
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        expect(file.path).toContain("apps/backend");
        expect(file.path).toContain(".env.local");
      }
    }
  });

  it("should handle path configuration at app level", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          path: "apps/backend",
          environments: {
            local: {
              variables: {
                PORT: "3000",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        expect(file.path).toContain("apps/backend");
        expect(file.path).toContain(".env.local");
      }
    }
  });

  it("should handle absolute paths", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: "3000",
              },
              path: "/absolute/path",
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        expect(file.path).toContain("/absolute/path");
      }
    }
  });

  it("should determine correct filename for local environment", () => {
    const config = EnvConfig.from({
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
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        // When no path is specified, it uses default format: appName.envName.env
        expect(file.path).toContain("backend.local.env");
      }
    }
  });

  it("should determine correct filename for production environment", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            production: {
              variables: {
                PORT: "3000",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        expect(file.path).toContain(".env");
        expect(file.path).not.toContain(".env.production");
      }
    }
  });

  it("should determine correct filename for other environments", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            development: {
              variables: {
                PORT: "3000",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        // When no path is specified, it uses default format: appName.envName.env
        expect(file.path).toContain("backend.development.env");
      }
    }
  });

  it("should use default path when no path specified", () => {
    const config = EnvConfig.from({
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
    } as EnvConfigType);

    const result = generateAllEnvFiles(config, "/tmp/output", "/tmp");

    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.length > 0) {
      const file = result.value[0];
      if (file) {
        expect(file.path).toContain("/tmp/output");
        expect(file.path).toContain("backend.local.env");
      }
    }
  });
});

describe("type support (number and boolean)", () => {
  it("should handle number type without quotes", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: 3000,
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("PORT=3000");
      expect(result.value).not.toContain('PORT="3000"');
    }
  });

  it("should handle boolean type without quotes", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                DEBUG: true,
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("DEBUG=true");
      expect(result.value).not.toContain('DEBUG="true"');
    }
  });

  it("should handle false boolean without quotes", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                ENABLED: false,
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("ENABLED=false");
      expect(result.value).not.toContain('ENABLED="false"');
    }
  });

  it("should handle mixed types (string, number, boolean)", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                NAME: "backend",
                PORT: 3000,
                DEBUG: true,
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("NAME=backend");
      expect(result.value).toContain("PORT=3000");
      expect(result.value).toContain("DEBUG=true");
    }
  });

  it("should handle number in shared variables", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          DEFAULT_PORT: 8080,
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: "${shared:DEFAULT_PORT}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("PORT=8080");
    }
  });

  it("should handle boolean in shared variables", () => {
    const config = EnvConfig.from({
      shared: {
        variables: {
          DEFAULT_DEBUG: true,
        },
      },
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                DEBUG: "${shared:DEFAULT_DEBUG}",
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("DEBUG=true");
    }
  });

  it("should handle number with object format", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                PORT: {
                  value: 3000,
                  comment: "Server port",
                },
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("# Server port");
      expect(result.value).toContain("PORT=3000");
    }
  });

  it("should handle boolean with object format", () => {
    const config = EnvConfig.from({
      apps: {
        backend: {
          environments: {
            local: {
              variables: {
                DEBUG: {
                  value: true,
                  comment: "Enable debug mode",
                },
              },
            },
          },
        },
      },
    } as EnvConfigType);

    const result = generateEnvFile(config, "backend", "local", "/tmp/test.env");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("# Enable debug mode");
      expect(result.value).toContain("DEBUG=true");
    }
  });
});
