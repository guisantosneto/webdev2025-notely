// client/app.js
const { useState, useEffect } = React;

// --- COMPONENTE: NOTA INDIVIDUAL ---
function Note({ note }) {
    // Formatar data
    const dateStr = new Date(note.createdAt).toLocaleDateString();
    // Classes de cor baseadas no style.css
    const colorClass = note.color ? `bg-${note.color}` : 'bg-yellow';

    return (
        <div className={`note-card ${colorClass}`}>
            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <div className="date">{dateStr}</div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL (APP) ---
function App() {
    // ESTADOS (A "memória" da aplicação)
    const [notes, setNotes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [activeTopicId, setActiveTopicId] = useState(null); // null = Todas as notas
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    // DADOS PARA NOVA NOTA (Estado do Formulário)
    const [newNoteTitle, setNewNoteTitle] = useState("");
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteTopic, setNewNoteTopic] = useState("");
    const [newNoteColor, setNewNoteColor] = useState("yellow");

    // 1. CARREGAR DADOS AO INICIAR
    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            const resNotes = await fetch('/api/notes');
            const dataNotes = await resNotes.json();
            setNotes(dataNotes);

            const resTopics = await fetch('/api/topics');
            const dataTopics = await resTopics.json();
            setTopics(dataTopics);
        } catch (error) {
            console.error("Erro ao carregar:", error);
        }
    };

    // 2. GUARDAR NOVA NOTA
    const handleSaveNote = async () => {
        if (!newNoteTitle) return alert("Título é obrigatório!");

        const novaNota = {
            title: newNoteTitle,
            content: newNoteContent,
            color: newNoteColor,
            topicId: newNoteTopic || null
        };

        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaNota)
        });

        if (res.ok) {
            setIsModalOpen(false); // Fecha modal
            setNewNoteTitle(""); setNewNoteContent(""); // Limpa form
            carregarDados(); // Recarrega lista
        }
    };

    // 3. FILTRAGEM
    // Filtra primeiro por Tópico, depois por Pesquisa
    const filteredNotes = notes.filter(note => {
        const matchTopic = activeTopicId === null || note.topicId === activeTopicId;
        const matchSearch = note.title.toLowerCase().includes(search.toLowerCase()) || 
                            note.content.toLowerCase().includes(search.toLowerCase());
        return matchTopic && matchSearch;
    });

    const activeTopicName = activeTopicId 
        ? topics.find(t => t._id === activeTopicId)?.name 
        : "Todas as Notas";

    return (
        <div id="app-container">
            {/* SIDEBAR */}
            <aside id="sidebar">
                <div className="brand"><h1>Notely</h1></div>
                <div className="actions">
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ New Note</button>
                </div>
                <div className="topics-section">
                    <h3>Topics</h3>
                    <ul id="topics-list">
                        <li className={activeTopicId === null ? 'active' : ''} 
                            onClick={() => setActiveTopicId(null)}>
                            Todas as Notas
                        </li>
                        {topics.map(topic => (
                            <li key={topic._id} 
                                className={activeTopicId === topic._id ? 'active' : ''}
                                onClick={() => setActiveTopicId(topic._id)}>
                                {topic.name}
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main id="main-content">
                <header>
                    <h2 id="current-topic-title">{activeTopicName}</h2>
                    <div className="search-box">
                        <input 
                            type="text" 
                            placeholder="Search notes..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </header>

                <div id="notes-grid">
                    {filteredNotes.map(note => (
                        <Note key={note._id} note={note} />
                    ))}
                </div>
            </main>

            {/* MODAL */}
            {isModalOpen && (
                <div id="modal-overlay">
                    <div id="modal-content">
                        <h2>Nova Nota</h2>
                        <label>Título</label>
                        <input type="text" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} />
                        
                        <label>Tópico</label>
                        <select value={newNoteTopic} onChange={e => setNewNoteTopic(e.target.value)}>
                            <option value="">Sem Tópico</option>
                            {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>

                        <label>Cor</label>
                        <div className="color-picker">
                            {['yellow', 'blue', 'green', 'red'].map(color => (
                                <button 
                                    key={color}
                                    className={`color-btn bg-${color} ${newNoteColor === color ? 'selected' : ''}`}
                                    onClick={() => setNewNoteColor(color)}
                                ></button>
                            ))}
                        </div>

                        <label>Conteúdo</label>
                        <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}></textarea>

                        <div className="modal-actions">
                            <button id="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                            <button id="btn-save" className="btn-primary" onClick={handleSaveNote}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Renderizar a App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);