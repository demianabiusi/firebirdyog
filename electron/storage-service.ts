import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  role?: string;
  charset: string;
  dialect?: number;
  pageSize?: number;
  createdAt?: string;
}

export class StorageService {
  private configPath: string;
  private connections: SavedConnection[] = [];

  constructor() {
    const userDataPath = app?.getPath('userData') || './data';
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (err) {
        console.error('Failed to create userData dir', err);
      }
    }
    this.configPath = path.join(userDataPath, 'firebird-connections.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        this.connections = JSON.parse(raw);
      } else {
        // Default initial sample connection
        this.connections = [
          {
            id: 'default-local',
            name: 'Localhost (Default FB)',
            host: '127.0.0.1',
            port: 3050,
            database: '/var/lib/firebird/data/test.fdb',
            user: 'SYSDBA',
            password: 'masterkey',
            role: '',
            charset: 'UTF8',
            dialect: 3,
            createdAt: new Date().toISOString()
          }
        ];
        this.save();
      }
    } catch (err) {
      console.error('Error loading connections:', err);
      this.connections = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.connections, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving connections:', err);
    }
  }

  public getConnections(): SavedConnection[] {
    return this.connections;
  }

  public saveConnection(conn: SavedConnection): SavedConnection {
    const index = this.connections.findIndex(c => c.id === conn.id);
    if (index >= 0) {
      this.connections[index] = { ...conn };
    } else {
      if (!conn.id) {
        conn.id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      }
      conn.createdAt = conn.createdAt || new Date().toISOString();
      this.connections.push(conn);
    }
    this.save();
    return conn;
  }

  public deleteConnection(id: string): boolean {
    const prevLen = this.connections.length;
    this.connections = this.connections.filter(c => c.id !== id);
    if (this.connections.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }
}
