# Finanças da Telma

Controle simples de gastos em HTML, CSS e JavaScript puro. Não tem servidor nem conta: os dados ficam guardados **só no navegador** de cada aparelho (localStorage) e não sincronizam sozinhos entre celular e computador.

## Como usar
- Abra o site publicado ou dê dois cliques em `index.html`.
- **Levar os dados para outro aparelho:** no fim da página, toque em **Enviar link com os dados** e mande o link pelo WhatsApp. Os dados vão depois do `#` do link, parte que o navegador não envia ao GitHub. Quem abrir o link vê tudo, então envie só para quem pode ver.
- **Backup:** no fim da página, **Salvar backup** baixa um `.json`, e **Abrir backup** restaura esse arquivo (pede confirmação antes de substituir).

## Publicação
O repositório tem só a interface. Os dados (`dados-telma.json` e os backups) ficam fora do Git por causa do `.gitignore`. O site publicado abre vazio até receber um link ou backup.
