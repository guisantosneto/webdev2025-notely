# Notely - Web Development 2025

**Curso:** Web Development 2025 - Universidade de Coimbra  
**Projeto:** Aplicação de Notas Autocolantes (Sticky Notes)  
**Autores:** Vicente e Guilherme

---

## 1. Descrição do Projeto

O **Notely** é uma aplicação de gestão de notas pessoais e partilhadas, desenvolvida com o objetivo de replicar a experiência de "sticky notes" num ambiente digital. O sistema permite aos utilizadores criar, editar, colorir e posicionar livremente as notas no ecrã.

A aplicação foi construída seguindo a arquitetura de **Single Page Application (SPA)**, capaz de funcionar tanto num navegador web convencional como numa aplicação desktop nativa.

**Tecnologias Utilizadas:**
* **Backend:** Node.js (utilizando apenas o módulo nativo `http`, sem frameworks como Express).
* **Base de Dados:** MongoDB (para persistência de utilizadores, tópicos e notas).
* **Desktop:** Electron (para encapsular a aplicação web numa janela nativa).
* **Frontend:** HTML, CSS e JavaScript (Vanilla).

**Funcionalidades Principais:**
* Autenticação de utilizadores (Registo e Login).
* Criação de múltiplos Tópicos de notas.
* **Sistema de Partilha:** Possibilidade de colaborar em tópicos através de um "Share Code" único.
* Manipulação de notas: Criar, Editar, Apagar e Arrastar (drag & drop) para organizar visualmente.

---

## 2. Instruções de Instalação e Execução

Para executar este projeto, é necessário ter instalado o [Node.js](https://nodejs.org/) e o [MongoDB](https://www.mongodb.com/).

### Passo 1: Configuração da Base de Dados (MongoDB)

Certifique-se de que o serviço do MongoDB está ativo na porta padrão `27017`.

**Importar Dados Iniciais (Dataset):**
Para inicializar a aplicação com dados de exemplo, utilize o comando `mongoimport` com o ficheiro fornecido no repositório (ex: `dataset.json`):

```bash
# Exemplo de comando para importar a coleção de utilizadores, notas e tópicos
mongoimport --db notely_db --collection users --file dataset_users.json --jsonArray
mongoimport --db notely_db --collection notes --file dataset_notes.json --jsonArray
mongoimport --db notely_db --collection topics --file dataset_topics.json --jsonArray
