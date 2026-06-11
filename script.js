// ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
let currentUser = null;
let checks = 0, errors = 0, success = 0, favorites = 0;
let currentPage = 1;
let editingRecordId = null;
let isChecking = false;
let favoritesOnly = false;
let originalCode = '';
const API_URL = ''; // Пустая строка для относительных путей

// ===================== СОХРАНЕНИЕ ТЕКУЩЕЙ СТРАНИЦЫ =====================
function saveCurrentPage(pageId) {
    localStorage.setItem('currentPage', pageId);
}

function restoreLastPage() {
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage && document.getElementById(savedPage)) {
        showPage(savedPage);
    } else {
        showPage('mainPage');
    }
}

// ===================== ПОЛУЧЕНИЕ ЗАГОЛОВКОВ =====================
function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser && currentUser.userId) {
        headers['X-User-Id'] = currentUser.userId;
    }
    return headers;
}

// ===================== ТИПИЧНЫЕ ОШИБКИ =====================
const typicalErrors = [
    { id: 1, title: "NameError: имя не определено", category: "variables", badge: "Переменные",
        wrong: "age = 25\nprint(ages)",
        correct: "age = 25\nprint(age)",
        explanation: "❌ Переменная не была создана ранее. Частая причина — опечатки.",
        link: "https://docs.python.org/3/tutorial/introduction.html" },
    { id: 2, title: "SyntaxError: пропущено двоеточие ':'", category: "syntax", badge: "Синтаксис",
        wrong: "if x > 5\n    print(x)",
        correct: "if x > 5:\n    print(x)",
        explanation: "❌ Двоеточие обозначает начало блока кода.",
        link: "https://docs.python.org/3/tutorial/controlflow.html" },
    { id: 3, title: "IndentationError: неправильные отступы", category: "indentation", badge: "Отступы",
        wrong: "def hello():\nprint('Hello')",
        correct: "def hello():\n    print('Hello')",
        explanation: "❌ Все строки внутри блока должны иметь одинаковый отступ.",
        link: "https://docs.python.org/3/tutorial/controlflow.html" },
    { id: 4, title: "TypeError: конкатенация строки и числа", category: "types", badge: "Типы данных",
        wrong: "age = 25\nprint('Мне ' + age)",
        correct: "age = 25\nprint('Мне ' + str(age))",
        explanation: "❌ Используйте str() или f-строки.",
        link: "https://docs.python.org/3/library/stdtypes.html" },
    { id: 5, title: "ZeroDivisionError: деление на ноль", category: "types", badge: "Арифметика",
        wrong: "result = 10 / 0",
        correct: "if divisor != 0: result = 10 / divisor",
        explanation: "❌ Всегда проверяйте делитель перед делением.",
        link: "https://docs.python.org/3/library/exceptions.html" },
    { id: 6, title: "IndexError: выход за границы списка", category: "variables", badge: "Списки",
        wrong: "my_list = [1,2,3]\nprint(my_list[5])",
        correct: "if 5 < len(my_list): print(my_list[5])",
        explanation: "❌ Индекс должен быть от 0 до len(список)-1.",
        link: "https://docs.python.org/3/tutorial/datastructures.html" },
    { id: 7, title: "KeyError: ключ отсутствует в словаре", category: "variables", badge: "Словари",
        wrong: "my_dict = {'name':'Alice'}\nprint(my_dict['age'])",
        correct: "print(my_dict.get('age', 'не найден'))",
        explanation: "❌ Используйте метод get() или оператор in.",
        link: "https://docs.python.org/3/library/stdtypes.html" },
    { id: 8, title: "ValueError: некорректное преобразование", category: "types", badge: "Преобразование",
        wrong: "number = int('abc')",
        correct: "try: number = int('abc')\nexcept ValueError: print('Ошибка')",
        explanation: "❌ Используйте try-except для обработки.",
        link: "https://docs.python.org/3/tutorial/errors.html" }
];

// ===================== ПОЛЕЗНЫЕ МАТЕРИАЛЫ =====================
const learningResources = [
    { title: "📘 Официальная документация Python", description: "Полное руководство", url: "https://docs.python.org/3/tutorial/", tag: "Документация" },
    { title: "🎯 Python Tutor", description: "Визуализация выполнения кода", url: "https://pythontutor.com/", tag: "Визуализация" },
    { title: "💡 Real Python", description: "Практические уроки", url: "https://realpython.com/", tag: "Уроки" },
    { title: "🎮 Codecademy", description: "Интерактивный курс", url: "https://www.codecademy.com/learn/learn-python", tag: "Курс" },
    { title: "📺 Лекции Тимофея Хирьянова", description: "Курс от МФТИ", url: "https://www.youtube.com/playlist?list=PLRDzFCPr95fK7tr47883DFUbm4GeOjjc0", tag: "Видеолекции" },
    { title: "🐍 CheckiO", description: "Игровой подход", url: "https://checkio.org/", tag: "Игры" },
    { title: "📖 Python Handbook", description: "Краткий справочник", url: "https://pythonhandbook.com/", tag: "Справочник" },
    { title: "🔧 W3Schools Python", description: "Упражнения", url: "https://www.w3schools.com/python/", tag: "Учебник" }
];

