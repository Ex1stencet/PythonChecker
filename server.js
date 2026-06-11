const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// База данных в /tmp для Render.com
const dbPath = '/tmp/codechecker.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.log("❌ Ошибка БД:", err.message);
    else { console.log("✅ База данных подключена"); initDatabase(); }
});

function initDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT UNIQUE,
            password TEXT,
            theme TEXT DEFAULT 'light',
            items_per_page INTEGER DEFAULT 10,
            auto_save INTEGER DEFAULT 1,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS requests (
            request_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            code_text TEXT,
            status TEXT,
            error_type TEXT,
            is_favorite INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS errors_knowledge (
            error_id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_name TEXT UNIQUE,
            explanation TEXT,
            solution TEXT,
            material_link TEXT
        )`);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)`);
        
        db.get(`SELECT * FROM users WHERE login = 'test'`, async (err, user) => {
            if (!user && !err) {
                const hash = await bcrypt.hash("test123", 10);
                db.run(`INSERT INTO users (login, password, role) VALUES (?, ?, ?)`, ["test", hash, "admin"]);
                console.log("✅ Создан тестовый пользователь: test / test123");
            }
        });
        
        const errorsKnowledge = [
            ['NameError', 'Переменная не определена.', 'Создайте переменную перед использованием.', 'https://docs.python.org/3/tutorial/introduction.html'],
            ['SyntaxError', 'Синтаксическая ошибка.', 'Проверьте скобки, кавычки, двоеточия.', 'https://docs.python.org/3/tutorial/errors.html'],
            ['IndentationError', 'Ошибка отступов.', 'Используйте 4 пробела для отступов.', 'https://docs.python.org/3/tutorial/controlflow.html'],
            ['TypeError', 'Несовместимые типы данных.', 'Используйте преобразование типов.', 'https://docs.python.org/3/library/stdtypes.html'],
            ['ZeroDivisionError', 'Деление на ноль.', 'Проверьте делитель перед делением.', 'https://docs.python.org/3/library/exceptions.html']
        ];
        
        errorsKnowledge.forEach(err => {
            db.run(`INSERT OR IGNORE INTO errors_knowledge (error_name, explanation, solution, material_link) VALUES (?, ?, ?, ?)`, err);
        });
        
        console.log("✅ База данных инициализирована");
    });
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post("/register", async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) return res.json({ success: false, message: "Введите логин и пароль" });
        if (password.length < 4) return res.json({ success: false, message: "Пароль должен быть не менее 4 символов" });
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (login, password) VALUES (?, ?)`, [login, hash], function(err) {
            if (err) return res.json({ success: false, message: "Пользователь уже существует" });
            res.json({ success: true, userId: this.lastID });
        });
    } catch (error) { res.json({ success: false, message: "Ошибка сервера" }); }
});

app.post("/login", (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT * FROM users WHERE login = ?`, [login], async (err, user) => {
        if (err || !user) return res.json({ success: false, message: "Пользователь не найден" });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.json({ success: false, message: "Неверный пароль" });
        res.json({ success: true, userId: user.user_id, login: user.login, role: user.role });
    });
});

app.get("/user/profile", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    db.get(`SELECT user_id, login, role, created_at FROM users WHERE user_id = ?`, [user_id], (err, row) => {
        if (err || !row) return res.json({ success: false });
        res.json({ success: true, user: row });
    });
});

