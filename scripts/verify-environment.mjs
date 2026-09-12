import process from 'node:process';

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
  console.error(`Notepadia requires Node.js 24+. Detected ${process.versions.node}.`);
  process.exit(1);
}

console.log(`Node.js ${process.versions.node} OK.`);
console.log('Notepadia uses Yarn Classic 1.x and Theia 1.75.0.');
console.log('Native build prerequisites must also be installed for Electron/Theia.');