// ===================== ЗАГРУЗКА ПРИ СТАРТЕ =====================
document.addEventListener('DOMContentLoaded', () => {
    loadTypicalErrors();
    loadLearningResources();
    checkSession();
    loadWeeklyStats();
    loadUserSettings();
    
    const autoSaveEnabled = localStorage.getItem('auto_save') !== 'false';
    if (autoSaveEnabled) {
        const draft = localStorage.getItem('draft_code');
        if (draft && currentUser) {
            if (confirm('🔄 Найден сохранённый черновик. Восстановить?')) {
                document.getElementById('codeInput').value = draft;
            }
        }
    }
    
    document.getElementById('codeInput').addEventListener('input', () => {
        if (localStorage.getItem('auto_save') !== 'false' && currentUser) {
            localStorage.setItem('draft_code', document.getElementById('codeInput').value);
        }
    });
});

// ===================== ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ (С АВТООБНОВЛЕНИЕМ) =====================
function showPage(pageId) {
    saveCurrentPage(pageId);
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Автоматическое обновление данных при переключении страниц
    if (pageId === 'historyPage') {
        loadHistory();
    }
    if (pageId === 'reportPage') { 
        updateStatsFromServer();
        loadWeeklyStats();
        loadTopErrors();
        loadDailyActivity();
    }
    if (pageId === 'mainPage') {
        updateStatsFromServer();
    }
}

// ===================== ФУНКЦИИ АККАУНТА =====================

async function login() {
    const loginVal = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    
    if (!loginVal || !password) {
        alert('Введите логин и пароль');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginVal, password: password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = {
                userId: data.userId,
                login: data.login,
                role: data.role
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            alert(`Добро пожаловать, ${data.login}!`);
            
            updateUIForLoggedInUser();
            await loadUserProfile();
            await loadHistory();
            await updateStatsFromServer();
            await loadWeeklyStats();
            await loadUserSettings();
            await refreshAllData(); // Обновляем все данные
            
            const savedPage = localStorage.getItem('currentPage');
            if (savedPage && document.getElementById(savedPage)) {
                showPage(savedPage);
            } else {
                showPage('mainPage');
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Сервер недоступен');
    }
}

function logout() {
    if (confirm('🚪 Вы уверены, что хотите выйти из аккаунта?')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        document.getElementById('login').value = '';
        document.getElementById('password').value = '';
        
        updateUIForLoggedOutUser();
        
        document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center">🔐 Войдите в аккаунт, чтобы увидеть историю проверок</td></tr>';
        document.getElementById('checksCount').innerText = '0';
        document.getElementById('errorsCount').innerText = '0';
        document.getElementById('successCountMain').innerText = '0';
        document.getElementById('successPercentMain').innerText = '0%';
        
        showNotification('👋 Вы вышли из аккаунта', 'info');
        showPage('accountPage');
    }
}

function updateUIForLoggedInUser() {
    document.getElementById('notLoggedInBlock').style.display = 'none';
    document.getElementById('loggedInBlock').style.display = 'block';
    document.getElementById('userName').innerText = currentUser?.login || 'Пользователь';
    document.getElementById('userRole').innerText = currentUser?.role === 'admin' ? 'Администратор' : 'Пользователь';
}

function updateUIForLoggedOutUser() {
    document.getElementById('notLoggedInBlock').style.display = 'block';
    document.getElementById('loggedInBlock').style.display = 'none';
}

async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/user/profile`, { headers: getHeaders() });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('userRegDate').innerText = new Date(data.user.created_at).toLocaleDateString();
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function changePassword() {
    const oldPassword = prompt('Введите текущий пароль:');
    if (!oldPassword) return;
    
    const newPassword = prompt('Введите новый пароль (мин. 4 символа):');
    if (!newPassword || newPassword.length < 4) {
        alert('Пароль должен быть не менее 4 символов');
        return;
    }
    
    const confirmPassword = prompt('Подтвердите новый пароль:');
    if (newPassword !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user/password`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Пароль успешно изменён!');
        } else {
            alert(data.message || '❌ Ошибка изменения пароля');
        }
    } catch (error) {
        alert('❌ Ошибка сервера');
    }
}

function checkSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUIForLoggedInUser();
            loadHistory();
            updateStatsFromServer();
            loadWeeklyStats();
        } catch (e) {
            console.error('Ошибка восстановления сессии:', e);
            localStorage.removeItem('currentUser');
        }
    } else {
        updateUIForLoggedOutUser();
    }
}

// ===================== ФИЛЬТРЫ =====================
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('sortOrder').value = 'desc';
    currentPage = 1;
    loadHistory();
    showNotification('🔄 Фильтры сброшены', 'success');
}

function toggleFavoritesFilter() {
    favoritesOnly = !favoritesOnly;
    const btn = document.getElementById('favoritesFilterBtn');
    if (favoritesOnly) {
        btn.innerHTML = '<i class="fas fa-star"></i> Только избранное';
        btn.style.background = '#ff9800';
    } else {
        btn.innerHTML = '<i class="fas fa-star"></i> Показать всё';
        btn.style.background = '#6c757d';
    }
    currentPage = 1;
    loadHistory();
}

