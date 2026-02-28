/**
 * AGENDA ESTUDANTIL PRO - CORE SCRIPT
 * Lógica de gerenciamento de estado, integração Supabase e UI dinâmico.
 * ATUALIZADO: Sistema de Status, Modal de Conclusão com Descrição e Ordenação por Data
 */

// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://brrkgsmvyalxeknrdsqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJycmtnc212eWFseGVrbnJkc3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDM2NzksImV4cCI6MjA4NjAxOTY3OX0.YzSioYO1H38eXzxMtAPOpjhYtxM1l68EE-6kRhsIUEA';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let state = {
    tasks: [],
    filter: 'Todos',
    search: '',
    isDarkMode: false,
    taskToComplete: null, // Armazena ID da tarefa sendo completada
    previousStatus: null // Armazena status anterior da tarefa
};

// --- ELEMENTOS DO DOM ---
const dom = {
    listPending: document.getElementById('list-pending'),
    listCompleted: document.getElementById('list-completed'),
    countPending: document.getElementById('count-pending'),
    countCompleted: document.getElementById('count-completed'),
    modalForm: document.getElementById('modal-form'),
    modalComplete: document.getElementById('modal-complete'),
    modalDetails: document.getElementById('modal-details'),
    taskForm: document.getElementById('task-form'),
    tccFields: document.getElementById('tcc-fields'),
    searchInput: document.getElementById('search-input'),
    themeToggle: document.getElementById('theme-toggle'),
    loader: document.getElementById('loader'),
    navItems: document.querySelectorAll('.nav-item'),
    completedByInput: document.getElementById('completed-by'),
    completionDescriptionInput: document.getElementById('completion-description'),
    btnConfirmComplete: document.getElementById('btn-confirm-complete')
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
 * Busca todas as tarefas do banco de dados e ordena por data
 */
async function fetchTasks() {
    try {
        const { data, error } = await supabaseClient
            .from('tarefas')
            .select('*')
            .order('date', { ascending: true, nullsFirst: false });

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
    const status = document.getElementById('f-status').value;
    
    const taskData = {
        description: document.getElementById('f-description').value,
        date: document.getElementById('f-date').value || null,
        priority: document.getElementById('f-priority').value,
        category: document.getElementById('f-category').value,
        details: document.getElementById('f-details').value,
        status: status,
        completed: status === 'pronto',
        completed_by: status === 'pronto' ? (document.getElementById('f-completed-by')?.value || null) : null
    };

    // Se mudou para "pronto" e não tem completed_by, abre modal de confirmação
    if (status === 'pronto' && !id) {
        // Salva temporariamente e depois abre modal
        state.pendingTaskData = taskData;
        closeModals();
        openCompleteModal(null, taskData);
        return;
    }

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
 * Altera o status da tarefa
 */
async function changeStatus(id, newStatus) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    // Se mudou para "pronto", abre modal para pedir nome e descrição
    if (newStatus === 'pronto') {
        // Guarda o status anterior para poder reverter
        state.previousStatus = task.status || 'ninguem-fazendo';
        openCompleteModal(id);
        return;
    }

    // Para outros status, apenas atualiza
    try {
        const { error } = await supabaseClient
            .from('tarefas')
            .update({ 
                status: newStatus,
                completed: false,
                completed_by: null,
                completion_description: null
            })
            .eq('id', id);

        if (error) throw error;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao atualizar status', err);
    }
}

/**
 * Abre modal de confirmação de conclusão
 */
function openCompleteModal(taskId, pendingData = null) {
    state.taskToComplete = taskId;
    state.pendingTaskData = pendingData;
    dom.completedByInput.value = '';
    dom.completionDescriptionInput.value = '';
    dom.modalComplete.classList.add('active');
    dom.completedByInput.focus();
}

/**
 * Cancela a conclusão e reverte o status anterior
 */
async function cancelComplete() {
    if (state.taskToComplete && state.previousStatus) {
        // Reverte para o status anterior
        try {
            const { error } = await supabaseClient
                .from('tarefas')
                .update({ 
                    status: state.previousStatus
                })
                .eq('id', state.taskToComplete);

            if (error) throw error;
            await fetchTasks();
        } catch (err) {
            showError('Erro ao reverter status', err);
        }
    }

    // Fecha modal e limpa estado
    dom.modalComplete.classList.remove('active');
    state.taskToComplete = null;
    state.previousStatus = null;
    state.pendingTaskData = null;
}

/**
 * Confirma a conclusão da tarefa com o nome e descrição
 */
async function confirmComplete() {
    const completedBy = dom.completedByInput.value.trim();
    const completionDescription = dom.completionDescriptionInput.value.trim();
    
    if (!completedBy) {
        alert('Por favor, digite quem completou a tarefa.');
        dom.completedByInput.focus();
        return;
    }

    if (!completionDescription) {
        alert('Por favor, descreva como a tarefa foi realizada.');
        dom.completionDescriptionInput.focus();
        return;
    }

    try {
        if (state.taskToComplete) {
            // Atualizando tarefa existente
            const { error } = await supabaseClient
                .from('tarefas')
                .update({ 
                    status: 'pronto',
                    completed: true,
                    completed_by: completedBy,
                    completion_description: completionDescription,
                    completed_at: new Date().toISOString()
                })
                .eq('id', state.taskToComplete);

            if (error) throw error;
        } else if (state.pendingTaskData) {
            // Criando nova tarefa já concluída
            const taskData = {
                ...state.pendingTaskData,
                completed: true,
                completed_by: completedBy,
                completion_description: completionDescription,
                completed_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('tarefas')
                .insert([taskData]);

            if (error) throw error;
        }

        dom.modalComplete.classList.remove('active');
        state.taskToComplete = null;
        state.previousStatus = null;
        state.pendingTaskData = null;
        await fetchTasks();
    } catch (err) {
        showError('Erro ao confirmar conclusão', err);
    }
}

// --- RENDERIZAÇÃO E UI ---

/**
 * Renderiza a lista de tarefas baseada no estado atual
 * Ordena por data (menor para maior)
 */
function render() {
    // Filtragem
    let filtered = state.tasks.filter(t => {
        const matchesFilter = state.filter === 'Todos' || t.category === state.filter;
        const matchesSearch = t.description.toLowerCase().includes(state.search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Ordenação por data (menor para maior)
    filtered = filtered.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date('9999-12-31');
        const dateB = b.date ? new Date(b.date) : new Date('9999-12-31');
        return dateA - dateB;
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
    const hasCompletionInfo = task.completed && (task.completion_description || task.details);
    
    // Status labels
    const statusLabels = {
        'ninguem-fazendo': 'Ninguém Fazendo',
        'desenvolvendo': 'Desenvolvendo',
        'quase-pronto': 'Quase Pronto',
        'pronto': 'Pronto'
    };

    const statusColors = {
        'ninguem-fazendo': '#94a3b8',
        'desenvolvendo': '#3b82f6',
        'quase-pronto': '#f59e0b',
        'pronto': '#10b981'
    };

    const currentStatus = task.status || 'ninguem-fazendo';

    return `
        <div class="task-card prio-${task.priority} ${task.completed ? 'completed' : ''} animate__animated animate__fadeIn" data-id="${task.id}">
            <div class="task-main">
                <div class="task-content">
                    <span class="task-title">${task.description}</span>
                    <div class="task-meta">
                        <div class="meta-item"><i class="far fa-calendar"></i> ${dateFormatted}</div>
                        <div class="tag tag-${task.category.toLowerCase()}">${task.category}</div>
                        ${!task.completed ? `
                            <div class="status-dropdown">
                                <select onchange="changeStatus('${task.id}', this.value)" class="status-select" style="background-color: ${statusColors[currentStatus]}">
                                    <option value="ninguem-fazendo" ${currentStatus === 'ninguem-fazendo' ? 'selected' : ''}>Ninguém Fazendo</option>
                                    <option value="desenvolvendo" ${currentStatus === 'desenvolvendo' ? 'selected' : ''}>Desenvolvendo</option>
                                    <option value="quase-pronto" ${currentStatus === 'quase-pronto' ? 'selected' : ''}>Quase Pronto</option>
                                    <option value="pronto" ${currentStatus === 'pronto' ? 'selected' : ''}>Pronto</option>
                                </select>
                            </div>
                        ` : ''}
                    </div>
                    ${task.completed && task.completed_by ? `
                        <div class="completed-info">
                            <i class="fas fa-user-check"></i> Feito por <strong>${task.completed_by}</strong>
                            ${task.completion_description ? `
                                <div class="completion-preview">
                                    <i class="fas fa-file-lines"></i> 
                                    ${task.completion_description.substring(0, 80)}${task.completion_description.length > 80 ? '...' : ''}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="task-actions">
                ${hasCompletionInfo ? `
                    <button class="btn-icon" onclick="showTaskDetails('${task.id}')" title="Ver Detalhes">
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
    document.getElementById('f-status').value = 'ninguem-fazendo';
    dom.tccFields.classList.add('hidden');
    dom.modalForm.classList.add('active');
});

// Fechar Modais
document.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
});

document.querySelectorAll('.btn-close-complete').forEach(btn => {
    btn.addEventListener('click', cancelComplete);
});

function closeModals() {
    dom.modalForm.classList.remove('active');
    dom.modalDetails.classList.remove('active');
    dom.modalComplete.classList.remove('active');
}

// Confirmar Conclusão
dom.btnConfirmComplete.addEventListener('click', confirmComplete);

// Cancelar ao clicar no overlay
dom.modalComplete.addEventListener('click', (e) => {
    if (e.target === dom.modalComplete) {
        cancelComplete();
    }
});

// ESC para cancelar
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modalComplete.classList.contains('active')) {
        cancelComplete();
    }
});

// Enter no campo de nome para ir para descrição
dom.completedByInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        dom.completionDescriptionInput.focus();
    }
});

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
    document.getElementById('f-status').value = task.status || 'ninguem-fazendo';

    document.getElementById('modal-title').textContent = 'Editar Tarefa';
    if (task.category === 'TCC') dom.tccFields.classList.remove('hidden');
    
    dom.modalForm.classList.add('active');
};

