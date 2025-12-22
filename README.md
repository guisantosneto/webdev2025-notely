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

## 3. Iniciar o Servidor (Backend & Web App)

O servidor Node.js é central para o funcionamento da app e deve ser sempre **o primeiro a ser iniciado**.

1.  Abra o terminal na pasta `server/`.
2.  Execute o comando:
    ```bash
    node server.js
    ```
3.  O servidor ficará ativo. Pode testar o acesso via Web no endereço:
    👉 **http://10.17.0.29:3000/**

---

## 4. Instalar e Iniciar a Aplicação Electron (Desktop)

Para utilizar a versão desktop nativa, deve utilizar o executável fornecido.

**Passos para instalação:**

1.  **Download do Executável:**
    Descarregue o ficheiro de instalação `notely.exe` através do link oficial do projeto:
    👉 **[Download notely.exe (Google Drive)](https://drive.google.com/file/d/1U4uSeWWtR9px4rlIOkxcDeIrOZ1Lh_E2/view?usp=sharing)**

2.  **Execução:**
    Certifique-se de que o servidor (Passo 3) está a correr. De seguida, instale/execute o ficheiro `notely.exe`.

3.  **Utilização:**
    A aplicação irá abrir uma janela nativa conectada automaticamente ao servidor do projeto.

*(Nota: Como alternativa para desenvolvimento, se tiver o código fonte, também pode executar `npm start` na pasta server, mas o método preferencial é o executável acima).*

---

## 5. Instruções de Utilização da App

* **Registo e Login:** Utilize o ecrã inicial para criar conta ou entrar.
* **Criar Notas:** Clique no botão `+` para adicionar uma nota ao quadro.
* **Editar:** Clique no texto da nota para alterar o conteúdo. As alterações são salvas ao sair do campo de texto.
* **Mover:** Arraste a nota pela barra superior para mudar a sua posição `(X, Y)`.
* **Partilha (Tópicos):**
    * Crie um novo Tópico na barra lateral.
    * Copie o **Share Code** apresentado (ex: `F7A29B`) e envie ao seu colega.
    * O colega deve usar o botão "Join Topic" e inserir esse código para ver e editar as mesmas notas.
