import { Injectable, Logger } from '@nestjs/common';
import { BoxManager } from './box.manager';
import { ConfigService } from '@nestjs/config';
import { ExecutionConfig, ExecutionResult } from '../types';
import { languages } from './language.config';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly defaultConfig: ExecutionConfig = {
    timeLimit: 2,
    memoryLimit: 256000,
    stackLimit: 256000,
    processes: 1,
    wallTimeMultiplier: 2,
  };
  constructor(
    private boxManager: BoxManager,
    configService: ConfigService
  ) {
    this.logger.log('Loaded languages:', JSON.stringify(languages, null, 2));
  }

  async executeCode(
    code: string,
    language: 'cpp' | 'python',   //just cpp & python for now
    input: any,
    config: Partial<ExecutionConfig> = {},
  ): Promise<ExecutionResult> {
    const execConfig = {... this.defaultConfig, ... config};

    let retry = 5;
    let boxId = await this.boxManager.acquireBoxId();
    while(boxId === null && retry !== 0){
      setTimeout(()=>{}, 1);
      boxId = await this.boxManager.acquireBoxId();
    }

    if (boxId === null) {
      this.logger.error('No available boxes - queue is full');
      return {
        success: false,
        error: 'Server is busy. Please try again later.',
        status: 'SE',
      };
    }

    try {
      return await this.executeInBox(boxId, code, language, input, execConfig);
    } finally {
      await this.boxManager.releaseBoxId(boxId);
    }
  }

  async executeInBox(boxId: number, code: string, language: string, input: any, config: ExecutionConfig): Promise<ExecutionResult> {
    this.logger.log(`executeInBox called with language: ${language}`);

    const langConfig = languages[language];

    this.logger.log(`langConfig:`, JSON.stringify(langConfig));

    if (!langConfig) {
      this.logger.error(`Language config not found for: ${language}`);
      return {
        success: false,
        error: `Unsupported language: ${language}`,
        status: 'SE',
      };
    }

    let boxPath: string;

    try {
      boxPath = await this.initBox(boxId);
      this.logger.log(`Box ${boxId} initialized at: ${boxPath}`);
    } catch (error) {
      this.logger.error(`Failed to init box ${boxId}:`, error);
      return {
        success: false,
        error: 'Failed to initialize sandbox',
        status: 'SE',
      };
    }

    const metaFile = `/tmp/isolate-meta-${boxId}-${Date.now()}.txt`;

    try{
      this.logger.log(`langConfig.extension: ${langConfig.extension}`);
      const sourceFile = `solution.${langConfig.extension}`;
      this.logger.log(`sourceFile: ${sourceFile}`);

      const sourcePath = join(boxPath, 'box', sourceFile);
      this.logger.log(`sourcePath: ${sourcePath}`);

      this.logger.log(`metaFile: ${metaFile}`);

      this.logger.log(`Writing source to: ${sourcePath}`);
      this.logger.log(`Code length: ${code.length}`);

      this.logger.log(`About to sanitize code...`);
      const sanitizedCode = this.sanitizeCode(code);
      this.logger.log(`Code sanitized, length: ${sanitizedCode.length}`);

      this.logger.log(`About to write file...`);
      await writeFile(sourcePath, sanitizedCode);
      this.logger.log(`File written successfully`);

      if (input) {
        this.logger.log(`Writing input file...`);
        const inputPath = join(boxPath, 'box', 'input.txt');
        await writeFile(inputPath, input);
        this.logger.log(`Input file written`);
      } else {
        this.logger.log(`No input provided, skipping input file`);
      }

      this.logger.log(`Checking if compilation needed...`);
      this.logger.log(`needsCompilation: ${langConfig.run.needsCompilation}`);

      if (langConfig.run.needsCompilation) {
        this.logger.log(`Starting compilation for box ${boxId}`);

        if (!langConfig.compile || !langConfig.compile.cmd) {
          this.logger.error(`compile.cmd is missing! langConfig.compile:`, JSON.stringify(langConfig.compile));
          return {
            success: false,
            error: 'Compilation configuration error',
            status: 'SE',
          };
        }

        this.logger.log(`Calling compile method...`);

        const compileResult = await this.compile(
          boxId,
          sourceFile,
          langConfig.compile,
          boxPath,
        );

        this.logger.log(`Compile method returned`);

        if (!compileResult.success) {
          return {
            success: false,
            error: compileResult.error,
            status: 'CE',
          };
        }

        //Make the compiled binary executable
        try {
          await execAsync(`sudo chmod +x ${boxPath}/box/solution`);
          this.logger.log(`Made solution executable`);

          // Verify the file exists and is executable
          const lsResult = await execAsync(`sudo ls -la ${boxPath}/box/solution`);
          this.logger.log(`Solution file info: ${lsResult.stdout.trim()}`);
        } catch (e) {
          this.logger.error(`Failed to chmod solution: ${e.message}`);
        }

        this.logger.log(`Compilation successful for box ${boxId}`);
      }

      // Execute
      this.logger.log(`Starting execution for box ${boxId}`);
      const execResult = await this.execute(
        boxId,
        langConfig,
        sourceFile,
        input,
        config,
        metaFile,
        boxPath,
      );

      this.logger.log(`Execution completed`);

      //Cleanup meta file with sudo BEFORE returning
      try {
        await execAsync(`sudo rm -f ${metaFile}`);
      } catch (e) {
        this.logger.warn(`Failed to delete meta file: ${e.message}`);
      }

      return execResult;
    } catch(error) {
      this.logger.error(`Execution error in box ${boxId}:`, error);
      this.logger.error(`Error type:`, typeof error);
      this.logger.error(`Error constructor:`, error?.constructor?.name);
      this.logger.error(`Error stack:`, error?.stack);
      this.logger.error(`Error message:`, error?.message);
      this.logger.error(`Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));

      return {
        success: false,
        error: 'Internal execution error',
        status: 'SE',
      };
    }
    finally {
      await this.cleanupBox(boxId);
    }
  }

  private async initBox(boxId: number): Promise<string> {
    const { stdout } = await execAsync(
      `sudo isolate --box-id=${boxId} --init`,
    );
    const boxPath = stdout.trim();

    // Change ownership so Node.js can write files
    await execAsync(`sudo chown -R $USER:$USER ${boxPath}`);

    return boxPath;
  }

  private async compile(
    boxId: number,
    sourceFile: string,
    compileConfig: any,
    boxPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const compileCmd = compileConfig.cmd(sourceFile);
      const stderrPath = join(boxPath, 'box', 'compile_error.txt');

      const command = `sudo isolate --box-id=${boxId} \
      --time=${compileConfig.timeout} \
      --wall-time=${compileConfig.timeout * 2} \
      --mem=512000 \
      --processes=50 \
      --dir=/etc:noexec \
      --env=PATH=/usr/bin:/bin \
      --run -- /bin/bash -c "${compileCmd} 2> compile_error.txt"`;

      await execAsync(command);

      return { success: true };
    } catch (error) {
      let compileError = 'Compilation failed';
      try {
        const stderrPath = join(boxPath, 'box', 'compile_error.txt');
        compileError = await readFile(stderrPath, 'utf-8');
      } catch (e) {
        compileError = error.message || 'Compilation failed';
      }

      return {
        success: false,
        error: this.formatCompileError(compileError),
      };
    }
  }

  private async execute(
    boxId: number,
    langConfig: any,
    sourceFile: string,
    input: string,
    config: ExecutionConfig,
    metaFile: string,
    boxPath: string,
  ): Promise<ExecutionResult> {
    const execFile = langConfig.run.needsCompilation ? 'solution' : sourceFile;
    const runCmd = typeof langConfig.run.cmd === 'function'
      ? langConfig.run.cmd(execFile)
      : langConfig.run.cmd;

    const inputRedirect = input ? '< input.txt' : '';
    const outputFile = 'output.txt';
    const errorFile = 'error.txt';

    const bashCommand = `exec ${runCmd} ${inputRedirect} > ${outputFile} 2> ${errorFile}`;
    this.logger.log(`Run command: ${runCmd}`);
    this.logger.log(`Shell command: ${bashCommand}`);

    const command = `sudo isolate --box-id=${boxId} \
    --time=${config.timeLimit} \
    --wall-time=${config.timeLimit * config.wallTimeMultiplier!} \
    --mem=${config.memoryLimit} \
    --stack=${config.stackLimit} \
    --processes=${config.processes} \
    --dir=/etc:noexec \
    --dir=/usr:noexec \
    --env=HOME=/box \
    --env=PATH=/usr/bin:/bin \
    --meta=${metaFile} \
    --run -- /bin/sh -c '${bashCommand}'`;

    this.logger.log(`Full isolate command:\n${command}`);

    try {
      const result = await execAsync(command, { timeout: (config.timeLimit * config.wallTimeMultiplier! + 5) * 1000 });
      this.logger.log(`Execution stdout: ${result.stdout}`);
      this.logger.log(`Execution stderr: ${result.stderr}`);
    } catch (error) {
      // Expected for TLE, MLE, RE - check meta file for details
      this.logger.log(`Execution threw error (this is normal for TLE/RE): ${error.message}`);
      if (error.stderr) {
        this.logger.log(`Execution stderr from error: ${error.stderr}`);
      }
    }

    let output = '';
    let stderr = '';

    try {
      const result = await execAsync(`sudo cat ${boxPath}/box/${outputFile}`);
      output = result.stdout;
    } catch (e) {
      this.logger.warn(`Could not read output file: ${e.message}`);
    }

    try {
      const result = await execAsync(`sudo cat ${boxPath}/box/${errorFile}`);
      stderr = result.stdout;
    } catch (e) {
      // Error file may not exist
      this.logger.warn(`Could not read error file: ${e.message}`);
    }

    let meta: any;
    try {
      await execAsync(`sudo chown $USER:$USER ${metaFile}`);
      const metaContent = await readFile(metaFile, 'utf-8');
      this.logger.log(`Meta file content:\n${metaContent}`);
      meta = this.parseMetaFile(metaContent);
      this.logger.log(`Parsed meta: ${JSON.stringify(meta)}`);
    } catch (error) {
      this.logger.error('Failed to read meta file:', error);
      return {
        success: false,
        error: 'Failed to get execution statistics',
        status: 'SE',
      };
    }

    return this.formatExecutionResult(meta, output, stderr);
  }

  private async cleanupBox(boxId: number): Promise<void> {
    try {
      await execAsync(`sudo isolate --box-id=${boxId} --cleanup`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup box ${boxId}:`, error);
    }
  }

  private parseMetaFile(content: string): any {
    const meta: any = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        meta[key] = value;
      }
    }

    // If no status is present and exitcode is 0, it's OK
    // If no status is present and exitcode is non-zero, it's RE
    let status = meta.status || (meta.exitcode === '0' ? 'OK' : 'RE');

    return {
      status: status,
      time: parseFloat(meta.time) || 0,
      timeWall: parseFloat(meta['time-wall']) || 0,
      memory: parseInt(meta['max-rss']) || parseInt(meta['cg-mem']) || 0,
      exitCode: parseInt(meta.exitcode) || 0,
      signal: parseInt(meta.exitsig) || parseInt(meta.killed) || 0,
      message: meta.message || '',
    };
  }

  private formatExecutionResult(
    meta: any,
    output: string,
    stderr: string,
  ): ExecutionResult {
    const result: ExecutionResult = {
      success: false,
      output: output.trim(),
      time: meta.time,
      memory: meta.memory,
      exitCode: meta.exitCode,
      status: 'RE',
    };

    switch (meta.status) {
      case 'OK':
      case 'RE':
        if (meta.exitCode === 0) {
          result.success = true;
          result.status = 'OK';
        } else {
          result.error = stderr || `Exit code: ${meta.exitCode}`;
          result.status = 'RE';
        }
        break;

      case 'TO':
        result.error = 'Time Limit Exceeded';
        result.status = 'TLE';
        break;

      case 'SG':
        result.error = `Runtime Error: ${this.getSignalName(meta.signal)}`;
        result.status = 'RE';
        break;

      case 'XX':
        result.error = 'Internal error';
        result.status = 'SE';
        break;

      default:
        result.error = meta.message || 'Unknown error';
        result.status = 'SE';
    }

    return result;
  }

  private getSignalName(signal: number): string {
    const signals: { [key: number]: string } = {
      6: 'SIGABRT (Aborted)',
      8: 'SIGFPE (Floating point exception)',
      9: 'SIGKILL (Killed)',
      11: 'SIGSEGV (Segmentation fault)',
      13: 'SIGPIPE (Broken pipe)',
      24: 'SIGXCPU (CPU time limit exceeded)',
    };
    return signals[signal] || `Signal ${signal}`;
  }

  private sanitizeCode(code: string): string {
    const maxSize = 64 * 1024; // 64KB
    if (code.length > maxSize) {
      throw new Error('Code size exceeds maximum limit');
    }
    return code;
  }

  private formatCompileError(error: string): string {
    // Limit error message size
    const maxLength = 1000;
    if (error.length > maxLength) {
      return error.substring(0, maxLength) + '\n... (truncated)';
    }
    return error;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    stats: any;
  }> {
    try {
      const stats = await this.boxManager.getPoolStats();
      return {
        healthy: stats.available > 0,
        stats,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: { error: error.message },
      };
    }
  }
}
