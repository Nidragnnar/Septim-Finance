# Septim

Gestão financeira pessoal com cara de moeda de dragão: roxo, dourado e um dragão de guarda.

Contas, cartões, faturas, metas, investimentos, dívidas, orçamento, calendário e relatórios num app só. Sem servidor e sem login: os dados ficam no seu aparelho e, se você quiser, sincronizados entre computador e celular pelo seu próprio Google Drive.

## Telas

- **Dashboard**: saldo disponível, receitas, despesas, saldo do período, contas a pagar, a receber, total investido, dívidas em aberto e limite livre dos cartões. Gráficos de receitas x despesas, gastos por categoria, evolução do patrimônio, evolução mensal, comparativo com o período anterior e distribuição por contas. Filtros: hoje, 7 dias, este mês, mês anterior, 3 meses, 6 meses, este ano ou período personalizado.
- **Transações**: tudo junto (receitas, despesas, compras no cartão, transferências, faturas, dívidas, investimentos), com busca e filtros. Aqui também se **importa o extrato do banco**.
- **Receitas** e **Despesas**: status (pendente, pago, atrasado), repetição mensal ou anual, despesa dividida em parcelas, comprovante anexado (fica só no aparelho).
- **Contas**: corrente, poupança, dinheiro, carteira digital; saldo, histórico e transferências (que não contam como receita nem despesa).
- **Cartões**: limite, fechamento, vencimento e cor. Compras parceladas se espalham pelas faturas; o pagamento da fatura sai da conta sem contar a despesa duas vezes.
- **Planejamento**: orçamento do mês e limite por categoria, com aviso em 80% e ao passar.
- **Metas**: valor, prazo, progresso e histórico de depósitos.
- **Investimentos**: aplicações, resgates e valor atualizado à mão (sem cotação inventada), lucro ou prejuízo.
- **Dívidas**: valor original, juros, parcelas, pagamentos e progresso de quitação.
- **Calendário**: vencimentos, receitas, faturas, parcelas e repetições futuras, com cores por tipo.
- **Relatórios**: nove relatórios com filtro de período, exportação em CSV, Excel e PDF (impressão).
- **Configurações**: Drive, nome, foto, tema, formato de data, categorias, avisos, ocultar valores, cópia de segurança e histórico de alterações.

## Regras de cálculo

- Valores guardados em centavos (inteiros), sem erro de arredondamento.
- Despesas entram no mês pelo vencimento; compras no cartão, pelo vencimento da fatura em que cada parcela cai; parcelas de dívida, pela data do pagamento.
- O saldo das contas só muda com o que foi pago ou recebido.
- Patrimônio = contas + investimentos − dívidas − cartões em aberto.

## Vindo do painel antigo

Na primeira abertura, o Septim traz sozinho os dados do painel anterior guardados no aparelho ou no Drive: gastos do dia a dia, contas fixas (viram despesas que repetem todo mês), parcelas de dívidas, renda (vira um salário que repete) e entradas extras, todos numa **Conta principal**. O painel antigo fica guardado no aparelho, sem mudança.

Depois, ajuste o **saldo de hoje** da Conta principal (Contas → lápis) para bater com o banco.

## Importar extrato do banco

Em **Transações** ou **Contas**, toque em **Importar extrato** e escolha o arquivo OFX ou CSV (testado com o do Inter). O Septim sugere o que cada linha vira: despesa com categoria, conta já lançada (marca como paga em vez de duplicar), parcela de dívida, pagamento de fatura ou nada (investimento, Pix devolvido). Você revisa antes de lançar; importar o mesmo período de novo não duplica. O arquivo é lido só no aparelho.

## Onde os dados ficam

Sempre neste aparelho primeiro, salvos a cada alteração. Conectando o Google Drive, eles também vão para um arquivo `painel-financas.json` no seu Drive, e todos os aparelhos conectados leem e escrevem nele.

