// Code execution utilities for different programming languages
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const TIMEOUT_MS = 5000; // 5 seconds timeout
const MAX_MEMORY_MB = 256;

export class CodeRunner {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async runCode(code, language, testCases) {
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const result = await this.executeTestCase(code, language, testCase);
        results.push(result);
      } catch (error) {
        results.push({
          passed: false,
          executionTime: 0,
          memoryUsed: 0,
          output: '',
          error: error.message
        });
      }
    }
    
    return results;
  }

  async executeTestCase(code, language, testCase) {
    const startTime = Date.now();
    const tempFile = path.join(this.tempDir, `${uuidv4()}.${this.getFileExtension(language)}`);
    
    try {
      // Write code to temporary file
      fs.writeFileSync(tempFile, code);
      
      // Execute based on language
      let result;
      switch (language) {
        case 'python':
          result = await this.runPython(tempFile, testCase);
          break;
        case 'javascript':
          result = await this.runJavaScript(tempFile, testCase);
          break;
        case 'cpp':
          result = await this.runCpp(tempFile, testCase);
          break;
        case 'java':
          result = await this.runJava(tempFile, testCase);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
      
      const executionTime = Date.now() - startTime;
      const memoryUsed = this.estimateMemoryUsage(result.output);
      
      return {
        passed: result.output.trim() === testCase.expectedOutput.trim(),
        executionTime,
        memoryUsed,
        output: result.output,
        error: result.error
      };
      
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  async runPython(filePath, testCase) {
    return new Promise((resolve, reject) => {
      const process = spawn('python', [filePath], {
        timeout: TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        } else {
          resolve({ output, error });
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
      
      // Send input to the process - ensure it's a string
      const inputString = typeof testCase.input === 'string' ? testCase.input : JSON.stringify(testCase.input);
      process.stdin.write(inputString);
      process.stdin.end();
    });
  }

  async runJavaScript(filePath, testCase) {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [filePath], {
        timeout: TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        } else {
          resolve({ output, error });
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
      
      // Send input to the process - ensure it's a string
      const inputString = typeof testCase.input === 'string' ? testCase.input : JSON.stringify(testCase.input);
      process.stdin.write(inputString);
      process.stdin.end();
    });
  }

  async runCpp(filePath, testCase) {
    const executablePath = filePath.replace('.cpp', '.exe');
    
    return new Promise((resolve, reject) => {
      // First compile
      const compileProcess = spawn('g++', [filePath, '-o', executablePath], {
        timeout: TIMEOUT_MS
      });
      
      compileProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Compilation failed'));
          return;
        }
        
        // Then run
        const runProcess = spawn(executablePath, [], {
          timeout: TIMEOUT_MS,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        runProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        runProcess.on('close', (code) => {
          // Clean up executable
          if (fs.existsSync(executablePath)) {
            fs.unlinkSync(executablePath);
          }
          
          if (code !== 0) {
            reject(new Error(`Process exited with code ${code}: ${error}`));
          } else {
            resolve({ output, error });
          }
        });
        
        runProcess.on('error', (err) => {
          reject(err);
        });
        
        // Send input to the process - ensure it's a string
        const inputString = typeof testCase.input === 'string' ? testCase.input : JSON.stringify(testCase.input);
        runProcess.stdin.write(inputString);
        runProcess.stdin.end();
      });
      
      compileProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  async runJava(filePath, testCase) {
    const className = path.basename(filePath, '.java');
    const classPath = path.dirname(filePath);
    
    return new Promise((resolve, reject) => {
      // First compile
      const compileProcess = spawn('javac', [filePath], {
        timeout: TIMEOUT_MS
      });
      
      compileProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Compilation failed'));
          return;
        }
        
        // Then run
        const runProcess = spawn('java', ['-cp', classPath, className], {
          timeout: TIMEOUT_MS,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        runProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        runProcess.on('close', (code) => {
          // Clean up class file
          const classFilePath = path.join(classPath, `${className}.class`);
          if (fs.existsSync(classFilePath)) {
            fs.unlinkSync(classFilePath);
          }
          
          if (code !== 0) {
            reject(new Error(`Process exited with code ${code}: ${error}`));
          } else {
            resolve({ output, error });
          }
        });
        
        runProcess.on('error', (err) => {
          reject(err);
        });
        
        // Send input to the process - ensure it's a string
        const inputString = typeof testCase.input === 'string' ? testCase.input : JSON.stringify(testCase.input);
        runProcess.stdin.write(inputString);
        runProcess.stdin.end();
      });
      
      compileProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  getFileExtension(language) {
    const extensions = {
      python: 'py',
      javascript: 'js',
      cpp: 'cpp',
      java: 'java'
    };
    return extensions[language] || 'txt';
  }

  estimateMemoryUsage(output) {
    // Simple estimation based on output size
    const outputSize = Buffer.byteLength(output, 'utf8');
    return Math.ceil(outputSize / 1024); // Convert to KB, then to MB
  }
}
