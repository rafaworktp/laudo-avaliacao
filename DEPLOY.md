# Deploy — LaudoAvaliacao

A arquitetura publicada tem duas partes:

- **Frontend estático** (GitHub Pages): `index.html`, `app.js`, `cliente.html`, `config.js`, `logo.png`.
- **Backend gerenciado** (Supabase): autenticação da engenheira, solicitações do cliente, laudos e comparáveis.

Não há servidor Node em produção. O `server.js` continua no repositório apenas como alternativa local/legada.

---

## 1. URLs

| Serviço | URL |
|---|---|
| Painel | `https://katgoulart66-debug.github.io/laudo-avaliacao/` |
| Formulário do cliente | `https://katgoulart66-debug.github.io/laudo-avaliacao/cliente.html?t=TOKEN` |
| Supabase | `https://vztgdmxjykipuzdovbld.supabase.co` |

---

## 2. Supabase

Projeto `laudo-avaliacao` — conta Kathleen Goulart, região `sa-east-1` (São Paulo), plano Free.

### Tabelas

| Tabela | Conteúdo |
|---|---|
| `solicitacoes_meta` | token, data, nome, contato, endereço, contagem de fotos/documentos, total de partes. |
| `solicitacao_partes` | conteúdo JSON do formulário do cliente, em partes de 700 KB. |
| `laudos_meta` | id, nome, status, data de atualização. |
| `laudo_partes` | conteúdo JSON do laudo, em partes de 700 KB. |
| `comparaveis` | banco único de comparáveis (JSONB). |

### Funções RPC

- `salvar_solicitacao_parte(p_token, p_parte, p_total, p_conteudo)`: grava uma parte; a parte 0 limpa partes antigas.
- `registrar_solicitacao(...)`: grava os metadados depois que todas as partes chegaram.

### RLS

- `anon`: sem leitura; só executa as duas RPCs acima.
- `authenticated`: lê/grava solicitações, laudos e comparáveis.
- `service_role`: só para administração; **nunca** no frontend.

### Chaves

- `anon` (pública): está em `config.js`.
- `service_role` (secreta): não versionar, não colocar no Pages, não enviar ao cliente.
- A senha do banco e a `service_role` ficam fora do repositório.

---

## 3. GitHub Pages

1. O repositório é público: `katgoulart66-debug/laudo-avaliacao`.
2. Pages está configurado em **Settings → Pages → Deploy from a branch → main / (root)**.
3. O arquivo `.nojekyll` evita processamento desnecessário.
4. Cada `git push` na `main` republica o site em cerca de 30–60 segundos.
5. O painel e o formulário usam caminhos relativos; funcionam na subpasta `/laudo-avaliacao/`.

### Atualizar

```bash
cd "C:\Users\Usuário\Documents\Projeto Padrão\LaudoAvaliacao"
git add .
git commit -m "ajustes"
git push
```

---

## 4. Login e senha

- E-mail: `kathleengoulart@hotmail.com`
- A senha inicial foi definida no provisionamento e **não** está no repositório.
- O painel abre em uma **tela de login dedicada**; “Continuar sem sincronizar” entra no modo local e grava essa escolha no navegador.
- **⋯ Mais → Entrar na nuvem** reabre o login; **⋯ Mais → Sair da nuvem** encerra a sessão.
- Troque em **⋯ Mais → Alterar senha** (usa a sessão autenticada e o Supabase Auth).
- Se precisar redefinir depois, use o dashboard do Supabase: **Authentication → Users → Reset password**.

---

## 5. Servidor Node (opcional)

Para usar o backend local em vez do Supabase:

1. Remova o bloco `supabase` de `config.js`.
2. Execute `node server.js` ou `iniciar.bat`.
3. Variáveis: `ADMIN_PASSWORD`, `PUBLIC_URL`, `PORT`.
4. Persistência: pasta `data/` (não versionada).
5. Para internet: Render/Railway/Fly/VPS com disco persistente e HTTPS, ou Docker:

```bash
docker build -t laudo .
docker run -d -p 8787:8787 -e ADMIN_PASSWORD=SUA_SENHA -e PUBLIC_URL=https://seu-dominio -v laudo-data:/app/data laudo
```

6. O `render.yaml` continua válido para o Render.

---

## 6. Segurança e LGPD

- HTTPS em todo o fluxo (GitHub Pages + Supabase).
- RLS impede leitura anônima das solicitações.
- O link do cliente é público, mas o token é aleatório; não divulgue tokens antigos.
- Fotos, documentos, CPF e telefone são dados pessoais: informe a finalidade no formulário e mantenha o consentimento LGPD.
- Apague solicitações antigas periodicamente.
- Ative 2FA no GitHub e no Supabase.
- Troque qualquer senha que tenha sido compartilhada em chat.
- Faça **⋯ Mais → Backup de todos** regularmente.

### Limites do plano Free

- 500 MB de banco, 5 GB de tráfego/mês.
- Projeto pausa após **7 dias sem uso**.
- Para produção contínua, considere o plano Pro e backups automáticos.

---

## 7. Checklist de publicação

- [x] Projeto Supabase criado e saudável.
- [x] Tabelas, RPCs e RLS aplicados.
- [x] Usuário da engenheira criado e confirmado.
- [x] Cliente → nuvem → painel testado.
- [x] Laudo com foto → partes → reconstrução testada.
- [x] Sincronização e exclusão testadas.
- [x] Leitura anônima bloqueada.
- [x] Layout v3 e tela de login testados (desktop/tablet, senha errada/correta e modo local).
- [ ] Frontend publicado na conta `katgoulart66-debug`.
- [ ] Repositório do Bruno removido.
- [ ] Trocar a senha inicial.
- [ ] Ativar 2FA no GitHub e no Supabase.
- [ ] Configurar backup/rotina de limpeza.
