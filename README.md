# LaudoAvaliacao — sistema de laudo de avaliação imobiliária

Aplicação web para elaborar laudos de avaliação de imóveis urbanos pelo método comparativo direto (NBR 14653-1:2019 / NBR 14653-2:2011), com:

- **cálculo automático** por fatores ou por regressão linear (OLS);
- **link do cliente** com formulário online;
- **nuvem Supabase** para receber solicitações, guardar laudos e comparáveis;
- banco de comparáveis reutilizável;
- conferência normativa, memória de cálculo, hash de integridade e PDF por impressão.

---

## Acesso

| Item | Endereço |
|---|---|
| Painel | `https://rafaworktp.github.io/laudo-avaliacao/` |
| Formulário do cliente | gerado em **Link do cliente** |
| Backend | Supabase — projeto `laudo-avaliacao`, região `sa-east-1` (São Paulo) |

**Login do painel:** e-mail `kathleengoulart@hotmail.com` + senha definida no provisionamento.
O painel abre em uma **tela de login dedicada** (e-mail fixo + senha). Use **Continuar sem sincronizar**
para trabalhar só neste navegador; depois, **⋯ Mais → Entrar na nuvem**.
Troque a senha em **⋯ Mais → Alterar senha**.

> A senha **não** fica no código nem no GitHub. A chave `anon` do Supabase é pública por
> projeto e só permite o envio do formulário; a leitura dos dados exige login (RLS).

---

## 1. Uso diário

1. Abra o painel e entre com a senha.
2. Preencha o laudo ou importe uma solicitação do cliente.
3. Clique em **Calcular tudo**, confira a **Conferência** e gere o **PDF**.
4. Para o cliente: **Link do cliente** → copie e envie.
5. Quando o cliente preencher: **⋯ Mais → Solicitações online** → escolha e importe.
6. Em outro computador: **⋯ Mais → Sincronizar** baixa os laudos da nuvem.

### Modo local (sem internet)

O `server.js` continua disponível como alternativa. Para usá-lo:

1. Remova ou comente o bloco `supabase` em `config.js`.
2. Execute **`iniciar.bat`** (ou `node server.js`).
3. Acesse `http://127.0.0.1:8787/index.html`.
4. Senha padrão: `laudo123`; para trocar, defina `ADMIN_PASSWORD` antes de iniciar.

No modo local, o cliente precisa estar na mesma rede ou usar um túnel/HTTPS.

---

## 2. Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Painel do engenheiro (layout moderno, laudo, cálculos, conferência, PDF). |
| `app.js` | Motor de cálculo, OLS, persistência, layout, link, importação e banco de comparáveis. |
| `cliente.html` | Formulário público do cliente (dados, fotos, documentos, LGPD). |
| `config.js` | Empresa, engenheiro, cidade, WhatsApp e credenciais públicas do Supabase. |
| `logo.png` | Logo da engenheira (sidebar, hero, timbre e formulário do cliente). |
| `server.js` | Servidor Node.js opcional (modo local/legado). |
| `iniciar.bat` | Atalho para Windows: sobe o servidor local e abre o painel. |
| `Dockerfile` | Imagem opcional para Render/Railway/Fly/VPS. |
| `DEPLOY.md` | Guia de publicação e infraestrutura. |
| `README.md` | Este guia. |

---

## 3. Publicação e infraestrutura

### Frontend — GitHub Pages

- Repositório: `https://github.com/rafaworktp/laudo-avaliacao` (público).
- Pages: branch `main`, pasta raiz (`/`).
- Para atualizar: `git add .`, `git commit -m "..."`, `git push`. O Pages republica sozinho.
- Arquivos estáticos: `index.html`, `app.js`, `cliente.html`, `config.js`, `logo.png`.
- Não há segredo no repositório. A chave `anon` é pública por design.

### Backend — Supabase

