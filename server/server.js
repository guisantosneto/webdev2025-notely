// server/server.js
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
        
        // 1. Criar Tópicos
        const topics = [
            { name: "Geral", createdAt: new Date() },
            { name: "Trabalho", createdAt: new Date() },
            { name: "Ideias", createdAt: new Date() }
        ];
        const result = await topicsCol.insertMany(topics);
        
        const topicIds = Object.values(result.insertedIds);

        const notes = [
            { title: "Bem-vindo", content: "Esta nota vem do MongoDB!", color: "yellow", topicId: topicIds[0], createdAt: new Date() },
            { title: "Projeto", content: "Terminar o Milestone 2.", color: "blue", topicId: topicIds[1], createdAt: new Date() },
            { title: "Ideia App", content: "Fazer um sistema de login.", color: "green", topicId: topicIds[2], createdAt: new Date() }
        ];
        await notesCol.insertMany(notes);
        console.log("✅ Dados iniciais criados com sucesso!");
    }
}

async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    

    if (req.url === '/api/notes' && req.method === 'GET') {
        try {
            const notes = await db.collection('notes').find().toArray();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(notes));
        } catch (err) {
            res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.url === '/api/topics' && req.method === 'GET') {
        try {
            const topics = await db.collection('topics').find().toArray();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(topics));
        } catch (err) {
            res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    const clientPath = path.join(__dirname, '..', 'client');
    
    if (req.url === '/' || req.url === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', res);
    } else if (req.url.endsWith('.css')) {
        serveFile(path.join(clientPath, req.url), 'text/css', res);
    } else if (req.url.endsWith('.js')) {
        serveFile(path.join(clientPath, req.url), 'application/javascript', res);
    } else {
        res.writeHead(404); res.end('404 Not Found');
    }
}

function serveFile(filePath, contentType, res) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404); res.end('Ficheiro não encontrado');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

startServer();