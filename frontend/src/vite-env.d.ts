/// <reference types="vite/client" />

interface PyodideInterface {
    runPythonAsync(code: string): Promise<any>;
    loadPackage(packages: string | string[]): Promise<void>;
}

declare global {
    interface Window {
        pyodide: PyodideInterface | undefined;
    }
}

export { };
