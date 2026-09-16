import { Client, ConnectConfig } from 'ssh2';
import * as net from 'net';
import * as fs from 'fs';

export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface SshTunnelInstance {
  localHost: string;
  localPort: number;
  close: () => Promise<void>;
}

export class SshTunnelService {
  /**
   * Tests SSH connectivity without establishing a full port forward.
   */
  public async testSshConnection(sshConfig: SshTunnelConfig): Promise<{ success: boolean; message: string; pingMs: number }> {
    const start = Date.now();
    return new Promise((resolve) => {
      if (!sshConfig.host?.trim()) {
        return resolve({ success: false, message: 'Host SSH no especificado.', pingMs: 0 });
      }
      if (!sshConfig.user?.trim()) {
        return resolve({ success: false, message: 'Usuario SSH no especificado.', pingMs: 0 });
      }

      const client = new Client();
      let hasFinished = false;

      const finish = (success: boolean, message: string) => {
        if (hasFinished) return;
        hasFinished = true;
        try { client.end(); } catch {}
        try { client.destroy(); } catch {}
        const pingMs = Date.now() - start;
        resolve({ success, message, pingMs });
      };

      client.on('ready', () => {
        finish(true, '¡Conexión al servidor SSH establecida exitosamente!');
      });

      client.on('error', (err: any) => {
        let msg = err?.message || String(err);
        if (msg.includes('All configured authentication methods failed')) {
          msg = 'Autenticación SSH fallida. Verifica usuario, contraseña o clave privada.';
        } else if (msg.includes('ECONNREFUSED')) {
          msg = `Conexión rechazada por el host SSH en ${sshConfig.host}:${sshConfig.port || 22}.`;
        } else if (msg.includes('ENOTFOUND')) {
          msg = `No se pudo resolver el nombre de host SSH: ${sshConfig.host}.`;
        } else if (msg.includes('ETIMEDOUT')) {
          msg = `Tiempo de espera agotado al conectar al host SSH ${sshConfig.host}:${sshConfig.port || 22}.`;
        }
        finish(false, msg);
      });

      try {
        const connectConfig = this.buildConnectConfig(sshConfig);
        client.connect(connectConfig);
      } catch (err: any) {
        finish(false, err?.message || String(err));
      }
    });
  }

  private buildConnectConfig(sshConfig: SshTunnelConfig): ConnectConfig {
    const port = Number(sshConfig.port) || 22;
    const config: ConnectConfig = {
      host: sshConfig.host.trim(),
      port,
      username: sshConfig.user.trim(),
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3
    };

    if (sshConfig.authType === 'password') {
      config.password = sshConfig.password || '';
    } else if (sshConfig.authType === 'privateKey') {
      if (!sshConfig.privateKeyPath || !sshConfig.privateKeyPath.trim()) {
        throw new Error('Ruta de archivo de clave privada SSH no especificada.');
      }
      if (!fs.existsSync(sshConfig.privateKeyPath)) {
        throw new Error(`El archivo de clave privada SSH no existe: ${sshConfig.privateKeyPath}`);
      }
      config.privateKey = fs.readFileSync(sshConfig.privateKeyPath);
      if (sshConfig.passphrase) {
        config.passphrase = sshConfig.passphrase;
      }
    }

    return config;
  }

  /**
   * Creates an SSH tunnel with a local TCP forwarding proxy.
   * Listens on 127.0.0.1 on an available random port and forwards incoming
   * traffic through the SSH connection to the remote target host and port.
   */
  public async createTunnel(
    sshConfig: SshTunnelConfig,
    remoteHost: string,
    remotePort: number
  ): Promise<SshTunnelInstance> {
    return new Promise((resolve, reject) => {
      if (!sshConfig.host?.trim()) {
        return reject(new Error('Host SSH no especificado.'));
      }
      if (!sshConfig.user?.trim()) {
        return reject(new Error('Usuario SSH no especificado.'));
      }

      const client = new Client();
      const openSockets = new Set<net.Socket>();
      let server: net.Server | null = null;
      let isClosed = false;

      const cleanup = async () => {
        if (isClosed) return;
        isClosed = true;

        for (const sock of openSockets) {
          try {
            sock.destroy();
          } catch {}
        }
        openSockets.clear();

        if (server) {
          await new Promise<void>((res) => {
            try {
              server!.close(() => res());
            } catch {
              res();
            }
          });
          server = null;
        }

        try {
          client.end();
        } catch {}
        try {
          client.destroy();
        } catch {}
      };

      client.on('error', (err: any) => {
        let msg = err?.message || String(err);
        if (msg.includes('All configured authentication methods failed')) {
          msg = 'Autenticación SSH fallida. Verifica usuario, contraseña o clave privada.';
        }
        if (!server) {
          cleanup();
          reject(new Error(`Error de conexión SSH: ${msg}`));
        } else {
          console.warn('SSH Client error during active tunnel:', err);
        }
      });

      client.on('ready', () => {
        const targetHost = (!remoteHost || remoteHost.trim() === 'localhost') ? '127.0.0.1' : remoteHost.trim();
        const targetPort = Number(remotePort) || 3050;

        server = net.createServer((sock) => {
          openSockets.add(sock);

          sock.on('close', () => openSockets.delete(sock));
          sock.on('error', (err: any) => {
            console.warn('Local proxy socket error:', err);
            openSockets.delete(sock);
          });

          client.forwardOut(
            '127.0.0.1',
            sock.remotePort || 0,
            targetHost,
            targetPort,
            (err: any, stream: any) => {
              if (err) {
                console.error(`Error forwarding through SSH to ${targetHost}:${targetPort}:`, err);
                sock.destroy(err);
                return;
              }

              sock.pipe(stream).pipe(sock);

              stream.on('error', (streamErr: any) => {
                console.warn('SSH forward stream error:', streamErr);
                sock.destroy();
              });
              stream.on('close', () => {
                sock.destroy();
              });
              sock.on('close', () => {
                stream.destroy();
              });
            }
          );
        });

        server.on('error', (serverErr: any) => {
          cleanup();
          reject(new Error(`Error creando servidor local para el túnel: ${serverErr.message}`));
        });

        // Listen on 127.0.0.1 with port 0 (OS assigns an ephemeral free port)
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          resolve({
            localHost: '127.0.0.1',
            localPort: addr.port,
            close: cleanup
          });
        });
      });

      try {
        const connectConfig = this.buildConnectConfig(sshConfig);
        client.connect(connectConfig);
      } catch (err: any) {
        cleanup();
        reject(err);
      }
    });
  }
}

export const sshTunnelService = new SshTunnelService();
