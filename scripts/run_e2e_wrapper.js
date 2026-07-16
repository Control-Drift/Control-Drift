import { spawn } from 'child_process';
import path from 'path';

console.log("Wrapper: Changing directory to project root...");
process.chdir('C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops');

// Add Node.js and other required paths to process.env.PATH
process.env.PATH = `${process.env.PATH};C:\\Program Files\\nodejs`;

console.log("Wrapper: Running run_e2e.js...");
await import('./run_e2e.js');
