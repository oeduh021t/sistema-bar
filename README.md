# 📊 Sistema Bar - SaaS Multi-tenant

Um sistema de backend robusto, escalável e multi-tenant desenvolvido para gerenciamento de bares, restaurantes e controle de contas de fiado. O projeto utiliza uma arquitetura segura onde os dados de cada estabelecimento são completamente isolados através de Tokens JWT.

## 🚀 Tecnologias Utilizadas

* **Node.js** com **TypeScript**
* **Express** (Framework HTTP)
* **Prisma Client & Prisma v6** (ORM)
* **PostgreSQL** (Banco de dados rodando via Docker)
* **JWT (JSON Web Token)** (Autenticação e controle de acesso RBAC)
* **Bcrypt** (Criptografia de senhas)
* **Zod** (Validação estrita de dados e schemas)

---

## 🔒 Arquitetura de Segurança & Multi-tenancy

O sistema implementa **Multi-tenancy** no nível do banco de dados utilizando a coluna `bar_id` em todas as tabelas transacionais. 
* **Segurança na Entrada:** O sistema **não confia** no `bar_id` enviado pelo corpo da requisição (`req.body`). 
* **Validação por Token:** Um middleware intercepta a requisição, valida a assinatura digital do JWT e extrai o `bar_id` diretamente do payload criptografado.
* **RBAC (Role-Based Access Control):** Rotas administrativas (como cadastro de produtos e abertura de mesas) são bloqueadas para a função `GARCOM` e permitidas apenas para usuários com a flag `DONO`.

---

## 🛠️ Módulos Concluídos (Backend)

### 🔑 Autenticação & Usuários
* `POST /auth/registrar` -> Cadastro de novos usuários (Dono/Garçom).
* `POST /auth/login` -> Validação com Bcrypt e emissão do Token JWT (Expiração em 1 dia).

### 📦 Estoque & Produtos
* `GET /produtos` -> Lista os produtos do bar logado (Filtro automático via Token).
* `POST /produtos` -> Cadastro de novos itens com validação de dados via Zod (Apenas Dono).

### 📝 Módulo de Mesas & Pedidos
* `POST /mesas` -> Cadastro de novas mesas físicas (Apenas Dono).
* `POST /mesas/status` -> Altera o estado da mesa (LIVRE/OCUPADA).
* `POST /mesas/pedido` -> Lança itens na mesa com **baixa automatizada e atômica no estoque** (usando `$transaction`).

### 💸 Módulo de Fiado & Fechamento
* `POST /clientes-fiado` -> Cadastro de clientes autorizados a "pendurar" contas com limite de crédito.
* `POST /fiado/movimentacao` -> Lançamento manual de débitos ou abates de créditos.
* `POST /mesas/fechamento` -> Encerra o consumo da mesa. Se a forma de pagamento for `FIADO`, valida o limite disponível do cliente, gera o histórico de débito e libera a mesa de forma atômica.

### 📊 Dashboard & Business Intelligence
* `GET /relatorios/dashboard` -> Painel gerencial (Apenas Dono) exibindo Faturamento Líquido, Total de Recebidos, Faturamento Potencial do Salão e o Top 5 de Clientes Inadimplentes ordenados por dívida.
