const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// ===================== ПОДКЛЮЧЕНИЕ К POSTGRESQL =====================
// Render автоматически подставит DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Для Render
    }
});

// ===================== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ =====================
async function initDatabase() {
    try {
        // Создание таблицы users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                login TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                theme TEXT DEFAULT 'light',
                items_per_page INTEGER DEFAULT 10,
                auto_save INTEGER DEFAULT 1,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Создание таблицы requests
        await pool.query(`
            CREATE TABLE IF NOT EXISTS requests (
                request_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                code_text TEXT,
                status TEXT,
                error_type TEXT,
                is_favorite INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Создание таблицы errors_knowledge
        await pool.query(`
            CREATE TABLE IF NOT EXISTS errors_knowledge (
                error_id SERIAL PRIMARY KEY,
                error_name TEXT UNIQUE,
                explanation TEXT,
                solution TEXT,
                material_link TEXT
            )
        `);
        
        // Создание индексов для ускорения запросов
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)`);
        
        // Создание тестового пользователя
        const testUser = await pool.query(`SELECT * FROM users WHERE login = 'test'`);
        if (testUser.rows.length === 0) {
            const hash = await bcrypt.hash("test123", 10);
            await pool.query(
                `INSERT INTO users (login, password, role) VALUES ($1, $2, $3)`,
                ["test", hash, "admin"]
            );
            console.log("✅ Создан тестовый пользователь: test / test123");
        }
        
        // Заполнение базы знаний об ошибках
        const errorsKnowledge = [
            ['NameError', 'Переменная не определена.', 'Создайте переменную перед использованием.', 'https://docs.python.org/3/tutorial/introduction.html'],
            ['SyntaxError', 'Синтаксическая ошибка.', 'Проверьте скобки, кавычки, двоеточия.', 'https://docs.python.org/3/tutorial/errors.html'],
            ['IndentationError', 'Ошибка отступов.', 'Используйте 4 пробела для отступов.', 'https://docs.python.org/3/tutorial/controlflow.html'],
            ['TypeError', 'Несовместимые типы данных.', 'Используйте преобразование типов.', 'https://docs.python.org/3/library/stdtypes.html'],
            ['ZeroDivisionError', 'Деление на ноль.', 'Проверьте делитель перед делением.', 'https://docs.python.org/3/library/exceptions.html']
        ];
        
        for (const err of errorsKnowledge) {
            await pool.query(
                `INSERT INTO errors_knowledge (error_name, explanation, solution, material_link) 
                 VALUES ($1, $2, $3, $4) ON CONFLICT (error_name) DO NOTHING`,
                err
            );
        }
        
        console.log("✅ База данных PostgreSQL инициализирована");
    } catch (error) {
        console.error("❌ Ошибка инициализации БД:", error);
    }
}

// Запуск инициализации
initDatabase();

// ===================== API МАРШРУТЫ =====================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Регистрация
app.post("/register", async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) {
            return res.json({ success: false, message: "Введите логин и пароль" });
        }
        if (password.length < 4) {
            return res.json({ success: false, message: "Пароль должен быть не менее 4 символов" });
        }
        
        const hash = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            `INSERT INTO users (login, password) VALUES ($1, $2) RETURNING user_id`,
            [login, hash]
        );
        
        res.json({ success: true, userId: result.rows[0].user_id });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            res.json({ success: false, message: "Пользователь уже существует" });
        } else {
            console.error(error);
            res.json({ success: false, message: "Ошибка сервера" });
        }
    }
});

// Вход
app.post("/login", async (req, res) => {
    try {
        const { login, password } = req.body;
        
        const result = await pool.query(`SELECT * FROM users WHERE login = $1`, [login]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Пользователь не найден" });
        }
        
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.json({ success: false, message: "Неверный пароль" });
        }
        
        res.json({ 
            success: true, 
            userId: user.user_id, 
            login: user.login, 
            role: user.role 
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Ошибка сервера" });
    }
});

// Профиль пользователя
app.get("/user/profile", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    
    try {
        const result = await pool.query(
            `SELECT user_id, login, role, created_at FROM users WHERE user_id = $1`,
            [user_id]
        );
        
        if (result.rows.length === 0) {
            return res.json({ success: false });
        }
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.json({ success: false });
    }
});

