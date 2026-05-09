import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import config from './config.js';
import terminalImage from 'terminal-image';
import chalk from 'chalk';

const IMAGES_DIR = path.join(os.homedir(), 'pollimage', 'images');

export async function fetchModels() {
  try {
    const response = await axios.get('https://gen.pollinations.ai/image/models');
    const models = response.data
      .filter(m => m.output_modalities && m.output_modalities.includes('image') && !m.output_modalities.includes('video'))
      .map(m => {
        const cost = parseFloat(m.pricing?.completionImageTokens || 0);
        let id = m.name;
        if (m.paid_only) {
          id += ` ${chalk.cyan('(💎 PAID)')}`;
        }
        return {
          id: m.name,
          displayName: id,
          description: m.description,
          pollenPerGen: cost
        };
      });
    
    return models.sort((a, b) => a.pollenPerGen - b.pollenPerGen);
  } catch (error) {
    return [{ id: 'flux', displayName: 'flux', pollenPerGen: 0.001 }];
  }
}

export async function fetchBalance() {
  const apiKey = config.get('apiKey');
  if (!apiKey) return { balance: null, status: 'not set' };
  try {
    const response = await axios.get('https://gen.pollinations.ai/account/balance', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 5000
    });
    return { balance: response.data.balance, status: 'valid' };
  } catch (error) {
    if (error.response?.status === 401) {
      return { balance: null, status: 'invalid' };
    }
    return { balance: null, status: 'unknown' };
  }
}

export async function generateImage(prompt, options = {}) {
  const baseUrl = config.get('baseUrl');
  const apiKey = config.get('apiKey');
  
  const encodedPrompt = encodeURIComponent(prompt);
  let url = `${baseUrl}/image/${encodedPrompt}`;
  
  const params = new URLSearchParams();
  if (options.width) params.append('width', options.width);
  if (options.height) params.append('height', options.height);
  if (options.seed) params.append('seed', options.seed);
  params.append('model', options.model || config.get('defaultModel'));
  params.append('nologo', 'true');
  
  url += `?${params.toString()}`;

  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await axios.get(url, {
    headers,
    responseType: 'arraybuffer'
  });

  const randomString = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const hash = crypto.createHash('md5').update(`${randomString}-${timestamp}`).digest('hex');
  const filename = `${hash}.jpg`;
  
  await fs.ensureDir(IMAGES_DIR);
  const filePath = path.join(IMAGES_DIR, filename);
  await fs.writeFile(filePath, response.data);

  return { filePath, hash, buffer: response.data };
}

export async function displayImage(buffer) {
  try {
    console.log(await terminalImage.buffer(buffer));
  } catch (error) {
    console.error('could not display image.');
  }
}
