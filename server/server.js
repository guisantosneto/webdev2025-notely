const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const PORT = 3000;
const DB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'notely_db';

let db;

async function startServer() {
    try {
        const client = new MongoClient(DB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`✅ Conectado ao MongoDB: ${DB_NAME}`);

        await seedDatabase();

        // Passamos a função handleRequest que agora aceita (request, response)
        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

async function seedDatabase() {
    const topicsCol = db.collection('topics');
    const notesCol = db.collection('notes');

    const topicsCount = await topicsCol.countDocuments();
    
    if (topicsCount === 0) {
        console.log("🌱 A semear a base de dados...");
        const topics = [
            { name: "Geral", createdAt: new Date() },
            { name: "Trabalho", createdAt: new Date() },
            { name: "Ideias", createdAt: new Date() }
        ];
        const result = await topicsCol.insertMany(topics);
        const topicIds = Object.values(result.insertedIds);

        const notes = [
            { title: "Bem-vindo", content: "Esta nota vem do MongoDB!", color: "yellow", topicId: topicIds[0], createdAt: new Date() },
            { title: "Projeto", content: "Terminar o Milestone 2.", color: "blue", topicId: topicIds[1], createdAt: new Date() }
        ];
        await notesCol.insertMany(notes);
        console.log("✅ Dados iniciais criados com sucesso!");
    }
}

async function handleRequest(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); 
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Pre-flight check para o browser não bloquear o POST
    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    // --- ROTA GET: Ler Notas ---
    if (request.url === '/api/notes' && request.method === 'GET') {
        try {
            const notes = await db.collection('notes').find().toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(notes));
        } catch (err) {
            response.writeHead(500); 
            response.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- ROTA POST: Criar Nota ---
    if (request.url === '/api/notes' && request.method === 'POST') {
        try {
            // 1. Ler dados do cliente
            const novaNota = await getRequestBody(request);
            
            // 2. Preencher dados que faltam
            novaNota.createdAt = new Date();
            if(!novaNota.title) novaNota.title = "Nova Nota";

            // 3. Gravar no MongoDB
            const result = await db.collection('notes').insertOne(novaNota);
            novaNota._id = result.insertedId; // Devolve o ID novo para o front

            // 4. Responder sucesso
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(novaNota));
            console.log("📝 Nota criada:", novaNota.title);

        } catch (err) {
            console.error(err);
            response.writeHead(500); 
            response.end(JSON.stringify({ error: "Erro ao criar nota" }));
        }
        return;
    }

    
    if (request.url === '/api/topics' && request.method === 'GET') {
        try {
            const topics = await db.collection('topics').find().toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(topics));
        } catch (err) {
            response.writeHead(500); 
            response.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- SERVIR FICHEIROS ESTÁTICOS ---
    const clientPath = path.join(__dirname, '..', 'client');
    
    if (request.url === '/' || request.url === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', response);
    } else if (request.url.endsWith('.css')) {
        serveFile(path.join(clientPath, request.url), 'text/css', response);
    } else if (request.url.endsWith('.js')) {
        serveFile(path.join(clientPath, request.url), 'application/javascript', response);
    } else {
        response.writeHead(404); 
        response.end('404 Not Found');
    }
}

function serveFile(filePath, contentType, response) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            response.writeHead(404); 
            response.end('Ficheiro não encontrado');
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content);
        }
    });
}

function getRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => { body += chunk.toString(); });
        request.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        request.on('error', (err) => reject(err));
    });
}

startServer();