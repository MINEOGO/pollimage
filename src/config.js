import Conf from 'conf';

const schema = {
  apiKey: {
    type: 'string',
    default: ''
  },
  baseUrl: {
    type: 'string',
    default: 'https://gen.pollinations.ai'
  },
  defaultModel: {
    type: 'string',
    default: 'flux'
  }
};

const config = new Conf({
  projectName: 'pollimage',
  schema
});

export default config;
