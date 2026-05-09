import { input, select, search } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import config from './config.js';
import { generateImage, displayImage, fetchModels, fetchBalance } from './api.js';
import fuzzy from 'fuzzy';
import os from 'os';
import path from 'path';
import readline from 'readline';

let history = [];
let historyIndex = -1;
let currentBuffer = '';
let suggestions = ['/help', '/clear', '/clr', '/models', '/set model', '/set apikey', '/exit'];
let filteredSuggestions = [];
let suggestionIndex = -1;
let lastLinesDrawn = 0;

export async function checkApiKey() {
  if (!config.get('apiKey')) {
    console.log(chalk.yellow('! First startup: API key required.'));
    const key = await input({
      message: 'Enter Pollinations API Key:',
      validate: (val) => val.length > 0 || 'Key required.'
    });
    config.set('apiKey', key);
    console.log(chalk.green('✔ Key saved.'));
  }
}

function showHelp() {
  console.log(chalk.cyan('\nCommands:'));
  console.log(chalk.white('  /help            - show this help'));
  console.log(chalk.white('  /clear, /clr     - clear terminal screen'));
  console.log(chalk.white('  /models          - list all available image models'));
  console.log(chalk.white('  /set model       - open searchable model selector'));
  console.log(chalk.white('  /set apikey <v>  - update api key (use 0 to remove)'));
  console.log(chalk.white('  /exit            - quit\n'));
}

async function selectModel() {
  const spinner = ora('fetching models...').start();
  const models = await fetchModels();
  spinner.stop();

  const choices = models.map(m => ({
    name: `${m.displayName} | ${m.pollenPerGen} pollen/gen`,
    value: m.id,
    description: m.description
  }));

  const model = await search({
    message: 'Search/Select model:',
    source: async (term) => {
      if (!term) return choices;
      const results = fuzzy.filter(term, choices, { extract: (el) => el.name });
      return results.map(r => r.original);
    }
  });

  config.set('defaultModel', model);
  console.log(chalk.green(`✔ active model: ${model}`));
}

async function getStatusLine() {
  const model = config.get('defaultModel');
  const { balance, status } = await fetchBalance();
  let sections = [];
  if (status === 'not set') sections.push(`apikey: ${chalk.red('not set')}`);
  else if (status === 'invalid') sections.push(`apikey: ${chalk.red('invalid')}`);
  sections.push(`model: ${chalk.cyan(model)}`);
  if (balance !== null && balance !== undefined) sections.push(`pollen bal: ${chalk.yellow(balance)}`);
  return sections.join(' | ');
}

function renderUI(rl) {
  if (lastLinesDrawn > 0) {
    readline.moveCursor(process.stdout, 0, -lastLinesDrawn);
    readline.cursorTo(process.stdout, 0);
    readline.clearScreenDown(process.stdout);
  }
  let output = '';
  let linesCount = 0;
  if (currentBuffer.startsWith('/') && filteredSuggestions.length > 0) {
    output += '\n';
    linesCount++;
    filteredSuggestions.forEach((s, i) => {
      if (i === suggestionIndex) output += chalk.black.bgWhite(` > ${s} `) + '\n';
      else output += chalk.gray(`   ${s} `) + '\n';
      linesCount++;
    });
  }
  output += chalk.gray(rl.statusLine || '') + '\n';
  linesCount++;
  output += '> ' + currentBuffer;
  process.stdout.write(output);
  lastLinesDrawn = linesCount;
}

export async function startInteractiveSession() {
  await checkApiKey();
  console.log(chalk.cyan('pollimage - by mineogo'));
  console.log(chalk.gray('type prompt or /help'));
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  rl.statusLine = await getStatusLine();
  renderUI(rl);
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') process.exit(0);
    if (key.name === 'up') {
      if (filteredSuggestions.length > 0) {
        suggestionIndex = (suggestionIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
      } else if (currentBuffer === '') {
        if (historyIndex < history.length - 1) {
          historyIndex++;
          currentBuffer = history[history.length - 1 - historyIndex];
        }
      }
    } else if (key.name === 'down') {
      if (filteredSuggestions.length > 0) {
        suggestionIndex = (suggestionIndex + 1) % filteredSuggestions.length;
      } else if (currentBuffer !== '') {
        if (historyIndex > 0) {
          historyIndex--;
          currentBuffer = history[history.length - 1 - historyIndex];
        } else {
          historyIndex = -1;
          currentBuffer = '';
        }
      }
    } else if (key.name === 'return') {
      if (suggestionIndex !== -1 && filteredSuggestions.length > 0) {
        currentBuffer = filteredSuggestions[suggestionIndex];
        filteredSuggestions = [];
        suggestionIndex = -1;
        renderUI(rl);
        return;
      }
      const val = currentBuffer.trim();
      currentBuffer = '';
      lastLinesDrawn = 0;
      console.log('');
      if (!val) {
        rl.statusLine = await getStatusLine();
        renderUI(rl);
        return;
      }
      history.push(val);
      historyIndex = -1;
      if (val.startsWith('/')) {
        const parts = val.slice(1).split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        if (cmd === 'exit' || cmd === 'quit') process.exit(0);
        else if (cmd === 'help') showHelp();
        else if (cmd === 'clear' || cmd === 'clr') {
          process.stdout.write('\x1Bc');
          console.log(chalk.cyan('pollimage - by mineogo'));
        } else if (cmd === 'models') {
          const spinner = ora('fetching...').start();
          const ms = await fetchModels();
          spinner.stop();
          console.log(chalk.cyan('\nAvailable Image Models:'));
          ms.forEach(m => console.log(chalk.white(` - ${m.displayName} (${m.pollenPerGen} pollen/gen)`)));
          console.log('');
        } else if (cmd === 'set') {
          const kt = args[0]?.toLowerCase();
          const v = args[1];
          if (kt === 'apikey') {
            if (v === '0') {
              config.set('apiKey', '');
              console.log(chalk.green('apikey removed!'));
            } else if (v) {
              config.set('apiKey', v);
              console.log(chalk.green('apikey set!'));
            }
          } else if (kt === 'model') {
            process.stdin.setRawMode(false);
            await selectModel();
            process.stdin.setRawMode(true);
            readline.emitKeypressEvents(process.stdin);
          }
        } else console.log(chalk.red('? unknown command'));
      } else {
        const m = config.get('defaultModel');
        const spinner = ora(`generating with ${m}...`).start();
        try {
          const { filePath, hash, buffer } = await generateImage(val);
          const hp = path.join(os.homedir(), 'pollimage', 'images', `${hash}.jpg`);
          spinner.succeed(chalk.green(`✔ done: ${hp}`));
          await displayImage(buffer);
        } catch (error) {
          spinner.fail(chalk.red(`✖ error: ${error.message}`));
        }
      }
      rl.statusLine = await getStatusLine();
      renderUI(rl);
    } else if (key.name === 'backspace') {
      currentBuffer = currentBuffer.slice(0, -1);
    } else if (!key.ctrl && !key.meta && str && str.length === 1) {
      currentBuffer += str;
    }
    if (currentBuffer.startsWith('/')) {
      filteredSuggestions = suggestions.filter(s => s.startsWith(currentBuffer));
      if (filteredSuggestions.length > 0 && suggestionIndex === -1) suggestionIndex = 0;
      if (filteredSuggestions.length === 0) suggestionIndex = -1;
    } else {
      filteredSuggestions = [];
      suggestionIndex = -1;
    }
    renderUI(rl);
  });
}
