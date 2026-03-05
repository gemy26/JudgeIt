import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionConfig,
  ExecutionResult,
  IsolateMeta,
  TestCase,
  languages,
  LanguageConfig,
} from '../types';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name, { timestamp: true });


  private readonly defaultConfig: ExecutionConfig = {
    timeLimit: 2,
    memoryLimit: 256000,
    stackLimit: 256000,
    processes: 1,
  };


  async executeBatch(
    boxId: number,
    code: string,
    language: string,
    testCases: TestCase[],
    config: Partial<ExecutionConfig> = {},
  ): Promise<ExecutionResult[]> {
    const langConfig = languages[language];
    if (!langConfig) {
      this.logger.error(`Unsupported language: ${language}`);
      return this.buildErrorResults(testCases, `Unsupported language: ${language}`, 'SE');
    }

    const mergedConfig = this.mergeConfig(config);
    let boxPath: string;
    try {
      boxPath = await this.initBox(boxId);
    } catch (error) {
      this.logger.error(`Failed to init box ${boxId}:`, error);
      return this.buildErrorResults(testCases, 'Failed to initialize sandbox', 'SE');
    }

    try {
      const sourceFile = `solution.${langConfig.extension}`;
      const sourcePath = join(boxPath, 'box', sourceFile);

      this.validateCode(code);
      await writeFile(sourcePath, code, { encoding: 'utf8' });

      // Compile if needed (C++, etc.)
      if (langConfig.compile) {
        const compileResult = await this.compileSource(boxId, sourceFile, langConfig, boxPath);
        if (!compileResult.success) {
          return this.buildErrorResults(testCases, compileResult.error!, 'CE');
        }
        // Make compiled binary executable
        const executablePath = join(boxPath, 'box', 'solution');
        await execAsync(`chmod +x ${executablePath}`).catch(() => {});
      }

      // Run each test case sequentially
      const results: ExecutionResult[] = [];
      for (const testCase of testCases) {
        const result = await this.runTestCase(
          boxId, langConfig, sourceFile, testCase, mergedConfig, boxPath,
        );
        results.push({ ...result, testCaseName: testCase.name });
      }

      return results;
    } catch (error) {
      this.logger.error(`Batch execution error in box ${boxId}:`, error);
      return this.buildErrorResults(testCases, 'Internal execution error', 'SE');
    } finally {
      await this.destroyBox(boxId);
    }
  }


  private async initBox(boxId: number): Promise<string> {
    const { stdout } = await execAsync(`sudo isolate --box-id=${boxId} --init`);
    const boxPath = stdout.trim();
    await execAsync(`sudo chown -R $USER:$USER ${boxPath}`);
    this.logger.debug(`Box ${boxId} initialized at ${boxPath}`);
    return boxPath;
  }

  private async destroyBox(boxId: number): Promise<void> {
    try {
      await execAsync(`sudo isolate --box-id=${boxId} --cleanup`);
    } catch {
      this.logger.warn(`Failed to cleanup box ${boxId}`);
    }
  }


  private async compileSource(
    boxId: number,
    sourceFile: string,
    langConfig: LanguageConfig,
    boxPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    const compileConfig = langConfig.compile!;
    const compileCmd = compileConfig.cmd(sourceFile).join(' ');
    const wallTime = compileConfig.timeout * 2;

    const command = `sudo isolate --box-id=${boxId} \
      --time=${compileConfig.timeout} \
      --wall-time=${wallTime} \
      --mem=512000 \
      --processes=50 \
      --dir=/etc:noexec \
      --env=PATH=/usr/bin:/bin \
      --run -- /bin/bash -c "${compileCmd} 2> compile_error.txt"`;

    try {
      await execAsync(command);
      this.logger.debug(`Compilation succeeded for box ${boxId}`);
      return { success: true };
    } catch {
      let compileError = 'Compilation failed';
      try {
        compileError = await readFile(join(boxPath, 'box', 'compile_error.txt'), 'utf-8');
      } catch {
        this.logger.error(`Compilation error read failed for box ${boxId}`);
      }
      this.logger.warn(`Compilation failed for box ${boxId}`);
      return { success: false, error: this.truncate(compileError, 1000) };
    }
  }


  private async runTestCase(
    boxId: number,
    langConfig: LanguageConfig,
    sourceFile: string,
    testCase: TestCase,
    config: ExecutionConfig,
    boxPath: string,
  ): Promise<ExecutionResult> {
    const metaFile = `/tmp/isolate-meta-${boxId}-${Date.now()}.txt`;

    try {
      if (testCase.input) {
        await writeFile(join(boxPath, 'box', 'input.txt'), testCase.input);
      }

      // Build isolate command
      const execFile = langConfig.compile ? 'solution' : sourceFile;
      const runCmd = langConfig.run.cmd(execFile).join(' ');
      const inputRedirect = testCase.input ? '< input.txt' : '';
      const shellCmd = `exec ${runCmd} ${inputRedirect} > output.txt 2> error.txt`;

      const wallTime = langConfig.run.wallTime(config.timeLimit);
      const usrDir = langConfig.compile ? '--dir=/usr:noexec' : '--dir=/usr';

      const command = `sudo isolate --box-id=${boxId} \
        --time=${config.timeLimit} \
        --wall-time=${wallTime} \
        --mem=${config.memoryLimit} \
        --stack=${config.stackLimit} \
        --processes=${config.processes} \
        --dir=/etc:noexec \
        ${usrDir} \
        --env=HOME=/box \
        --env=PATH=/usr/bin:/bin \
        --meta=${metaFile} \
        --run -- /bin/sh -c '${shellCmd}'`;

      try {
        await execAsync(command, { timeout: (wallTime + 5) * 1000 });
      } catch {
        this.logger.warn(`Execution command failed for box ${boxId}, test case ${testCase.name}`);
      }

      // Read outputs
      const output = await this.readBoxFile(boxPath, 'output.txt');
      const stderr = await this.readBoxFile(boxPath, 'error.txt');

      // Parse meta file for execution stats
      const meta = await this.readMeta(metaFile);
      if (!meta) {
        return this.buildResult({ error: 'Failed to read execution metadata', status: 'SE' });
      }

      return this.buildResultFromMeta(meta, output, stderr);
    } finally {
      await execAsync(`sudo rm -f ${metaFile}`).catch(() => {});
    }
  }

  private async readMeta(metaFile: string): Promise<IsolateMeta | null> {
    try {
      await execAsync(`sudo chown $USER:$USER ${metaFile}`);
      const content = await readFile(metaFile, 'utf-8');
      return this.parseMetaFile(content);
    } catch (error) {
      this.logger.error('Failed to read meta file:', error);
      return null;
    }
  }

  private parseMetaFile(content: string): IsolateMeta {
    const raw: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        raw[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim();
      }
    }

    const status = raw.status || (raw.exitcode === '0' ? 'OK' : 'RE');

    return {
      status,
      time: parseFloat(raw.time) || 0,
      wallTime: parseFloat(raw['time-wall']) || 0,
      memory: parseInt(raw['max-rss']) || parseInt(raw['cg-mem']) || 0,
      exitCode: parseInt(raw.exitcode) || 0,
      signal: parseInt(raw.exitsig) || parseInt(raw.killed) || 0,
      message: raw.message || '',
    };
  }


  private buildResultFromMeta(
    meta: IsolateMeta,
    output: string,
    stderr: string,
  ): ExecutionResult {
    const base: ExecutionResult = {
      success: false,
      output: output.trim(),
      time: meta.time,
      wallTime: meta.wallTime,
      memory: meta.memory,
      exitCode: meta.exitCode,
      status: 'RE',
    };

    switch (meta.status) {
      case 'OK':
      case 'RE':
        if (meta.exitCode === 0) {
          base.success = true;
          base.status = 'OK';
        } else {
          base.error = stderr || `Exit code: ${meta.exitCode}`;
          base.status = 'RE';
          base.stderr = stderr || undefined;
        }
        break;

      case 'TO':
        base.error = 'Time Limit Exceeded';
        base.status = 'TLE';
        break;

      case 'SG':
        if (meta.signal === 9 && meta.message?.includes('memory')) {
          base.error = 'Memory Limit Exceeded';
          base.status = 'MLE';
        } else {
          base.error = `Runtime Error: ${this.getSignalName(meta.signal)}`;
          base.status = 'RE';
          base.signal = meta.signal;
          base.stderr = stderr || undefined;
        }
        break;

      case 'XX':
        base.error = 'Internal sandbox error';
        base.status = 'SE';
        break;

      default:
        base.error = meta.message || 'Unknown error';
        base.status = 'SE';
    }

    return base;
  }

  private buildResult(overrides: Partial<ExecutionResult>): ExecutionResult {
    return {
      success: false,
      status: 'SE',
      ...overrides,
    };
  }

  private buildErrorResults(
    testCases: TestCase[],
    error: string,
    status: ExecutionResult['status'],
  ): ExecutionResult[] {
    return testCases.map((tc) =>
      this.buildResult({ testCaseName: tc.name, error, status }),
    );
  }


  private async readBoxFile(boxPath: string, filename: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`sudo cat ${boxPath}/box/${filename}`);
      return stdout;
    } catch {
      return '';
    }
  }

  private mergeConfig(partial: Partial<ExecutionConfig>): ExecutionConfig {
    return { ...this.defaultConfig, ...partial };
  }

  private validateCode(code: string): void {
    const maxSize = 64 * 1024;
    if (code.length > maxSize) {
      throw new Error('Code size exceeds 64KB limit');
    }
  }

  private truncate(text: string, maxLength: number): string {
    return text.length > maxLength
      ? text.substring(0, maxLength) + '\n... (truncated)'
      : text;
  }

  private getSignalName(signal: number): string {
    const signals: Record<number, string> = {
      6: 'SIGABRT (Aborted)',
      8: 'SIGFPE (Floating point exception)',
      9: 'SIGKILL (Killed)',
      11: 'SIGSEGV (Segmentation fault)',
      13: 'SIGPIPE (Broken pipe)',
      24: 'SIGXCPU (CPU time limit exceeded)',
    };
    return signals[signal] || `Signal ${signal}`;
  }
}
