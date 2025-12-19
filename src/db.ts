import Dexie from 'dexie';

export class HexFile {
    id?: number;
    url!: string;
    text!: string;
}

export class Am32Dexie extends Dexie {
    downloads!: Dexie.Table<HexFile, any>;

    constructor () {
        super('Am32Dexie');
        this.version(1).stores({
            downloads: '++id, url, text'
        });
    }
}

const db = new Am32Dexie();

export default db;
