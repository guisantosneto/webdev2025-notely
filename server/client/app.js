// client/app.js - Versão Drag & Drop

const { useState, useEffect, useRef } = React;

// --- COMPONENTE: NOTA ARRÁSTAVEL ---
function Note({ note, onMouseDown, onDelete }) {
    const dateStr = new Date(note.createdAt).toLocaleDateString();
    const colorClass = note.color ? `bg-${note.color}` : 'bg-yellow';

    // Estilo dinâmico para a posição
    const style = {
        left: `${note.x || 50}px`, // Se não tiver posição, usa 50px
        top: `${note.y || 50}px`,
        zIndex: note.isDragging ? 1000 : 1 // Traz para a frente se estiver a arrastar
    };

    return (
        <div 
            className={`note-card ${colorClass}`} 
            style={style}
            onMouseDown={(e) => onMouseDown(e, note._id)}
        >
            {/* Botão de Apagar */}
            <button className="delete-btn" onClick={(e) => {
                e.stopPropagation(); // Evita iniciar o arrasto ao clicar no X
                onDelete(note._id);
            }}>&times;</button>

            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <div className="date">{dateStr}</div>
        </div>
    );
}

// --- APP PRINCIPAL ---
function App() {
    // --- ESTADOS ---
    const [notes, setNotes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [activeTopicId, setActiveTopicId] = useState(null);
    const [search, setSearch] = useState("");
    
    // Estados de Arrastar (Drag)
    const [draggingId, setDraggingId] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 }); // Onde cliquei dentro da nota?

    // Modais
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

    // Form Data
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteTopic, setNewNoteTopic] = useState("");
    const [newNoteColor, setNewNoteColor] = useState("yellow");
    const [newTopicName, setNewTopicName] = useState("");

    useEffect(() => { carregarDados(); }, []);

    const carregarDados = async () => {
        try {
            const resNotes = await fetch('/api/notes');
            const dataNotes = await resNotes.json();
            setNotes(dataNotes);

            const resTopics = await fetch('/api/topics');
            setTopics(await resTopics.json());
        } catch (error) { console.error("Erro:", error); }
    };

    // --- LÓGICA DE ARRASTAR (DRAG AND DROP) ---
    
    // 1. Iniciar Arrasto (Clicou na nota)
    const handleMouseDown = (e, id) => {
        // Se clicar em inputs ou botões, não arrasta
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

        const note = notes.find(n => n._id === id);
        const startX = note.x || 50;
        const startY = note.y || 50;

        setDraggingId(id);
        // Calcula a diferença entre onde o rato está e onde a nota começa
        setOffset({
            x: e.clientX - startX,
            y: e.clientY - startY
        });
    };

    // 2. Mover o Rato (Atualiza visualmente)
    const handleMouseMove = (e) => {
        if (!draggingId) return; // Se não estou a arrastar nada, ignora

        const newX = e.clientX - offset.x;
        const newY = e.clientY - offset.y;

        // Atualiza o estado local para a nota mexer no ecrã
        setNotes(prevNotes => prevNotes.map(n => {
            if (n._id === draggingId) {
                return { ...n, x: newX, y: newY, isDragging: true };
            }
            return n;
        }));
    };

    // 3. Largar o Rato (Guarda na BD)
    const handleMouseUp = async () => {
        if (!draggingId) return;

        const note = notes.find(n => n._id === draggingId);
        
        // Remove a flag de dragging
        setNotes(prev => prev.map(n => n._id === draggingId ? { ...n, isDragging: false } : n));
        setDraggingId(null);

        // Guarda a nova posição no servidor (PUT)
        try {
            await fetch(`/api/notes?id=${note._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: note.x, y: note.y })
            });
        } catch (err) {
            console.error("Erro ao guardar posição:", err);
        }
    };

    // --- OUTRAS AÇÕES (Criar, Apagar, etc) ---

    const handleSaveNote = async () => {
        if (!newNoteTitle) return alert("Título obrigatório!");
        
        // Posição aleatória inicial para não ficarem todas empilhadas
        const randomX = 50 + Math.random() * 200; 
        const randomY = 50 + Math.random() * 200;

        const novaNota = { 
            title: newNoteTitle, content: newNoteContent, color: newNoteColor, topicId: newNoteTopic || null,
            x: randomX, y: randomY 
        };
        
        await fetch('/api/notes', { method: 'POST', body: JSON.stringify(novaNota) });
        setIsNoteModalOpen(false);
        setNewNoteTitle(""); setNewNoteContent("");
        carregarDados();
    };

    const handleDeleteNote = async (id) => {
        if(!confirm("Apagar nota?")) return;
        await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
        setNotes(notes.filter(n => n._id !== id));
    };

    const handleSaveTopic = async () => {
        if (!newTopicName) return;
        await fetch('/api/topics', { method: 'POST', body: JSON.stringify({ name: newTopicName }) });
        setIsTopicModalOpen(false); setNewTopicName("");
        carregarDados();
    };

    // Filtros
    const filteredNotes = notes.filter(n => {
        return (activeTopicId === null || n.topicId === activeTopicId) &&
               (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));
    });
    const activeTopicName = activeTopicId ? topics.find(t => t._id === activeTopicId)?.name : "Todas as Notas";

    return (
        <div id="app-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <aside id="sidebar">
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
            </aside>

            <main id="main-content">
                <header>
                    <h2 id="current-topic-title">{activeTopicName}</h2>
                    <div className="search-box">
                        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </header>
                
                {/* ÁREA DE ARRASTO */}
                <div id="notes-grid">
                    {filteredNotes.map(n => (
                        <Note key={n._id} note={n} onMouseDown={handleMouseDown} onDelete={handleDeleteNote} />
                    ))}
                </div>
            </main>

            {/* MODAIS (Cópia exata do anterior) */}
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
            
             {/* MODAL TÓPICO */}
             {isTopicModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content" style={{height: 'auto'}}> 
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