- Projeto: `laudo-avaliacao` (`vztgdmxjykipuzdovbld`), região `sa-east-1`.
- Tabelas: `solicitacoes_meta`, `solicitacao_partes`, `laudos_meta`, `laudo_partes`, `comparaveis`.
- Funções RPC: `salvar_solicitacao_parte`, `registrar_solicitacao`.
- RLS:
  - `anon` só executa as RPCs de envio do formulário;
  - `authenticated` (login da engenheira) lê e grava solicitações, laudos e comparáveis;
  - leitura anônima retorna vazio; escrita anônima é bloqueada.
- Fotos e PDFs grandes são divididos em partes de **700 KB**, evitando limites de payload.
- A chave `service_role` **nunca** vai para o frontend.

### Servidor Node (opcional)

Se preferir hospedar o `server.js`:

1. Envie a pasta para Render/Railway/Fly/VPS ou use o `Dockerfile`.
2. Configure `ADMIN_PASSWORD`, `PUBLIC_URL` e um disco persistente em `/app/data`.
3. Remova o bloco `supabase` de `config.js` para o painel usar a API local.
4. Use HTTPS.

---

## 4. Cálculo automático — “inseriu os dados, sai o cálculo”

O botão **Calcular tudo** executa a cadeia inteira:

1. Sincroniza os comparáveis com a homogeneização e os detalhes.
2. Preenche automaticamente:
   - `Fo` (0,90 para oferta; 1,00 para venda);
   - `Fa` (área, expoente 0,20 para terreno e 0,125 para construção);
   - `Fc` (Ross-Heidecke: conservação/idade do comparável em relação ao avaliando);
   - `Fp` (padrão construtivo);
   - `Fl` e `Ft` (1,00; revise se houver dado específico).
3. Calcula `qh`, média, desvio, CV, IC 80%, campo de arbítrio e intervalo admissível.
4. Se houver dados suficientes, roda a **regressão OLS** e seleciona as variáveis significativas.
5. Preenche o valor central, o valor final, o valor unitário, os graus e a memória.
6. Mostra um resumo do resultado.

Os fatores automáticos são **sugestões técnicas**. O painel de conferência e a memória mostram o que foi usado; o engenheiro pode sobrescrever qualquer campo.

### Base do valor unitário

- **Terreno:** preço ÷ área do terreno.
- **Construção:** preço ÷ área construída.
- **Automática:** terreno para “Terreno/Lote/Gleba”; construção para “Casa/Apartamento/Sala/Galpão”.

### Graus e precisão

- Precisão: IC 80% **original** (nunca o campo de arbítrio).
- Intervalo admissível: interseção entre IC e campo de arbítrio (±15%).
- Fatores: 4 itens, 10/6/4 pontos, itens 2 e 4 obrigatórios.
- Regressão: 6 itens, 16/10/6 pontos, itens 2/4/5/6 obrigatórios e pré-requisitos 9.2.1.1.
- Extrapolação: nenhuma no grau III; uma variável até 15% no II; até 20% no I.
- Micronumerosidade: 3 / 10% de n / 10 por categoria.
- Saneamento: Chauvenet, com motivo e recálculo de n.

---

## 5. Regressão OLS interna

A seção **7.4.4.4** mostra a matriz gerada a partir dos comparáveis e dos detalhes.

- Variável dependente: **VU (R$/m²)**.
- Variáveis candidatas: área, idade, padrão, conservação, esquina e distância.
- Modelos: linear, semilog (`ln VU`) e log-log.
- O sistema calcula:
  - coeficientes, erros-padrão, t, p e VIF;
  - R², R² ajustado, F, p(F), erro-padrão e Durbin-Watson;
  - resíduos, alavancagem e distância de Cook;
  - previsão do avaliando e IC 80% em reais.
- Seleção **backward**: variáveis com p > 10% são removidas uma a uma; a memória registra as removidas.
- O grau da regressão é calculado na seção 8.1.1; se faltar um pré-requisito, o grau é limitado.

### Detalhes dos comparáveis

Preencha a tabela **5.0.1** (idade, conservação 1–5, esquina, topografia, distância) na mesma ordem da tabela 5. Esses dados alimentam o OLS e o fator de conservação.

