#!/usr/bin/env node

import { Command } from 'commander';
import { startInteractiveSession, checkApiKey } from '../src/ui.js';
import { generateImage, displayImage, fetchModels } from '../src/api.js';
import config from '../src/config.js';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('pollimage')
  .description('pollimage by mineogo')
  .version('1.0.0');

program
  .command('i')
  .description('interactive mode')
  .action(() => {
    startInteractiveSession();
  });

program
  .command('set-key <key>')
  .description('set apikey')
  .action((key) => {
    if (key === '0') {
      config.set('apiKey', '');
      console.log(chalk.green('apikey removed!'));
    } else {
      config.set('apiKey', key);
      console.log(chalk.green('apikey set!'));
    }
  });

program
  .command('models')
  .description('list available image models')
  .action(async () => {
    const spinner = ora('fetching models...').start();
    const models = await fetchModels();
    spinner.stop();
    console.log(chalk.cyan('\nAvailable Image Models:'));
    models.forEach(m => console.log(chalk.white(` - ${m.id} (${m.gensPerPollen} gens/pollen)`)));
    console.log('');
  });

program
  .command('gen <prompt>')
  .description('generate image')
  .option('-m, --model <model>', 'model to use', config.get('defaultModel'))
  .option('-w, --width <width>', 'image width', '1024')
  .option('-h, --height <height>', 'image height', '1024')
  .option('-s, --seed <seed>', 'seed')
  .action(async (prompt, options) => {
    await checkApiKey();
    const spinner = ora(`generating with ${options.model}...`).start();
    try {
      const { filePath, hash, buffer } = await generateImage(prompt, options);
      spinner.succeed(chalk.green(`✔ done: ${hash}.jpg`));
      await displayImage(buffer);
    } catch (error) {
      if (error.response?.status === 401) {
        spinner.fail(chalk.red('✖ error 401: invalid api key.'));
      } else if (error.response?.status === 402) {
        spinner.fail(chalk.red('✖ error 402: out of pollen.'));
      } else {
        spinner.fail(chalk.red(`✖ error: ${error.message}`));
      }
    }
  });

program
  .action(() => {
    if (program.args.length === 0) {
      startInteractiveSession();
    }
  });

program.parse(process.argv);