- **Quase tempo real.** Cada alteração sobe em segundos; o app pergunta ao Drive se há novidade a cada 15 segundos e sempre que você volta para a tela.
- **Sem internet, nada se perde.** Fica salvo no aparelho e sobe quando a conexão voltar.
- **Dois aparelhos ao mesmo tempo.** O app junta as duas versões: lançamentos dos dois lados são mantidos e o que foi apagado continua apagado.
- **Histórico.** O Drive guarda versões anteriores do arquivo (botão direito → Gerenciar versões).

## Sincronizar com o Google Drive

Uma vez só, uns 10 minutos. Você cria um pequeno script na sua conta Google que guarda o arquivo; o app conversa com ele. Quem já usava o painel antigo não precisa refazer nada: o mesmo script e a mesma conexão continuam valendo.

**1. Gere a chave.** No app publicado, em **Configurações → Sincronizar com o Google Drive**, toque em **Gerar**. Uma chave longa aparece e é copiada.

**2. Crie o script.** Abra [script.google.com](https://script.google.com) → **Novo projeto**. Apague o que estiver no editor e cole o conteúdo de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Na linha `const CHAVE = '...'`, troque o texto entre as aspas pela chave. Dê um nome ao projeto (ex.: *Septim*) e salve com `Ctrl+S`.

**3. Autorize.** No topo do editor, escolha a função **testar** e clique em **Executar**. O Google vai pedir permissão:
escolha sua conta → **Avançado** → **Acessar (não seguro)** → **Permitir**.
O aviso aparece porque é um script seu que o Google não revisou; ele roda só na sua conta. No registro deve aparecer "Tudo certo" com o link do arquivo.

**4. Publique.** **Implantar** → **Nova implantação** → engrenagem → **App da Web**.
- Executar como: **Eu**
- Quem pode acessar: **Qualquer pessoa**

Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" quer dizer que o endereço atende pedidos de fora — é assim que o app consegue falar com ele. Sem a chave certa, ele recusa tudo.

**5. Conecte o computador.** Cole o URL, confira que a chave é a mesma e toque em **Conectar**. Aparece **Drive ✓** no topo.

**6. Conecte o celular.** No computador, toque em **Copiar link para o celular**, mande para você mesmo e abra no celular. Ele se conecta sozinho. Depois é só usar "Adicionar à tela inicial".

> O link carrega a chave: trate como senha. Mande só para você.

### Se não conectar

O app mostra o motivo logo abaixo do botão **Conectar**. Os casos mais comuns:

| O app diz | O que fazer |
|---|---|
| endereço de teste (/dev) | Use o **URL do app da Web**, que termina em `/exec` (Implantar → Gerenciar implantações). |
| O Google bloqueou a conversa | Em Gerenciar implantações, **Quem pode acessar** precisa ser **Qualquer pessoa** — não "Qualquer pessoa com Conta do Google". |
| recusou a chave | A chave do app e a da linha `const CHAVE` precisam ser iguais. Depois de colar, salve e publique uma **nova versão** (abaixo). |
| não respondeu como o script | Confira se colou o URL certo e se o código é o do `Codigo.gs`; publique nova versão. |

Não rode `doPost` pelo editor: ele só funciona quando o app chama. Para autorizar, rode `testar`.

### Se alterar o script depois

Para manter o mesmo endereço: **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**. Criar uma *nova implantação* gera outro URL, e aí é preciso reconectar os aparelhos.

### Se a chave vazar

Gere uma nova, troque no script, publique uma nova versão e reconecte os aparelhos. A chave antiga para de funcionar na hora.

## Rodar na sua máquina

Os arquivos usam módulos JavaScript, então precisam de um servidor:

```bash
npx serve .
```

## Estrutura

```
index.html              a casca do app
css/app.css             o visual (roxo, dourado, claro e escuro)
js/app.js               menu, rotas, tema e avisos
js/dados.js             o estado, o histórico e a junção de versões
js/calc.js              datas, saldos, faturas, orçamento e avisos
js/nuvem.js             a conversa com o Drive
js/migracao.js          a conversão dos dados do painel antigo
js/extrato.js           a importação de extrato OFX/CSV
js/formularios.js       cadastros e edições
js/telas/               uma tela por arquivo
apps-script/Codigo.gs   o script que guarda os dados no seu Drive
img/                    logo, dragão e ícones
```

## Licença

MIT.
