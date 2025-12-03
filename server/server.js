// server/server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb'); // Adicionado ObjectId para futuras operações

// --- Configurações ---
const PORT = 6000;
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

        // --- INSERÇÃO DE TESTE (Opcional, mas útil para verificar a BD) ---
        // Se a coleção 'notes' não existir, este comando irá criá-la.
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
        const server = http.createServer((req, res) => {
            handleRequest(req, res);
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
function serveStaticFile(filePath, mimeType, res) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            // Este erro é comum se o ficheiro não for encontrado
            console.error(`Erro ao ler o ficheiro ${filePath}:`, err.code);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    });
}

// Função que trata os pedidos HTTP
function handleRequest(req, res) {
    
    // Caminho da pasta 'client', relativo à pasta 'server'
    const clientPath = path.join(__dirname, '..', 'client'); 

    // --- Tratamento de Rotas Estáticas ---

    // 1. Ignorar o pedido de Favicon (para evitar erros desnecessários)
    if (req.url === '/favicon.ico') {
        res.writeHead(204); // 204 No Content
        res.end();
        return;
    }

    // 2. Servir a página principal (Single Page Application)
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(clientPath, 'index.html');
        serveStaticFile(filePath, 'text/html', res);
        return;
    }
    
    // 3. Servir ficheiros CSS e JS
    if (req.url.endsWith('.css')) {
        const filePath = path.join(clientPath, req.url);
        serveStaticFile(filePath, 'text/css', res);
        return;
    }
    
    if (req.url.endsWith('.js')) {
        const filePath = path.join(clientPath, req.url);
        serveStaticFile(filePath, 'application/javascript', res);
        return;
    }

    // --- Fim do Tratamento Estático ---
    
    // FUTURO: Aqui é onde irá adicionar o tratamento de rotas API para o Notely
    // (ex: /api/notes, /api/topics)

    // Se a rota não foi tratada
    res.writeHead(404);
    res.end('404 Not Found');
}

// Iniciar a aplicação
startServer();