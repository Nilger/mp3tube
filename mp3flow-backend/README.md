# mp3flow-backend

Serviço separado que faz a extração de áudio de verdade (`yt-dlp` + `ffmpeg`) e
guarda os arquivos convertidos em disco persistente, com expiração automática.
Não roda no Cloudflare Workers/Lovable — precisa de um host com Node.js completo,
permissão para rodar processos (Docker) e um volume persistente.

## Rodando localmente

```bash
cp .env.example .env
# edite .env e defina API_SECRET com um valor aleatório:
openssl rand -hex 32
mkdir -p ./data   # simula o volume localmente

docker build -t mp3flow-backend .
docker run --env-file .env -e DATA_DIR=/data/files -v "$(pwd)/data:/data/files" -p 8080:8080 mp3flow-backend
```

Teste:

```bash
curl -X POST http://localhost:8080/convert \
  -H "x-api-key: SEU_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=SEU_VIDEO_ID"}'
# devolve JSON: { "id", "title", "duration", "url": "/files/<id>.mp3?t=<token>" }
# baixe com: curl -o teste.mp3 "http://localhost:8080/files/<id>.mp3?t=<token>"
```

## Deploy no Railway (mais simples)

1. Crie um repositório Git só para esta pasta (`mp3flow-backend`) e suba pro GitHub.
2. Em https://railway.app → **New Project → Deploy from GitHub repo** → selecione o repo.
   Railway detecta o `Dockerfile` automaticamente.
3. **Adicione um Volume**: na aba do serviço → **Volumes → New Volume** → monte em `/data/files`.
   Sem isso os arquivos somem a cada redeploy.
4. Em **Variables**, adicione:
   - `API_SECRET` = o valor aleatório que você gerou
   - `ALLOWED_ORIGIN` = a URL pública do seu site Lovable (ex: `https://mp3flow.lovable.app`)
   - `DATA_DIR` = `/data/files` (mesmo caminho do volume)
   - `RETENTION_DAYS` = `7` (ou o que preferir)
5. Railway vai te dar uma URL pública tipo `https://mp3flow-backend-production.up.railway.app`.
   Essa é a `VITE_BACKEND_URL` que você vai usar no front-end.

## Como funciona o armazenamento

- Cada conversão gera um arquivo em `DATA_DIR/<id>.mp3` e uma entrada num índice
  (`DATA_DIR/index.json`) com título, duração e um **token de acesso aleatório**
  (não é o `API_SECRET`).
- O link devolvido (`/files/<id>.mp3?t=<token>`) é o que fica salvo no histórico do
  navegador — funciona sem precisar de header customizado, o que permite usá-lo
  direto em `<audio>` e em downloads.
- Uma rotina roda a cada hora e apaga arquivos com mais de `RETENTION_DAYS` dias.
  Isso existe tanto por espaço em disco quanto para não acumular indefinidamente
  cópias de conteúdo protegido — mantenha esse valor baixo.
- O botão "excluir" no site chama `DELETE /files/:id` (autenticado com `API_SECRET`)
  e apaga o arquivo na hora, sem esperar a expiração.

## Notas importantes

- `API_SECRET` não é autenticação de usuário — é só para o backend recusar
  requisições de `/convert` e `DELETE /files/:id` que não vieram do seu front-end.
- O token por arquivo (`?t=...`) é o que protege os links de download/streaming —
  qualquer pessoa com o link completo consegue baixar aquele arquivo específico até
  ele expirar. Não compartilhe esses links.
- Há um rate limit simples em memória (6 requisições/minuto por IP) só em `/convert`.
- Vídeos live e vídeos acima de `MAX_DURATION_SECONDS` são rejeitados.
- yt-dlp é atualizado frequentemente porque o YouTube muda seu player; se as
  conversões começarem a falhar do nada, rebuild a imagem Docker (o Dockerfile
  sempre baixa a versão "latest" do yt-dlp no build).
