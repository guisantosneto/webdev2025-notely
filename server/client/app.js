const { useState, useEffect } = React;

function LoginScreen({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Simple validation
        if (!email || !password) {
            setError("Please fill in all fields.");
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

            if (!res.ok) throw new Error(data.error || "Unknown error");

            if (isRegistering) {
                alert("Account created successfully! Please log in.");
                setIsRegistering(false); // Switch to login screen
                setPassword(""); // Clear password for security
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
                <h3>{isRegistering ? 'Create Account' : 'Login'}</h3>
                
                {error && <p className="error-msg">{error}</p>}
                
                <form onSubmit={handleSubmit}>
                    <input 
                        type="email" 
                        placeholder="Your email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Your password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                    />
                    <button type="submit" className="btn-primary">
                        {isRegistering ? 'Register' : 'Login Now'}
                    </button>
                </form>
                
                <p className="toggle-link" onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(""); // Clear errors when switching
                }}>
                    {isRegistering ? '← Back to Login' : 'No account? Create one →'}
                </p>
            </div>
        </div>
    );
}

// --- NOTE COMPONENT ---
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

// --- MAIN APP ---
function App() {
    const [token, setToken] = useState(localStorage.getItem('notely_token'));
    const [userEmail, setUserEmail] = useState(localStorage.getItem('notely_email'));
    
    // Data States
    const [notes, setNotes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [activeTopicId, setActiveTopicId] = useState(null);
    const [search, setSearch] = useState("");
    
    // Drag States
    const [draggingId, setDraggingId] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Modals
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    
    // Edit Topic Modal
    const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
    const [editingTopicId, setEditingTopicId] = useState(null);
    const [editingTopicName, setEditingTopicName] = useState("");

    // Form States
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteTopic, setNewNoteTopic] = useState("");
    const [newNoteColor, setNewNoteColor] = useState("yellow");
    const [newTopicName, setNewTopicName] = useState("");

    // --- EFFECT: Load data ONLY if token exists ---
    useEffect(() => {
        if (token) carregarDados();
    }, [token]);

    // Helper for Auth Fetch
    const authFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': token, 
                'Content-Type': 'application/json'
            }
        });
    };

    const carregarDados = async () => {
        try {
            const resNotes = await authFetch('/api/notes');
            if (resNotes.status === 401) return logout(); // Token expired
            setNotes(await resNotes.json());

            const resTopics = await authFetch('/api/topics');
            const loadedTopics = await resTopics.json();
            setTopics(loadedTopics);

            // Auto-select first topic if none active
            if (loadedTopics.length > 0) {
                setActiveTopicId(prevId => {
                    const topicExists = loadedTopics.find(t => t._id === prevId);
                    return topicExists ? prevId : loadedTopics[0]._id;
                });
            } else {
                setActiveTopicId(null);
            }

        } catch (error) { console.error("Error:", error); }
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

    // IF NOT LOGGED IN, SHOW LOGIN SCREEN
    if (!token) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    // --- LOGIC (Drag, Save, Delete) ---

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
        if (!newNoteTitle) return alert("Title is required!");
        
        // Use selected topic in modal OR current active topic
        const topicToUse = newNoteTopic || activeTopicId;
        
        if (!topicToUse) return alert("You must have a topic selected to create notes!");

        const randomX = 50 + Math.random() * 200; 
        const randomY = 50 + Math.random() * 200;
        
        const novaNota = { 
            title: newNoteTitle, 
            content: newNoteContent, 
            color: newNoteColor, 
            topicId: topicToUse, 
            x: randomX, 
            y: randomY 
        };
        
        await authFetch('/api/notes', { method: 'POST', body: JSON.stringify(novaNota) });
        setIsNoteModalOpen(false); setNewNoteTitle(""); setNewNoteContent(""); carregarDados();
    };

    const handleDeleteNote = async (id) => {
        if(!confirm("Delete note?")) return;
        await authFetch(`/api/notes?id=${id}`, { method: 'DELETE' });
        setNotes(notes.filter(n => n._id !== id));
    };

    const handleSaveTopic = async () => {
        if (!newTopicName) return;
        await authFetch('/api/topics', { method: 'POST', body: JSON.stringify({ name: newTopicName }) });
        setIsTopicModalOpen(false); setNewTopicName(""); carregarDados();
    };

    // Open Edit Modal
    const openEditTopic = (e, topic) => {
        e.stopPropagation(); 
        setEditingTopicId(topic._id);
        setEditingTopicName(topic.name);
        setIsEditTopicModalOpen(true);
    };

    // Save Edit
    const handleUpdateTopic = async () => {
        if (!editingTopicName) return;
        
        const res = await authFetch(`/api/topics?id=${editingTopicId}`, { 
            method: 'PUT', 
            body: JSON.stringify({ name: editingTopicName }) 
        });

        if (!res.ok) {
            const data = await res.json();
            return alert(data.error || "Error updating");
        }

        setIsEditTopicModalOpen(false);
        carregarDados();
    };

    const handleDeleteTopic = async (e, id, name) => {
        e.stopPropagation();
        if (!confirm(`Delete topic "${name}"? Notes will become hidden until moved.`)) return;

        await authFetch(`/api/topics?id=${id}`, { method: 'DELETE' });
        carregarDados();
    };

    // Filter notes by Active Topic
    const filteredNotes = notes.filter(n => {
        return (n.topicId === activeTopicId) &&
               (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));
    });
    
    const activeTopicName = activeTopicId ? topics.find(t => t._id === activeTopicId)?.name : "Select a Topic";

    return (
        <div id="app-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <aside id="sidebar">
                {/* TOP PART (Logo + Actions + Topics) */}
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
                                    {/* Edit Button */}
                                    <button className="icon-btn" title="Edit" onClick={(e) => openEditTopic(e, t)}>✎</button>
                                    
                                    {/* Delete Button */}
                                    <button 
                                        className="icon-btn delete" 
                                        title="Delete"
                                        onClick={(e) => handleDeleteTopic(e, t._id, t.name)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </li>
                        ))}
                        </ul>
                    </div>
                </div>

                {/* BOTTOM PART (Profile + Logout) */}
                <div className="user-profile">
                    <div className="avatar">
                        {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
                    </div>
                    
                    <div className="user-info">
                        <span className="email-text">{userEmail}</span>
                        <button onClick={logout} className="logout-link">Logout</button>
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
                    
                    {/* Empty State Message */}
                    {filteredNotes.length === 0 && activeTopicId && (
                        <div style={{ padding: '20px', color: '#666' }}>
                            <p>Empty topic. Create a new note!</p>
                        </div>
                    )}
                </div>
            </main>

            {/* CREATE NOTE MODAL */}
            {isNoteModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content">
                        <h2>New Note</h2>
                        <input type="text" placeholder="Title" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} />
                        
                        <select value={newNoteTopic} onChange={e => setNewNoteTopic(e.target.value)}>
                            <option value="">(Current Topic: {activeTopicName})</option>
                            {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                        
                        <div className="color-picker">
                            {['yellow', 'blue', 'green', 'red'].map(c => (
                                <button key={c} className={`color-btn bg-${c} ${newNoteColor === c ? 'selected' : ''}`} onClick={() => setNewNoteColor(c)}></button>
                            ))}
                        </div>
                        <textarea placeholder="Content" value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}></textarea>
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsNoteModalOpen(false)}>Cancel</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveNote}>Save</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* CREATE TOPIC MODAL */}
             {isTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" className="small-modal"> 
                        <h2>New Topic</h2>
                        
                        <input 
                            type="text" 
                            placeholder="Topic Name" 
                            maxLength={20}
                            value={newTopicName} 
                            onChange={e => setNewTopicName(e.target.value)} 
                        />
                        
                        <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: '800', marginTop: '5px' }}>
                            {newTopicName.length}/20
                        </div>

                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsTopicModalOpen(false)}>Cancel</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveTopic}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT TOPIC MODAL */}
            {isEditTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" className="small-modal"> 
                        <h2>Edit Topic</h2>
                        <input 
                            type="text" 
                            placeholder="Name" 
                            maxLength={20} 
                            value={editingTopicName} 
                            onChange={e => setEditingTopicName(e.target.value)} 
                        />
                        <div style={{textAlign:'right', fontSize:'12px', fontWeight:'800', marginTop:'5px'}}>
                            {editingTopicName.length}/20
                        </div>
                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsEditTopicModalOpen(false)}>Cancel</button>
                            <button id="btn-save" className="btn-primary" onClick={handleUpdateTopic}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);