# Septim

Painel de finanças com cara de moeda de dragão: roxo, dourado e um dragão de guarda.

Painel pessoal para acompanhar o mês: quanto ainda dá para gastar, contas fixas com vencimento, parcelas e reserva. Um arquivo HTML, sem build e sem servidor — e, se você quiser, sincronizado entre computador e celular pelo seu próprio Google Drive.

A pergunta que ele responde no topo não é "quanto tenho na conta", é **quanto sobra depois do que já está comprometido** — e quanto isso dá por dia até o fim do mês.

## O que tem dentro

- **Livre para gastar** — renda menos contas fixas, parcelas, o que você quer guardar e o que já gastou. Ao lado, o mesmo número dividido pelos dias que faltam.
- **Resumo em cartões** — renda, saídas, sobra (com a diferença para o mês passado) e quanto da renda vai para parcelas, com a faixa saudável de até 30%.
- **Últimos meses** — gráfico dos seis meses até o mês aberto: contas fixas, parcelas e dia a dia empilhados, a renda tracejada e quanto sobrou em cada mês fechado.
- **Próximos meses** — quanto deve ficar livre nos seis meses seguintes: renda menos contas fixas, parcelas, o que você quer guardar e a média do dia a dia dos últimos três meses. Avisa em que mês cai a última parcela de cada dívida.
- **Avisos do mês** — frases tiradas dos seus números: conta atrasada ou vencendo, ritmo do dia a dia contra o que cabe no mês, categoria que disparou, parcelas pesadas e dívidas que estão acabando.
- **Saúde financeira** — nota de 0 a 100: sobra prevista (40 pontos, cheia com 20% da renda), parcelas (25, cheia até 10%), contas + parcelas (20, cheia até 50%) e reserva (15, cheia guardando 10%).
- **Fita do mês** — uma barra por dia com o gasto daquele dia; embaixo, um ponto em cada vencimento (verde pago, âmbar chegando, vermelho passou).
- **Gastos do dia a dia** — valor, descrição, Enter. Agrupados por dia, somados por categoria, com gráfico de rosca. Toque no nome de um gasto para corrigir.
- **Comparação com o mês passado** — por categoria e no total. No mês corrente, compara até o mesmo dia, para não pôr meio mês contra um mês inteiro.
- **Contas fixas** — cadastradas uma vez, reaparecem todo mês a partir do mês em que entraram. Valor editável mês a mês, com o valor normal ao lado. Marcar como paga registra o dia sozinho. Toque no nome para mudar nome, valor normal ou dia (o valor novo vale daqui para a frente). Vencimento no dia 31 cai no último dia dos meses curtos.
- **Encerrar sem perder o passado** — o × numa conta que já existia em meses anteriores encerra a conta a partir do mês aberto; os meses anteriores continuam com ela.
- **Desfazer** — apagou sem querer? Aparece um aviso com **Desfazer** por alguns segundos.
- **Dívidas e parcelas** — quantas parcelas quiser no mesmo mês, com previsão de quando acaba. Dívida quitada some dos meses seguintes.
- **Importar extrato do banco** — em *Seus dados*, escolha o extrato em OFX ou CSV (testado com o do Inter). O painel sugere o que cada linha vira: gasto com categoria, conta fixa paga (mesmo valor ou nome), parcela de dívida ou nada (investimento, Pix devolvido, entradas). Você revisa e ajusta antes de lançar; importar o mesmo período de novo não duplica. O arquivo é lido só no aparelho.
- **Modo escuro**, **instalável no celular** e **funciona sem internet**.

## Onde os dados ficam

Sempre neste aparelho primeiro, salvos a cada alteração. Se você conectar o Google Drive, eles também vão para um arquivo `painel-financas.json` no seu Drive, e todos os aparelhos conectados leem e escrevem nele.

- **Quase tempo real.** O painel manda cada alteração em segundos e pergunta ao Drive se há novidade a cada 15 segundos e sempre que você volta para a tela.
- **Sem internet, nada se perde.** Fica salvo no aparelho e sobe quando a conexão voltar.
- **Dois aparelhos ao mesmo tempo.** Se ambos mexerem antes de sincronizar, o painel junta as duas versões: lançamentos dos dois lados são mantidos e o que foi apagado continua apagado.
- **Histórico.** O Drive guarda versões anteriores do arquivo (clique com o botão direito → Gerenciar versões).

