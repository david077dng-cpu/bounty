const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration from environment
const VOLC_ARK_API_KEY = process.env.VOLC_ARK_API_KEY || '';
const VOLC_ARK_BASE_URL = process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3';
const VOLC_ARK_MODEL_ID = 'doubao-seed-2-0-pro-260215';

const TASK_ID = 'AI66OMW';
const OUTPUT_DIR = path.join(__dirname, '../../frontend/public/images/tasks');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `${TASK_ID}.png`);

const prompt = `Generate a clean diagram illustration for the sunk cost fallacy (洛拉帕洛扎效应) concept map.

The diagram structure:
- Top center: a circle labeled "洛拉帕洛扎效应\n(沉没成本谬误)"
- Upper row: two rounded rectangles - left "活动投入" with subtitle "已花25元买1杯，目标: 再领9杯", right "条件要求" with subtitle "邀请5位新好友扫码"
- Lower row: two rounded rectangles - left "心理驱动" with subtitle "不想浪费已付出的25元", right "行为结果" with subtitle "硬拉陌生人凑数"
- Connections: arrows from top circle to both upper rectangles (purple color), left upper to left lower (red), right upper to right lower (red), left lower to right lower (red)
- Bottom: centered text "为了不浪费已付成本，额外投入更多不必要精力"

Style: clean modern digital concept diagram with soft warm off-white background (#fff5f0). Use purple (#9b72cf) for the top connections, red (#ff3356) for the downward connections. All boxes have soft gradients and subtle shadows. Overall aspect ratio 16:9, resolution around 1200x675, suitable for a card thumbnail.

Return only the PNG image bytes encoded as base64 in the response with content type image/png. Do not add any extra text or explanation.`;

async function generateImage() {
  console.log('Generating PNG for AI66OMW using ARK Doubao (doubao-seed-2-0-pro-260215)...');

  if (!VOLC_ARK_API_KEY) {
    console.error('Error: VOLC_ARK_API_KEY not set');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    const response = await axios.post(
      `${VOLC_ARK_BASE_URL}/chat/completions`,
      {
        model: VOLC_ARK_MODEL_ID,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${VOLC_ARK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
        responseType: 'json',
      }
    );

    const choices = response.data.choices;
    if (!choices || choices.length === 0) {
      console.error('Error: No choices in response');
      console.error('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    let message = choices[0].message;
    if (!message) {
      console.error('Error: No message in response');
      console.error('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    // Handle different content formats
    // Format 1: content is array with {type: 'image', image: base64}
    let imageBase64 = null;
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image' && part.image) {
          imageBase64 = part.image;
          break;
        }
      }
    }
    // Format 2: content is text that is base64
    else if (typeof message.content === 'string') {
      // Check if it's already base64
      const content = message.content.trim();
      // Remove any markdown wrapping
      const clean = content.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
      if (content.startsWith('data:image/png;base64,')) {
        imageBase64 = clean.split(',')[1];
      } else if (Buffer.isBuffer(Buffer.from(clean, 'base64')) && clean.length > 1000) {
        imageBase64 = clean;
      } else {
        console.error('Got text response instead of image:', content.slice(0, 500));
      }
    }

    if (!imageBase64) {
      console.error('Error: No image found in response');
      console.error('Full message:', JSON.stringify(message, null, 2));
      process.exit(1);
    }

    // Decode and save
    const buffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(OUTPUT_PATH, buffer);

    console.log(`✓ Successfully generated PNG:`);
    console.log(`  Path: ${OUTPUT_PATH}`);
    console.log(`  Size: ${buffer.length} bytes`);

  } catch (error) {
    console.error('Error generating image:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

generateImage();
