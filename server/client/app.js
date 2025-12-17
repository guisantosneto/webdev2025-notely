const { useState, useEffect } = React;

function LoginScreen({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Validação simples
        if (!email || !password) {
            setError("Preencha todos os campos.");
            return;
        }

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erro desconhecido");

            if (isRegistering) {
                alert("Conta criada com sucesso! Faça login.");
                setIsRegistering(false); // Muda para o ecrã de login
                setPassword(""); // Limpa a password por segurança
            } else {
                onLogin(data.token, data.email);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div id="login-container">
            <div className="login-card">
                <h3>{isRegistering ? 'Criar Conta' : 'Login'}</h3>
                
                {error && <p className="error-msg">{error}</p>}
                
                <form onSubmit={handleSubmit}>
                    <input 
                        type="email" 
                        placeholder="O teu email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="A tua password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                    />
                    <button type="submit" className="btn-primary">
                        {isRegistering ? 'Registar' : 'Entrar Agora'}
                    </button>
                </form>
                
                <p className="toggle-link" onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(""); // Limpa erros ao trocar de ecrã
                }}>
                    {isRegistering ? '← Voltar para Login' : 'Não tens conta? Criar →'}
                </p>
            </div>
        </div>
    );
}

// --- COMPONENTE NOTA (Igual ao anterior) ---
function Note({ note, onMouseDown, onDelete }) {
    const dateStr = new Date(note.createdAt).toLocaleDateString();
    const colorClass = note.color ? `bg-${note.color}` : 'bg-yellow';
    const style = {
        left: `${note.x || 50}px`, top: `${note.y || 50}px`,
        zIndex: note.isDragging ? 1000 : 1
    };

    return (
        <div className={`note-card ${colorClass}`} style={style} onMouseDown={(e) => onMouseDown(e, note._id)}>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(note._id); }}>&times;</button>
            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <div className="date">{dateStr}</div>
        </div>
    );
}

