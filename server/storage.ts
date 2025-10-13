// Storage interface tidak digunakan untuk project ini
// Aplikasi hanya menggunakan API endpoint untuk fetch data dari Icecast server
export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
