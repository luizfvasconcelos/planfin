# Product

## Register

product

## Users

Luiz e Duda — um casal que divide as finanças. Antes controlavam tudo numa planilha
Excel compartilhada; o PlanFin é a substituta. São os dois únicos usuários (auth fechada,
2 contas), então o app é privado e feito sob medida, não um produto para terceiros.

Contexto de uso: celular, mobile-first, uso rápido e frequente no dia a dia — registrar um
gasto na rua, conferir o saldo projetado antes de uma compra, lançar o faturamento da Duda.
Os dois editam ao mesmo tempo (sync em tempo real via Supabase Realtime). Desktop é
secundário.

## Product Purpose

Dar visibilidade do **fluxo de caixa futuro** de um casal e tirar a ansiedade de "será que
vai dar?". O coração é a Timeline: uma linha por dia com entradas, saídas e saldo acumulado,
destacando antecipadamente o dia em que o saldo cruza zero. Em volta dela orbitam:

- **Contas Fixas** — despesas recorrentes (aluguel, assinaturas).
- **Gastos** — registro de gastos variáveis do dia a dia, com categorias e subcategorias.
- **Orçamento** — teto de gasto por período e acompanhamento contra o realizado.
- **Faturamento Duda** — renda variável diária da Duda, com prazo de recebimento e caixa
  planejável.

Sucesso = o casal abandona de vez a planilha porque o PlanFin é mais rápido de lançar, mais
claro de ler e antecipa problemas de saldo antes que eles aconteçam.

## Brand Personality

**Acolhedor, pessoal, sereno.** É um app feito à mão para uma casa, não um dashboard
corporativo. O calor vem do tom (português informal, "Duda" em vez de "Usuário B", a foto
dela na navegação) e de pequenos toques pessoais — nunca de cores pastel ou ilustrações
cartoon. Dinheiro é assunto sério; o app trata com cuidado e calma, sem alarmismo e sem
infantilidade.

Voz: direta, em primeira pessoa do casal, sem jargão financeiro. "Seu saldo fica negativo
dia 14", não "alerta de fluxo de caixa projetado negativo".

## Anti-references

- **Planilha árida (Excel):** grade de células cinza, números soltos sem hierarquia. É
  exatamente o que estão deixando para trás — o PlanFin precisa ter hierarquia e respiro.
- **App de banco / fintech frio:** azul-marinho institucional, tom impessoal e distante,
  linguagem corporativa. O oposto de "feito pra nossa casa".
- **Dashboard SaaS genérico de template:** cards idênticos repetidos, KPI gigante com
  gradiente, eyebrow maiúsculo tracked acima de cada seção, paleta roxa de bootstrap.
- **Fofo/infantil demais:** excesso de pastel, ilustrações cartoon, emojis por todo lado.
  Acolhedor não é infantil — a seriedade do dinheiro tem que transparecer.

## Design Principles

- **Feito à mão pra casa.** Cada decisão favorece o pessoal sobre o genérico: nomes reais,
  a foto da Duda, linguagem de quem mora junto. Quando houver dúvida entre "parecer profissional"
  e "parecer nosso", escolha "nosso".
- **Clareza tira a ansiedade.** O trabalho do app é deixar o futuro legível. Antecipar o saldo
  negativo, mostrar o que sobra, sem assustar. Calma, não alarme.
- **Cada visual responde uma pergunta.** Dashboards e gráficos existem para responder uma
  pergunta óbvia ("estourei o orçamento?", "quando o saldo zera?"), nunca como enfeite. Sem
  visual decorativo; convenções consistentes de progress-bar e KPI.
- **Uma mão, na rua, rápido.** Mobile-first de verdade: alvos de toque generosos, ações ao
  alcance do polegar (bottom nav, bottom sheets), lançamento de gasto em poucos toques.
- **Mesma língua em todas as telas.** Timeline, Gastos, Orçamento, Fixas e Duda compartilham
  o mesmo vocabulário visual (cor de seção, formato de card, chips, tipografia). Inconsistência
  entre telas é bug de design.

## Accessibility & Inclusion

- **WCAG AA de contraste**, sem exceção pelo "charme" do tom claro: corpo de texto ≥ 4.5:1,
  valores monetários e números críticos com peso e contraste fortes (são o conteúdo principal).
- **Toque mobile:** alvos ≥ 44px, espaçamento que evita toque errado, uso confortável com uma mão.
- **Cor nunca é o único sinal:** saldo negativo, estouro de orçamento e status sempre têm
  reforço por texto, ícone ou peso — não só vermelho/verde (segurança para daltonismo).
- **`prefers-reduced-motion`** respeitado em toda animação (crossfade/instantâneo como alternativa).
- **PT-BR** em toda a interface; formatação de moeda em BRL e datas no formato brasileiro.
