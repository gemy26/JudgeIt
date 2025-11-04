export interface LanguageConfig {
  extension: string;
  compile: {
    cmd?: (sourceFile: string) => string;
    timeout: number;
  };
  run: {
    cmd: string | ((execFile: string) => string);
    needsCompilation: boolean;
  };
}

export const languages = {
  cpp: {
    extension: 'cpp',
    compile: {
      timeout: 10,
      cmd: (sourceFile: string) =>
        `g++ -std=c++17 -O2 -Wall -Wextra ${sourceFile} -o solution -lm`,
    },
    run: {
      needsCompilation: true,
      cmd: (execFile: string) => `./${execFile}`,
    },
  },
  python: {
    extension: 'py',
    compile: {
      timeout: 0,
    },
    run: {
      needsCompilation: false,
      cmd: (sourceFile: string) => `python3 ${sourceFile}`,
    },
  },
};