// ===================== ВАЛИДАЦИЯ КОДА =====================
function validatePythonCode(code) {
    const errors = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed === '') continue;
        if (trimmed.startsWith('#')) continue;
        
        const keywords = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'with', 'try', 'except', 'finally'];
        
        for (const keyword of keywords) {
            const regex = new RegExp(`^${keyword}(\\s|\\(|:)`);
            if (regex.test(trimmed)) {
                if (!trimmed.includes(':') && !trimmed.endsWith(':')) {
                    errors.push(`Строка ${i+1}: Пропущено двоеточие (:) после "${keyword}"`);
                }
                break;
            }
        }
        
        if (line.includes('(') || line.includes('[') || line.includes('{')) {
            let brackets = [];
            for (let j = 0; j < line.length; j++) {
                const ch = line[j];
                if (ch === '(' || ch === '[' || ch === '{') brackets.push(ch);
                else if (ch === ')') { if (brackets.pop() !== '(') errors.push(`Строка ${i+1}: Непарная скобка )`); }
                else if (ch === ']') { if (brackets.pop() !== '[') errors.push(`Строка ${i+1}: Непарная скобка ]`); }
                else if (ch === '}') { if (brackets.pop() !== '{') errors.push(`Строка ${i+1}: Непарная скобка }`); }
            }
            if (brackets.length > 0) errors.push(`Строка ${i+1}: Незакрытые скобки`);
        }
    }
    return errors;
}

function extractErrorName(error) {
    const match = error.match(/(\w+Error)/);
    return match ? match[1] : 'UnknownError';
}

function getDetailedErrorExplanation(error) {
    const errorName = extractErrorName(error);
    const explanations = {
        'NameError': { title: '❌ NameError - Имя не определено', desc: 'Переменная не была создана', solution: 'Создайте переменную перед использованием', beginnerTip: '💡 Проверьте опечатки в имени переменной' },
        'SyntaxError': { title: '❌ SyntaxError - Синтаксическая ошибка', desc: 'Python не может разобрать код', solution: 'Проверьте скобки, кавычки, двоеточия', beginnerTip: '💡 Часто забывают двоеточие после if, for, while, def' },
        'IndentationError': { title: '❌ IndentationError - Ошибка отступов', desc: 'Неправильные отступы в коде', solution: 'Используйте 4 пробела для отступов', beginnerTip: '💡 Не смешивайте пробелы и табуляцию' },
        'TypeError': { title: '❌ TypeError - Ошибка типа', desc: 'Несовместимые типы данных', solution: 'Используйте преобразование типов', beginnerTip: '💡 Нельзя складывать строку с числом' },
        'ZeroDivisionError': { title: '❌ ZeroDivisionError - Деление на ноль', desc: 'Попытка деления на ноль', solution: 'Проверьте делитель перед делением', beginnerTip: '💡 Всегда проверяйте, что делитель не равен нулю' },
        'IndexError': { title: '❌ IndexError - Выход за границы', desc: 'Индекс вне диапазона списка', solution: 'Проверьте длину списка', beginnerTip: '💡 Индексы начинаются с 0' },
        'KeyError': { title: '❌ KeyError - Ключ не найден', desc: 'Ключ отсутствует в словаре', solution: 'Используйте метод get()', beginnerTip: '💡 Проверьте существование ключа' },
        'ValueError': { title: '❌ ValueError - Неверное значение', desc: 'Некорректное преобразование типа', solution: 'Используйте try-except', beginnerTip: '💡 Проверяйте данные перед преобразованием' }
    };
    const exp = explanations[errorName];
    if (exp) {
        return `<h4>${exp.title}</h4><p><strong>📖 Описание:</strong> ${exp.desc}</p><p><strong>🔧 Решение:</strong> ${exp.solution}</p><div style="background:rgba(255,152,0,0.2); padding:10px; border-radius:8px; margin:10px 0"><strong>🎓 Совет:</strong> ${exp.beginnerTip}</div>${getTipForError(error)}`;
    }
    return `<p>⚠️ Для этой ошибки пока нет подробного описания. Проверьте синтаксис вашего кода.</p>`;
}

function getTipForError(errorText) {
    const errorType = extractErrorName(errorText);
    const errorMapping = { 
        'NameError': typicalErrors[0], 'SyntaxError': typicalErrors[1], 'IndentationError': typicalErrors[2], 
        'TypeError': typicalErrors[3], 'ZeroDivisionError': typicalErrors[4], 'IndexError': typicalErrors[5], 
        'KeyError': typicalErrors[6], 'ValueError': typicalErrors[7] 
    };
    const tip = errorMapping[errorType];
    if (tip) {
        return `<div style="background:rgba(255,87,34,0.15); padding:15px; border-radius:10px; margin-top:15px"><h4 style="color:#ff5722">📌 Связанная типичная ошибка:</h4><div class="tip-wrong"><strong>❌ Неправильно:</strong><br><code>${escapeHtml(tip.wrong)}</code></div><div class="tip-correct"><strong>✅ Правильно:</strong><br><code>${escapeHtml(tip.correct)}</code></div><a href="${tip.link}" target="_blank" style="color:#ff5722">📖 Подробнее →</a></div>`;
    }
    return '';
}