app.put("/user/password", async (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    const { old_password, new_password } = req.body;
    db.get(`SELECT password FROM users WHERE user_id = ?`, [user_id], async (err, row) => {
        if (err || !row) return res.json({ success: false });
        const isValid = await bcrypt.compare(old_password, row.password);
        if (!isValid) return res.json({ success: false, message: "Неверный текущий пароль" });
        if (new_password.length < 4) return res.json({ success: false, message: "Пароль должен быть не менее 4 символов" });
        const hash = await bcrypt.hash(new_password, 10);
        db.run(`UPDATE users SET password = ? WHERE user_id = ?`, [hash, user_id], function(err) {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

app.post("/check", (req, res) => {
    const { code } = req.body;
    if (!code || code.trim() === "") return res.json({ success: false, error: "Код пустой" });
    
    const tempCode = `# -*- coding: utf-8 -*-\nimport sys\nimport traceback\ntry:\n    sys.stdout.reconfigure(encoding='utf-8')\nexcept:\n    pass\ntry:\n${code.split('\n').map(line => '    ' + line).join('\n')}\nexcept Exception as e:\n    print(f"{type(e).__name__}: {e}", file=sys.stderr)\n    traceback.print_exc()\n`;
    const tempFile = path.join('/tmp', `temp_${Date.now()}.py`);
    
    try {
        fs.writeFileSync(tempFile, tempCode, "utf8");
        exec(`python3 "${tempFile}"`, { timeout: 10000, encoding: "utf8" }, (error, stdout, stderr) => {
            try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch(e) {}
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

app.post("/save", (req, res) => {
    const { user_id, code, status, error_type } = req.body;
    if (!user_id) return res.json({ success: false });
    db.run(`INSERT INTO requests (user_id, code_text, status, error_type) VALUES (?, ?, ?, ?)`, [user_id, code, status, error_type || ""], function(err) {
        if (err) return res.json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

app.get("/history", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    const order = req.query.order === "asc" ? "ASC" : "DESC";
    db.all(`SELECT * FROM requests WHERE user_id = ? ORDER BY request_id ${order}`, [user_id], (err, rows) => {
        if (err) return res.json([]);
        res.json(rows);
    });
});

app.get("/record/:id", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ error: "Не авторизован" });
    db.get(`SELECT * FROM requests WHERE request_id = ? AND user_id = ?`, [req.params.id, user_id], (err, row) => {
        if (err || !row) return res.json({ error: "Запись не найдена" });
        res.json(row);
    });
});

app.put("/update/:id", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    const { code, status, error_type } = req.body;
    db.run(`UPDATE requests SET code_text = ?, status = ?, error_type = ? WHERE request_id = ? AND user_id = ?`, [code, status, error_type || "", req.params.id, user_id], function(err) {
        if (err) return res.json({ success: false });
        if (this.changes === 0) return res.json({ success: false });
        res.json({ success: true });
    });
});

app.delete("/delete/:id", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    db.run(`DELETE FROM requests WHERE request_id = ? AND user_id = ?`, [req.params.id, user_id], function(err) {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

app.post("/favorite/:id", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    const { is_favorite } = req.body;
    db.run(`UPDATE requests SET is_favorite = ? WHERE request_id = ? AND user_id = ?`, [is_favorite ? 1 : 0, req.params.id, user_id], function(err) {
        res.json({ success: !err });
    });
});

app.get("/stats", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ total: 0, errors: 0, favorites: 0 });
    db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN status='Есть ошибки' THEN 1 ELSE 0 END) as errors, SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorites FROM requests WHERE user_id = ?`, [user_id], (err, row) => {
        res.json(row || { total: 0, errors: 0, favorites: 0 });
    });
});

app.get("/top-errors", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    db.all(`SELECT error_type, COUNT(*) as count FROM requests WHERE user_id = ? AND error_type != '' AND error_type IS NOT NULL GROUP BY error_type ORDER BY count DESC LIMIT 5`, [user_id], (err, rows) => {
        res.json(rows || []);
    });
});

app.get("/daily-activity", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    db.all(`SELECT DATE(created_at) as date, COUNT(*) as count FROM requests WHERE user_id = ? AND created_at >= DATE('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date DESC`, [user_id], (err, rows) => {
        res.json(rows || []);
    });
});

app.get("/weekly-stats", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json([]);
    db.all(`SELECT CASE cast(strftime('%w', created_at) as integer) WHEN 0 THEN 'Воскресенье' WHEN 1 THEN 'Понедельник' WHEN 2 THEN 'Вторник' WHEN 3 THEN 'Среда' WHEN 4 THEN 'Четверг' WHEN 5 THEN 'Пятница' WHEN 6 THEN 'Суббота' END as day_name, COUNT(*) as count FROM requests WHERE user_id = ? GROUP BY strftime('%w', created_at) ORDER BY strftime('%w', created_at)`, [user_id], (err, rows) => {
        res.json(rows || []);
    });
});

app.get("/full-report", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ totalChecks: 0, successChecks: 0, errorChecks: 0, successPercent: 0, topErrors: [] });
    db.get(`SELECT COUNT(*) as totalChecks FROM requests WHERE user_id = ?`, [user_id], (err, totalRow) => {
        db.get(`SELECT COUNT(*) as errorChecks FROM requests WHERE user_id = ? AND status='Есть ошибки'`, [user_id], (err, errorRow) => {
            db.all(`SELECT error_type, COUNT(*) as count FROM requests WHERE user_id = ? AND error_type != '' GROUP BY error_type ORDER BY count DESC LIMIT 5`, [user_id], (err, topErrors) => {
                const totalChecks = totalRow?.totalChecks || 0;
                const errorChecks = errorRow?.errorChecks || 0;
                const successChecks = totalChecks - errorChecks;
                const successPercent = totalChecks > 0 ? Math.round(successChecks * 100 / totalChecks) : 0;
                res.json({ totalChecks, successChecks, errorChecks, successPercent, topErrors: topErrors || [] });
            });
        });
    });
});

app.post("/save-settings", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ success: false });
    const { theme, items_per_page, auto_save } = req.body;
    db.run(`UPDATE users SET theme = ?, items_per_page = ?, auto_save = ? WHERE user_id = ?`, [theme || 'light', items_per_page || 10, auto_save ? 1 : 0, user_id], function(err) {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

app.get("/get-settings", (req, res) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) return res.json({ theme: 'light', items_per_page: 10, auto_save: 1 });
    db.get(`SELECT theme, items_per_page, auto_save FROM users WHERE user_id = ?`, [user_id], (err, row) => {
        res.json(row || { theme: 'light', items_per_page: 10, auto_save: 1 });
    });
});

app.listen(PORT, () => { 
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📝 Тестовый пользователь: test / test123`);
    console.log(`🔗 Открыть: http://localhost:${PORT}`);
});
