import axios from 'axios';

const ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.VOLC_ARK_API_KEY;
const ARK_MODEL_ID = process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callArkCompletion(messages: Message[], modelId?: string): Promise<string> {
  if (!ARK_API_KEY) {
    throw new Error('ARK API key not configured');
  }

  const actualModelId = modelId || ARK_MODEL_ID;

  const response = await axios.post(
    `${ARK_BASE_URL}/chat/completions`,
    {
      model: actualModelId,
      messages,
      stream: false,
    },
    {
      headers: {
        'Authorization': `Bearer ${ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
      proxy: false,
    }
  );

  if (response.data && response.data.choices && response.data.choices.length > 0) {
    return response.data.choices[0].message.content.trim();
  }

  throw new Error('No response from ARK');
}