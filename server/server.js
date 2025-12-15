// server/server.js COMPLETO
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
        
        // Inicia servidor
        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

// Função auxiliar para ler o corpo do pedido (JSON)
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => resolve(body));
        req.on('error', err => reject(err));
    });
}

async function handleRequest(req, res) {
    // CORS e Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // --- API: NOTAS ---
    if (req.url === '/api/notes' && req.method === 'GET') {
        const notes = await db.collection('notes').find().toArray();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(notes));
        return;
    }

    if (req.url === '/api/notes' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const data = JSON.parse(body);
            const newNote = { ...data, createdAt: new Date() };
            const result = await db.collection('notes').insertOne(newNote);
            res.writeHead(201, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ ...newNote, _id: result.insertedId }));
        } catch(e) { res.writeHead(500); res.end(JSON.stringify({error: e.message})); }
        return;
    }

    if (req.url.startsWith('/api/notes') && req.method === 'DELETE') {
        const id = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
        await db.collection('notes').deleteOne({ _id: new ObjectId(id) });
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true}));
        return;
    }

    // --- ROTA PUT: Atualizar Nota (Posição, Cor, Texto, etc) ---
    if (request.url.startsWith('/api/notes') && request.method === 'PUT') {
        try {
            const urlParts = new URL(request.url, `http://${request.headers.host}`);
            const id = urlParts.searchParams.get('id');

            const body = await getRequestBody(request);
            const updates = JSON.parse(body);

            // Remove o _id do corpo para não tentar atualizar a chave primária (dá erro no Mongo)
            delete updates._id; 

            const result = await db.collection('notes').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
        } catch (err) {
            console.error(err);
            response.writeHead(500); 
            response.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: TÓPICOS (A PARTE QUE FALTAVA) ---
    if (req.url === '/api/topics' && req.method === 'GET') {
        const topics = await db.collection('topics').find().toArray();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(topics));
        return;
    }

    if (req.url === '/api/topics' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const data = JSON.parse(body);
            if (!data.name) throw new Error("Nome obrigatório");

            const newTopic = { name: data.name, createdAt: new Date() };
            const result = await db.collection('topics').insertOne(newTopic);
            
            res.writeHead(201, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ ...newTopic, _id: result.insertedId }));
        } catch(e) { 
            console.error(e); // Log no terminal para debug
            res.writeHead(500); res.end(JSON.stringify({error: e.message})); 
        }
        return;
    }

    // --- ESTÁTICOS ---
    const clientPath = path.join(__dirname, '..', 'client');
    const safeUrl = req.url.startsWith('/') ? req.url.slice(1) : req.url;

    if (req.url === '/' || req.url === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', res);
    } else if (req.url.endsWith('.css')) {
        serveFile(path.join(clientPath, safeUrl), 'text/css', res);
    } else if (req.url.endsWith('.js')) {
        serveFile(path.join(clientPath, safeUrl), 'application/javascript', res);
    } else {
        res.writeHead(404); res.end('Not Found');
    }
}

function serveFile(filePath, type, res) {
    fs.readFile(filePath, (err, content) => {
        if(err) { res.writeHead(404); res.end('File not found'); }
        else { res.writeHead(200, {'Content-Type': type}); res.end(content); }
    });
}

startServer();