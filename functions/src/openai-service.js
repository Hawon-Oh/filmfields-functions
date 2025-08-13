/**
 * OpenAI 서비스 - 텍스트 임베딩 생성을 위한 모듈
 */
const { OpenAI } = require("openai");

class OpenAIService {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 텍스트를 벡터로 변환하는 임베딩 생성 함수
   * @param {string} text - 벡터화할 텍스트
   * @param {string} model - 사용할 임베딩 모델 (기본값: text-embedding-ada-002)
   * @returns {Promise<Array<number>>} - 생성된 임베딩 벡터
   */
  async createEmbedding(text, model = "text-embedding-ada-002") {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('유효한 텍스트가 제공되지 않았습니다.');
      }

      const response = await this.client.embeddings.create({
        model: model,
        input: text,
      });

      if (!response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error('OpenAI API에서 유효한 임베딩을 반환하지 않았습니다.');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('임베딩 생성 중 오류 발생:', error);
      throw error;
    }
  }
}

module.exports = OpenAIService;
