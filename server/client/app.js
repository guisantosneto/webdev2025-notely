const { useState, useEffect } = React;

function LoginScreen({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!email || !password) { setError("Preencha todos os campos."); return; }

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
                setIsRegistering(false); 
                setPassword(""); 
            } else {
                onLogin(data.token, data.email);
            }
        } catch (err) { setError(err.message); }
    };

    return (
        <div id="login-container">
            <div className="login-card">
                <h3>{isRegistering ? 'Create Account' : 'Login'}</h3>
                {error && <p className="error-msg">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="submit" className="btn-primary">{isRegistering ? 'Register' : 'Enter'}</button>
                </form>
                <p className="toggle-link" onClick={() => { setIsRegistering(!isRegistering); setError(""); }}>
                    {isRegistering ? 'Back to Login' : 'Create Account'}
                </p>
            </div>
        </div>
    );
}

function Note({ note, onMouseDown, onDelete }) {
    const dateStr = new Date(note.createdAt).toLocaleDateString();
    const colorClass = note.color ? `bg-${note.color}` : 'bg-yellow';
    const style = { left: `${note.x || 50}px`, top: `${note.y || 50}px`, zIndex: note.isDragging ? 1000 : 1 };

    return (
        <div className={`note-card ${colorClass}`} style={style} onMouseDown={(e) => onMouseDown(e, note._id)}>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(note._id); }}>&times;</button>
            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <div className="date">{dateStr}</div>
        </div>
    );
}

