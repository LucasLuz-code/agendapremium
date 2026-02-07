/**
 * AGENDA ESTUDANTIL PRO - CORE SCRIPT
 * Lógica de gerenciamento de estado, integração Supabase e UI dinâmico.
 */

// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://brrkgsmvyalxeknrdsqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_i8agnGLp1kfs4g7zrC8Z9g_XvZ7bzPN';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let state = {
    tasks: [],
    filter: 'Todos',
    search: '',
    isDarkMode: false
};

// --- ELEMENTOS DO DOM ---
const dom = {
    listPending: document.getElementById('list-pending'),
    listCompleted: document.getElementById('list-completed'),
    countPending: document.getElementById('count-pending'),
    countCompleted: document.getElementById('count-completed'),
    modalForm: document.getElementById('modal-form'),
    modalDetails: document.getElementById('modal-details'),
    taskForm: document.getElementById('task-form'),
    tccFields: document.getElementById('tcc-fields'),
    searchInput: document.getElementById('search-input'),
    themeToggle: document.getElementById('theme-toggle'),
    loader: document.getElementById('loader'),
    navItems: document.querySelectorAll('.nav-item')
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando Agenda Estudantil Pro...');
    
    // 1. Carregar Tema
    initTheme();
    
    // 2. Carregar Dados do Supabase
    await fetchTasks();
    
    // 3. Configurar Drag & Drop
    initSortable();
    
    // 4. Remover Loader
    setTimeout(() => dom.loader.style.opacity = '0', 500);
    setTimeout(() => dom.loader.style.display = 'none', 1000);
});

// --- FUNÇÕES DE DADOS (SUPABASE) ---

/**
 * Busca todas as tarefas do banco de dados
 */