> Se a matriz for singular (variáveis colineares), o sistema avisa e o cálculo automático cai para fatores. Preencha mais variáveis ou remova dados redundantes.

---

## 6. Link do cliente e envio online

1. **Link do cliente** gera uma URL com token, engenheiro, empresa, cidade e WhatsApp.
2. O cliente abre `cliente.html`, preenche, anexa fotos/documentos e aceita a LGPD.
3. Clique em **Enviar online**. O cliente recebe um protocolo.
4. No painel, use **⋯ Mais → Solicitações online** para listar e importar.
5. O laudo é criado com os dados, fotos e documentos; os anexos podem ser baixados.
6. O consentimento LGPD fica registrado nas observações.

> O envio online usa o Supabase e funciona mesmo que o computador da engenheira esteja desligado.
> Sem internet, o cliente ainda pode baixar o `.json` e enviar por WhatsApp/e-mail.

### Privacidade

- O link é público, mas o token é aleatório.
- O cliente anônimo **não consegue listar nem ler** outras solicitações.
- Os dados ficam em região brasileira (São Paulo) e trafegam por HTTPS.
- Para LGPD, informe a finalidade, mantenha o consentimento e apague solicitações antigas.

---

## 7. Banco de comparáveis

- **Salvar comparáveis no banco:** guarda os comparáveis atuais (com os detalhes de regressão) no navegador e na nuvem.
- **Carregar comparáveis do banco:** traz os comparáveis para o laudo atual, sem duplicar.
- O banco é compartilhado entre laudos e sincroniza via tabela `comparaveis`.

---

## 8. Persistência, backup e sincronização

- **Local:** cada navegador guarda os laudos no `localStorage`.
- **Nuvem:** laudos e solicitações são gravados em partes de 700 KB no Supabase.
- **Sincronizar:** baixa laudos mais novos e envia os locais mais novos.
- **Salvar:** o botão **Salvar** envia o laudo para a nuvem (o autosave mantém apenas a cópia local, para não gastar dados).
- **Solicitações:** metadados em `solicitacoes_meta`; conteúdo em `solicitacao_partes`.
- **Backup:** **⋯ Mais → Backup de todos** baixa um JSON com todos os laudos locais.
- **Excluir laudo:** remove do navegador e da nuvem (com confirmação).

### Limites do plano gratuito do Supabase

- 500 MB de banco, 5 GB de tráfego e pausa do projeto após **7 dias sem uso**.
- Para uso profissional contínuo, considere o plano Pro e configure backup/alertas.
- Fotos e PDFs grandes consomem espaço; faça limpeza periódica de solicitações antigas.

---

## 9. Segurança

- Troque a senha do painel em **⋯ Mais → Alterar senha**.
- Ative 2FA na conta Supabase e no GitHub.
- Não compartilhe a chave `service_role`; ela não está no frontend.
- Use HTTPS (GitHub Pages e Supabase já fornecem).
- Faça backup regular (**Backup de todos**).
- O sistema é single-tenant: um login por escritório/empresa.
- Se uma senha foi compartilhada em conversa, troque-a.

---

## 10. Layout e uso

- **Tela de login dedicada**: painel azul-marinho, cartão de acesso, senha com mostrar/ocultar e opção de modo local.
- Painel com **sidebar azul-marinho**, topbar, barra de contexto (laudo/status), cartões e tabelas compactas.
- Identidade visual inspirada em dashboards SaaS profissionais (Tabler) e na identidade da GestãoClick:
  azul-marinho, azul vivo, cartões arredondados e tipografia Plus Jakarta Sans.
- **Logo** no sidebar, na tela de login, no timbre impresso e no formulário do cliente.
- Cards por seção, tabelas compactas, fórmulas em bloco técnico.
- Barra superior com ações principais; ações secundárias em **⋯ Mais**.
- Layout responsivo: em telas menores, o menu de seções vira um seletor.
- Impressão A4: sem sidebar/topbar, com timbre, cabeçalho, tabelas, memória de cálculo e hash.
- **Gerar PDF:** escolha “Salvar como PDF”, A4 e “Elementos gráficos de plano de fundo”.

