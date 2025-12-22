const { useState, useEffect, useRef } = React;

/* --- COMPONENTE 1: ALERTA SIMPLES (Só botão OK) --- */
function CustomAlert({ message, onClose }) {
    if (!message) return null;
    return (
        <div id="modal-overlay" onClick={onClose}>
            <div id="modal-content" style={{maxWidth: '400px', textAlign: 'center'}} onClick={e => e.stopPropagation()}>
                <h2 style={{border:'none', paddingBottom:0, marginBottom:'10px'}}>AVISO</h2>
                <p style={{fontSize:'16px', marginBottom:'20px', lineHeight:'1.5'}}>{message}</p>
                <div className="modal-actions">
                    <button id="btn-save" style={{width:'100%'}} onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    );
}

/* --- COMPONENTE 2: CONFIRMAÇÃO (Sim / Não) --- */
function CustomConfirm({ message, onConfirm, onCancel }) {
    return (
        <div id="modal-overlay" onClick={onCancel}>
            <div id="modal-content" style={{maxWidth: '400px', textAlign: 'center'}} onClick={e => e.stopPropagation()}>
                <h2 style={{border:'none', paddingBottom:0, marginBottom:'10px'}}>TEM A CERTEZA?</h2>
                <p style={{fontSize:'16px', marginBottom:'20px', lineHeight:'1.5'}}>{message}</p>
                <div className="modal-actions">
                    <button id="btn-cancel" onClick={onCancel}>Cancelar</button>
                    <button id="btn-save" onClick={onConfirm}>Apagar</button>
                </div>
            </div>
        </div>
    );
}

function LoginScreen({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [alertMsg, setAlertMsg] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
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
                setAlertMsg("Conta criada! Faça login.");
                setIsRegistering(false);
                setPassword("");
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
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="submit" className="btn-primary">
                        {isRegistering ? 'Registar' : 'Entrar'}
                    </button>
                </form>
                <p className="toggle-link" onClick={() => { setIsRegistering(!isRegistering); setError(""); }}>
                    {isRegistering ? '← Voltar ao Login' : 'Não tem conta? Crie uma →'}
                </p>
            </div>
            <CustomAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
        </div>
    );
}

