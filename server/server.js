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

        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

// Ler corpo do pedido
function getRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => body += chunk.toString());
        request.on('end', () => resolve(body));
        request.on('error', err => reject(err));
    });
}

async function handleRequest(request, response) {
    // CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    // --- API: NOTAS ---
    if (request.url === '/api/notes' && request.method === 'GET') {
        const notes = await db.collection('notes').find().toArray();
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(notes));
        return;
    }

    if (request.url === '/api/notes' && request.method === 'POST') {
        try {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);

            const newNote = { ...data, createdAt: new Date() };
            const result = await db.collection('notes').insertOne(newNote);

            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newNote, _id: result.insertedId }));
        } catch (e) {
            response.writeHead(500);
            response.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (request.url.startsWith('/api/notes') && request.method === 'DELETE') {
        const id = new URL(request.url, `http://${request.headers.host}`)
            .searchParams.get('id');

        await db.collection('notes').deleteOne({ _id: new ObjectId(id) });

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true }));
        return;
    }

    // --- PUT: Atualizar Nota ---
    if (request.url.startsWith('/api/notes') && request.method === 'PUT') {
        try {
            const url = new URL(request.url, `http://${request.headers.host}`);
            const id = url.searchParams.get('id');

            const body = await getRequestBody(request);
            const updates = JSON.parse(body);

            delete updates._id;

            await db.collection('notes').updateOne(
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

    // --- API: TÓPICOS ---
    if (request.url === '/api/topics' && request.method === 'GET') {
        const topics = await db.collection('topics').find().toArray();
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(topics));
        return;
    }

    if (request.url === '/api/topics' && request.method === 'POST') {
        try {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);

            if (!data.name) throw new Error('Nome obrigatório');

            const newTopic = { name: data.name, createdAt: new Date() };
            const result = await db.collection('topics').insertOne(newTopic);

            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newTopic, _id: result.insertedId }));
        } catch (e) {
            response.writeHead(500);
            response.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // --- ESTÁTICOS ---
    const clientPath = path.join(__dirname, '..', 'client');
    const safeUrl = request.url.startsWith('/') ? request.url.slice(1) : request.url;

    if (request.url === '/' || request.url === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', response);
    } else if (request.url.endsWith('.css')) {
        serveFile(path.join(clientPath, safeUrl), 'text/css', response);
    } else if (request.url.endsWith('.js')) {
        serveFile(path.join(clientPath, safeUrl), 'application/javascript', response);
    } else {
        response.writeHead(404);
        response.end('Not Found');
    }
}

function serveFile(filePath, type, response) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            response.writeHead(404);
            response.end('File not found');
        } else {
            response.writeHead(200, { 'Content-Type': type });
            response.end(content);
        }
    });
}

startServer();
