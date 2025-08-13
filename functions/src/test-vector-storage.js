require('dotenv').config();

/**
 * 테스트 유틸리티 - Firebase Functions 검증을 위한 모듈
 */
const OpenAIService = require('./openai-service');
const PineconeService = require('./pinecone-service');

console.log(process.env.OPENAI_API_KEY);
console.log(process.env.PINECONE_API_KEY);
console.log(process.env.PINECONE_INDEX_NAME);

/**
 * 테스트 함수 - OpenAI 임베딩 및 Pinecone 저장 기능 검증
 * 
 * 사용 방법:
 * 1. 환경 변수 설정: OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME
 * 2. 함수 실행: node test-vector-storage.js
 */
async function testVectorStorage() {
  try {
    console.log('벡터 저장 테스트 시작...');
    
    // 테스트 데이터
    const testVideoId = `test-video-${Date.now()}`;
    const testDescription = '새로운 외계행성을 탐험하던 중, 주인공 일행들은 처음보는 식물들을 찾게 됩니다. 이 식물들은 놀랍게도 인간의 언어를 이해하고, 대화를 나눌 수 있는 능력을 가지고 있었습니다. 이들은 주인공들에게 자신들의 세계와 문화를 소개하며, 서로 다른 종족 간의 소통과 이해의 중요성을 일깨워 줍니다.';
    const testMetadata = {
      title: '외계식물도감',
      duration: 300,
      createdAt: new Date().toISOString()
    };
    
    // 서비스 인스턴스 생성
    const openaiService = new OpenAIService();
    const pineconeService = new PineconeService();
    
    console.log('OpenAI 임베딩 생성 중...');
    const embedding = await openaiService.createEmbedding(testDescription);
    console.log(`임베딩 생성 완료: ${embedding.length} 차원 벡터`);
    

    console.log('Pinecone에 벡터 저장 중...');
    const response = await pineconeService.upsertVector(testVideoId, embedding, testMetadata);
    console.log('Pinecone 저장 응답:', response);
    
    // 저장된 벡터로 검색
    console.log('저장된 벡터로 검색 테스트 중...');
    const searchResults = await pineconeService.queryVector(embedding, 1);
    console.log('검색 결과:', JSON.stringify(searchResults, null, 2));
    
    // 검색결과 검증
    console.log('testVideoId:', JSON.stringify(testVideoId));
    console.log('returnedId:', JSON.stringify(searchResults[0].id));
    
    // searchResults가 null 또는 undefined가 아님
    // searchResults가 비어 있지 않음 (length > 0)
    if (searchResults && searchResults.length > 0 && searchResults[0].id === testVideoId) {
      console.log('✅ 테스트 성공: 벡터가 올바르게 저장되고 검색되었습니다.');
    } else {
      console.error('❌ 테스트 실패: 저장된 벡터를 검색할 수 없습니다.');
    }
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
if (require.main === module) {
  testVectorStorage()
    .then(() => console.log('테스트 완료'))
    .catch(err => console.error('테스트 실패:', err));
}

module.exports = { testVectorStorage };
