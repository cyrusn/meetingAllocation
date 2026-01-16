const readline = require('readline')

class ProgressBar {
  constructor(total, width = 40) {
    this.total = total
    this.current = 0
    this.width = width
  }

  update(current, message = '') {
    this.current = current
    const percentage = Math.round((this.current / this.total) * 100)
    const filledWidth = Math.round((this.width * this.current) / this.total)
    const emptyWidth = this.width - filledWidth
    const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth)
    
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(`[${bar}] ${percentage}% | ${message}`)
  }

  finish(message = 'Done!') {
    this.update(this.total, message)
    process.stdout.write('\n')
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }))
}

module.exports = { ProgressBar, askQuestion }
