import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Documentação" };

export default async function DocsPage() {
  await requireAcademyAdmin();
  return (
    <>
      <PageHeader title="Documentação" description="Como usar o Kombexa no dia a dia." />
      <Card className="docs">
        <h2 style={{ marginTop: 0 }}>Visão geral</h2>
        <p>O Kombexa organiza os alunos, as mensalidades, os pagamentos e o caixa da academia. O caminho mais comum é: <strong>pesquisar o aluno → abrir o perfil → ver a situação financeira → registrar o pagamento</strong>.</p>

        <h2>Primeira utilização</h2>
        <p>Em <Link href="/configuracoes">Configurações</Link>, preencha os <strong>dados da academia</strong>, cadastre as <strong>modalidades</strong> (com o valor sugerido de cada uma) e escreva os <strong>termos da ficha de matrícula</strong>. O Início mostra o que ainda falta.</p>

        <h2>Como cadastrar um aluno</h2>
        <ol>
          <li>Abra <Link href="/alunos">Alunos</Link> e clique em <strong>Novo aluno</strong>.</li>
          <li>Informe nome e <strong>data de nascimento</strong> (obrigatória). Se o aluno for menor de 18 anos, aparece a seção do <strong>responsável legal</strong>: informe um novo ou escolha um já cadastrado (para irmãos).</li>
          <li>Escolha a modalidade. O valor sugerido dela vem preenchido e pode ser ajustado. Informe o <strong>dia de vencimento</strong>: ele é usado em todas as mensalidades futuras.</li>
          <li>Se quiser, informe CPF, endereço, contato de emergência e se o aluno autoriza o uso de imagem.</li>
        </ol>
        <p>Para menores, o <strong>responsável principal</strong> é o contato de cobrança (o WhatsApp vai para ele) e é quem assina a ficha. Um aluno menor não pode ficar sem responsável principal.</p>

        <h2>Ficha de matrícula</h2>
        <p>No perfil do aluno, em <strong>Mais ações → Imprimir ficha de matrícula</strong>. A ficha reúne os dados do cadastro, os termos da academia e as linhas de assinatura. Depois de assinada, marque <strong>Marcar como assinada</strong> no perfil: enquanto isso, o aluno aparece com “Ficha pendente”.</p>

        <h2>Logo da academia nos documentos</h2>
        <p>Em <Link href="/configuracoes?aba=identidade">Configurações → Identidade visual</Link>, envie a logo da academia (PNG, JPEG ou WebP, até 1 MB). Ela passa a encabeçar a ficha de matrícula, o contrato e os recibos. Sem logo, os documentos saem com as iniciais e o nome da academia. A razão social e o responsável, preenchidos na aba Academia, aparecem como contratada no contrato. O Kombexa aparece só no rodapé, como sistema emissor.</p>

        <h2>Comunicados</h2>
        <p>Em <Link href="/comunicados">Comunicados</Link>, publique avisos de horário, feriado, evento ou graduação. Eles aparecem para todos os alunos ativos na Área do Aluno; nada é enviado por e-mail ou WhatsApp. <strong>Fixar</strong> mantém o aviso no topo; <strong>Arquivar</strong> tira do mural sem apagar.</p>

        <h2>Graduações</h2>
        <p>No perfil do aluno, aba <strong>Graduações</strong>: registre a faixa, corda ou grau com a data. O aluno vê a graduação atual e o histórico na Área do Aluno. Remover serve para corrigir um lançamento errado e fica na auditoria.</p>

        <h2>Presença pelo QR Code</h2>
        <p>Cada aluno tem um QR Code em <strong>Carteirinha</strong>, na Área do Aluno. Em <Link href="/presenca">Presença</Link>, use um leitor de QR conectado ao computador ou digite o código mostrado abaixo do QR. Vale só para o dia de hoje e não duplica a presença. O QR não tem dados pessoais e, se o aluno gerar um novo, o antigo deixa de valer.</p>

        <h2>Recibo</h2>
        <p>Em <Link href="/pagamentos">Pagamentos</Link> ou no perfil do aluno, clique em <strong>Recibo</strong> ao lado de um pagamento. Dá para imprimir, salvar em PDF ou enviar o resumo pelo WhatsApp. Para alunos menores, o recibo sai em nome do responsável principal.</p>

        <h2>Pedidos de acesso ou eliminação de dados (LGPD)</h2>
        <p>Se um aluno (ou o responsável) pedir os dados dele, use <strong>Mais ações → Exportar dados</strong> no perfil. Se pedir a eliminação, marque o aluno como inativo, quite ou cancele as mensalidades em aberto e use <strong>Eliminar dados pessoais</strong>, na seção Privacidade. O financeiro continua, sem identificar a pessoa.</p>

        <h2>Informações de saúde</h2>
        <p>Ficam na aba <strong>Saúde</strong> do perfil, com consentimento obrigatório. Não aparecem em listas, buscas, mensagens nem na ficha, a menos que você marque para incluir na impressão.</p>

        <h2>Como convidar alunos (QR Code)</h2>
        <ol>
          <li>Abra <Link href="/convidar">Convidar alunos</Link>. O sistema mostra o QR Code da academia.</li>
          <li>Mostre na recepção, clique em <strong>Imprimir cartaz</strong> ou envie o link pelo WhatsApp.</li>
          <li>O aluno cria a própria conta. O pedido aparece em <Link href="/solicitacoes">Solicitações</Link>, com um aviso no menu.</li>
          <li>Ao aprovar, informe modalidade, data de início, valor mensal e dia de vencimento. Se a pessoa já era aluna, use <strong>Vincular a este aluno</strong> para manter o histórico dela.</li>
          <li>Depois de aprovado, o aluno entra no Kombexa e vê as próprias mensalidades e pagamentos.</li>
        </ol>
        <p>O cadastro pelo convite é só para maiores de 18 anos; menores continuam sendo cadastrados por você em Alunos. Se o QR Code for parar em um lugar indevido, clique em <strong>Gerar novo código</strong>: o antigo deixa de funcionar na hora.</p>

        <h2>Aluno que já tem conta</h2>
        <p>O aluno também pode criar a conta sozinho, em <strong>Criar conta</strong> na tela de login. A conta fica sem academia até você adicioná-la:</p>
        <ol>
          <li>Peça o e-mail da conta. Ele aparece na área do aluno, logo depois do cadastro.</li>
          <li>Em <Link href="/solicitacoes">Solicitações</Link>, use <strong>Adicionar aluno que já tem conta</strong> e informe o e-mail.</li>
          <li>O pedido aparece na lista. Aprove como no convite, ou vincule a um aluno que você já tinha cadastrado.</li>
        </ol>
        <p>Você também pode mandar o link do convite por e-mail, em <Link href="/convidar">Convidar alunos</Link>.</p>

        <h2>Como criar mensalidades</h2>
        <p><strong>Todas de uma vez:</strong> em <Link href="/mensalidades/gerar">Mensalidades → Gerar mensalidades do mês</Link>, escolha o mês. O sistema cria uma para cada aluno ativo que ainda não tem, com o valor e o vencimento do cadastro. Rodar de novo não duplica.</p>
        <p><strong>Uma específica:</strong> em <Link href="/mensalidades/nova">Nova mensalidade</Link>, escolha o aluno; o valor mensal dele já vem preenchido.</p>
        <p>Uma mensalidade só pode ser editada ou cancelada enquanto não recebeu nenhum pagamento.</p>

        <h2>Como registrar um pagamento</h2>
        <ol>
          <li>Clique em <strong>Registrar pagamento</strong> (no menu, no início, no perfil do aluno ou ao lado de uma mensalidade). No celular, é o botão do meio na barra de baixo.</li>
          <li>Digite parte do nome, do telefone ou do e-mail do aluno e escolha na lista. As mensalidades em aberto dele aparecem, e o saldo já vem preenchido.</li>
          <li>Confirme o valor, a data e a forma de pagamento.</li>
        </ol>
        <p><strong>Pagamento parcial:</strong> se a mensalidade é R$ 150,00 e o aluno pagou R$ 100,00, registre R$ 100,00. Ela continua a vencer (ou atrasada, se o vencimento passou) com R$ 50,00 em aberto até o restante ser pago.</p>
        <p><strong>Pagamento avulso:</strong> deixe a mensalidade em branco (por exemplo, para a venda de um kimono).</p>
        <p><strong>Aguardando confirmação:</strong> use quando o pagamento foi combinado mas ainda não caiu. Ele só entra no caixa depois de confirmado em <Link href="/pagamentos?status=pending">Pagamentos</Link>.</p>

        <h2>Como consultar pendências</h2>
        <p>No <Link href="/">Início</Link> aparecem as mensalidades atrasadas e as que vencem no mês. Em <Link href="/mensalidades?status=overdue">Mensalidades</Link>, filtre por <strong>Atrasada</strong> ou <strong>A vencer</strong>. Uma mensalidade fica atrasada a partir do dia seguinte ao vencimento (no horário de Brasília). No perfil do aluno, o botão <strong>Cobrar pelo WhatsApp</strong> abre o WhatsApp com uma mensagem pronta, que você revisa antes de enviar.</p>

        <h2>Como ver o perfil do aluno</h2>
        <p>Em <Link href="/alunos">Alunos</Link>, clique no nome. O perfil mostra a situação financeira no topo (em dia, a vencer ou atrasado), o último pagamento e as abas de informações, mensalidades, pagamentos e histórico de ações.</p>

        <h2>Como consultar o financeiro</h2>
        <p>Em <Link href="/financeiro">Financeiro</Link> você vê as entradas, as saídas e o saldo do período. <strong>Mensalidades pagas entram sozinhas</strong> quando o pagamento é registrado. Lance à mão só o que não é mensalidade: despesas, matrículas e outros recebimentos.</p>

        <h2>Como corrigir um erro</h2>
        <p>Nada financeiro é apagado. Para desfazer um pagamento, clique em <strong>Cancelar</strong> ao lado dele e informe o motivo: a mensalidade volta a ficar em aberto e a entrada sai do caixa. Tudo fica registrado em <Link href="/auditoria">Auditoria</Link>.</p>

        <h2>Perguntas frequentes</h2>
        <details><summary>Posso excluir um aluno?</summary><p>Não. Para preservar o histórico financeiro, marque o aluno como inativo. Ele deixa de receber mensalidades na geração do mês.</p></details>
        <details><summary>Por que não consigo editar uma mensalidade?</summary><p>Ela já recebeu pagamento. Cancele o pagamento primeiro; assim o histórico fica correto.</p></details>
        <details><summary>O aluno pagou mais do que devia. E agora?</summary><p>O sistema não aceita pagamento acima do saldo da mensalidade. Registre o valor da mensalidade e, se for o caso, o excedente como pagamento avulso.</p></details>
        <details><summary>Qualquer pessoa com o QR Code consegue entrar na academia?</summary><p>Não. Ela consegue apenas pedir. Só entra quem você aprovar em Solicitações.</p></details>
        <details><summary>A mensalidade gera sozinha todo mês?</summary><p>Não. A geração acontece só quando alguém clica em “Gerar mensalidades do mês”.</p></details>

        <h2>Limitações atuais</h2>
        <ul>
          <li>A Área do Aluno é de consulta: o aluno não marca pagamentos nem presença e não altera a matrícula.</li>
          <li>Não há integração com bancos: o Pix copia e cola é gerado com a sua chave, mas a confirmação do pagamento é feita pela recepção.</li>
          <li>Não há assinatura eletrônica: a ficha é assinada no papel e a data é registrada no perfil do aluno.</li>
          <li>Comunicados aparecem só na Área do Aluno (sem e-mail, WhatsApp ou notificação no celular).</li>
          <li>Ainda não há agenda de aulas e turmas.</li>
        </ul>
      </Card>
    </>
  );
}