function App() {
    const [token, setToken] = useState(localStorage.getItem('notely_token'));
    const [userEmail, setUserEmail] = useState(localStorage.getItem('notely_email'));
    
    // Dados
    const [notes, setNotes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [activeTopicId, setActiveTopicId] = useState(null);
    const [search, setSearch] = useState("");
    
    // Drag
    const [draggingId, setDraggingId] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Modais e Forms
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteTopic, setNewNoteTopic] = useState("");
    const [newNoteColor, setNewNoteColor] = useState("yellow");

    // Modal Criar Tópico
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");

    // [NOVO] Modal Editar Tópico
    const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
    const [editingTopicId, setEditingTopicId] = useState(null);
    const [editingTopicName, setEditingTopicName] = useState("");

    useEffect(() => { if (token) carregarDados(); }, [token]);

    const authFetch = (url, options = {}) => {
        return fetch(url, { ...options, headers: { ...options.headers, 'Authorization': token, 'Content-Type': 'application/json' } });
    };

    const carregarDados = async () => {
        try {
            const resNotes = await authFetch('/api/notes');
            if (resNotes.status === 401) return logout();
            setNotes(await resNotes.json());

            const resTopics = await authFetch('/api/topics');
            const loadedTopics = await resTopics.json();
            setTopics(loadedTopics);

            if (loadedTopics.length > 0) {
                setActiveTopicId(prevId => {
                    const topicExists = loadedTopics.find(t => t._id === prevId);
                    return topicExists ? prevId : loadedTopics[0]._id;
                });
            } else {
                setActiveTopicId(null);
            }
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

    if (!token) return <LoginScreen onLogin={handleLogin} />;

    // --- Lógica Drag & Drop ---
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

    // --- Lógica Notas ---
    const handleSaveNote = async () => {
        if (!newNoteTitle) return alert("Título obrigatório!");
        const topicToUse = newNoteTopic || activeTopicId;
        if (!topicToUse) return alert("Tens de ter um tópico selecionado!");

        const novaNota = { 
            title: newNoteTitle, content: newNoteContent, color: newNoteColor, 
            topicId: topicToUse, x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 
        };
        
        await authFetch('/api/notes', { method: 'POST', body: JSON.stringify(novaNota) });
        setIsNoteModalOpen(false); setNewNoteTitle(""); setNewNoteContent(""); carregarDados();
    };

    const handleDeleteNote = async (id) => {
        if(!confirm("Apagar nota?")) return;
        await authFetch(`/api/notes?id=${id}`, { method: 'DELETE' });
        setNotes(notes.filter(n => n._id !== id));
    };

    // --- Lógica Tópicos ---
    const handleSaveTopic = async () => {
        if (!newTopicName) return;
        await authFetch('/api/topics', { method: 'POST', body: JSON.stringify({ name: newTopicName }) });
        setIsTopicModalOpen(false); setNewTopicName(""); carregarDados();
    };

    // [NOVO] Abrir modal de edição
    const openEditTopic = (e, topic) => {
        e.stopPropagation(); // Não ativar o tópico ao clicar no editar
        setEditingTopicId(topic._id);
        setEditingTopicName(topic.name);
        setIsEditTopicModalOpen(true);
    };

    // [NOVO] Guardar edição
    const handleUpdateTopic = async () => {
        if (!editingTopicName) return;
        
        const res = await authFetch(`/api/topics?id=${editingTopicId}`, { 
            method: 'PUT', 
            body: JSON.stringify({ name: editingTopicName }) 
        });

        if (!res.ok) {
            const data = await res.json();
            return alert(data.error || "Erro ao atualizar");
        }

        setIsEditTopicModalOpen(false);
        carregarDados();
    };

    const handleDeleteTopic = async (e, id, name) => {
        e.stopPropagation();
        if (!confirm(`Apagar tópico "${name}"?`)) return;
        await authFetch(`/api/topics?id=${id}`, { method: 'DELETE' });
        carregarDados();
    };

    const filteredNotes = notes.filter(n => (n.topicId === activeTopicId) && 
        (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())));
    
    const activeTopicName = activeTopicId ? topics.find(t => t._id === activeTopicId)?.name : "Selecione um Tópico";

    return (
        <div id="app-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <aside id="sidebar">
                <div className="sidebar-content">
                    <div className="brand"><h1>Notely</h1></div>
                    <div className="actions">
                        <button className="btn-primary" onClick={() => setIsNoteModalOpen(true)}>New Note</button>
                        <button className="btn-secondary" onClick={() => setIsTopicModalOpen(true)}>New Topic</button>
                    </div>

                    <div className="topics-section">
                        <h3>Topics</h3>
                        <ul id="topics-list">
                            {topics.map(t => (
                            <li key={t._id} className={activeTopicId === t._id ? 'active' : ''} onClick={() => setActiveTopicId(t._id)}>
                                <span>{t.name}</span>
                                <div className="topic-actions-group">
                                    {/* [NOVO] Botão Editar */}
                                    <button className="icon-btn" title="Editar" onClick={(e) => openEditTopic(e, t)}>✎</button>
                                    
                                    {/* Botão Apagar */}
                                    <button className="icon-btn delete" title="Apagar" onClick={(e) => handleDeleteTopic(e, t._id, t.name)}>&times;</button>
                                </div>
                            </li>
                        ))}
                        </ul>
                    </div>
                </div>

                <div className="user-profile">
                    <div className="avatar">{userEmail ? userEmail.charAt(0).toUpperCase() : '?'}</div>
                    <div className="user-info">
                        <span className="email-text">{userEmail}</span>
                        <button onClick={logout} className="logout-link">Sair</button>
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
                    {filteredNotes.map(n => <Note key={n._id} note={n} onMouseDown={handleMouseDown} onDelete={handleDeleteNote} />)}
                    {filteredNotes.length === 0 && activeTopicId && <p style={{padding:'20px', color:'#666'}}>Tópico vazio.</p>}
                </div>
            </main>

            {/* MODAL CRIAR NOTA */}
            {isNoteModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content">
                        <h2>Nova Nota</h2>
                        <input type="text" placeholder="Título" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} />
                        <select value={newNoteTopic} onChange={e => setNewNoteTopic(e.target.value)}>
                            <option value="">(Tópico Atual)</option>
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
            
            {/* MODAL CRIAR TÓPICO */}
            {isTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" className="small-modal"> 
                        <h2>Novo Tópico</h2>
                        <input type="text" placeholder="Nome" maxLength={20} value={newTopicName} onChange={e => setNewTopicName(e.target.value)} />
                        <div style={{textAlign:'right', fontSize:'12px', fontWeight:'800', marginTop:'5px'}}>{newTopicName.length}/20</div>
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsTopicModalOpen(false)}>Cancelar</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveTopic}>Criar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* [NOVO] MODAL EDITAR TÓPICO */}
            {isEditTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" className="small-modal"> 
                        <h2>Editar Tópico</h2>
                        <input 
                            type="text" 
                            placeholder="Nome" 
                            maxLength={20} 
                            value={editingTopicName} 
                            onChange={e => setEditingTopicName(e.target.value)} 
                        />
                        <div style={{textAlign:'right', fontSize:'12px', fontWeight:'800', marginTop:'5px'}}>
                            {editingTopicName.length}/20
                        </div>
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsEditTopicModalOpen(false)}>Cancelar</button>
                            <button id="btn-save" className="btn-primary" onClick={handleUpdateTopic}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);