// --- APP PRINCIPAL ---
function App() {
    const [token, setToken] = useState(localStorage.getItem('notely_token'));
    const [userEmail, setUserEmail] = useState(localStorage.getItem('notely_email'));
    
    // Estados de Dados
    const [notes, setNotes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [activeTopicId, setActiveTopicId] = useState(null);
    const [search, setSearch] = useState("");
    
    // Drag
    const [draggingId, setDraggingId] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Modais
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

    // Form
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteTopic, setNewNoteTopic] = useState("");
    const [newNoteColor, setNewNoteColor] = useState("yellow");
    const [newTopicName, setNewTopicName] = useState("");

    // --- EFFECT: Carregar dados SÓ SE tiver token ---
    useEffect(() => {
        if (token) carregarDados();
    }, [token]);

    // Função auxiliar para fetch com AUTH
    const authFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': token, // Envia o token no header
                'Content-Type': 'application/json'
            }
        });
    };

    const carregarDados = async () => {
        try {
            const resNotes = await authFetch('/api/notes');
            if (resNotes.status === 401) return logout(); // Token expirou
            setNotes(await resNotes.json());

            const resTopics = await authFetch('/api/topics');
            setTopics(await resTopics.json());
        } catch (error) { console.error("Erro:", error); }
    };

    const handleLogin = (newToken, email) => {
        localStorage.setItem('notely_token', newToken);
        localStorage.setItem('notely_email', email);
        setToken(newToken);
        setUserEmail(email);
    };

    const logout = () => {
        localStorage.removeItem('notely_token');
        setToken(null);
        setNotes([]);
    };

    // SE NÃO ESTIVER LOGADO, MOSTRA ECRÃ DE LOGIN
    if (!token) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    // --- RESTO DA LÓGICA (Drag, Save, Delete) ---
    // Nota: Substituí 'fetch' por 'authFetch' em tudo

    const handleMouseDown = (e, id) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        const note = notes.find(n => n._id === id);
        setDraggingId(id);
        setOffset({ x: e.clientX - (note.x || 50), y: e.clientY - (note.y || 50) });
    };

    const handleMouseMove = (e) => {
        if (!draggingId) return;
        const newX = e.clientX - offset.x;
        const newY = e.clientY - offset.y;
        setNotes(prev => prev.map(n => n._id === draggingId ? { ...n, x: newX, y: newY, isDragging: true } : n));
    };

    const handleMouseUp = async () => {
        if (!draggingId) return;
        const note = notes.find(n => n._id === draggingId);
        setNotes(prev => prev.map(n => n._id === draggingId ? { ...n, isDragging: false } : n));
        setDraggingId(null);
        await authFetch(`/api/notes?id=${note._id}`, { method: 'PUT', body: JSON.stringify({ x: note.x, y: note.y }) });
    };

    const handleSaveNote = async () => {
        if (!newNoteTitle) return alert("Título obrigatório!");
        const randomX = 50 + Math.random() * 200; 
        const randomY = 50 + Math.random() * 200;
        const novaNota = { title: newNoteTitle, content: newNoteContent, color: newNoteColor, topicId: newNoteTopic || null, x: randomX, y: randomY };
        
        await authFetch('/api/notes', { method: 'POST', body: JSON.stringify(novaNota) });
        setIsNoteModalOpen(false); setNewNoteTitle(""); setNewNoteContent(""); carregarDados();
    };

    const handleDeleteNote = async (id) => {
        if(!confirm("Apagar nota?")) return;
        await authFetch(`/api/notes?id=${id}`, { method: 'DELETE' });
        setNotes(notes.filter(n => n._id !== id));
    };

    const handleSaveTopic = async () => {
        if (!newTopicName) return;
        await authFetch('/api/topics', { method: 'POST', body: JSON.stringify({ name: newTopicName }) });
        setIsTopicModalOpen(false); setNewTopicName(""); carregarDados();
    };

    const filteredNotes = notes.filter(n => {
        return (activeTopicId === null || n.topicId === activeTopicId) &&
               (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));
    });
    const activeTopicName = activeTopicId ? topics.find(t => t._id === activeTopicId)?.name : "Todas as Notas";

    return (
        <div id="app-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <aside id="sidebar">
                {/* PARTE DE CIMA (Logo + Ações + Tópicos) */}
                <div className="sidebar-content">
                    <div className="brand"><h1>Notely</h1></div>
                    
                    <div className="actions">
                        <button className="btn-primary" onClick={() => setIsNoteModalOpen(true)}>New Note</button>
                        <button className="btn-secondary" onClick={() => setIsTopicModalOpen(true)}>New Topic</button>
                    </div>

                    <div className="topics-section">
                        <h3>Topics</h3>
                        <ul id="topics-list">
                            <li className={activeTopicId === null ? 'active' : ''} onClick={() => setActiveTopicId(null)}>Todas as Notas</li>
                            {topics.map(t => (
                                <li key={t._id} className={activeTopicId === t._id ? 'active' : ''} onClick={() => setActiveTopicId(t._id)}>{t.name}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* PARTE DE BAIXO (Perfil + Sair) */}
                <div className="user-profile">
                    {/* Ícone de Perfil (Avatar com a inicial) */}
                    <div className="avatar">
                        {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
                    </div>
                    
                    <div className="user-info">
                        <span className="email-text">{userEmail}</span>
                        <button onClick={logout} className="logout-link">Sair da conta</button>
                    </div>
                </div>
            </aside>

            <main id="main-content">
                <header>
                    <h2 id="current-topic-title">{activeTopicName}</h2>
                    <div className="search-box">
                        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </header>
                <div id="notes-grid">
                    {filteredNotes.map(n => (
                        <Note key={n._id} note={n} onMouseDown={handleMouseDown} onDelete={handleDeleteNote} />
                    ))}
                </div>
            </main>

            {isNoteModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content">
                        <h2>Nova Nota</h2>
                        <input type="text" placeholder="Título" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} />
                        <select value={newNoteTopic} onChange={e => setNewNoteTopic(e.target.value)}>
                            <option value="">Sem Tópico</option>
                            {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                        <div className="color-picker">
                            {['yellow', 'blue', 'green', 'red'].map(c => (
                                <button key={c} className={`color-btn bg-${c} ${newNoteColor === c ? 'selected' : ''}`} onClick={() => setNewNoteColor(c)}></button>
                            ))}
                        </div>
                        <textarea placeholder="Texto" value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}></textarea>
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsNoteModalOpen(false)}>Cancelar</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveNote}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
            
             {isTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" className="small-modal"> 
                        <h2>Novo Tópico</h2>
                        <input type="text" placeholder="Nome" value={newTopicName} onChange={e => setNewTopicName(e.target.value)} />
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsTopicModalOpen(false)}>Cancelar</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveTopic}>Criar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);