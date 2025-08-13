/**
 * Pinecone 서비스 - 벡터 데이터베이스 연동을 위한 모듈
 */
const { Pinecone } = require("@pinecone-database/pinecone");

class PineconeService {
  constructor(apiKey, indexName) {
    this.client = new Pinecone({
      apiKey: apiKey || process.env.PINECONE_API_KEY,
    });
    this.indexName = indexName || process.env.PINECONE_INDEX_NAME || "video";
    this.index = this.client.index(this.indexName);
  }

  /**
   * 비디오 데이터와 임베딩 벡터를 Pinecone에 저장
   * @param {string} id - 비디오 ID
   * @param {Array<number>} vector - 임베딩 벡터
   * @param {Object} metadata - 저장할 메타데이터 (title, duration, createdAt)
   * @returns {Promise<Object>} - Pinecone 응답
   */
  async upsertVector(id, vector, metadata) {
    try {
      if (!id || !vector || !metadata) {
        throw new Error('유효한 ID, 벡터, 또는 메타데이터가 제공되지 않았습니다.');
      }

      // 메타데이터에 필수 필드가 있는지 확인
      const requiredFields = ['title', 'createdAt'];
      for (const field of requiredFields) {
        if (!metadata[field]) {
          throw new Error(`메타데이터에 필수 필드가 누락되었습니다: ${field}`);
        }
      }

      // Pinecone에 데이터 저장
      const response = await this.index.upsert([{
        id: id,
        values: vector,
        metadata: metadata
      }]);

      return response;
    } catch (error) {
      console.error('Pinecone 데이터 저장 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * 벡터 유사도 검색 수행
   * @param {Array<number>} vector - 검색할 쿼리 벡터
   * @param {number} topK - 반환할 결과 수
   * @returns {Promise<Array<Object>>} - 검색 결과
   */
  async queryVector(vector, topK = 10) {
    try {
      const queryRequest = {
        vector: vector,
        topK: topK,
        includeMetadata: true
      };

      const results = await this.index.namespace('').query(queryRequest);

      return results.matches;
    } catch (error) {
      console.error('Pinecone 쿼리 중 오류 발생:', error);
      throw error;
    }
  }
}

module.exports = PineconeService;