### Trocar a logo

Substitua `logo.png` por outra imagem **quadrada**, de preferência com fundo transparente e a marca centralizada. A imagem é usada automaticamente no sidebar, na tela de login, no timbre e no formulário do cliente.

### Hash de integridade

- **Gerar hash SHA-256** calcula o hash do conteúdo atual (sem o próprio campo).
- O hash é impresso no laudo e pode ser conferido contra o JSON.
- **Não é assinatura ICP-Brasil/PAdES.** Para assinatura legal, integre um provedor de certificado (ex.: Vidaas/ICP-Brasil) e PDF/A.

---

## 11. O que ainda depende de terceiros

- **PAdES/ICP-Brasil:** exige certificado e provedor; o sistema entrega hash e espaço para assinatura externa.
- **CUB e índices:** o CUB é informado manualmente (mês/fonte); índices podem ser informados como fator. A atualização automática exige uma fonte/API contratada.
- **PDF determinístico:** hoje é gerado pela impressão do navegador. Para PDF/A com paginação fixa, usar uma biblioteca/serviço de PDF.
- **Multiusuário com perfis:** hoje há um login. Para equipe com papéis, criar usuários e políticas RLS por perfil.

---

## 12. Testes realizados

- Fatores: 5 comparáveis → média 2.013,33; s 29,82; IC 1.992,89–2.033,78; amplitude 2,0% → precisão III.
- Fatores: 12 comparáveis com fatores automáticos → valor final calculado e grau II.
- OLS: 12 comparáveis, seleção backward (área; idade/esquina removidas por p > 10%) → R² 0,9248; F 122,99; previsão R$ 405.216,78; IC 400.060,17–410.373,40; precisão III; fundamentação II.
- Regressão: 18 pontos, itens 2/4/5/6 em III e 9.2.1.1 completo → III; sem um pré-requisito → II.
- Extrapolação: 350 m² contra amostra 100–300 m², desvio 10% → item 4 grau II.
- Micronumerosidade: n = 5, ni = 2 → mínimo 3 → alerta.
- Chauvenet: [1000, 1010, 990, 1005, 1500] → 1500 excluído; n = 4; média 1.001,25.
- Ross-Heidecke: R$ 200.000, 30/60 anos, estado 2,5 → Kd 42,56%; depreciado R$ 114.887,50.
- Extenso: R$ 1.000.001,00 → “um milhão e um real”.
- Nuvem: cliente preenche → `Enviar online` → protocolo; painel lista e importa; campos conferidos.
- Nuvem: laudo com foto de 713 KB → 2 partes no Supabase; leitura/reconstrução exata.
- Sincronização: 2 laudos baixados, 0 reenviados após normalização de datas; exclusão remove metadados e partes.
- RLS: leitura anônima retorna vazio; escrita anônima é bloqueada (`401`).
- Login: tela dedicada; senha errada mostra erro inline; senha correta entra; modo local persiste após recarregar.
- Layout: sidebar azul-marinho, topbar, cartões e login dividido; cliente com cabeçalho claro e formulário em cards.
- Responsivo: em telas menores, o menu de seções vira um seletor e as ações secundárias ficam em “Mais”.
- Impressão: timbre com logo, números de seção, sem sidebar/topbar, A4.

---

## 13. Referências normativas

- ABNT NBR 14653-1:2019 — procedimentos gerais.
- ABNT NBR 14653-2:2011 — imóveis urbanos.
- IBAPE/SP — Norma para avaliação de imóveis urbanos (2011).
- NBR 12721 / CUB — custos de construção.
- CPC art. 473 — laudo judicial (quando aplicável).
- LGPD — Lei 13.709/2018.

---

## 14. Aviso

Ferramenta de apoio. O laudo deve ser elaborado, conferido e assinado por profissional habilitado (engenheiro civil/arquiteto com ART/RRT). Confirme sempre a edição vigente das normas e a responsabilidade técnica pelo resultado.
