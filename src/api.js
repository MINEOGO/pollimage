import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import config from './config.js';
import { execSync } from 'child_process';

const IMAGES_DIR = path.join(os.homedir(), 'pollimage', 'images');

export async function fetchModels() {
  try {
    const response = await axios.get('https://gen.pollinations.ai/image/models');
    return response.data
      .filter(m => m.output_modalities && m.output_modalities.includes('image'))
      .map(m => {
        const cost = parseFloat(m.pricing?.completionImageTokens || 0);
        const gensPerPollen = cost > 0 ? Math.round(1 / cost) : 'N/A';
        return {
          id: m.name,
          description: m.description,
          gensPerPollen: gensPerPollen
        };
      });
  } catch (error) {
    return [{ id: 'flux', gensPerPollen: 1000 }];
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

  return { filePath, hash };
}

export function displayImage(filePath) {
  try {
    execSync(`viu "${filePath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('viu not found. install it to see images.');
  }
}
