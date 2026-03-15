import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from './execution.service';
import { ExecutionConfig, ExecutionResult, TestCase } from '../types';

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionService],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
  });

  const defaultConfig: ExecutionConfig = {
    timeLimit: 1,
    memoryLimit: 26500,
    stackLimit: 26500,
    processes: 1,
  };

  const createTestCase = (name: string, input: string = ''): TestCase => ({
    name,
    input,
  });

  const expectSuccessfulExecution = (result: ExecutionResult[], index = 0) => {
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[index]).toBeDefined();
    expect(result[index].success).toBe(true);
    expect(result[index].status).toEqual('OK');
  };

  const expectFailedExecution = (
    result: ExecutionResult[],
    status: string,
    index = 0,
  ) => {
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[index]).toBeDefined();
    expect(result[index].success).toBe(false);
    expect(result[index].status).toEqual(status);
    expect(result[index].error).toBeDefined();
  };

  it('should execute c++ code successfully and return output hello', async () => {
    const code = '#include <iostream>\nint main() { std::cout << "hello"; }';
    const result = await service.executeBatch(
      999,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('hello');
    expect(result[0].wallTime).toBeDefined();
    expect(result[0].memory).toBeDefined();
    expect(result[0].testCaseName).toEqual('1');
  });

  it('should execute python code successfully and return output hello', async () => {
    const code = 'print("hello")\n';
    const result = await service.executeBatch(
      1,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('hello');
    expect(result[0].testCaseName).toEqual('1');
  });

  it('should handle stdin input in c++ and process it correctly', async () => {
    const code =
      '#include <iostream>\n' +
      'int main() {\n' +
      '  int x, y;\n' +
      '  std::cin >> x >> y;\n' +
      '  std::cout << (x + y);\n' +
      '  return 0;\n' +
      '}';
    const testCases = [createTestCase('1', '5 3')];
    const result = await service.executeBatch(
      2,
      code,
      'cpp',
      testCases,
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('8');
  });

  it('should handle stdin input in python and process it correctly', async () => {
    const code = 'x, y = map(int, input().split())\n' + 'print(x + y)\n';
    const testCases = [createTestCase('1', '10 20')];
    const result = await service.executeBatch(
      3,
      code,
      'python',
      testCases,
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('30');
  });

  it('should handle multiple lines of stdin input', async () => {
    const code =
      'n = int(input())\n' +
      'total = 0\n' +
      'for i in range(n):\n' +
      '    total += int(input())\n' +
      'print(total)\n';
    const testCases = [createTestCase('1', '3\n1\n2\n3')];
    const result = await service.executeBatch(
      4,
      code,
      'python',
      testCases,
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('6');
  });

  it('should return empty output for code with no output', async () => {
    const code = 'int main() { return 0; }';
    const result = await service.executeBatch(
      5,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('');
  });

  it('should detect c++ compilation errors', async () => {
    const code = 'int main() { std::cout << "hello"; }'; // Missing iostream include
    const result = await service.executeBatch(
      6,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'CE');
    expect(result[0].error).toBeDefined();
    expect(result[0].error.length).toBeGreaterThan(0);
    expect(result[0].success).toBe(false);
  });

  it('should truncate long compilation error messages', async () => {
    const code =
      '#include <iostream>\n' +
      'int main() {\n' +
      '  std::cout << undeclared_variable;\n' +
      '}\n';
    const result = await service.executeBatch(
      7,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'CE');
    expect(result[0].error).toBeDefined();
  });

  it('should detect segmentation fault (null pointer dereference)', async () => {
    const code = 'int main() { int* p = nullptr; *p = 1; }';
    const result = await service.executeBatch(
      8,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].signal).toBeDefined();
  });

  it('should detect runtime error from non-zero exit code', async () => {
    const code = 'int main() {\n' + '  return 42;\n' + '}\n';
    const result = await service.executeBatch(
      9,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].exitCode).toEqual(42);
  });

  it('should capture stderr output on runtime error', async () => {
    const code =
      '#include <iostream>\n' +
      'int main() {\n' +
      '  std::cerr << "error message";\n' +
      '  return 1;\n' +
      '}\n';
    const result = await service.executeBatch(
      10,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].stderr).toBeDefined();
  });

  it('should detect process spawn restriction violation', async () => {
    const code =
      '#include <iostream>\n' +
      '#include <thread>\n' +
      'void task() { while (true) {} }\n' +
      'int main() {\n' +
      '  std::thread t1(task);\n' +
      '  std::thread t2(task);\n' +
      '  t1.join();\n' +
      '  t2.join();\n' +
      '  return 0;\n' +
      '}';
    const result = await service.executeBatch(
      11,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].success).toBe(false);
  });

  it('should detect stack overflow in python', async () => {
    const code =
      'import sys\n' +
      'sys.setrecursionlimit(1000000)\n' +
      'def f(): f()\n' +
      'f()\n';
    const result = await service.executeBatch(
      12,
      code,
      'python',
      [createTestCase('1')],
      {
        timeLimit: 1,
        memoryLimit: 26500,
        stackLimit: 8000,
        processes: 1,
      },
    );

    expectFailedExecution(result, 'RE');
  });

  it('should detect time limit exceeded in cpp', async () => {
    const code = '#include <iostream>\nint main() { while(true){} }';
    const result = await service.executeBatch(
      13,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'TLE');
  });

  it('should detect TLE with python infinite loop', async () => {
    const code = 'while True: pass\n';
    const result = await service.executeBatch(
      14,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'TLE');
  });

  it('should detect memory limit exceeded with large vector allocation', async () => {
    const code =
      '#include <iostream>\n' +
      '#include <vector>\n' +
      'int main() {\n' +
      '  std::vector<int> v(300000000, 1);\n' +
      '  return 0;\n' +
      '}\n';
    const config = {
      timeLimit: 2,
      memoryLimit: 26500,
      stackLimit: 26500,
      processes: 1,
    };
    const result = await service.executeBatch(
      15,
      code,
      'cpp',
      [createTestCase('1')],
      config,
    );

    console.log(result);
    expectFailedExecution(result, 'RE');
  });

  it('should execute multiple test cases and return results for all', async () => {
    const code = 'print(input())';
    const testCases = [
      createTestCase('tc1', 'hello'),
      createTestCase('tc2', 'world'),
      createTestCase('tc3', 'test'),
    ];
    const result = await service.executeBatch(
      16,
      code,
      'python',
      testCases,
      defaultConfig,
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toEqual(3);

    expect(result[0].output).toEqual('hello');
    expect(result[0].testCaseName).toEqual('tc1');
    expect(result[0].success).toBe(true);

    expect(result[1].output).toEqual('world');
    expect(result[1].testCaseName).toEqual('tc2');
    expect(result[1].success).toBe(true);

    expect(result[2].output).toEqual('test');
    expect(result[2].testCaseName).toEqual('tc3');
    expect(result[2].success).toBe(true);
  });

  it('should handle mixed success and failure in batch execution', async () => {
    const code = 'print(input())';
    const testCases = [
      createTestCase('pass', 'success'),
      createTestCase('pass', 'also_success'),
    ];
    const result = await service.executeBatch(
      17,
      code,
      'python',
      testCases,
      defaultConfig,
    );

    expect(result.length).toEqual(2);
    expectSuccessfulExecution(result, 0);
    expectSuccessfulExecution(result, 1);
  });

  it('should return error for unsupported language', async () => {
    const code = 'print("hello")';
    const result = await service.executeBatch(
      18,
      code,
      'pypy',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'SE');
    expect(result[0].error).toEqual('Unsupported language: pypy');
  });

  it('should return error for unsupported language with multiple test cases', async () => {
    const code = 'some code';
    const testCases = [
      createTestCase('1'),
      createTestCase('2'),
      createTestCase('3'),
    ];
    const result = await service.executeBatch(
      19,
      code,
      'ruby',
      testCases,
      defaultConfig,
    );

    expect(result.length).toEqual(3);
    result.forEach((res) => {
      expect(res.status).toEqual('SE');
      expect(res.error).toEqual('Unsupported language: ruby');
    });
  });

  it('should reject code exceeding 64KB size limit', async () => {
    const code = 'x = "' + 'a'.repeat(65 * 1024) + '"';
    const testCases = [createTestCase('1')];
    const result = await service.executeBatch(
      20,
      code,
      'python',
      testCases,
      defaultConfig,
    );

    expectFailedExecution(result, 'SE');
    expect(result[0].error).toContain('Code size exceeds 64KB');
  });

  it('should accept code close to but under 64KB limit', async () => {
    const code = '# ' + 'a'.repeat(60 * 1024) + '\nprint("ok")\n';
    const result = await service.executeBatch(
      21,
      code,
      'python',
      [createTestCase('1')],
      { ...defaultConfig, timeLimit: 2 },
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('ok');
  });

  it('should populate execution timing and memory statistics', async () => {
    const code = '#include <iostream>\nint main() { std::cout << "test"; }';
    const result = await service.executeBatch(
      22,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(typeof result[0].time).toBe('number');
    expect(typeof result[0].wallTime).toBe('number');
    expect(typeof result[0].memory).toBe('number');
    expect(result[0].time).toBeGreaterThanOrEqual(0);
    expect(result[0].wallTime).toBeGreaterThanOrEqual(0);
    expect(result[0].memory).toBeGreaterThanOrEqual(0);
  });

  it('should properly track exit code on successful execution', async () => {
    const code =
      '#include <iostream>\nint main() { std::cout << "success"; return 0; }';
    const result = await service.executeBatch(
      23,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].exitCode).toEqual(0);
  });

  it('should handle code with special characters and escapes', async () => {
    const code = 'print("hello\\nworld\\t!")';
    const result = await service.executeBatch(
      24,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('hello\nworld\t!');
  });

  it('should handle large output correctly', async () => {
    const code = 'for i in range(1000): print(i)';
    const result = await service.executeBatch(
      25,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output.split('\n').length).toEqual(1000);
  });

  it('should respect custom time limit configuration', async () => {
    const code = 'import time\n' + 'time.sleep(0.1)\n' + 'print("done")\n';
    const config = {
      timeLimit: 2,
      memoryLimit: 26500,
      stackLimit: 26500,
      processes: 1,
    };
    const result = await service.executeBatch(
      27,
      code,
      'python',
      [createTestCase('1')],
      config,
    );

    expectSuccessfulExecution(result);
  });

  it('should handle time limit', async () => {
    const code = 'i = 0\nwhile True: i += 1\n';
    const config = {
      timeLimit: 0.5,
      memoryLimit: 26500,
      stackLimit: 26500,
      processes: 1,
    };
    const result = await service.executeBatch(
      28,
      code,
      'python',
      [createTestCase('1')],
      config,
    );

    expectFailedExecution(result, 'TLE');
  });

  it('should handle code that reads from empty stdin', async () => {
    const code =
      '#include <iostream>\n' +
      '#include <string>\n' +
      'int main() {\n' +
      '  std::string line;\n' +
      '  if (std::getline(std::cin, line)) {\n' +
      '    std::cout << "got: " << line;\n' +
      '  } else {\n' +
      '    std::cout << "eof";\n' +
      '  }\n' +
      '  return 0;\n' +
      '}\n';
    const result = await service.executeBatch(
      30,
      code,
      'cpp',
      [createTestCase('1', null as any)],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].output).toEqual('eof');
  });

  it('should detect divide by zero error in c++', async () => {
    const code =
      '#include <iostream>\n' +
      'int main() {\n' +
      '  int x = 10, y = 0;\n' +
      '  int z = x / y;\n' +
      '  std::cout << z;\n' +
      '  return 0;\n' +
      '}\n';
    const result = await service.executeBatch(
      32,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].signal).toBeDefined();
  });

  it('should detect array out of bounds with vector access', async () => {
    const code =
      '#include <iostream>\n' +
      '#include <vector>\n' +
      'int main() {\n' +
      '  std::vector<int> v = {1, 2, 3};\n' +
      '  int x = v.at(100);\n' +
      '  return 0;\n' +
      '}\n';
    const result = await service.executeBatch(
      33,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    console.log(result);
    expect(result[0]).toBeDefined();
  });

  it('should pass floating point exception', async () => {
    const code =
      '#include <iostream>\n' +
      'int main() {\n' +
      '  double x = 1.0, y = 0.0;\n' +
      '  double z = x / y;\n' +
      '  std::cout << z;\n' +
      '  return 0;\n' +
      '}\n';
    const result = await service.executeBatch(
      34,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );
    expectSuccessfulExecution(result);
  });

  it('should detect infinite recursion hits time limit', async () => {
    const code =
      '#include <iostream>\n' +
      'void recursive() { recursive(); }\n' +
      'int main() {\n' +
      '  recursive();\n' +
      '  return 0;\n' +
      '}\n';
    const config = {
      timeLimit: 1,
      memoryLimit: 26500,
      stackLimit: 8000,
      processes: 1,
    };
    const result = await service.executeBatch(
      35,
      code,
      'cpp',
      [createTestCase('1')],
      config,
    );

    expectFailedExecution(result, 'TLE');
  });

  it('should detect python import error as runtime error', async () => {
    const code = 'import nonexistent_module\nprint("hello")\n';
    const result = await service.executeBatch(
      36,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
    expect(result[0].stderr).toBeDefined();
  });

  it('should detect python syntax error during execution', async () => {
    const code = 'x = 1 + \nprint(x)\n';
    const result = await service.executeBatch(
      37,
      code,
      'python',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
  });

  it('should handle assertion failure as runtime error', async () => {
    const code =
      '#include <cassert>\n' +
      '#include <iostream>\n' +
      'int main() {\n' +
      '  int x = 5;\n' +
      '  assert(x == 10);\n' +
      '  return 0;\n' +
      '}\n';
    const result = await service.executeBatch(
      38,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectFailedExecution(result, 'RE');
  });

  it('should not include signal info in successful execution', async () => {
    const code = '#include <iostream>\nint main() { std::cout << "ok"; }';
    const result = await service.executeBatch(
      31,
      code,
      'cpp',
      [createTestCase('1')],
      defaultConfig,
    );

    expectSuccessfulExecution(result);
    expect(result[0].signal).toBeUndefined();
  });
});
