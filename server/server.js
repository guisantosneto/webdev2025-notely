const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

// --- CONSTANTES ---
const PORT = process.env.PORT || 3000;
const DB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'notely_db';

let db;

async function startServer() {
    try {
        const client = new MongoClient(DB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`✅ Conectado ao MongoDB: ${DB_NAME}`);

        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('topics').createIndex({ shareCode: 1 });

        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Erro fatal ao iniciar:", error);
    }
}

// --- FUNÇÕES DE SEGURANÇA ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

async function getUserFromRequest(req) {
    const token = req.headers['authorization'];
    if (!token) return null;
    return await db.collection('users').findOne({ sessionToken: token });
}

function getRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => body += chunk.toString());
        request.on('end', () => resolve(body));
        request.on('error', err => reject(err));
    });
}

// --- HANDLER PRINCIPAL ---
async function handleRequest(request, response) {
    // CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const urlParts = new URL(request.url, `http://${request.headers.host}`);
    const pathname = urlParts.pathname;

    // --- 1. AUTH ---

    // REGISTER
    if (pathname === '/api/auth/register' && request.method === 'POST') {
        try {
            const body = await getRequestBody(request);
            const { email, password } = JSON.parse(body);

            if (!email || !password) throw new Error("Email e password obrigatórios");

            const existing = await db.collection('users').findOne({ email });
            if (existing) {
                response.writeHead(409);
                response.end(JSON.stringify({ error: "Utilizador já existe" }));
                return;
            }

            const newUser = {
                email,
                password: hashPassword(password),
                createdAt: new Date()
            };
            
            const result = await db.collection('users').insertOne(newUser);
            const newUserId = result.insertedId;

            // Tópico Inicial
            const shareCode = crypto.randomBytes(3).toString('hex').toUpperCase();
            await db.collection('topics').insertOne({
                name: "Topic #1",
                userId: newUserId,
                shareCode: shareCode,
                members: [newUserId],
                createdAt: new Date()
            });
            
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
        } catch (e) {
            console.error(e);
            response.writeHead(500);
            response.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // LOGIN
    if (pathname === '/api/auth/login' && request.method === 'POST') {
        try {
            const body = await getRequestBody(request);
            const { email, password } = JSON.parse(body);

            const user = await db.collection('users').findOne({ 
                email, 
                password: hashPassword(password) 
            });

            if (!user) {
                response.writeHead(401); 
                response.end(JSON.stringify({ error: "Credenciais inválidas" }));
                return;
            }

            const token = generateToken();
            await db.collection('users').updateOne({ _id: user._id }, { $set: { sessionToken: token } });

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ token, email: user.email }));
        } catch (e) {
            response.writeHead(500);
            response.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // --- 2. API PROTEGIDA ---
    if (pathname.startsWith('/api/')) {
        const user = await getUserFromRequest(request);
        
        if (!user) {
            response.writeHead(401);
            response.end(JSON.stringify({ error: "Não autorizado. Faça login." }));
            return;
        }

        // --- NOTAS ---

        // GET NOTES
        if (pathname === '/api/notes' && request.method === 'GET') {
            const myTopics = await db.collection('topics').find({ 
                $or: [ { userId: user._id }, { members: user._id } ]
            }).toArray();
            
            const myTopicIds = myTopics.map(t => t._id);

            const notes = await db.collection('notes').find({
                $or: [
                    { userId: user._id },
                    { topicId: { $in: myTopicIds } }
                ]
            }).toArray();

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(notes));
            return;
        }

        // POST NOTE (CORRIGIDO PARA PARTILHA)
        if (pathname === '/api/notes' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);
            
            let topicObjectId = null;

            if (data.topicId) {
                try {
                    topicObjectId = new ObjectId(data.topicId); // Converte para ID real
                } catch(e) {
                    // Se falhar a conversão
                }

                const topic = await db.collection('topics').findOne({ 
                    _id: topicObjectId,
                    $or: [ { userId: user._id }, { members: user._id } ]
                });
                
                if (!topic) {
                    response.writeHead(403);
                    response.end(JSON.stringify({ error: "Sem permissão neste tópico." }));
                    return;
                }
            }

            const newNote = { 
                title: data.title,
                content: data.content,
                color: data.color,
                x: data.x,
                y: data.y,
                topicId: topicObjectId, // Guarda como ID real para que a pesquisa funcione
                userId: user._id, 
                createdAt: new Date() 
            };
            
            const result = await db.collection('notes').insertOne(newNote);
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newNote, _id: result.insertedId }));
            return;
        }

        // PUT NOTE
        if (pathname === '/api/notes' && request.method === 'PUT') {
            const id = urlParts.searchParams.get('id');
            const body = await getRequestBody(request);
            const updates = JSON.parse(body);
            delete updates._id; 
            // Não deixamos mudar o userId nem topicId aqui por segurança simples
            delete updates.userId;
            delete updates.topicId;

            await db.collection('notes').updateOne(
                { _id: new ObjectId(id) }, 
                { $set: updates }
            );
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // DELETE NOTE
        if (pathname === '/api/notes' && request.method === 'DELETE') {
            const id = urlParts.searchParams.get('id');
            // Apenas o dono da nota pode apagar
            await db.collection('notes').deleteOne({ _id: new ObjectId(id) });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // --- TÓPICOS ---

        // GET TOPICS
        if (pathname === '/api/topics' && request.method === 'GET') {
            const topics = await db.collection('topics').find({
                $or: [ { userId: user._id }, { members: user._id } ]
            }).toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(topics));
            return;
        }

        // POST TOPIC
        if (pathname === '/api/topics' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);

            if (!data.name || data.name.length > 20) {
                response.writeHead(400); 
                response.end(JSON.stringify({ error: "Nome inválido (máx 20 caracteres)." }));
                return;
            }

            const shareCode = crypto.randomBytes(3).toString('hex').toUpperCase();

            const newTopic = { 
                name: data.name, 
                userId: user._id, 
                shareCode: shareCode,
                members: [user._id],
                createdAt: new Date() 
            };
            const result = await db.collection('topics').insertOne(newTopic);
            
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newTopic, _id: result.insertedId }));
            return;
        }

        // JOIN TOPIC
        if (pathname === '/api/topics/join' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const { code } = JSON.parse(body);

            const topic = await db.collection('topics').findOne({ shareCode: code });
            
            if (!topic) {
                response.writeHead(404);
                response.end(JSON.stringify({ error: "Código inválido." }));
                return;
            }

            await db.collection('topics').updateOne(
                { _id: topic._id },
                { $addToSet: { members: user._id } }
            );

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true, topic }));
            return;
        }

        // PUT TOPIC
        if (pathname === '/api/topics' && request.method === 'PUT') {
            const id = urlParts.searchParams.get('id');
            const body = await getRequestBody(request);
            const data = JSON.parse(body);

            if (!data.name || data.name.length > 20) {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "Nome inválido." }));
                return;
            }

            // Só o dono muda o nome
            await db.collection('topics').updateOne(
                { _id: new ObjectId(id), userId: user._id },
                { $set: { name: data.name } }
            );
            
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // DELETE TOPIC
        if (pathname === '/api/topics' && request.method === 'DELETE') {
            const id = urlParts.searchParams.get('id');
            
            const result = await db.collection('topics').deleteOne({ _id: new ObjectId(id), userId: user._id });

            if (result.deletedCount > 0) {
                await db.collection('notes').updateMany(
                    { topicId: new ObjectId(id) },
                    { $set: { topicId: null } }
                );
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }
    }

    // --- STATIC FILES ---
    const clientPath = path.join(__dirname, 'client');
    const safeUrl = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    if (pathname === '/' || pathname === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', response);
    } 
    else if (pathname.endsWith('.css')) {
        serveFile(path.join(clientPath, safeUrl), 'text/css', response);
    } 
    else if (pathname.endsWith('.js')) {
        serveFile(path.join(clientPath, safeUrl), 'application/javascript', response);
    } 
    else {
        response.writeHead(404);
        response.end('Not Found');
    }
}

function serveFile(filePath, type, response) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            response.writeHead(404);
            response.end('Ficheiro nao encontrado');
        } else {
            response.writeHead(200, { 'Content-Type': type });
            response.end(content);
        }
    });
}

startServer();