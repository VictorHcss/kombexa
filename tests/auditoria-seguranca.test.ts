// Regressão (auditoria 2026-11): os links dos e-mails não podem seguir cabeçalhos forjados.
import { describe, expect, it, vi } from "vitest";

const forged = new Headers({ host: "atacante.example", "x-forwarded-host": "atacante.example", "x-forwarded-proto": "https" });
vi.mock("next/headers", () => ({ headers: async () => forged }));

import { configuredSiteUrl, siteUrl } from "@/lib/url";

describe("endereço público dos links", () => {
  it("normaliza APP_URL e recusa valores inválidos", () => {
    expect(configuredSiteUrl("https://app.kombexa.com.br/")).toBe("https://app.kombexa.com.br");
    expect(configuredSiteUrl("http://localhost:3000/qualquer/caminho")).toBe("http://localhost:3000");
    expect(configuredSiteUrl("javascript:alert(1)")).toBeNull();
    expect(configuredSiteUrl("não é url")).toBeNull();
    expect(configuredSiteUrl("")).toBeNull();
    expect(configuredSiteUrl(undefined)).toBeNull();
  });

  it("com APP_URL, ignora Host e X-Forwarded-Host da requisição", async () => {
    vi.stubEnv("APP_URL", "https://app.kombexa.com.br");
    expect(await siteUrl()).toBe("https://app.kombexa.com.br");
    vi.unstubAllEnvs();
  });

  it("sem APP_URL, mantém o comportamento antigo (desenvolvimento)", async () => {
    vi.stubEnv("APP_URL", "");
    expect(await siteUrl()).toBe("https://atacante.example");
    vi.unstubAllEnvs();
  });
});

import { csvMoney, toCsv } from "@/lib/csv";

describe("CSV: injeção de fórmula", () => {
  it("neutraliza texto que começaria uma fórmula e preserva números", () => {
    const csv = toCsv(["Aluno", "Valor"], [["=HYPERLINK(\"http://x\";\"clique\")", csvMoney(-500)], ["@SOMA(A1)", csvMoney(12345)], ["+5511999", -3], ["-ana", "Silva-Souza"]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"";""clique"")";-5,00`);
    expect(csv).toContain("'@SOMA(A1);123,45");
    expect(csv).toContain("\r\n+5511999;-3"); // número: não é fórmula perigosa
    expect(csv).toContain("'-ana;Silva-Souza");
  });
});