## Sincronizar com o Google Drive

Uma vez só, uns 10 minutos. Você cria um pequeno script na sua conta Google que guarda o arquivo; o painel conversa com ele.

**1. Gere a chave.** No painel publicado, em *Seus dados*, toque em **Sincronizar com o Google Drive** e depois em **gerar**. Uma chave longa aparece e é copiada.

**2. Crie o script.** Abra [script.google.com](https://script.google.com) → **Novo projeto**. Apague o que estiver no editor e cole o conteúdo de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Na linha `const CHAVE = '...'`, troque o texto entre as aspas pela chave. Dê um nome ao projeto (ex.: *Painel finanças*) e salve com `Ctrl+S`.

**3. Autorize.** No topo do editor, escolha a função **testar** e clique em **Executar**. O Google vai pedir permissão:
escolha sua conta → **Avançado** → **Acessar Painel finanças (não seguro)** → **Permitir**.
O aviso aparece porque é um script seu que o Google não revisou; ele roda só na sua conta. No registro deve aparecer "Tudo certo" com o link do arquivo.

**4. Publique.** **Implantar** → **Nova implantação** → engrenagem → **App da Web**.
- Executar como: **Eu**
- Quem pode acessar: **Qualquer pessoa**

Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" quer dizer que o endereço atende pedidos de fora — é assim que o painel consegue falar com ele. Sem a chave certa, ele recusa tudo.

**5. Conecte o computador.** Cole o URL no painel, confira que a chave é a mesma e toque em **Conectar**. Aparece **Drive ✓** no topo.

**6. Conecte o celular.** No computador, toque em **Copiar link para o celular**, mande para você mesmo e abra no celular. Ele se conecta sozinho. Depois é só usar "Adicionar à tela inicial".

> O link carrega a chave: trate como senha. Mande só para você.

### Se não conectar

O painel mostra o motivo logo abaixo do botão **Conectar**. Os casos mais comuns:

| O painel diz | O que fazer |
|---|---|
| endereço de teste (/dev) | Use o **URL do app da Web**, que termina em `/exec` (Implantar → Gerenciar implantações). |
| O Google bloqueou a conversa | Em Gerenciar implantações, **Quem pode acessar** precisa ser **Qualquer pessoa** — não "Qualquer pessoa com Conta do Google". Abrir o `/exec` no seu navegador funciona mesmo com a opção errada, porque você está logado; o painel não está. |
| recusou a chave | A chave do painel e a da linha `const CHAVE` precisam ser iguais. Depois de colar, salve e publique uma **nova versão** (abaixo): a implantação guarda o código do momento em que foi feita. |
| não respondeu como o script | Confira se colou o URL certo e se o código é o do `Codigo.gs`; publique nova versão. |

Não rode `doPost` pelo editor (nem pela Depuração): ele só funciona quando o painel chama. Para autorizar, rode `testar`.

### Se alterar o script depois

Para manter o mesmo endereço: **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**. Criar uma *nova implantação* gera outro URL, e aí é preciso reconectar os aparelhos.

### Se a chave vazar

Gere uma nova no painel, troque no script, publique uma nova versão (acima) e reconecte os aparelhos. A chave antiga para de funcionar na hora.

## Levar os dados do Claude para cá

Se você já usava o painel dentro do Claude: lá, **Exportar cópia**; aqui, **Importar**. Os dados se juntam aos que já existirem.

## Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Painel de finanças"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/painel-financas.git
git push -u origin main
```

No repositório: **Settings → Pages → Deploy from a branch → main / (root)**. Em um minuto está em `https://SEU-USUARIO.github.io/painel-financas/`.

O repositório pode ser público: o código não contém chave nem endereço do seu script — isso fica guardado só nos seus aparelhos.

## Rodar na sua máquina

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

```
index.html              o painel inteiro: markup, estilo e lógica
apps-script/Codigo.gs   o script que guarda os dados no seu Drive
manifest.webmanifest    nome, cores e ícone para instalar no celular
sw.js                   cache offline, rede primeiro
icone-192.png, -512    ícone do app
logo.png, dragao.png   logo do topo e dragão do painel (máscaras)
```

## Licença

MIT.