// Смена пароля
app.put("/user/password", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false, message: "Не авторизован" });
    
    const { old_password, new_password } = req.body;
    
    try {
        const result = await pool.query(`SELECT password FROM users WHERE user_id = $1`, [user_id]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Пользователь не найден" });
        }
        
        const isValid = await bcrypt.compare(old_password, result.rows[0].password);
        
        if (!isValid) {
            return res.json({ success: false, message: "Неверный текущий пароль" });
        }
        
        if (new_password.length < 4) {
            return res.json({ success: false, message: "Пароль должен быть не менее 4 символов" });
        }
        
        const hash = await bcrypt.hash(new_password, 10);
        await pool.query(`UPDATE users SET password = $1 WHERE user_id = $2`, [hash, user_id]);
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// Проверка кода
app.post("/check", (req, res) => {
    const { code } = req.body;
    if (!code || code.trim() === "") {
        return res.json({ success: false, error: "Код пустой" });
    }
    
    const tempCode = `# -*- coding: utf-8 -*-\nimport sys\nimport traceback\ntry:\n    sys.stdout.reconfigure(encoding='utf-8')\nexcept:\n    pass\ntry:\n${code.split('\n').map(line => '    ' + line).join('\n')}\nexcept Exception as e:\n    print(f"{type(e).__name__}: {e}", file=sys.stderr)\n    traceback.print_exc()\n`;
    const tempFile = path.join('/tmp', `temp_${Date.now()}.py`);
    
    try {
        fs.writeFileSync(tempFile, tempCode, "utf8");
        exec(`python3 "${tempFile}"`, { timeout: 10000, encoding: "utf8" }, (error, stdout, stderr) => {
            try { 
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); 
            } catch(e) {}
            
            if (error) {
                let errorMsg = stderr || error.message;
                const errorMatch = errorMsg.match(/(\w+Error):/);
                const errorName = errorMatch ? errorMatch[1] : "Ошибка выполнения";
                return res.json({ success: false, error: errorName + "\n" + errorMsg.substring(0, 500) });
            }
            res.json({ success: true, output: stdout || "✅ Код выполнен успешно!" });
        });
    } catch (error) { 
        res.json({ success: false, error: "Ошибка записи файла" }); 
    }
});

// Сохранение истории
app.post("/save", async (req, res) => {
    const { user_id, code, status, error_type } = req.body;
    if (!user_id) return res.json({ success: false });
    
    try {
        const result = await pool.query(
            `INSERT INTO requests (user_id, code_text, status, error_type) 
             VALUES ($1, $2, $3, $4) RETURNING request_id`,
            [user_id, code, status, error_type || ""]
        );
        res.json({ success: true, id: result.rows[0].request_id });
    } catch (error) {
        res.json({ success: false });
    }
});

