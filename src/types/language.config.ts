export interface CompileConfig {
  timeout: number;
  cmd: (sourceFile: string) => string[];
}

export interface RunConfig {
  needsCompilation: boolean;
  cmd: (file: string) => string[];
  wallTime: (timeLimit: number) => number;
}

export interface LanguageConfig {
  extension: string;
  compile: CompileConfig | null;
  run: RunConfig;
}

export const languages: Record<string, LanguageConfig> = {
  cpp: {
    extension: 'cpp',
    compile: {
      timeout: 10,
      cmd: (sourceFile: string) => [
        '/usr/bin/g++',
        '-std=c++17',
        '-O2',
        '-Wall',
        '-Wextra',
        sourceFile,
        '-o',
        'solution',
        '-lm',
      ],
    },
    run: {
      needsCompilation: true,
      cmd: () => ['./solution'],
      wallTime: (timeLimit) => timeLimit * 2,
    },
  },

  python: {
    extension: 'py',
    compile: null, // No compilation
    run: {
      needsCompilation: false,
      cmd: (sourceFile: string) => ['/usr/bin/python3', sourceFile],
      wallTime: (timeLimit) => timeLimit * 3,
    },
  },
};
