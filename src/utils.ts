import axios from 'axios';
import fs from 'fs';

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