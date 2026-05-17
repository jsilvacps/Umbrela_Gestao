# Como gerar o instalador .exe (Windows)

## Pré-requisitos
- Node.js 18+ instalado
- npm install já executado

## Gerar o instalador

```bash
npm run electron:build
```

Este comando:
1. Roda `next build` (compila o app)
2. Copia os arquivos estáticos para `.next/standalone/`
3. Empacota tudo com electron-builder
4. Gera o instalador em `dist-electron/HortiGestao-PDV-Setup-1.0.0.exe`

## Testar sem instalar (mais rápido)

```bash
npm run electron:pack
```

Gera uma pasta `dist-electron/win-unpacked/` com o exe já pronto, sem criar o instalador.

## Desenvolvimento local

```bash
npm run electron:dev
```

Abre o PDV em uma janela Electron enquanto o Next.js dev server roda em paralelo.

---

# Como acessar o ADM pelo celular (deploy web)

## Deploy na Vercel (gratuito)

1. Crie uma conta em https://vercel.com
2. Conecte ao repositório GitHub do projeto
3. Na Vercel, adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL` = (valor do .env.local)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (valor do .env.local)
4. Clique em Deploy
5. A URL gerada (ex: `horti-gestao.vercel.app`) abre direto no /adm

## Ou via Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

Responda as perguntas e seu app estará online em minutos.

---

# Arquitetura offline/online

```
CAIXA (.exe Electron)
├── Produtos carregados do IndexedDB (instantâneo, funciona offline)
├── Vendas → tenta Supabase primeiro
│   ├── Se online: grava direto, debita estoque, atualiza fiado
│   └── Se offline: salva na fila local (IndexedDB) + debita estoque local
└── Ao reconectar: sincroniza automaticamente todas as vendas pendentes

SUPABASE (nuvem)
└── Fonte de verdade — todos os dados chegam aqui

ADM WEB (Vercel)
└── Dono acessa pelo celular — vê vendas, produtos, relatórios em tempo real
```
