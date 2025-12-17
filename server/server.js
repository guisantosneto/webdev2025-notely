const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Nativo do Node para encriptar
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

        // Cria índice para email único (opcional mas recomendado)
        await db.collection('users').createIndex({ email: 1 }, { unique: true });

        const server = http.createServer(handleRequest);
        server.listen(PORT, () => {
            console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Erro fatal:", error);
    }
}

// --- FUNÇÕES AUXILIARES DE AUTH ---

// Hash simples usando SHA256 (Nativo, sem bibliotecas externas)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Gera um token aleatório para a sessão
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// Verifica quem é o utilizador com base no Header "Authorization"
async function getUserFromRequest(req) {
    const token = req.headers['authorization'];
    if (!token) return null;
    // Procura utilizador que tenha este token de sessão
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
    // CORS (Permitir headers de Authorization)
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }

    const urlParts = new URL(request.url, `http://${request.headers.host}`);
    const pathname = urlParts.pathname;

    // --- API: AUTH (LOGIN & REGISTO) ---
    
    // REGISTO
    if (pathname === '/api/auth/register' && request.method === 'POST') {
        try {
            const body = await getRequestBody(request);
            const { email, password } = JSON.parse(body);

            if (!email || !password) throw new Error("Email e password obrigatórios");

            // Verifica se já existe
            const existing = await db.collection('users').findOne({ email });
            if (existing) {
                response.writeHead(409); // Conflict
                response.end(JSON.stringify({ error: "Utilizador já existe" }));
                return;
            }

            // Cria utilizador
            const newUser = {
                email,
                password: hashPassword(password), // Nunca guardar plain text!
                createdAt: new Date()
            };
            await db.collection('users').insertOne(newUser);
            
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
        } catch (e) {
            response.writeHead(500); response.end(JSON.stringify({ error: e.message }));
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

            // Gera novo token de sessão e guarda no user
            const token = generateToken();
            await db.collection('users').updateOne({ _id: user._id }, { $set: { sessionToken: token } });

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ token, email: user.email }));
        } catch (e) {
            response.writeHead(500); response.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // --- API: ROTAS PROTEGIDAS (PRECISAM DE LOGIN) ---
    
    // Para todas as rotas abaixo, precisamos saber QUEM é o utilizador
    // Se for ficheiro estático (JS/CSS), passa à frente
    if (pathname.startsWith('/api/')) {
        const user = await getUserFromRequest(request);
        if (!user) {
            response.writeHead(401);
            response.end(JSON.stringify({ error: "Não autorizado. Faça login." }));
            return;
        }

        // 1. GET NOTES (Só as do utilizador)
        if (pathname === '/api/notes' && request.method === 'GET') {
            const notes = await db.collection('notes').find({ userId: user._id }).toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(notes));
            return;
        }

        // 2. CREATE NOTE (Associa ao utilizador)
        if (pathname === '/api/notes' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);
            const newNote = { 
                ...data, 
                userId: user._id, // IMPORTANTE: Liga a nota a este user
                createdAt: new Date() 
            };
            const result = await db.collection('notes').insertOne(newNote);
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newNote, _id: result.insertedId }));
            return;
        }

        // 3. UPDATE NOTE
        if (pathname === '/api/notes' && request.method === 'PUT') {
            const id = urlParts.searchParams.get('id');
            const body = await getRequestBody(request);
            const updates = JSON.parse(body);
            delete updates._id;

            // Garante que só edita se a nota pertencer ao user
            await db.collection('notes').updateOne(
                { _id: new ObjectId(id), userId: user._id },
                { $set: updates }
            );
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // 4. DELETE NOTE
        if (pathname === '/api/notes' && request.method === 'DELETE') {
            const id = urlParts.searchParams.get('id');
            // Garante que só apaga se a nota pertencer ao user
            await db.collection('notes').deleteOne({ _id: new ObjectId(id), userId: user._id });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
            return;
        }

        // 5. TÓPICOS (Gerais ou por user? Vamos fazer por user também)
        if (pathname === '/api/topics' && request.method === 'GET') {
            const topics = await db.collection('topics').find({ userId: user._id }).toArray();
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(topics));
            return;
        }

        if (pathname === '/api/topics' && request.method === 'POST') {
            const body = await getRequestBody(request);
            const data = JSON.parse(body);
            const newTopic = { name: data.name, userId: user._id, createdAt: new Date() };
            const result = await db.collection('topics').insertOne(newTopic);
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ...newTopic, _id: result.insertedId }));
            return;
        }
    }

    // --- ESTÁTICOS ---
    const clientPath = path.join(__dirname, 'client');
    const safeUrl = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    if (pathname === '/' || pathname === '/index.html') {
        serveFile(path.join(clientPath, 'index.html'), 'text/html', response);
    } else if (pathname.endsWith('.css')) {
        serveFile(path.join(clientPath, safeUrl), 'text/css', response);
    } else if (pathname.endsWith('.js')) {
        serveFile(path.join(clientPath, safeUrl), 'application/javascript', response);
    } else {
        response.writeHead(404);
        response.end('Not Found');
    }
}

function serveFile(filePath, type, response) {
    fs.readFile(filePath, (err, content) => {
        if (err) { response.writeHead(404); response.end('File not found'); } 
        else { response.writeHead(200, { 'Content-Type': type }); response.end(content); }
    });
}

startServer();