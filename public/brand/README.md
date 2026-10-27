# Arquivos da marca Kombexa

Esta pasta recebe os **arquivos oficiais** da marca Kombexa (a plataforma). Ainda não há arquivos
oficiais no repositório: o sistema usa um **monograma provisório** (um "K" carvão em um quadrado
laranja `#FF4B1F`), desenhado em `components/Brand.tsx`, `app/icon.svg` e nos ícones PNG do PWA.
Ele não é o logotipo definitivo.

## Quando os arquivos oficiais chegarem

1. Coloque aqui, por exemplo:
   - `kombexa-simbolo.svg`: só o símbolo, quadrado (menu, login, cabeçalhos).
   - `kombexa-logo.svg`: símbolo + nome, horizontal (documentação, materiais).
2. Defina `NEXT_PUBLIC_KOMBEXA_LOGO=/brand/kombexa-simbolo.svg` no `.env` e refaça o build.
3. Substitua os ícones do app: `app/icon.svg` (favicon), `app/apple-icon.png` (180×180),
   `public/icon-192.png`, `public/icon-512.png` e `public/icon-maskable-512.png` (com margem de
   segurança de 10% para a máscara do Android).

## Não confundir com a logo da academia

A logo de cada academia é enviada pelo responsável em **Configurações → Identidade visual** e
fica no banco de dados (tabela `academy_logos`). Ela encabeça os documentos da academia (ficha,
contrato, recibo). A marca Kombexa aparece nesses documentos só no rodapé, como sistema emissor.