// ===================== ПРОВЕРКА КОДА (С АВТООБНОВЛЕНИЕМ) =====================
async function checkCode() {
    const honeypot = document.getElementById('website');
    if (honeypot && honeypot.value !== '') {
        showNotification('❌ Ошибка валидации', 'error');
        return;
    }
    
    if (isChecking) {
        showNotification('⏳ Проверка уже выполняется...', 'info');
        return;
    }
    
    const code = document.getElementById('codeInput').value;
    const resultDiv = document.getElementById('result');
    const explanationDiv = document.getElementById('errorExplanation');
    const spinner = document.getElementById('loadingSpinner');
    const checkBtn = document.getElementById('checkBtn');
    
    if (code.trim() === '') {
        resultDiv.innerHTML = '<p style="color:#ffaaaa">❌ Введите код для проверки!</p>';
        return;
    }
    
    const validationErrors = validatePythonCode(code);
    const validationDiv = document.getElementById('validationErrors');
    
    if (validationErrors.length > 0) {
        validationDiv.innerHTML = validationErrors.map(e => `⚠️ ${e}`).join('<br>');
        validationDiv.classList.add('show');
    } else {
        validationDiv.classList.remove('show');
    }
    
    if (localStorage.getItem('auto_save') !== 'false' && currentUser) {
        localStorage.setItem('draft_code', code);
    }
    
    isChecking = true;
    checkBtn.disabled = true;
    checkBtn.style.opacity = '0.6';
    spinner.style.display = 'block';
    
    resultDiv.innerHTML = '<p style="color:#7ee8ff">⏳ Отправка кода на проверку...</p>';
    
    try {
        const response = await fetch(`${API_URL}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        
        const data = await response.json();
        
        let status = 'Ошибок нет';
        let errorType = '';
        
        if (data.success) {
            resultDiv.innerHTML = `<h3 style="color:#aaffaa">✅ Код выполнен успешно!</h3><pre>${escapeHtml(data.output)}</pre>`;
            explanationDiv.innerHTML = '<p>🎉 Отличная работа! Код не содержит ошибок.</p>';
            status = 'Ошибок нет';
        } else {
            status = 'Есть ошибки';
            errorType = extractErrorName(data.error);
            resultDiv.innerHTML = `<h3 style="color:#ffaaaa">❌ Найдена ошибка</h3><pre>${escapeHtml(data.error)}</pre>`;
            explanationDiv.innerHTML = getDetailedErrorExplanation(data.error);
        }
        
        // Сохраняем в историю
        await saveHistory(code, status, errorType);
        
        // АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ВСЕХ ДАННЫХ
        await refreshAllData();
        
        showNotification('✅ Проверка завершена, данные обновлены', 'success');
        
        if (localStorage.getItem('auto_save') !== 'false' && currentUser && !editingRecordId) {
            localStorage.removeItem('draft_code');
        }
        
        if (editingRecordId) cancelEdit();
        
    } catch (error) {
        console.error('Ошибка:', error);
        resultDiv.innerHTML = '<p style="color:#ffaaaa">⚠️ Сервер недоступен! Проверьте соединение.</p>';
        explanationDiv.innerHTML = '<p>❌ Не удалось подключиться к серверу.</p>';
    } finally {
        isChecking = false;
        checkBtn.disabled = false;
        checkBtn.style.opacity = '1';
        spinner.style.display = 'none';
    }
}

// ===================== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ВСЕХ ДАННЫХ =====================
async function refreshAllData() {
    if (!currentUser) return;
    
    console.log('🔄 Автоматическое обновление данных...');
    
    try {
        await updateStatsFromServer();
        await loadHistory();
        await loadWeeklyStats();
        await loadTopErrors();
        await loadDailyActivity();
        console.log('✅ Все данные обновлены');
    } catch (error) {
        console.error('Ошибка при обновлении данных:', error);
    }
}

// ===================== CRUD ОПЕРАЦИИ =====================
async function saveHistory(code, status, errorType) {
    if (!currentUser) return;
    
    try {
        await fetch(`${API_URL}/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ user_id: currentUser.userId, code, status, error_type: errorType })
        });
    } catch (error) { console.error('Ошибка сохранения:', error); }
}

