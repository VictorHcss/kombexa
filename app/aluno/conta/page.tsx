import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StudentHeader } from "@/components/StudentHeader";
import { Flash } from "@/components/client";
import { Card, Dl } from "@/components/ui";
import { requireStudent } from "@/lib/auth/guards";
import { ownAccount } from "@/services/student-portal";
import { ContactForm, StudentPasswordForm } from "./Forms";

export const metadata: Metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

/** Minha conta: o aluno atualiza o telefone e troca a senha. O resto do cadastro é da academia. */
export default async function StudentAccountPage() {
  const ctx = await requireStudent();
  const me = await ownAccount(ctx);
  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno/conta" />
      <main className="content content--narrow">
        <Suspense fallback={null}><Flash /></Suspense>
        <Link href="/aluno" className="back-link">← Voltar para minha área</Link>
        <h1 className="greeting">Minha conta</h1>

        <Card title="Acesso">
          <Dl items={[["Nome", me.name], ["E-mail de acesso", me.email]]} />
          <p className="small muted card-note">Para mudar o nome ou o e-mail de acesso, fale com a recepção da academia.</p>
        </Card>

        <Card title="Contato">
          <ContactForm phone={me.phone} />
        </Card>

        <Card title="Senha">
          <p className="small muted card-lead">Ao trocar a senha, os outros aparelhos conectados saem da conta.</p>
          <StudentPasswordForm />
        </Card>

        <p className="small muted student-foot"><a href="/aluno/meus-dados" download>Baixar meus dados</a>: tudo o que as academias guardam sobre você, em um arquivo.</p>
      </main>
    </div>
  );
}