function Note({ note, onMouseDown, onDelete }) {
    const dateStr = new Date(note.createdAt).toLocaleDateString();
    const colorClass = note.color ? `bg-${note.color}` : 'bg-yellow';
    const style = {
        left: `${note.x || 50}px`, top: `${note.y || 50}px`,
        zIndex: note.isDragging ? 1000 : 1
    };

    return (
        <div className={`note-card ${colorClass}`} style={style} onMouseDown={(e) => onMouseDown(e, note._id)}>
            <div className="note-header">
                <h3>{note.title}</h3>
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(note._id); }}>&times;</button>
            </div>
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

    // Modais e Formulários
    const [modalState, setModalState] = useState({ type: null, data: null }); 
    const [formData, setFormData] = useState({ title: "", content: "", color: "yellow", topicId: "", name: "", joinCode: "" });
    
    // ESTADOS PARA OS POPUPS PERSONALIZADOS
    const [alertMsg, setAlertMsg] = useState(null);
    const [confirmState, setConfirmState] = useState({ show: false, action: null, id: null, name: null });

    const draggingIdRef = useRef(null);
    draggingIdRef.current = draggingId;

    useEffect(() => {
        if (!token) return;
        carregarDados();
        const intervalId = setInterval(() => {
            if (draggingIdRef.current === null) carregarDados(true); 
        }, 2000);
        return () => clearInterval(intervalId);
    }, [token]);

    const authFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: { ...options.headers, 'Authorization': token, 'Content-Type': 'application/json' }
        });
    };

    const carregarDados = async () => {
        try {
            const resNotes = await authFetch('/api/notes');
            if (resNotes.status === 401) return logout();
            const notesData = await resNotes.json();
            
            if (draggingIdRef.current === null) {
                setNotes(notesData);
            }

            const resTopics = await authFetch('/api/topics');
            const loadedTopics = await resTopics.json();
            setTopics(loadedTopics);

            setActiveTopicId(prev => {
                if (prev && loadedTopics.find(t => t._id === prev)) return prev;
                return loadedTopics.length > 0 ? loadedTopics[0]._id : null;
            });
        } catch (error) { 
            if (error.message !== "Failed to fetch") console.error(error); 
        }
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

    // --- Drag ---
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
        await authFetch(`/api/notes?id=${note._id}`, { method: 'PUT', body: JSON.stringify({ x: note.x, y: note.y }) });
        setDraggingId(null);
        carregarDados();
    };

    // --- ELIMINAÇÃO COM POPUP PERSONALIZADO ---
    
    // 1. Quando clica no lixo da Nota
    const clickDeleteNote = (id) => {
        setConfirmState({ show: true, action: 'note', id: id });
    };

    // 2. Quando clica no lixo do Tópico
    const clickDeleteTopic = (e, id, name) => {
        e.stopPropagation();
        setConfirmState({ show: true, action: 'topic', id: id, name: name });
    };

    // 3. Quando confirma "Sim, apagar"
    const executeDelete = async () => {
        if (confirmState.action === 'note') {
            await authFetch(`/api/notes?id=${confirmState.id}`, { method: 'DELETE' });
            setNotes(prev => prev.filter(n => n._id !== confirmState.id));
        } else if (confirmState.action === 'topic') {
            await authFetch(`/api/topics?id=${confirmState.id}`, { method: 'DELETE' });
            carregarDados();
        }
        setConfirmState({ show: false, action: null, id: null });
    };

    // --- OUTRAS AÇÕES ---
    const handleSaveNote = async () => {
        if (!formData.title) return setAlertMsg("Título obrigatório!");
        const topicToUse = formData.topicId || activeTopicId;
        if (!topicToUse) return setAlertMsg("Crie um tópico primeiro!");

        const newNote = { 
            title: formData.title, content: formData.content, color: formData.color, 
            topicId: topicToUse, x: 100, y: 100 
        };
        await authFetch('/api/notes', { method: 'POST', body: JSON.stringify(newNote) });
        closeModal(); carregarDados();
    };

    const handleSaveTopic = async () => {
        if (!formData.name) return;
        await authFetch('/api/topics', { method: 'POST', body: JSON.stringify({ name: formData.name }) });
        closeModal(); carregarDados();
    };

    const handleUpdateTopic = async () => {
        await authFetch(`/api/topics?id=${modalState.data._id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name }) });
        closeModal(); carregarDados();
    };

    const handleJoinTopic = async () => {
        if (!formData.joinCode) return setAlertMsg("Insira o código!");
        const res = await authFetch('/api/topics/join', { method: 'POST', body: JSON.stringify({ code: formData.joinCode }) });
        if (!res.ok) return setAlertMsg("Código inválido ou erro ao entrar.");
        closeModal(); 
        carregarDados();
        setAlertMsg("Entraste no tópico com sucesso!");
    };

    const copyToClipboard = (text) => {
        if(!text) return setAlertMsg("Este tópico não tem código. Cria um novo!");
        navigator.clipboard.writeText(text);
        setAlertMsg("Código copiado!");
    };

    // --- Modais ---
    const openModal = (type, data = null) => {
        setModalState({ type, data });
        setFormData({ 
            title: "", content: "", color: "yellow", topicId: activeTopicId || "", 
            name: data ? data.name : "", joinCode: "" 
        });
    };
    const closeModal = () => setModalState({ type: null, data: null });

    if (!token) return <LoginScreen onLogin={handleLogin} />;

    const filteredNotes = notes.filter(n => n.topicId === activeTopicId && 
        (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    );
    const activeTopic = topics.find(t => t._id === activeTopicId);

    return (
        <div id="app-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <aside id="sidebar">
                <div className="sidebar-content">
                    <div className="brand"><h1>Notely</h1></div>
                    
                    <div className="actions">
                        <button className="btn-primary" onClick={() => openModal('createNote')}>+ Nota</button>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <button className="btn-secondary" style={{flex:1}} onClick={() => openModal('createTopic')}>+ Tópico</button>
                            <button className="btn-secondary" style={{flex:1}} onClick={() => openModal('joinTopic')}>Junta-te ↵</button>
                        </div>
                    </div>

                    <div className="topics-section">
                        <h3>Os teus Tópicos</h3>
                        <ul id="topics-list">
                            {topics.map(t => (
                                <li key={t._id} className={activeTopicId === t._id ? 'active' : ''} onClick={() => setActiveTopicId(t._id)}>
                                    <span>{t.name}</span>
                                    <div className="topic-actions-group">
                                        <button className="icon-btn share" title="Partilhar" onClick={(e) => { e.stopPropagation(); openModal('shareTopic', t); }}>🔗</button>
                                        <button className="icon-btn" title="Editar" onClick={(e) => { e.stopPropagation(); openModal('editTopic', t); }}>✎</button>
                                        <button className="icon-btn delete" title="Apagar" onClick={(e) => clickDeleteTopic(e, t._id, t.name)}>&times;</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="user-profile">
                    <div className="avatar">{userEmail.charAt(0).toUpperCase()}</div>
                    <div className="user-info">
                        <span className="email-text">{userEmail}</span>
                        <button onClick={logout} className="logout-link">Sair</button>
                    </div>
                </div>
            </aside>

            <main id="main-content">
                <header>
                    <div id="current-topic-title">{activeTopic ? activeTopic.name : "Seleciona um Tópico"}</div>
                    <div className="search-box">
                        <input type="text" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </header>
                <div id="notes-grid">
                    {filteredNotes.map(n => <Note key={n._id} note={n} onMouseDown={handleMouseDown} onDelete={clickDeleteNote} />)}
                </div>
            </main>

            {/* --- MODAIS DE FORMULÁRIO --- */}
            {modalState.type && (
                <div id="modal-overlay">
                    <div id="modal-content" className={['createTopic', 'joinTopic', 'shareTopic'].includes(modalState.type) ? 'small-modal' : ''}>
                        
                        {/* 1. NOVA NOTA */}
                        {modalState.type === 'createNote' && <>
                            <h2>Nova Nota</h2>
                            <input type="text" placeholder="Título" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} autoFocus />
                            <div className="color-picker">
                                {['yellow', 'blue', 'green', 'red'].map(c => (
                                    <button key={c} className={`color-btn bg-${c} ${formData.color === c ? 'selected' : ''}`} onClick={() => setFormData({...formData, color: c})}></button>
                                ))}
                            </div>
                            <textarea placeholder="Conteúdo..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
                            <div className="modal-actions">
                                <button id="btn-cancel" onClick={closeModal}>Cancelar</button>
                                <button id="btn-save" onClick={handleSaveNote}>Guardar</button>
                            </div>
                        </>}

                        {/* 2. NOVO TÓPICO */}
                        {modalState.type === 'createTopic' && <>
                            <h2>Novo Tópico</h2>
                            <input type="text" placeholder="Nome" maxLength={20} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
                            <div className="modal-actions">
                                <button id="btn-cancel" onClick={closeModal}>Cancelar</button>
                                <button id="btn-save" onClick={handleSaveTopic}>Criar</button>
                            </div>
                        </>}

                        {/* 3. EDITAR TÓPICO */}
                        {modalState.type === 'editTopic' && <>
                            <h2>Renomear</h2>
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
                            <div className="modal-actions">
                                <button id="btn-cancel" onClick={closeModal}>Cancelar</button>
                                <button id="btn-save" onClick={handleUpdateTopic}>Salvar</button>
                            </div>
                        </>}

                        {/* 4. ENTRAR EM TÓPICO (JOIN) */}
                        {modalState.type === 'joinTopic' && <>
                            <h2>Entrar em Tópico</h2>
                            <p style={{textAlign:'center', marginBottom:'10px'}}>Cola aqui o código que te enviaram:</p>
                            <input type="text" placeholder="Ex: A1B2C3" maxLength={6} style={{textAlign:'center', letterSpacing:'2px'}} value={formData.joinCode} onChange={e => setFormData({...formData, joinCode: e.target.value.toUpperCase()})} autoFocus />
                            <div className="modal-actions">
                                <button id="btn-cancel" onClick={closeModal}>Cancelar</button>
                                <button id="btn-save" onClick={handleJoinTopic}>Junta-te</button>
                            </div>
                        </>}

                        {/* 5. PARTILHAR (SHARE) */}
                        {modalState.type === 'shareTopic' && <>
                            <h2>Partilhar</h2>
                            <p className="small-text">Envia este código aos teus amigos:</p>
                            <div className="share-code-display" onClick={() => copyToClipboard(modalState.data.shareCode)}>
                                {modalState.data.shareCode || "SEM CÓDIGO"}
                            </div>
                            {!modalState.data.shareCode && <p style={{color:'red', fontSize:'10px', textAlign:'center'}}>Tópico antigo. Cria um novo para teres código.</p>}
                            <p className="small-text" style={{fontSize:'10px'}}>(Clica para copiar)</p>
                            <div className="modal-actions">
                                <button id="btn-save" style={{width:'100%'}} onClick={closeModal}>Fechar</button>
                            </div>
                        </>}

                    </div>
                </div>
            )}

            {/* --- ALERTA (Aviso) --- */}
            <CustomAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

            {/* --- CONFIRMAÇÃO (Apagar) --- */}
            {confirmState.show && (
                <CustomConfirm 
                    message={confirmState.action === 'note' ? "Tens a certeza que queres apagar esta nota?" : "Tens a certeza que queres apagar este tópico?"}
                    onConfirm={executeDelete}
                    onCancel={() => setConfirmState({ show: false, action: null })}
                />
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);