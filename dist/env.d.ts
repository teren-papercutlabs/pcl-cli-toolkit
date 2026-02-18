/**
 * Load environment variables from multiple dotenv files.
 * Suppresses dotenv's stdout debug output. Tolerates missing files.
 */
export declare function loadEnv(paths: string[]): void;
