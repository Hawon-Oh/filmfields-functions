require('dotenv').config();

/**
 * 검색 API 테스트 유틸리티 - 통합 검색 기능 테스트
 */
const OpenAIService = require('./openai-service');
const PineconeService = require('./pinecone-service');


console.log(process.env.OPENAI_API_KEY);
console.log(process.env.PINECONE_API_KEY);
console.log(process.env.PINECONE_INDEX_NAME);

/**
 * 검색 기능 테스트 함수
 * 
 * 사용 방법:
 * 1. 환경 변수 설정: OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME
 * 2. 함수 실행: node test-search-api.js "검색어" [필터옵션]
 * 
 * 예시:
 * - 기본 검색: node test-search-api.js "여행"
 * - 필터 검색: node test-search-api.js "여행" --minDuration=60 --maxDuration=300
 */
async function testSearch() {
  try {
    // 명령줄 인수 파싱
    const args = process.argv.slice(2);
    const query = args[0] || "테스트 검색어";
    const limit = 5;
    
    // 필터 옵션 파싱
    const filters = {};
    args.slice(1).forEach(arg => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        if (key && value) {
          if (key === 'minDuration' || key === 'maxDuration') {
            filters[key] = parseInt(value);
          } else {
            filters[key] = value;
          }
        }
      }
    });
    
    console.log(`검색 테스트 시작: "${query}", 결과 수: ${limit}`);
    if (Object.keys(filters).length > 0) {
      console.log('필터:', filters);
    }
    
    // 서비스 인스턴스 생성
    const openaiService = new OpenAIService();
    const pineconeService = new PineconeService();
    
    console.log('OpenAI 임베딩 생성 중...');
    const embedding = await openaiService.createEmbedding(query);
    console.log(`임베딩 생성 완료: ${embedding.length} 차원 벡터`);
    
    // 필터 구성
    const pineconeFilter = {};
    
    // 기간 필터
    if (filters.minDuration || filters.maxDuration) {
      pineconeFilter.duration = {};
      if (filters.minDuration) pineconeFilter.duration.$gte = filters.minDuration;
      if (filters.maxDuration) pineconeFilter.duration.$lte = filters.maxDuration;
    }
    
    // 날짜 필터
    if (filters.startDate || filters.endDate) {
      pineconeFilter.createdAt = {};
      if (filters.startDate) pineconeFilter.createdAt.$gte = new Date(filters.startDate).toISOString();
      if (filters.endDate) pineconeFilter.createdAt.$lte = new Date(filters.endDate).toISOString();
    }
    
    console.log('Pinecone에서 유사한 벡터 검색 중...');
    const searchResults = await pineconeService.queryVector(
      embedding, 
      limit, 
      Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined
    );
    
    console.log(`검색 결과 (${searchResults.length}개):`);
    searchResults.forEach((result, index) => {
      console.log(`\n결과 #${index + 1}:`);
      console.log(`ID: ${result.id}`);
      console.log(`유사도 점수: ${result.score.toFixed(4)}`);
      console.log('메타데이터:', JSON.stringify(result.metadata, null, 2));
    });
    
    return searchResults;
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
    throw error;
  }
}

// 테스트 실행
if (require.main === module) {
  testSearch()
    .then(() => console.log('\n테스트 완료'))
    .catch(err => console.error('\n테스트 실패:', err));
}

module.exports = { testSearch };