// Detalhes da Tarefa (TCC ou Tarefas Concluídas)
window.showTaskDetails = (id) => {
    const task = state.tasks.find(t => t.id === id);
    const content = document.getElementById('details-content');
    
    const statusLabels = {
        'ninguem-fazendo': 'Ninguém Fazendo',
        'desenvolvendo': 'Desenvolvendo',
        'quase-pronto': 'Quase Pronto',
        'pronto': 'Pronto'
    };
    
    content.innerHTML = `
        <div class="input-group">
            <label>Descrição</label>
            <p style="font-weight: 700; font-size: 1.1rem;">${task.description}</p>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Data</label>
                <p>${task.date ? new Date(task.date).toLocaleDateString('pt-BR') : 'Não definida'}</p>
            </div>
            <div class="input-group">
                <label>Prioridade</label>
                <p style="color: var(--prio-${task.priority}); font-weight: 800; text-transform: uppercase;">${task.priority}</p>
            </div>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Categoria</label>
                <p style="font-weight: 700;">${task.category}</p>
            </div>
            <div class="input-group">
                <label>Status</label>
                <p style="font-weight: 700;">${statusLabels[task.status || 'ninguem-fazendo']}</p>
            </div>
        </div>
        ${task.completed_by ? `
            <div class="input-group">
                <label>Concluído por</label>
                <p style="font-weight: 700; color: var(--accent);">${task.completed_by}</p>
            </div>
        ` : ''}
        ${task.completed_at ? `
            <div class="input-group">
                <label>Data de Conclusão</label>
                <p>${new Date(task.completed_at).toLocaleString('pt-BR')}</p>
            </div>
        ` : ''}
        ${task.completion_description ? `
            <div class="input-group">
                <label><i class="fas fa-clipboard-check"></i> Como foi realizada</label>
                <div class="completion-full-description">${task.completion_description}</div>
            </div>
        ` : ''}
        ${task.details && task.category === 'TCC' ? `
            <div class="input-group">
                <label>Etapas e Observações do TCC</label>
                <div style="background: var(--bg-main); padding: 15px; border-radius: 10px; white-space: pre-wrap; line-height: 1.6;">${task.details}</div>
            </div>
        ` : ''}
    `;
    dom.modalDetails.classList.add('active');
};

// Função global para mudar status
window.changeStatus = changeStatus;

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