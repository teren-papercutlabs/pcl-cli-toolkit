interface ReadInputOptions {
    file?: string;
}
/**
 * Read input from a file or stdin. Returns the content as a string.
 * If file is provided, reads from file. Otherwise reads from stdin.
 */
export declare function readInput(options?: ReadInputOptions): Promise<string>;
export {};
