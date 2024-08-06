import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';


export async function apikey(name: string) {
    try {
        const response = await axios.post(
            `${process.env.URL}`,
            { name },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ADMIN_KEY}`
                }
            }
        );
        const key = response.data.result.key;
        console.log(key);
        return key;
    } catch (error) {
        console.error(error);
    }
}

export function readUserIds() {
    if (fs.existsSync('db.json')) {
        const data = fs.readFileSync('db.json', 'utf-8');
        return JSON.parse(data);
    } else {
        return {};
    }
}

export function writeUserIds(userIds: any) {
    const data = JSON.stringify(userIds, null, 2);
    fs.writeFileSync('db.json', data, 'utf-8');
}

export async function readModels() {
    if (fs.existsSync('src/models.json')) {
        const data = fs.readFileSync('src/models.json', 'utf-8');
        const models = JSON.parse(data);
        return models.data.map((model: any) => model.id);
    } else {
        return [];
    }
}

export function saveUserData(userId: string, apiKey: string, selectedModel: string) {
    const userIds = readUserIds();
    userIds[userId] = {
        apiKey: apiKey,
        model: selectedModel
    };
    writeUserIds(userIds);
}

export async function sendmessage(message: string, model: string, apiKey: string, userId: string, historyId: string) {
    const url = 'https://gpt.anyvm.tech/v1/chat/completions';
    
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    let messages = [
        {
            role: 'user',
            content: message
        }
    ];

    const data = {
        model: model,
        messages: messages
    };

    try {
        const response = await axios.post(url, data, { headers });
        const responseData = response.data;

        const assistantMessage = responseData.choices[0].message;

        messages.push({
            role: assistantMessage.role,
            content: assistantMessage.content
        });

        
        
        let messageHistory: { [key: string]: any } = {};
        const messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
        if (!fs.existsSync(messageHistoryFilePath)) {
            fs.mkdirSync('src/history');
        }
        if (fs.existsSync(messageHistoryFilePath)) {
            const fileContent = fs.readFileSync(messageHistoryFilePath, 'utf-8');
            messageHistory = JSON.parse(fileContent);
        }

        if (!messageHistory[userId]) {
            messageHistory[userId] = [];
        }
        messageHistory[userId].push(...messages);

        fs.writeFileSync(messageHistoryFilePath, JSON.stringify(messageHistory, null, 2));

        return responseData;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

export async function loadHistory(message: any, historyId: string): Promise<void> {
    const userId: string = message.author.id;
    let messageHistoryFilePath: string;
        messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
    
    if (fs.existsSync(messageHistoryFilePath)) {
        const fileContent: string = fs.readFileSync(messageHistoryFilePath, 'utf-8');
        const messageHistory: any = JSON.parse(fileContent);
        saveDB(message, historyId);
        message.reply(`Loaded history: ${JSON.stringify(messageHistory, null, 2)}`);
    } else {
        message.reply(`No history found for ID: ${historyId}`);
    }
}
export async function loadPublic(message: any, historyId: string): Promise<void> {
    const userId: string = "public";
    let messageHistoryFilePath: string;
    messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);

    if (fs.existsSync(messageHistoryFilePath)) {
        const fileContent: string = fs.readFileSync(messageHistoryFilePath, 'utf-8');
        const messageHistory: any = JSON.parse(fileContent);
        saveDB(message, historyId);
        message.reply(`Loaded history: ${JSON.stringify(messageHistory, null, 2)}`);
    } else {
        message.reply(`No public history found for ID: ${historyId}`);
    }
}
export function setHistory(message: any, historyId: string): void {
    const userId: string = message.author.id;
    const messageHistoryFilePath: string = path.join('src/history', `${userId}_${historyId}.json`);

    if (!fs.existsSync('src/history')) {
        fs.mkdirSync('src/history');
    }

    fs.writeFileSync(messageHistoryFilePath, JSON.stringify({ [userId]: [] }, null, 2));
    saveDB(message, historyId);
    message.reply(`History ID set to: ${historyId}`);
}
export async function copyHistory(message: any, historyId: string): Promise<void> {
    const userId: string = message.author.id;
    const dbFilePath: string = path.join('src', 'db.json');

    try {
        const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
        const db = JSON.parse(dbContent);

        if (db[userId] && db[userId].historyFilePath) {
            const messageHistoryFilePath: string = db[userId].historyFilePath;

            if (fs.existsSync(messageHistoryFilePath)) {
                message.reply(`History ID ${historyId} already exists. change id to save.`);
                return;
            }

            if (!fs.existsSync('src/history')) {
                fs.mkdirSync('src/history');
            }

            fs.writeFileSync(messageHistoryFilePath, JSON.stringify({ [userId]: [] }, null, 2));
            saveDB(message, historyId);
            message.reply(`History ID set to: ${historyId}`);
        } else {
            message.reply(`No history file path found for user ID ${userId} in db.json.`);
        }
    } catch (error) {
        console.error('Error reading db.json:', error);
        message.reply('An error occurred while accessing the database.');
    }
}

export function clearHistory(message: any): void {
    const userId: string = message.author.id;
    const dbFilePath: string = path.join('src', 'db.json');

    if (!fs.existsSync(dbFilePath)) {
        message.reply('Database file not found.');
        return;
    }

    const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);

    if (!db[userId] || !db[userId].historyId) {
        message.reply('No history found for the given userId.');
        return;
    }

    const historyId: string = db[userId].historyId;
    const userHistoryFilePath: string = path.join('src/history', `${userId}_${historyId}.json`);

    if (fs.existsSync(userHistoryFilePath)) {
        fs.writeFileSync(userHistoryFilePath, JSON.stringify([]));
        message.reply('History cleared.');
    } else {
        message.reply('No history found for the given historyId.');
    }
}
 async function checkDatabaseFile(dbFilePath: string, message: any): Promise<void> {
    try {
        await fs.promises.access(dbFilePath);
    } catch (error) {
        message.reply('Database file not found.');
        return;
    }
}
async function saveDB(message: any, historyId: string) {
    const userId = message.author.id;
    const dbFilePath = path.join('src', 'db.json');
    const userHistoryFilePath = `${userId}_${historyId}.json`;

    await checkDatabaseFile(dbFilePath, message);

    const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);

    if (!db[userId]) {
        db[userId] = {};
    }

    db[userId].historyFilePath = userHistoryFilePath;

    fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
    message.reply(`saved  ${historyId}.`);
}

export function setPublic(message: any, historyId: string): void {
    const userId: string = 'public';
    const publicHistoryFilePath = path.join('src/history', `public_${historyId}.json`);
    if (fs.existsSync(publicHistoryFilePath)) {
        message.reply(`Public history ID ${historyId} already exists. change id to save.`);
        return;
    }

    if (!fs.existsSync('src/history')) {
        fs.mkdirSync('src/history');
    }

    fs.writeFileSync(publicHistoryFilePath, JSON.stringify({ [userId]: [] }, null, 2));
    saveDB(message, historyId);
    message.reply(`Public history ID set to: ${historyId}`);
}
export async function checkHistory(userId: string, message: any): Promise<string | null> {
    const dbFilePath = path.join('src', 'db.json');

    try {
        await fs.promises.access(dbFilePath);
    } catch (error) {
        return null;
    }

    const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);

    if (db[userId] && db[userId].historyFilePath) {
        const historyFilePath = db[userId].historyFilePath;
        const historyId = historyFilePath.split('_')[1].split('.')[0];

        if (/^\d+$/.test(userId)) {
            message.reply(`Current history is private and ID is ${historyId}`);
        } else if (userId === "public") {
            message.reply(`Current history is public and ID is ${historyId}`);
        }

        return historyId;
    }

    return null;
}