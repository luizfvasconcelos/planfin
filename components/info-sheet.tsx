"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface Props {
  open: boolean
  onClose: () => void
}

export function InfoSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-5">
        <SheetHeader className="mb-4">
          <SheetTitle>Como funciona</SheetTitle>
        </SheetHeader>

        <div className="pb-8 space-y-6 leading-relaxed break-words">
          <Section title="Cálculo da projeção">
            <p>
              A média é calculada <strong>separadamente por tipo</strong> (Diária / Produção) dentro de cada clínica,
              porque os dias têm padrões diferentes (ex: terça de diária costuma render mais que sexta de produção).
            </p>
            <p>
              <strong>Média Diária</strong> = total das diárias do mês ÷ dias de diária lançados.<br />
              <strong>Média Produção</strong> = total das produções do mês ÷ dias de produção lançados.
            </p>
            <p>
              <strong>Projeção</strong> = realizado + projeção dos dias futuros da agenda:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Dias de <strong>Produção</strong> remanescentes: somam <em>média de produção</em>.
              </li>
              <li>
                Dias de <strong>Diária</strong> remanescentes com mínimo (ex: PS R$ 160): somam{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">max(média_diária, mínimo)</code>.
              </li>
              <li>
                Se ainda não há diária lançada no mês: usa direto o <strong>mínimo</strong>
                (o piso contratual é o melhor sinal quando não há histórico).
              </li>
              <li>
                Se ainda não há produção lançada no mês <em>e</em> existem dias futuros de produção:
                não dá pra projetar de forma confiável → o card mostra
                <strong> "Amostra pequena pra projetar"</strong> em vez de um número.
              </li>
              <li>Dias passados sem lançamento são tratados como <em>perdidos</em> e não entram na projeção.</li>
              <li>Dias marcados como <strong>folga</strong> no Plano do mês também não entram.</li>
              <li>Em meses já encerrados, a projeção não aparece — só o realizado.</li>
            </ul>
          </Section>

          <Section title="Sob demanda">
            <p>
              Clínicas sem slots na agenda são consideradas <em>sob demanda</em>: aparecem com o realizado mas <strong>sem projeção</strong>.
              Isso é proposital — a variabilidade de pacientes/dia torna a projeção pouco confiável (ex: OF, onde o ticket varia muito).
            </p>
          </Section>

          <Section title="Agenda semanal (🕐)">
            <p>
              Define o <strong>padrão recorrente</strong> de trabalho: para cada dia da semana, qual clínica e tipo (Diária/Produção).
              É o template usado pelos cálculos de projeção.
            </p>
            <p>Mais de uma clínica pode ocupar o mesmo dia (ex: Quarta = YM + OF).</p>
          </Section>

          <Section title="Plano do mês (📅)">
            <p>
              Mostra o calendário do mês com a agenda padrão aplicada. Use pra marcar como <strong>folga</strong> dias específicos
              (feriados, especialização, etc) — esses dias somem da projeção.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Dias passados não podem ser marcados/desmarcados.</li>
              <li>Dias com entrada já lançada não permitem toggle (preservam o histórico).</li>
            </ul>
          </Section>

          <Section title="Adicionar uma clínica nova">
            <p>
              Não afeta meses anteriores. Os cards de meses antigos só mostram clínicas que <strong>tinham entradas naquele mês</strong>.
            </p>
            <p>
              No mês atual e futuros, a nova clínica passa a aparecer nos cards e nos formulários (incluindo a agenda).
            </p>
          </Section>

          <Section title="Remover uma clínica">
            <p>
              <strong>O histórico é sempre preservado.</strong> Remover aqui faz <em>soft delete</em> (marca como inativa, não apaga).
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Em <strong>meses passados</strong> com entradas: o card continua aparecendo (com nome, sigla e cor originais).</li>
              <li>Em <strong>mês atual e futuros</strong>: a clínica some dos cards e dos formulários de adicionar entrada/agenda.</li>
              <li>Os lançamentos antigos continuam no banco, vinculados ao UUID da clínica — não somem.</li>
            </ul>
          </Section>

          <Section title="Editar uma clínica">
            <p>
              Tudo é referenciado pelo <strong>UUID</strong> (não pelo nome ou sigla), então qualquer alteração se propaga
              automaticamente para todas as visualizações:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Cards</strong> (cor, sigla, nome) atualizam em todos os meses</li>
              <li><strong>Tendência mensal</strong> (cor da linha, sigla na ponta, chips de filtro)</li>
              <li><strong>Plano do mês</strong> (badges no calendário)</li>
              <li><strong>Lista de entradas</strong> e <strong>Exportar mensagem</strong></li>
              <li><strong>Agenda semanal</strong></li>
            </ul>
            <p>
              O nome cadastrado hoje é o que aparece no histórico — então se a clínica mudou de nome, edite aqui e o histórico passa a usar o novo nome.
            </p>
          </Section>

          <Section title="Exportar mensagem (📤)">
            <p>
              Botão de compartilhar no header. Copia uma mensagem formatada estilo WhatsApp para o clipboard.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Copiar tudo</strong>: o mês inteiro com sigla em cada linha (ex: <code className="text-xs bg-gray-100 px-1 rounded">07 Ter - PS: 214$</code>).</li>
              <li><strong>Copiar [clínica]</strong>: só as entradas daquela clínica, <em>sem a sigla</em> (ex: <code className="text-xs bg-gray-100 px-1 rounded">07 Ter: 214$</code>) — pronto pra mandar pra patroa da clínica.</li>
            </ul>
          </Section>

          <Section title="Limites de navegação">
            <p>O histórico começa em <strong>janeiro/2026</strong>. Não há dados antes disso.</p>
          </Section>

          <Section title="Sincronia entre dispositivos">
            <p>
              Os dados são compartilhados entre você e a Duda em tempo real (Supabase).
              Edições feitas em um celular aparecem no outro automaticamente.
            </p>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}
