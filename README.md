# Notely - Web Development 2025

**Curso:** Desenvolvimento Web 2025 – Universidade de Coimbra  
**Autores:** Vicente e Guilherme

---

## ⚠️ AVISO IMPORTANTE: REDE DO DEI ⚠️

Para executar esta aplicação, é **OBRIGATÓRIO** estar ligado à rede do **DEI (Departamento de Engenharia Informática)** ou via **VPN da Universidade de Coimbra**.

O ficheiro `main.js` do Electron e o servidor estão configurados para comunicar através do endereço IP fixo:


Se não estiver conectado a esta rede, a aplicação (tanto a versão **Web** como **Desktop**) **não irá carregar**.

---

## 1. Descrição do Projeto

O **Notely** é uma aplicação de *sticky notes* (notas autocolantes) desenvolvida como projeto final da disciplina de **Desenvolvimento Web**.

O seu objetivo é permitir que grupos de utilizadores criem, editem e organizem notas em tempo real num **quadro virtual partilhado**.

A aplicação foi desenvolvida como uma **SPA (Single Page Application)**, funcionando tanto no **browser** como numa **aplicação desktop nativa** através de Electron.

### Funcionalidades Principais

- Autenticação de utilizadores (Registo e Login)
- Criação e edição de notas
- Posicionamento livre das notas (Drag & Drop)
- Organização por **Tópicos**
- Partilha de tópicos entre utilizadores através de **códigos únicos**

---

## 2. Instalação de Dependências e Configuração

Antes de iniciar, certifique-se de que tem instalados:

- **Node.js**
- **MongoDB**

---

### 2.1 Configuração da Base de Dados (MongoDB)

Certifique-se de que o serviço do MongoDB está a correr na porta padrão:


Para importar os dados iniciais, execute os seguintes comandos (garantindo que os ficheiros `.json` se encontram na pasta correta):

```bash
mongoimport --db notely_db --collection users --file dataset_users.json --jsonArray
mongoimport --db notely_db --collection notes --file dataset_notes.json --jsonArray
mongoimport --db notely_db --collection topics --file dataset_topics.json --jsonArray

```
---

### 2.2 Instalação das Bibliotecas

Abra o terminal na pasta server/ do projeto e execute:

cd server
npm install

---

### 3. Iniciar o Servidor (Backend & Web App)

O servidor Node.js é essencial para o funcionamento da aplicação e deve ser sempre o primeiro a ser iniciado.

Abra um terminal na pasta server/

Execute o comando:

node server.js


O servidor ficará ativo e poderá aceder à versão Web da aplicação através do navegador em:

👉 http://10.17.0.29:3000/

---

### 4. Iniciar a Aplicação Electron (Desktop)

Para utilizar a versão desktop nativa da aplicação:

Mantenha o terminal do servidor a correr

Abra um novo terminal na pasta server/

Execute o comando:

npm start


Este comando irá iniciar a aplicação Electron, configurada para aceder automaticamente ao endereço:

http://10.17.0.29:3000

---

### 5. Instruções de Utilização da Aplicação
Registo e Login

Utilize o ecrã inicial para criar uma conta ou iniciar sessão.

Criar Notas

Clique no botão + para adicionar uma nova nota ao quadro.

Editar Notas

Clique diretamente no texto da nota para editar o conteúdo.
As alterações são guardadas automaticamente ao sair do campo de texto.

Mover Notas

Arraste a nota pela barra superior para alterar a sua posição (coordenadas X e Y).

Partilha de Tópicos

Crie um novo Tópico na barra lateral

Copie o Share Code apresentado (exemplo: F7A29B)

Envie esse código ao seu colega

O colega deve clicar em Join Topic e inserir o código

Após isso, ambos poderão ver e editar as mesmas notas em tempo real.
