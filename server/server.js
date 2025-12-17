const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

        // Garante que o email é único na base de dados
        await db.collection('users').createIndex({ email: 1 }, { unique: true });

        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Erro fatal ao iniciar:", error);
    }
}

// --- FUNÇÕES DE SEGURANÇA (CRYPTO) ---

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

async function handleRequest(request, response) {
    // CORS - Permite que o frontend comunique com o backend
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

    // --- 1. ROTAS PÚBLICAS (AUTH) ---

    // REGISTAR
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
            await db.collection('users').insertOne(newUser);
            
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
        } catch (e) {
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

    // --- 2. ROTAS PROTEGIDAS (REQUEREM LOGIN) ---
    
    if (pathname.startsWith('/api/')) {
        // Verifica quem é o utilizador antes de qualquer coisa
        const user = await getUserFromRequest(request);
        
        if (!user) {
            response.writeHead(401);
            response.end(JSON.stringify({ error: "Não autorizado. Faça login." }));
            return;
        }

        // --- API: NOTAS ---

        // GET NOTES
        if (pathname === '/api/notes' && request.method === 'GET') {
            const notes = await db.collection('notes').find({ userId: user._id }).toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(notes));
            return;
        }

        // POST NOTE (Criar)
        if (pathname === '/api/notes' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);
            
            const newNote = { 
                ...data, 
                userId: user._id, 
                createdAt: new Date() 
            };
            
            const result = await db.collection('notes').insertOne(newNote);
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newNote, _id: result.insertedId }));
            return;
        }

        // PUT NOTE (Atualizar Posição/Texto)
        if (pathname === '/api/notes' && request.method === 'PUT') {
            const id = urlParts.searchParams.get('id');
            const body = await getRequestBody(request);
            const updates = JSON.parse(body);
            delete updates._id; // Proteção para não mudar o ID

            await db.collection('notes').updateOne(
                { _id: new ObjectId(id), userId: user._id },
                { $set: updates }
            );
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // DELETE NOTE
        if (pathname === '/api/notes' && request.method === 'DELETE') {
            const id = urlParts.searchParams.get('id');
            await db.collection('notes').deleteOne({ _id: new ObjectId(id), userId: user._id });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // --- API: TÓPICOS ---

        // GET TOPICS
        if (pathname === '/api/topics' && request.method === 'GET') {
            const topics = await db.collection('topics').find({ userId: user._id }).toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(topics));
            return;
        }

        // POST TOPIC (Com limite de 20 caracteres)
        if (pathname === '/api/topics' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);

            if (!data.name) {
                response.writeHead(400); 
                response.end(JSON.stringify({ error: "Nome obrigatório" }));
                return;
            }

            // [NOVO] Validação de limite de caracteres
            if (data.name.length > 20) {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "O nome deve ter no máximo 20 caracteres." }));
                return;
            }

            const newTopic = { name: data.name, userId: user._id, createdAt: new Date() };
            const result = await db.collection('topics').insertOne(newTopic);
            
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newTopic, _id: result.insertedId }));
            return;
        }

        // DELETE TOPIC (Seguro: Liberta as notas)
        if (pathname === '/api/topics' && request.method === 'DELETE') {
            const id = urlParts.searchParams.get('id');
            
            // 1. Apaga o tópico
            await db.collection('topics').deleteOne({ _id: new ObjectId(id), userId: user._id });

            // 2. Atualiza as notas para ficarem sem tópico (topicId: null)
            await db.collection('notes').updateMany(
                { topicId: id, userId: user._id },
                { $set: { topicId: null } }
            );

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }
    }

    // --- 3. SERVIR FICHEIROS ESTÁTICOS (Frontend) ---
    const clientPath = path.join(__dirname, 'client');
    const safeUrl = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    // Se pedir a raiz ou index.html
    if (pathname === '/' || pathname === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', response);
    } 
    // Se pedir CSS
    else if (pathname.endsWith('.css')) {
        serveFile(path.join(clientPath, safeUrl), 'text/css', response);
    } 
    // Se pedir JS
    else if (pathname.endsWith('.js')) {
        serveFile(path.join(clientPath, safeUrl), 'application/javascript', response);
    } 
    // Erro 404
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