async function fetchTasks() {
    try {
        const { data, error } = await supabaseClient
            .from('tarefas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        state.tasks = data || [];
        render();
    } catch (err) {
        showError('Erro ao carregar tarefas', err);
    }
}

/**
 * Salva ou Atualiza uma tarefa
 */
async function handleSaveTask(e) {
    e.preventDefault();
    
    const id = document.getElementById('task-id').value;
    const taskData = {
        description: document.getElementById('f-description').value,
        date: document.getElementById('f-date').value || null,
        priority: document.getElementById('f-priority').value,
        category: document.getElementById('f-category').value,
        details: document.getElementById('f-details').value,
        completed: false
    };

    try {
        let response;
        if (id) {
            // Modo Edição
            response = await supabaseClient
                .from('tarefas')
                .update(taskData)
                .eq('id', id);
        } else {
            // Modo Criação
            response = await supabaseClient
                .from('tarefas')
                .insert([taskData]);
        }

        if (response.error) throw response.error;
        
        closeModals();
        await fetchTasks();
    } catch (err) {
        showError('Erro ao salvar tarefa', err);
    }
}

/**
 * Deleta uma tarefa
 */
async function deleteTask(id) {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;

    try {
        const { error } = await supabaseClient
            .from('tarefas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao excluir', err);
    }
}

/**
 * Alterna status de conclusão
 */
async function toggleComplete(id, currentStatus) {
    try {
        const { error } = await supabaseClient
            .from('tarefas')
            .update({ completed: !currentStatus })
            .eq('id', id);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao atualizar status', err);
    }
}

// --- RENDERIZAÇÃO E UI ---

/**
 * Renderiza a lista de tarefas baseada no estado atual
 */
function render() {
    // Filtragem
    const filtered = state.tasks.filter(t => {
        const matchesFilter = state.filter === 'Todos' || t.category === state.filter;
        const matchesSearch = t.description.toLowerCase().includes(state.search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const pending = filtered.filter(t => !t.completed);
    const completed = filtered.filter(t => t.completed);

    // Injeção de HTML
    dom.listPending.innerHTML = pending.map(t => createCardHTML(t)).join('');
    dom.listCompleted.innerHTML = completed.map(t => createCardHTML(t)).join('');

    // Atualização de Contadores
    dom.countPending.textContent = pending.length;
    dom.countCompleted.textContent = completed.length;
}

/**
 * Gera o HTML de um card de tarefa
 */
function createCardHTML(task) {
    const dateFormatted = task.date ? new Date(task.date).toLocaleDateString('pt-BR') : 'Sem data';
    const isTCC = task.category === 'TCC';

    return `
        <div class="task-card prio-${task.priority} ${task.completed ? 'completed' : ''} animate__animated animate__fadeIn" data-id="${task.id}">
            <div class="task-main">
                <div class="check-btn" onclick="toggleComplete('${task.id}', ${task.completed})">
                    <i class="fas fa-check"></i>
                </div>
                <div class="task-content">
                    <span class="task-title">${task.description}</span>
                    <div class="task-meta">
                        <div class="meta-item"><i class="far fa-calendar"></i> ${dateFormatted}</div>
                        <div class="tag tag-${task.category.toLowerCase()}">${task.category}</div>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                ${isTCC && task.details ? `
                    <button class="btn-icon" onclick="showTccDetails('${task.id}')" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                ` : ''}
                <button class="btn-icon" onclick="openEditModal('${task.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteTask('${task.id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

// --- EVENTOS DE INTERFACE ---

// Abrir Modal de Criação
document.getElementById('btn-new-task').addEventListener('click', () => {
    dom.taskForm.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('modal-title').textContent = 'Criar Nova Tarefa';
    dom.tccFields.classList.add('hidden');
    dom.modalForm.classList.add('active');
});

// Fechar Modais
document.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
});

function closeModals() {
    dom.modalForm.classList.remove('active');
    dom.modalDetails.classList.remove('active');
}

// Lógica de Categoria TCC
document.getElementById('f-category').addEventListener('change', (e) => {
    if (e.target.value === 'TCC') {
        dom.tccFields.classList.remove('hidden');
        document.getElementById('f-details').required = true;
    } else {
        dom.tccFields.classList.add('hidden');
        document.getElementById('f-details').required = false;
    }
});

// Salvar Tarefa
dom.taskForm.addEventListener('submit', handleSaveTask);

// Editar Tarefa
window.openEditModal = (id) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('task-id').value = task.id;
    document.getElementById('f-description').value = task.description;
    document.getElementById('f-date').value = task.date || '';
    document.getElementById('f-priority').value = task.priority;
    document.getElementById('f-category').value = task.category;
    document.getElementById('f-details').value = task.details || '';

    document.getElementById('modal-title').textContent = 'Editar Tarefa';
    if (task.category === 'TCC') dom.tccFields.classList.remove('hidden');
    
    dom.modalForm.classList.add('active');
};

// Detalhes TCC
window.showTccDetails = (id) => {
    const task = state.tasks.find(t => t.id === id);
    const content = document.getElementById('details-content');
    
    content.innerHTML = `
        <div class="input-group">
            <label>Descrição</label>
            <p style="font-weight: 700; font-size: 1.1rem;">${task.description}</p>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Data</label>
                <p>${task.date || 'Não definida'}</p>
            </div>
            <div class="input-group">
                <label>Prioridade</label>
                <p style="color: var(--prio-${task.priority}); font-weight: 800; text-transform: uppercase;">${task.priority}</p>
            </div>
        </div>
        <div class="input-group">
            <label>Etapas e Observações</label>
            <div style="background: var(--bg-main); padding: 15px; border-radius: 10px; white-space: pre-wrap; line-height: 1.6;">${task.details}</div>
        </div>
    `;
    dom.modalDetails.classList.add('active');
};

// Busca em Tempo Real
dom.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
});

// Filtros da Sidebar
dom.navItems.forEach(item => {
    item.addEventListener('click', () => {
        dom.navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.filter = item.dataset.filter;
        render();
    });
});

// --- UTILITÁRIOS ---

function initSortable() {
    new Sortable(dom.listPending, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        handle: '.task-card'
    });
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.body.classList.replace('light-mode', 'dark-mode');
        state.isDarkMode = true;
        updateThemeUI();
    }
}

dom.themeToggle.addEventListener('click', () => {
    state.isDarkMode = !state.isDarkMode;
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
    updateThemeUI();
});

function updateThemeUI() {
    const icon = dom.themeToggle.querySelector('i');
    const text = dom.themeToggle.querySelector('span');
    icon.className = state.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    text.textContent = state.isDarkMode ? 'Modo Claro' : 'Modo Escuro';
}

function showError(title, err) {
    console.error(`❌ ${title}:`, err);
    alert(`${title}\n\nVerifique o console para detalhes técnicos.`);
}