async function loadHistory() {
    if (!currentUser) {
        document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center">🔐 Войдите в аккаунт, чтобы увидеть историю проверок</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/history`, { headers: getHeaders() });
        let data = await response.json();
        
        if (favoritesOnly) data = data.filter(item => item.is_favorite === 1);
        
        const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const filter = document.getElementById('statusFilter')?.value || 'all';
        const sortOrder = document.getElementById('sortOrder')?.value || 'desc';
        
        let filtered = data.filter(item => {
            const matchesSearch = item.code_text.toLowerCase().includes(search);
            const matchesFilter = filter === 'all' || item.status === filter;
            return matchesSearch && matchesFilter;
        });
        
        filtered.sort((a, b) => sortOrder === 'desc' ? b.request_id - a.request_id : a.request_id - b.request_id);
        
        if (filtered.length === 0 && (search || filter !== 'all' || favoritesOnly)) {
            let message = '🔍 Ничего не найдено.';
            if (favoritesOnly) message = '⭐ Нет избранных записей.';
            document.getElementById('historyTableBody').innerHTML = `<tr><td colspan="7" style="text-align:center">${message}</td></tr>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }
        
        const itemsPerPage = parseInt(localStorage.getItem('items_per_page') || '10');
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filtered.slice(start, start + itemsPerPage);
        displayHistory(pageData);
        displayPagination(totalPages);
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="7">❌ Ошибка загрузки истории</td></tr>';
    }
}

function displayHistory(data) {
    const table = document.getElementById('historyTableBody');
    table.innerHTML = '';
    if (data.length === 0) { 
        table.innerHTML = '<tr><td colspan="7" style="text-align:center">📭 Нет записей</td></tr>'; 
        return; 
    }
    data.forEach(item => {
        const statusColor = item.status === 'Ошибок нет' ? '#aaffaa' : '#ffaaaa';
        const shortCode = item.code_text.substring(0, 60) + (item.code_text.length > 60 ? '...' : '');
        const isFavorite = item.is_favorite ? '⭐' : '☆';
        const favBtnClass = item.is_favorite ? 'favorite-btn active' : 'favorite-btn';
        table.innerHTML += `
            <tr>
                <td>${item.request_id}</td>
                <td><code>${escapeHtml(shortCode)}</code></td>
                <td style="color:${statusColor}; font-weight:bold">${item.status}</td>
                <td>${item.error_type || '-'}</td>
                <td>${new Date(item.created_at).toLocaleString()}</td>
                <td><button onclick="toggleFavorite(${item.request_id}, ${item.is_favorite})" class="${favBtnClass}">${isFavorite}</button></td>
                <td class="action-buttons">
                    <button onclick="viewRecord(${item.request_id})" class="action-view">👁️</button>
                    <button onclick="editRecord(${item.request_id})" class="action-edit">✏️</button>
                    <button onclick="deleteRecord(${item.request_id})" class="action-delete">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function displayPagination(totalPages) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button onclick="goToPage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    paginationDiv.innerHTML = html;
}

function goToPage(page) { currentPage = page; loadHistory(); }

async function viewRecord(id) {
    try {
        const response = await fetch(`${API_URL}/record/${id}`, { headers: getHeaders() });
        const data = await response.json();
        if (data.error) { alert(data.error); return; }
        const modal = document.getElementById('detailModal');
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <p><strong>📋 ID:</strong> ${data.request_id}</p>
            <p><strong>📊 Статус:</strong> <span style="color:${data.status === 'Ошибок нет' ? '#aaffaa' : '#ffaaaa'}">${data.status}</span></p>
            <p><strong>🐍 Ошибка:</strong> ${data.error_type || 'Нет'}</p>
            <p><strong>📅 Дата:</strong> ${new Date(data.created_at).toLocaleString()}</p>
            <p><strong>💻 Код:</strong></p>
            <pre>${escapeHtml(data.code_text)}</pre>
            <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap">
                <button onclick="copyCodeToClipboard('${escapeHtml(data.code_text).replace(/'/g, "\\'")}')" class="tool-btn" style="background:#2196f3">📋 Копировать</button>
                <button onclick="editRecord(${data.request_id})" class="primary-btn">✏️ Редактировать</button>
                <button onclick="deleteRecord(${data.request_id})" class="clearBtn">🗑️ Удалить</button>
            </div>
        `;
        modal.style.display = 'block';
    } catch (error) { alert('Ошибка загрузки записи'); }
}

function copyCodeToClipboard(code) {
    navigator.clipboard.writeText(code).then(() => {
        showNotification('📋 Код скопирован', 'success');
    }).catch(() => {
        showNotification('❌ Не удалось скопировать', 'error');
    });
}

async function editRecord(id) {
    try {
        const response = await fetch(`${API_URL}/record/${id}`, { headers: getHeaders() });
        const data = await response.json();
        if (data.error) { alert(data.error); return; }
        originalCode = data.code_text;
        document.getElementById('codeInput').value = data.code_text;
        editingRecordId = id;
        document.getElementById('saveEditBtn').style.display = 'inline-block';
        document.getElementById('result').innerHTML = '✏️ Режим редактирования';
        showPage('checkPage');
        document.getElementById('codeInput').scrollIntoView({ behavior: 'smooth' });
        showNotification('✏️ Режим редактирования', 'info');
        document.getElementById('codeInput').addEventListener('input', checkCodeChanges);
    } catch (error) { showNotification('❌ Ошибка загрузки', 'error'); }
}

function checkCodeChanges() {
    const currentCode = document.getElementById('codeInput').value;
    const saveBtn = document.getElementById('saveEditBtn');
    if (originalCode !== currentCode) {
        saveBtn.style.background = '#ff9800';
        saveBtn.innerHTML = '⚠️ Сохранить';
    } else {
        saveBtn.style.background = 'rgba(40,167,69,0.9)';
        saveBtn.innerHTML = '💾 Сохранить';
    }
}

async function saveEdit() {
    if (!editingRecordId) return;
    
    const code = document.getElementById('codeInput').value;
    const spinner = document.getElementById('loadingSpinner');
    const saveBtn = document.getElementById('saveEditBtn');
    
    saveBtn.classList.add('save-animation');
    setTimeout(() => saveBtn.classList.remove('save-animation'), 300);
    spinner.style.display = 'block';
    
    try {
        const checkResponse = await fetch(`${API_URL}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        const checkData = await checkResponse.json();
        
        const status = checkData.success ? 'Ошибок нет' : 'Есть ошибки';
        const errorType = checkData.success ? '' : extractErrorName(checkData.error);
        
        const response = await fetch(`${API_URL}/update/${editingRecordId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ code, status, error_type: errorType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Изменения сохранены', 'success');
            cancelEdit();
            await refreshAllData(); // Обновляем все данные
        } else {
            showNotification(result.message || '❌ Ошибка сохранения', 'error');
        }
    } catch (error) {
        showNotification('❌ Ошибка при сохранении', 'error');
    } finally {
        spinner.style.display = 'none';
        saveBtn.style.background = 'rgba(40,167,69,0.9)';
        saveBtn.innerHTML = '💾 Сохранить';
    }
}

function cancelEdit() {
    editingRecordId = null;
    originalCode = '';
    document.getElementById('saveEditBtn').style.display = 'none';
    document.getElementById('codeInput').removeEventListener('input', checkCodeChanges);
    document.getElementById('codeInput').value = '';
    document.getElementById('result').innerHTML = 'Здесь появится результат проверки';
    document.getElementById('errorExplanation').innerHTML = 'После проверки здесь появится подробное объяснение ошибки';
}

async function deleteRecord(id) {
    if (!confirm('⚠️ Удалить запись?')) return;
    try {
        const response = await fetch(`${API_URL}/delete/${id}`, { method: 'DELETE', headers: getHeaders() });
        const result = await response.json();
        if (result.success) {
            await refreshAllData(); // Обновляем все данные
            showNotification('✅ Запись удалена, данные обновлены', 'success');
        } else {
            showNotification(result.message || '❌ Ошибка удаления', 'error');
        }
    } catch (error) { showNotification('❌ Ошибка', 'error'); }
}

async function toggleFavorite(id, current) {
    try {
        await fetch(`${API_URL}/favorite/${id}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ is_favorite: !current })
        });
        await refreshAllData(); // Обновляем все данные
        showNotification('⭐ Избранное обновлено', 'success');
    } catch (error) { console.error('Ошибка'); }
}

