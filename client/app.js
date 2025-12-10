// Variáveis Globais para guardar os dados
let allNotes = [];
let allTopics = [];
let currentTopicId = null; // null significa "Todos"

document.addEventListener('DOMContentLoaded', async () => {
    await carregarTopicos();
    await carregarNotas();
});

// 1. Buscar Tópicos à API
async function carregarTopicos() {
    try {
        const res = await fetch('/api/topics');
        allTopics = await res.json();
        
        const lista = document.getElementById('topics-list');
        // Limpar lista (mantendo o "Todas as Notas")
        lista.innerHTML = `<li class="active" onclick="filtrarPorTopico(null)">Todas as Notas</li>`;

        allTopics.forEach(topic => {
            const li = document.createElement('li');
            li.innerText = topic.name;
            // Guardamos o ID do tópico no elemento HTML para saber qual é qual
            li.dataset.id = topic._id; 
            li.onclick = () => filtrarPorTopico(topic._id);
            lista.appendChild(li);
        });
    } catch (err) {
        console.error("Erro a carregar tópicos:", err);
    }
}

// 2. Buscar Notas à API
async function carregarNotas() {
    try {
        const res = await fetch('/api/notes');
        allNotes = await res.json();
        renderizarNotas(allNotes); // Desenha todas inicialmente
    } catch (err) {
        console.error("Erro a carregar notas:", err);
    }
}

// 3. Desenhar as notas no ecrã
function renderizarNotas(notasParaMostrar) {
    const grid = document.getElementById('notes-grid');
    grid.innerHTML = ''; // Limpar grelha

    if (notasParaMostrar.length === 0) {
        grid.innerHTML = '<p>Nenhuma nota encontrada.</p>';
        return;
    }

    notasParaMostrar.forEach(note => {
        const card = document.createElement('div');
        // Adiciona a classe da cor (ex: bg-yellow) se existir
        const corClass = note.color ? `bg-${note.color}` : 'bg-yellow';
        card.className = `note-card ${corClass}`;

        card.innerHTML = `
            <h3>${note.title}</h3>
            <p>${note.content}</p>
            <div class="date">${new Date(note.createdAt).toLocaleDateString()}</div>
        `;
        grid.appendChild(card);
    });
}

// 4. Filtrar quando clica num tópico
window.filtrarPorTopico = function(topicId) {
    currentTopicId = topicId;

    // Atualizar visual da Sidebar (Bold no selecionado)
    const items = document.querySelectorAll('#topics-list li');
    items.forEach(li => {
        li.classList.remove('active');
        if (li.dataset.id === topicId || (topicId === null && !li.dataset.id)) {
            li.classList.add('active');
        }
    });

    // Atualizar Título
    const titulo = document.getElementById('current-topic-title');
    if (topicId === null) {
        titulo.innerText = "Todas as Notas";
        renderizarNotas(allNotes);
    } else {
        // Encontrar o nome do tópico pelo ID
        const topicoObj = allTopics.find(t => t._id === topicId);
        titulo.innerText = topicoObj ? topicoObj.name : "Tópico";
        
        // Filtrar o array de notas
        const notasFiltradas = allNotes.filter(n => n.topicId === topicId);
        renderizarNotas(notasFiltradas);
    }
};

// 5. Pesquisa Simples (Opcional)
document.getElementById('search-input').addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase();
    const notasFiltradas = allNotes.filter(n => 
        n.title.toLowerCase().includes(texto) || 
        n.content.toLowerCase().includes(texto)
    );
    renderizarNotas(notasFiltradas);
});