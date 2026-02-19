export interface Config {
    tailscale: {
        mode: 'off' | 'serve' | 'funnel';
    };
    pairedDevices: {
        deviceId: string;
        token: string;
        role: 'console' | 'bridge' | 'drone';
        approved: boolean;
        pairingCode?: string;
    }[];
}
export declare function loadConfig(): Config;
export declare function saveConfig(config: Config): void;
export declare function generatePairingCode(): string;
//# sourceMappingURL=config.d.ts.map