// ===================== СТАТИСТИКА =====================
async function updateStatsFromServer() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/stats`, { headers: getHeaders() });
        const stats = await response.json();
        
        checks = stats.total || 0;
        errors = stats.errors || 0;
        favorites = stats.favorites || 0;
        success = checks - errors;
        const percent = checks > 0 ? Math.round(success * 100 / checks) : 0;
        
        document.getElementById('checksCount').innerText = checks;
        document.getElementById('errorsCount').innerText = errors;
        document.getElementById('successCountMain').innerText = success;
        document.getElementById('successPercentMain').innerText = percent + '%';
        document.getElementById('reportChecks').innerText = checks;
        document.getElementById('reportErrors').innerText = errors;
        document.getElementById('successCount').innerText = success;
        document.getElementById('successPercent').innerText = percent + '%';
        document.getElementById('favoritesCount').innerText = favorites;
        
        if (document.getElementById('userChecks')) {
            document.getElementById('userChecks').innerText = checks;
            document.getElementById('userSuccess').innerText = success;
            document.getElementById('userErrors').innerText = errors;
            document.getElementById('userPercent').innerText = percent + '%';
            document.getElementById('userFavorites').innerText = favorites;
        }
        
        loadTopErrors();
        loadDailyActivity();
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadTopErrors() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_URL}/top-errors`, { headers: getHeaders() });
        const data = await response.json();
        const container = document.getElementById('topErrors');
        if (!container) return;
        if (data.length === 0) { container.innerHTML = '<p>Нет данных</p>'; return; }
        container.innerHTML = data.map(err => `<div class="error-stat"><span>${err.error_type}</span><span class="count">${err.count} раз</span></div>`).join('');
    } catch (error) { console.error('Ошибка'); }
}

async function loadDailyActivity() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_URL}/daily-activity`, { headers: getHeaders() });
        const data = await response.json();
        const container = document.getElementById('dailyActivity');
        if (!container) return;
        if (data.length === 0) { container.innerHTML = '<p>Нет активности</p>'; return; }
        container.innerHTML = data.map(day => `<div class="stat-item"><span>${new Date(day.date).toLocaleDateString()}</span><strong>${day.count} проверок</strong></div>`).join('');
    } catch (error) { console.error('Ошибка'); }
}

async function loadWeeklyStats() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_URL}/weekly-stats`, { headers: getHeaders() });
        const data = await response.json();
        const container = document.getElementById('weeklyStats');
        if (!container) return;
        if (data.length === 0) { container.innerHTML = '<p>Нет данных</p>'; return; }
        const maxCount = Math.max(...data.map(d => d.count));
        container.innerHTML = data.map(day => `
            <div class="week-day">
                <div class="week-day-name">${day.day_name}</div>
                <div class="week-day-count">${day.count}</div>
                <div class="week-day-bar">
                    <div class="week-day-bar-fill" style="width: ${(day.count / maxCount) * 100}%"></div>
                </div>
            </div>
        `).join('');
    } catch (error) { console.error('Ошибка'); }
}

async function generateFullReport() {
    if (!currentUser) {
        alert('🔐 Войдите в аккаунт');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/full-report`, { headers: getHeaders() });
        const report = await response.json();
        const modal = document.getElementById('detailModal');
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <h3>📊 Полный отчёт</h3>
            <div class="stat-item"><span>📅 Дата:</span><strong>${new Date().toLocaleString()}</strong></div>
            <div class="stat-item"><span>🔍 Всего проверок:</span><strong>${report.totalChecks}</strong></div>
            <div class="stat-item"><span>✅ Успешных:</span><strong>${report.successChecks}</strong></div>
            <div class="stat-item"><span>❌ С ошибками:</span><strong>${report.errorChecks}</strong></div>
            <div class="stat-item"><span>📈 Успешность:</span><strong>${report.successPercent}%</strong></div>
            <hr>
            <h4>📋 Топ ошибок:</h4>
            ${report.topErrors.map(err => `<div class="stat-item"><span>${err.error_type}</span><strong>${err.count} раз</strong></div>`).join('')}
            <hr>
            <button onclick="exportReportToPDF()" class="primary-btn">📑 Экспорт PDF</button>
        `;
        modal.style.display = 'block';
    } catch (error) { alert('Ошибка отчёта'); }
}

