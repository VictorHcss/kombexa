import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { currentUser } from "@/lib/auth/session";
import { InviteCodeForm, StudentSignupForm } from "./Forms";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

/**
 * Criar conta de aluno. Quem se cadastra aqui fica sem academia até o administrador de uma
 * academia adicionar a conta pelo e-mail. Com o código do convite, o pedido já vai direto
 * para a academia (?tipo=convite).
 * Academias não se cadastram por aqui: quem cria é o administrador da plataforma.
 */
export default async function CreateAccountPage({ searchParams }: { searchParams: Promise<{ tipo?: string; proximo?: string }> }) {
  const { tipo, proximo } = await searchParams;
  if (proximo?.startsWith("/convite/")) redirect(proximo); // veio do convite: o cadastro é lá
  const user = await currentUser();
  // aluno já conectado pode usar um convite (o pedido sai da conta dele); o resto volta para a própria área
  if (user && !(tipo === "convite" && user.role === "STUDENT")) redirect(user.role === "PLATFORM_ADMIN" ? "/plataforma" : user.role === "STUDENT" ? "/aluno" : "/");
  const footer = <>Já tem conta? <Link href="/login">Entrar</Link></>;

  if (tipo === "convite") {
    return (
      <AuthLayout title="Tenho um convite" footer={footer}
        lead="Informe o código ou cole o link que a academia enviou. O pedido vai direto para a recepção aprovar.">
        <InviteCodeForm />
        <p className="auth-switch"><Link href="/criar-conta">Criar conta sem convite</Link></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar conta de aluno" wide footer={footer}
      lead="Depois de criar a conta, passe o seu e-mail para a recepção da academia. Quando ela adicionar você, suas mensalidades e pagamentos aparecem na sua área.">
      <div className="auth-note">
        <span>Tem o QR Code ou o código da academia?</span>
        <Link href="/criar-conta?tipo=convite">Usar convite</Link>
      </div>
      <StudentSignupForm />
      <p className="auth-switch muted">É dono de academia? O acesso é criado pela equipe do Kombexa. Fale com o suporte da plataforma.</p>
    </AuthLayout>
  );
}
