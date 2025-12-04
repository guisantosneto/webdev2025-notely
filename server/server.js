// server/server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb'); 

// --- Configurações ---
const PORT = 3000;
const DB_URI = 'mongodb://localhost:27017'; 
const DB_NAME = 'notely_db'; 

let db; // Variável global para armazenar a conexão à Base de Dados

// Função Principal que Lida com a Conexão à BD e Inicia o Servidor
async function startServer() {
    try {
        // --- 1. Conexão MongoDB ---
        const client = new MongoClient(DB_URI);
        await client.connect();
        
        db = client.db(DB_NAME); 
        console.log(`✅ Conectado com sucesso ao MongoDB: ${DB_NAME}`);

        // --- INSERÇÃO DE TESTE (Verificação inicial) ---
        const notesCollection = db.collection('notes');
        const count = await notesCollection.countDocuments({});
        
        if (count === 0) {
            const testNote = {
                title: "Nota de Teste Inicial",
                content: "Esta nota existe para garantir que a BD aparece no Compass.",
                color: "yellow",
                topic: "Geral",
                createdAt: new Date()
            };
            const result = await notesCollection.insertOne(testNote);
            console.log(`💾 Documento de teste inserido com sucesso: ID ${result.insertedId}`);
        }
        // ------------------------------------------------------------------

        // --- 2. Iniciar o Servidor HTTP ---
        // Alterado de (req, res) para (request, response) como pedido
        const server = http.createServer((request, response) => {
            handleRequest(request, response);
        });

        server.listen(PORT, () => {
            console.log(`🚀 Servidor Node.js a correr em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("❌ Falha crítica ao iniciar: O MongoDB está a correr?", error.message);
        process.exit(1); 
    }
}

// Função para servir ficheiros estáticos (HTML, CSS, JS)
function serveStaticFile(filePath, mimeType, response) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.error(`Erro ao ler o ficheiro ${filePath}:`, err.code);
            response.writeHead(404, { 'Content-Type': 'text/plain' });
            response.end('404 Not Found');
            return;
        }
        response.writeHead(200, { 'Content-Type': mimeType });
        response.end(content);
    });
}

// Função que trata os pedidos HTTP
// Note que adicionei 'async' aqui para podermos esperar pela resposta da BD
async function handleRequest(request, response) {
    
    // Caminho da pasta 'client', relativo à pasta 'server'
    const clientPath = path.join(__dirname, '..', 'client'); 

    // --- Tratamento de Rotas Estáticas ---

    // 1. Ignorar o pedido de Favicon
    if (request.url === '/favicon.ico') {
        response.writeHead(204); 
        response.end();
        return;
    }

    // 2. Servir a página principal
    if (request.url === '/' || request.url === '/index.html') {
        const filePath = path.join(clientPath, 'index.html');
        serveStaticFile(filePath, 'text/html', response);
        return;
    }
    
    // 3. Servir ficheiros CSS e JS
    if (request.url.endsWith('.css')) {
        const filePath = path.join(clientPath, request.url);
        serveStaticFile(filePath, 'text/css', response);
        return;
    }
    
    if (request.url.endsWith('.js')) {
        const filePath = path.join(clientPath, request.url);
        serveStaticFile(filePath, 'application/javascript', response);
        return;
    }

    // --- ROTAS API (Onde o Back-end fala com a Base de Dados) ---

    // Rota GET /api/notes -> Devolve todas as notas em formato JSON
    if (request.url === '/api/notes' && request.method === 'GET') {
        try {
            const collection = db.collection('notes');
            
            // Vai buscar tudo à BD e converte num array
            const notes = await collection.find({}).toArray();
            
            // Responde com os dados em JSON
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(notes));
            
        } catch (error) {
            console.error("Erro ao buscar notas:", error);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: "Erro interno ao buscar notas" }));
        }
        return; // Importante para não continuar e dar 404
    }

    // --- Se a rota não foi encontrada ---
    response.writeHead(404);
    response.end('404 Not Found');
}

// Iniciar a aplicação
startServer();