// ===================== ЭКСПОРТ В PDF =====================
async function exportHistoryToPDF() {
    if (!currentUser) {
        alert('🔐 Войдите в аккаунт');
        return;
    }
    const historyTable = document.querySelector('#historyPage .table-wrapper');
    if (!historyTable || historyTable.innerHTML.includes('Нет записей') || historyTable.innerHTML.includes('Войдите')) {
        showNotification('📭 Нет данных для экспорта', 'error');
        return;
    }
    
    const originalTitle = document.querySelector('#historyPage h1').innerHTML;
    const date = new Date().toLocaleString();
    const filterStatus = document.getElementById('statusFilter').options[document.getElementById('statusFilter').selectedIndex]?.text || 'Все';
    const isFavorites = favoritesOnly ? ' (только избранное)' : '';
    
    const exportContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h1 style="color: #333;">${originalTitle}${isFavorites}</h1>
            <p style="color: #666;">Дата: ${date}</p>
            <p style="color: #666;">Фильтр: ${filterStatus}</p>
            <div style="margin-top: 20px;">
                ${historyTable.cloneNode(true).outerHTML}
            </div>
            <p style="color: #999; margin-top: 30px;">Сгенерировано PythonChecker</p>
        </div>
    `;
    
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `pythonchecker_history_${new Date().toISOString().slice(0,19)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(exportContent).save();
    showNotification('📑 История экспортирована', 'success');
}

function exportReportToPDF() {
    if (!currentUser) {
        alert('🔐 Войдите в аккаунт');
        return;
    }
    const element = document.getElementById('reportPage');
    const date = new Date().toLocaleString();
    const clone = element.cloneNode(true);
    const header = document.createElement('div');
    header.innerHTML = `<p style="text-align:center;">Дата: ${date}</p>`;
    clone.insertBefore(header, clone.firstChild);
    
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `pythonchecker_report_${new Date().toISOString().slice(0,19)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(clone).save();
    showNotification('📑 Отчёт экспортирован', 'success');
}

// ===================== ЗАГРУЗКА ФАЙЛА =====================
function showFileName() {
    const file = document.getElementById('fileInput').files[0];
    const fileError = document.getElementById('fileError');
    if (file) {
        if (!file.name.endsWith('.py')) {
            fileError.innerHTML = '❌ Только .py файлы';
            fileError.style.display = 'block';
            document.getElementById('fileInput').value = '';
            document.getElementById('selectedFile').innerHTML = '';
            return;
        }
        if (file.size > 1024 * 1024) {
            fileError.innerHTML = '❌ Файл > 1MB';
            fileError.style.display = 'block';
            document.getElementById('fileInput').value = '';
            document.getElementById('selectedFile').innerHTML = '';
            return;
        }
        fileError.style.display = 'none';
        document.getElementById('selectedFile').innerHTML = `📄 ${file.name}`;
        loadFile();
    }
}

function loadFile() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('codeInput').value = e.target.result;
        showNotification('📂 Файл загружен', 'success');
    };
    reader.readAsText(file, 'UTF-8');
}

function formatCode() {
    const textarea = document.getElementById('codeInput');
    let code = textarea.value;
    let lines = code.split('\n');
    let formatted = [];
    let indentLevel = 0;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line === '') { formatted.push(''); continue; }
        if (line.startsWith('else') || line.startsWith('elif') || line.startsWith('except') || line.startsWith('finally')) indentLevel = Math.max(0, indentLevel - 1);
        formatted.push(' '.repeat(indentLevel * 4) + line);
        if (line.endsWith(':')) indentLevel++;
    }
    textarea.value = formatted.join('\n');
    showNotification('✅ Код отформатирован', 'success');
}

function clearCode() {
    if (document.getElementById('codeInput').value.trim() !== '' && !confirm('⚠️ Очистить редактор?')) return;
    document.getElementById('codeInput').value = '';
    document.getElementById('result').innerHTML = 'Здесь появится результат проверки';
    document.getElementById('errorExplanation').innerHTML = 'После проверки здесь появится подробное объяснение ошибки';
    document.getElementById('validationErrors').classList.remove('show');
    if (localStorage.getItem('auto_save') !== 'false') localStorage.removeItem('draft_code');
    cancelEdit();
    showNotification('🗑 Редактор очищен', 'info');
}

// ===================== ТИПИЧНЫЕ ОШИБКИ =====================
function loadTypicalErrors() { const c = document.getElementById('tipsList'); if (c) displayTips(typicalErrors); }
function displayTips(tips) {
    const container = document.getElementById('tipsList');
    container.innerHTML = tips.map(tip => `<div class="tip-item"><div class="tip-title"><span>⚠️</span><span>${tip.title}</span><span class="tip-badge">${tip.badge}</span></div><div class="tip-wrong"><strong>❌ Неправильно:</strong><br><code>${escapeHtml(tip.wrong)}</code></div><div class="tip-correct"><strong>✅ Правильно:</strong><br><code>${escapeHtml(tip.correct)}</code></div><div class="tip-explanation">${tip.explanation}</div><a href="${tip.link}" target="_blank" class="tip-link">📖 Подробнее →</a></div>`).join('');
}
function showTipCategory(category) {
    document.querySelectorAll('.tip-cat-btn').forEach(btn => btn.classList.remove('active'));
    if (category === 'all') document.querySelector('.tip-cat-btn:first-child')?.classList.add('active');
    else if (category === 'syntax') document.querySelectorAll('.tip-cat-btn')[1]?.classList.add('active');
    else if (category === 'variables') document.querySelectorAll('.tip-cat-btn')[2]?.classList.add('active');
    else if (category === 'types') document.querySelectorAll('.tip-cat-btn')[3]?.classList.add('active');
    else if (category === 'indentation') document.querySelectorAll('.tip-cat-btn')[4]?.classList.add('active');
    let filtered = typicalErrors;
    if (category !== 'all') filtered = typicalErrors.filter(tip => tip.category === category);
    displayTips(filtered);
}

function loadLearningResources() {
    const container = document.getElementById('resourcesGrid');
    if (!container) return;
    container.innerHTML = learningResources.map(r => `<a href="${r.url}" target="_blank" class="resource-item"><div class="resource-title">${r.title}</div><div class="resource-desc">${r.description}</div><span class="resource-tag">${r.tag}</span></a>`).join('');
}

// ===================== РЕГИСТРАЦИЯ =====================
function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
    document.getElementById('regError').style.display = 'none';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
}

async function register() {
    const login = document.getElementById('regLogin').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const errorDiv = document.getElementById('regError');
    
    if (!login) { errorDiv.innerText = 'Введите логин'; errorDiv.style.display = 'block'; return; }
    if (password.length < 4) { errorDiv.innerText = 'Пароль должен быть не менее 4 символов'; errorDiv.style.display = 'block'; return; }
    if (password !== confirm) { errorDiv.innerText = 'Пароли не совпадают'; errorDiv.style.display = 'block'; return; }
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Регистрация успешна! Теперь войдите.');
            closeRegisterModal();
            document.getElementById('regLogin').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirm').value = '';
            document.getElementById('login').value = login;
            document.getElementById('password').value = password;
        } else {
            errorDiv.innerText = data.message;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.innerText = 'Ошибка сервера';
        errorDiv.style.display = 'block';
    }
}

// ===================== ТЁМНАЯ ТЕМА =====================
function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.checked = isDark;
}

function toggleThemeSetting() {
    const isDark = document.getElementById('themeToggle').checked;
    applyTheme(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (currentUser) saveSettings();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme === 'dark');
}

// ===================== НАСТРОЙКИ =====================
async function loadUserSettings() {
    if (!currentUser) { loadTheme(); return; }
    try {
        const response = await fetch(`${API_URL}/get-settings`, { headers: getHeaders() });
        const settings = await response.json();
        applyTheme(settings.theme === 'dark');
        localStorage.setItem('theme', settings.theme === 'dark' ? 'dark' : 'light');
        if (settings.items_per_page) {
            document.getElementById('itemsPerPageSelect').value = settings.items_per_page;
            localStorage.setItem('items_per_page', settings.items_per_page);
        }
        const autoSave = settings.auto_save !== 0;
        document.getElementById('autoSaveToggle').checked = autoSave;
        localStorage.setItem('auto_save', autoSave);
    } catch (error) { loadTheme(); }
}

function changeItemsPerPage() {
    const value = document.getElementById('itemsPerPageSelect').value;
    localStorage.setItem('items_per_page', value);
    currentPage = 1;
    loadHistory();
    showNotification(`📄 Показывать по ${value} записей`, 'success');
}

function toggleAutoSave() {
    const isEnabled = document.getElementById('autoSaveToggle').checked;
    localStorage.setItem('auto_save', isEnabled);
    showNotification(isEnabled ? '💾 Автосохранение включено' : '💾 Автосохранение выключено', 'info');
}

async function saveSettings() {
    const isDark = document.body.classList.contains('dark-theme');
    if (!currentUser) {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        showNotification('✅ Настройки сохранены (локально)', 'success');
        return;
    }
    const settings = {
        theme: isDark ? 'dark' : 'light',
        items_per_page: parseInt(document.getElementById('itemsPerPageSelect').value),
        auto_save: document.getElementById('autoSaveToggle').checked ? 1 : 0
    };
    try {
        const response = await fetch(`${API_URL}/save-settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        const result = await response.json();
        if (result.success) {
            localStorage.setItem('theme', settings.theme);
            showNotification('✅ Настройки сохранены', 'success');
        } else showNotification('❌ Ошибка сохранения', 'error');
    } catch (error) {
        localStorage.setItem('theme', settings.theme);
        showNotification('✅ Настройки сохранены (локально)', 'success');
    }
}

// ===================== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ КАЖДЫЕ 30 СЕКУНД =====================
setInterval(() => {
    if (currentUser) {
        const activePage = document.querySelector('.page.active')?.id;
        if (activePage === 'historyPage' || activePage === 'reportPage') {
            refreshAllData();
            console.log('🔄 Автообновление по таймеру');
        }
    }
}, 30000); // 30 секунд

// ===================== ВСПОМОГАТЕЛЬНЫЕ =====================
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
function showNotification(msg, type) {
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = msg;
    n.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type === 'success' ? 'rgba(40,167,69,0.95)' : type === 'error' ? 'rgba(220,53,69,0.95)' : 'rgba(64,145,108,0.95)'};color:white;padding:10px 18px;border-radius:10px;z-index:1000;font-size:13px;`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

window.onclick = function(e) { 
    const m = document.getElementById('detailModal');
    const rm = document.getElementById('registerModal');
    if (e.target === m) m.style.display = 'none';
    if (e.target === rm) rm.style.display = 'none';
}

// Инициализация
loadTheme();
restoreLastPage();
