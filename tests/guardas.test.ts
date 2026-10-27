// Toda tela, action e rota da área da academia confere a permissão certa no servidor.
// Este teste lê o código: uma rota nova sem guarda (ou com a permissão errada) quebra aqui antes de ir ao ar.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const ROOT = join(__dirname, "..", "app", "(app)");

/** Permissão esperada pela primeira pasta da URL. */
const BY_FOLDER: Record<string, string> = {
  alunos: "alunos", mensalidades: "mensalidades", pagamentos: "pagamentos", financeiro: "financeiro", relatorios: "financeiro",
  presenca: "presenca", solicitacoes: "solicitacoes", convidar: "solicitacoes", auditoria: "auditoria", configuracoes: "configuracoes",
  comunicados: "comunicados",
};

/**
 * Exceções conscientes, cada uma com o motivo:
 * - Início: confere "mensalidades" à mão e manda quem não tem para a primeira área liberada.
 * - Documentação e Configurações (página): abertas a toda a equipe; a página mostra só as abas permitidas.
 * - Busca de alunos: usada nos formulários de mensalidade e pagamento.
 * - Saúde: exige a permissão própria.
 * - Equipe (criar, desativar, mudar acesso): exige acesso total.
 * - Trocar a própria senha: qualquer pessoa da equipe.
 */
const EXCEPTIONS: Record<string, Record<string, string>> = {
  "page.tsx": { DashboardPage: "" },
  "documentacao/page.tsx": { "*": "" },
  "configuracoes/page.tsx": { "*": "" },
  "alunos/actions.ts": { searchStudentsAction: "", saveHealthAction: "saude" },
  "configuracoes/actions.ts": { createUserAction: "full", toggleUserAction: "full", updatePermissionsAction: "full", changePasswordAction: "" },
};

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /^(page\.tsx|actions\.ts|route\.ts)$/.test(f) ? [p] : [];
});

/** Cada função exportada e a permissão com que ela chama requireAcademyAdmin (null = não chama). */
function guardsOf(source: string) {
  const out: { name: string; permission: string | null }[] = [];
  const re = /export (?:default )?async function (\w+)/g;
  const starts = [...source.matchAll(re)];
  starts.forEach((m, i) => {
    const body = source.slice(m.index, starts[i + 1]?.index ?? source.length);
    const call = body.match(/requireAcademyAdmin\(\s*(?:"([^"]*)")?\s*\)/);
    out.push({ name: m[1], permission: call ? call[1] ?? "" : null });
  });
  return out;
}

describe("guardas das telas, actions e rotas da academia", () => {
  const all = files(ROOT);

  it("encontra os arquivos (o teste não está lendo uma pasta vazia)", () => {
    expect(all.length).toBeGreaterThan(30);
  });

  for (const file of all) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    it(rel, () => {
      const folder = rel.split("/")[0];
      const exceptions = EXCEPTIONS[rel] ?? {};
      const fns = guardsOf(readFileSync(file, "utf8"));
      expect(fns.length, "nenhuma função exportada").toBeGreaterThan(0);
      for (const fn of fns) {
        const expected = exceptions[fn.name] ?? exceptions["*"] ?? BY_FOLDER[folder];
        expect(fn.permission, `${fn.name} não chama requireAcademyAdmin`).not.toBeNull();
        expect(fn.permission, `${fn.name} usa a permissão errada`).toBe(expected ?? "");
      }
    });
  }

  it("as permissões usadas existem", () => {
    for (const p of Object.values(BY_FOLDER)) expect(ALL_PERMISSIONS).toContain(p);
  });
});

// Área do Aluno: toda tela, action e rota exige a conta de aluno (requireStudent). Os serviços
// ainda conferem o vínculo de cada dado; isto garante que ninguém chegue lá sem sessão de aluno.
describe("guardas da Área do Aluno", () => {
  const STUDENT_ROOT = join(__dirname, "..", "app", "aluno");
  const all = files(STUDENT_ROOT);

  it("encontra as páginas do aluno", () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of all) {
    const rel = relative(STUDENT_ROOT, file).replace(/\\/g, "/");
    it(`aluno/${rel}`, () => {
      const source = readFileSync(file, "utf8");
      const re = /export (?:default )?async function (\w+)/g;
      const starts = [...source.matchAll(re)];
      expect(starts.length).toBeGreaterThan(0);
      starts.forEach((m, i) => {
        const body = source.slice(m.index, starts[i + 1]?.index ?? source.length);
        expect(/requireStudent\(\)/.test(body), `${m[1]} não chama requireStudent()`).toBe(true);
        expect(/requireAcademyAdmin\(/.test(body), `${m[1]} não deveria usar a guarda da equipe`).toBe(false);
      });
    });
  }
});
