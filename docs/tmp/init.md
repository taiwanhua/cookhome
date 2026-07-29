我接下來，要嘗試使用 ai 搭建整個食譜專案，

專案架構上，
我想要使用 turboRepos 做 monorepos 

npx create-turbo@latest -e kitchen-sink

應該會建出這幾個 app，我希望他們分別做為以下用途:

api: 後端 API server，front admin 都會打這個服務
storefront: 專案前台前端，幫我改名為 front，相關配置也幫我改正確，之後不會使用  API Routes
admin: 後台前端
blog: 我不需要這個請幫我刪除


還會建出這幾個 package :

@repo/eslint-config
@repo/jest-presets 
@repo/logger 
@repo/ui 
@repo/typescript-config 

接下來，幫我調整後端 api 的架構:

使用 nestjs 框架 Express and Apollo (npm i @nestjs/graphql @nestjs/apollo @apollo/server @as-integrations/express5 graphql)
並且使用 Prisma ORM v6.19，與 MongoDB，
記得要搭配 @graphql-codegen 與 @graphql-codegen/typescript-react-query 來生成前端的 typescript hooks，方便前端使用。

在幫我調整前端的 storefront 與 admin 套件架構:

要搭配 graphql-request 與 TanStack Query 使用
 