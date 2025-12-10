// client/app.js

let allNotes = [];
let allTopics = [];
let currentTopicId = null; 
let selectedColor = 'yellow'; // Cor selecionada no modal

document.addEventListener('DOMContentLoaded', async () => {
    await carregarTopicos();
    await carregarNotas();
    setupEventListeners();
});

function setupEventListeners() {
    // 1. Botão "+ New Note" abre o modal
    const btnNew = document.getElementById('btn-new-note');
    if (btnNew) btnNew.addEventListener('click', abrirModal);

    // 2. Botões do Modal
    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) btnCancel.addEventListener('click', fecharModal);

    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.addEventListener('click', salvarNotaDoModal);

    // 3. Seleção de Cores no Modal
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            // Remove classe 'selected' de todos e adiciona ao clicado
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
            event.target.classList.add('selected');
            selectedColor = event.target.dataset.color;
        });
    });

    // 4. Pesquisa
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const texto = event.target.value.toLowerCase();
            const notasFiltradas = allNotes.filter(n => 
                n.title.toLowerCase().includes(texto) || 
                n.content.toLowerCase().includes(texto)
            );
            renderizarNotas(notasFiltradas);
        });
    }
}

// --- LÓGICA DO MODAL ---

function abrirModal() {
    // Preencher o select de tópicos
    const select = document.getElementById('modal-topic');
    select.innerHTML = '<option value="">Sem Tópico</option>';
    
    allTopics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic._id;
        option.innerText = topic.name;
        select.appendChild(option);
    });

    // Se já estivermos num tópico específico, selecionar automaticamente
    if (currentTopicId) {
        select.value = currentTopicId;
    }

    // Limpar campos
    document.getElementById('modal-title').value = '';
    document.getElementById('modal-text').value = '';
    selectedColor = 'yellow'; // Reset cor
    
    // Reset visual dos botões de cor
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    const defaultColorBtn = document.querySelector('.bg-yellow');
    if (defaultColorBtn) defaultColorBtn.classList.add('selected');

    // Mostrar modal
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function fecharModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function salvarNotaDoModal() {
    const tituloInput = document.getElementById('modal-title');
    const textoInput = document.getElementById('modal-text');
    const topicoInput = document.getElementById('modal-topic');

    const titulo = tituloInput.value;
    const texto = textoInput.value;
    const topicoId = topicoInput.value || null;

    if (!titulo) {
        alert("A nota precisa de um título!");
        return;
    }

    const novaNota = {
        title: titulo,
        content: texto,
        color: selectedColor,
        topicId: topicoId,
        createdAt: new Date()
    };

    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaNota)
        });

        if (response.ok) {
            const notaSalva = await response.json();
            allNotes.push(notaSalva);
            
            // Se a nota for do tópico atual (ou estivermos a ver "Todas"), atualizamos o ecrã
            if (currentTopicId === null || currentTopicId === topicoId) {
                // Força atualização visual
                window.filtrarPorTopico(currentTopicId);
            }
            
            fecharModal();
        } else {
            alert('Erro ao guardar nota.');
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

// --- FUNÇÕES DE API E RENDERIZAÇÃO ---

async function carregarTopicos() {
    try {
        const response = await fetch('/api/topics');
        allTopics = await response.json();
        
        const lista = document.getElementById('topics-list');
        lista.innerHTML = `<li class="active" onclick="filtrarPorTopico(null)">Todas as Notas</li>`;

        allTopics.forEach(topic => {
            const li = document.createElement('li');
            li.innerText = topic.name;
            li.dataset.id = topic._id; 
            li.onclick = () => filtrarPorTopico(topic._id);
            lista.appendChild(li);
        });
    } catch (error) {
        console.error("Erro:", error);
    }
}

async function carregarNotas() {
    try {
        const response = await fetch('/api/notes');
        allNotes = await response.json();
        renderizarNotas(allNotes); 
    } catch (error) {
        console.error("Erro:", error);
    }
}

function renderizarNotas(notasParaMostrar) {
    const grid = document.getElementById('notes-grid');
    grid.innerHTML = ''; 

    if (notasParaMostrar.length === 0) {
        grid.innerHTML = '<p style="color:#666; width:100%;">Nenhuma nota encontrada.</p>';
        return;
    }

    notasParaMostrar.forEach(note => {
        const card = document.createElement('div');
        const corClass = note.color ? `bg-${note.color}` : 'bg-yellow';
        card.className = `note-card ${corClass}`;

        // Formata data
        const dataFormatada = new Date(note.createdAt).toLocaleDateString();

        card.innerHTML = `
            <h3>${note.title}</h3>
            <p>${note.content}</p>
            <div class="date">${dataFormatada}</div>
        `;
        grid.appendChild(card);
    });
}

window.filtrarPorTopico = function(topicId) {
    currentTopicId = topicId;
    
    const items = document.querySelectorAll('#topics-list li');
    items.forEach(li => {
        li.classList.remove('active');
        if (li.dataset.id === topicId || (topicId === null && !li.dataset.id)) {
            li.classList.add('active');
        }
    });

    const titulo = document.getElementById('current-topic-title');
    if (topicId === null) {
        titulo.innerText = "Todas as Notas";
        renderizarNotas(allNotes);
    } else {
        const topicoObj = allTopics.find(t => t._id === topicId);
        titulo.innerText = topicoObj ? topicoObj.name : "Tópico";
        const notasFiltradas = allNotes.filter(n => n.topicId === topicId);
        renderizarNotas(notasFiltradas);
    }
};