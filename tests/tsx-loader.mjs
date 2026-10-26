import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|json)$/;

/** Resolve extensionless imports from the app's TypeScript sources. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !SOURCE_EXT.test(specifier)) {
    for (const ext of ['.tsx', '.ts', '.js', '.mjs']) {
      try {
        return await nextResolve(`${specifier}${ext}`, context);
      } catch {
        // Try the next extension. A real failure still surfaces below.
      }
    }
  }
  return nextResolve(specifier, context);
}

/** Transpile JSX so node:test can render the demo screen. Plain .ts stays on Node's loader. */
export async function load(url, context, nextLoad) {
  if (!url.endsWith('.tsx')) return nextLoad(url, context);
  const source = readFileSync(fileURLToPath(url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: url,
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