// Получение истории
app.get("/history", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    
    const order = req.query.order === "asc" ? "ASC" : "DESC";
    
    try {
        const result = await pool.query(
            `SELECT * FROM requests WHERE user_id = $1 ORDER BY request_id ${order}`,
            [user_id]
        );
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Получение одной записи
app.get("/record/:id", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ error: "Не авторизован" });
    
    try {
        const result = await pool.query(
            `SELECT * FROM requests WHERE request_id = $1 AND user_id = $2`,
            [req.params.id, user_id]
        );
        
        if (result.rows.length === 0) {
            return res.json({ error: "Запись не найдена" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.json({ error: "Ошибка" });
    }
});

// Обновление записи
app.put("/update/:id", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    
    const { code, status, error_type } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE requests SET code_text = $1, status = $2, error_type = $3 
             WHERE request_id = $4 AND user_id = $5`,
            [code, status, error_type || "", req.params.id, user_id]
        );
        
        if (result.rowCount === 0) {
            return res.json({ success: false });
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// Удаление записи
app.delete("/delete/:id", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    
    try {
        const result = await pool.query(
            `DELETE FROM requests WHERE request_id = $1 AND user_id = $2`,
            [req.params.id, user_id]
        );
        
        if (result.rowCount === 0) {
            return res.json({ success: false });
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// Избранное
app.post("/favorite/:id", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    
    const { is_favorite } = req.body;
    
    try {
        await pool.query(
            `UPDATE requests SET is_favorite = $1 WHERE request_id = $2 AND user_id = $3`,
            [is_favorite ? 1 : 0, req.params.id, user_id]
        );
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// Статистика
app.get("/stats", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ total: 0, errors: 0, favorites: 0 });
    
    try {
        const totalResult = await pool.query(
            `SELECT COUNT(*) as total FROM requests WHERE user_id = $1`,
            [user_id]
        );
        
        const errorsResult = await pool.query(
            `SELECT COUNT(*) as errors FROM requests WHERE user_id = $1 AND status='Есть ошибки'`,
            [user_id]
        );
        
        const favoritesResult = await pool.query(
            `SELECT COUNT(*) as favorites FROM requests WHERE user_id = $1 AND is_favorite = 1`,
            [user_id]
        );
        
        res.json({
            total: parseInt(totalResult.rows[0].total),
            errors: parseInt(errorsResult.rows[0].errors),
            favorites: parseInt(favoritesResult.rows[0].favorites)
        });
    } catch (error) {
        res.json({ total: 0, errors: 0, favorites: 0 });
    }
});

// Топ ошибок
app.get("/top-errors", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    
    try {
        const result = await pool.query(
            `SELECT error_type, COUNT(*) as count 
             FROM requests 
             WHERE user_id = $1 AND error_type != '' AND error_type IS NOT NULL 
             GROUP BY error_type 
             ORDER BY count DESC 
             LIMIT 5`,
            [user_id]
        );
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Дневная активность
app.get("/daily-activity", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    
    try {
        const result = await pool.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count 
             FROM requests 
             WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(created_at) 
             ORDER BY date DESC`,
            [user_id]
        );
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Статистика по дням недели
app.get("/weekly-stats", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    
    try {
        const result = await pool.query(`
            SELECT 
                CASE EXTRACT(DOW FROM created_at)
                    WHEN 0 THEN 'Воскресенье'
                    WHEN 1 THEN 'Понедельник'
                    WHEN 2 THEN 'Вторник'
                    WHEN 3 THEN 'Среда'
                    WHEN 4 THEN 'Четверг'
                    WHEN 5 THEN 'Пятница'
                    WHEN 6 THEN 'Суббота'
                END as day_name,
                COUNT(*) as count
            FROM requests
            WHERE user_id = $1
            GROUP BY EXTRACT(DOW FROM created_at)
            ORDER BY EXTRACT(DOW FROM created_at)
        `, [user_id]);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Полный отчёт
app.get("/full-report", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ totalChecks: 0, successChecks: 0, errorChecks: 0, successPercent: 0, topErrors: [] });
    
    try {
        const totalResult = await pool.query(
            `SELECT COUNT(*) as totalChecks FROM requests WHERE user_id = $1`,
            [user_id]
        );
        
        const errorResult = await pool.query(
            `SELECT COUNT(*) as errorChecks FROM requests WHERE user_id = $1 AND status='Есть ошибки'`,
            [user_id]
        );
        
        const topErrorsResult = await pool.query(
            `SELECT error_type, COUNT(*) as count 
             FROM requests 
             WHERE user_id = $1 AND error_type != '' 
             GROUP BY error_type 
             ORDER BY count DESC 
             LIMIT 5`,
            [user_id]
        );
        
        const totalChecks = parseInt(totalResult.rows[0].totalchecks);
        const errorChecks = parseInt(errorResult.rows[0].errorchecks);
        const successChecks = totalChecks - errorChecks;
        const successPercent = totalChecks > 0 ? Math.round(successChecks * 100 / totalChecks) : 0;
        
        res.json({
            totalChecks,
            successChecks,
            errorChecks,
            successPercent,
            topErrors: topErrorsResult.rows
        });
    } catch (error) {
        res.json({ totalChecks: 0, successChecks: 0, errorChecks: 0, successPercent: 0, topErrors: [] });
    }
});

// Сохранение настроек
app.post("/save-settings", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    
    const { theme, items_per_page, auto_save } = req.body;
    
    try {
        await pool.query(
            `UPDATE users SET theme = $1, items_per_page = $2, auto_save = $3 WHERE user_id = $4`,
            [theme || 'light', items_per_page || 10, auto_save ? 1 : 0, user_id]
        );
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// Получение настроек
app.get("/get-settings", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ theme: 'light', items_per_page: 10, auto_save: 1 });
    
    try {
        const result = await pool.query(
            `SELECT theme, items_per_page, auto_save FROM users WHERE user_id = $1`,
            [user_id]
        );
        
        if (result.rows.length === 0) {
            return res.json({ theme: 'light', items_per_page: 10, auto_save: 1 });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.json({ theme: 'light', items_per_page: 10, auto_save: 1 });
    }
});

// Запуск сервера
app.listen(PORT, () => { 
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📝 Тестовый пользователь: test / test123`);
    console.log(`🔗 Открыть: http://localhost:${PORT}`);
    console.log(`💾 База данных: PostgreSQL`);
});
