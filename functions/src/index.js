const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const OpenAIService = require("./openai-service");
const PineconeService = require("./pinecone-service");

// 초기화
initializeApp();
const db = getFirestore();

let openaiService = null;
let pineconeService = null;



// 서비스 인스턴스 초기화 함수
// 이 함수는 개발환경에 따라 적절하게 환경 변수 설정함
function initializeServicesIfNeeded() {
  if (openaiService && pineconeService) return;

  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  if (isEmulator) {
    console.log("[INFO] 로컬 환경 - .env 로드 중...");
    try {
      require('dotenv').config();
      console.log("[SUCCESS] .env 파일 로드 완료");
    } catch (err) {
      console.error("[ERROR] .env 파일 로드 실패:", err);
      throw new Error("로컬 환경에서 .env 파일이 필요합니다.");
    }
  }

  // 환경변수 검증
  const requiredVars = ["OPENAI_API_KEY", "PINECONE_API_KEY"];
  const missingVars = requiredVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(`필수 환경변수 누락: ${missingVars.join(', ')}`);
  }

  // 기본값 처리
  process.env.PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "default-index";

  console.log("[INFO] 서비스 인스턴스 초기화 중...");
  const OpenAIService = require("./openai-service");
  const PineconeService = require("./pinecone-service");

  openaiService = new OpenAIService();
  pineconeService = new PineconeService();
  console.log("[SUCCESS] 서비스 인스턴스 초기화 완료");
}






// 새로운 비디오 생성 시 실행되는 함수
exports.processNewVideo = onDocumentCreated("videos/{videoId}", async (event) => {
  initializeServicesIfNeeded();

  // 새로 생성된 비디오 문서 데이터 가져오기
  const videoData = event.data.data();
  const videoId = event.params.videoId;

  
  // 1. videoData와 필수 필드가 있는지 확인
  const missingFields = [];
  if (!videoData) {
    console.error(`[ERROR] videoData 전체가 존재하지 않습니다. event.params:`, event.params);
    return null;
  }

  // duration이 1분 미만일 때 0으로 저장돼서 함수가 종료되는 문제를 해결해야 함.
  // 임시로 duration 있는지 체크하는건 제거
  if (!videoData.title) missingFields.push('title');
  if (!videoData.description) missingFields.push('description');
  if (!videoData.createdAt) missingFields.push('createdAt');
  if (missingFields.length > 0) {
    console.error(`[ERROR] 필수 필드 누락 (${event.params.videoId}): ${missingFields.join(', ')}`);
    return null;
  }


  // 2. OpenAI API를 사용하여 description 텍스트 임베딩 생성
  console.log(`[INFO] 새 비디오 문서 처리 시작: id: ${videoId}, title: ${videoData.title}`);
  console.log(`[INFO] OpenAI API를 사용하여 임베딩 생성 중: ${videoId}`);
  const embedding = await openaiService.createEmbedding(videoData.description);
  if (!embedding) {
    console.error(`[ERROR] 임베딩 생성 실패: ${videoId}`);
    return null;
  }
  console.log(`[SUCCESS] 임베딩 생성 완료: ${videoId}`);


  // 3. Pinecone에 메타데이터와 description 벡터 저장
  const metadata = {
    title: videoData.title,
    duration: videoData.duration,
    createdAt: videoData.createdAt.toDate().toISOString(), // Firestore 타임스탬프를 ISO 문자열로 변환
  };
  await pineconeService.upsertVector(videoId, embedding, metadata);
  console.log(`[SUCCESS] 비디오 ${videoId}의 데이터가 Pinecone에 저장됨`);

  return null;
});











/**
 * Firestore 'in' 쿼리의 최대 제한을 고려하여 배치로 문서를 가져오는 함수
 * @param {Array<string>} ids - 가져올 문서 ID 배열
 * @param {string} collectionName - 컬렉션 이름
 * @returns {Promise<Object>} - ID를 키로 하는 문서 데이터 맵
 */
async function fetchDocumentsByIds(ids, collectionName) {
  // Firestore 'in' 쿼리는 최대 10개의 값만 지원
  const batchSize = 10;
  const documentMap = {};
  
  // ID 배열을 batchSize 크기의 청크로 분할
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    
    // 각 청크에 대해 'in' 쿼리 실행
    const snapshot = await db.collection(collectionName)
      .where("__name__", "in", chunk)
      .get();
    
    // 결과를 맵에 추가
    snapshot.forEach(doc => {
      documentMap[doc.id] = { id: doc.id, ...doc.data() };
    });
  }
  
  return documentMap;
}

/**
 * 통합 검색 함수 - GET/POST 요청 모두 처리
 * 
 * GET 요청 파라미터:
 * - query: 검색어 (필수)
 * - limit: 반환할 결과 수 (선택, 기본값: 10)
 * - minDuration: 최소 길이(초) (선택)
 * - maxDuration: 최대 길이(초) (선택)
 * - startDate: 시작 날짜 (선택, ISO 형식)
 * - endDate: 종료 날짜 (선택, ISO 형식)
 * 
 * POST 요청 본문:
 * {
 *   "query": "검색어",
 *   "limit": 10,
 *   "filters": {
 *     "minDuration": 60,
 *     "maxDuration": 300,
 *     "startDate": "2023-01-01",
 *     "endDate": "2023-12-31"
 *   }
 * }
 */
exports.search = onRequest({
  cors: true, // CORS 활성화
  maxInstances: 10, // 최대 인스턴스 수
}, async (req, res) => {
    initializeServicesIfNeeded();
  try {
    let query, limit, filters = {};
    
    // GET 또는 POST 요청 처리
    if (req.method === 'POST') {
      // POST 요청 본문에서 데이터 추출
      const body = req.body;
      query = body.query;
      limit = body.limit || 10;
      
      // 필터 정보 추출
      if (body.filters) {
        filters = body.filters;
      }
    } else {
      // GET 요청 쿼리 파라미터에서 데이터 추출
      query = req.query.query;
      limit = parseInt(req.query.limit) || 10;
      
      // 필터 정보 추출
      if (req.query.minDuration) filters.minDuration = parseInt(req.query.minDuration);
      if (req.query.maxDuration) filters.maxDuration = parseInt(req.query.maxDuration);
      if (req.query.startDate) filters.startDate = req.query.startDate;
      if (req.query.endDate) filters.endDate = req.query.endDate;
    }
    
    // 검색어 필수 확인
    if (!query) {
      return res.status(400).json({
        error: "검색어(query)가 필요합니다."
      });
    }
    
    console.log(`검색 요청: "${query}", 결과 수: ${limit}, 필터:`, filters);
    
    // 1. 검색어를 OpenAI API로 벡터화
    const queryVector = await openaiService.createEmbedding(query);
    
    // 2. 필터 구성
    const pineconeFilter = {};
    
    // 기간 필터
    if (filters.minDuration || filters.maxDuration) {
      pineconeFilter.duration = {};
      if (filters.minDuration) pineconeFilter.duration.$gte = parseInt(filters.minDuration);
      if (filters.maxDuration) pineconeFilter.duration.$lte = parseInt(filters.maxDuration);
    }
    
    // 날짜 필터
    if (filters.startDate || filters.endDate) {
      pineconeFilter.createdAt = {};
      if (filters.startDate) pineconeFilter.createdAt.$gte = new Date(filters.startDate).toISOString();
      if (filters.endDate) pineconeFilter.createdAt.$lte = new Date(filters.endDate).toISOString();
    }
    
    // 3. Pinecone에서 유사한 벡터 검색 (필터 적용)
    const searchResults = await pineconeService.queryVector(
      queryVector, 
      limit, 
      Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined
    );
    
    // 검색 결과가 없는 경우
    if (!searchResults || searchResults.length === 0) {
      return res.status(200).json({
        videos: [],
        lastVisible: null,
        totalCount: 0
      });
    }
    
    // 4. Pinecone 결과에서 ID 추출
    const ids = searchResults.map(match => match.id);
    
    try {
      // 5. Firestore에서 문서 일괄 조회 (배치 처리)
      const videoMap = await fetchDocumentsByIds(ids, "videos");
      
      // 6. 결과 정렬 (Pinecone 결과 순서대로)
      const orderedVideos = ids
        .map(id => videoMap[id])
        .filter(Boolean) // 존재하는 것만
        .map(video => ({
          id: video.id,
          title: video.title || "",
          introduction: video.introduction || "",
          description: video.description || "",
          thumbnailUrl: video.thumbnailUrl || "",
          videoUrl: video.videoUrl || "",
          userId: video.userId || "",
          user: video.user || null,
          viewCount: video.viewCount || 0,
          likeCount: video.likeCount || 0,
          createdAt: video.createdAt?.toDate?.() ? video.createdAt.toDate().toISOString() : new Date().toISOString(),
          duration: video.duration || 0
          // 유사도 점수 추가 (선택 사항)
          // similarity: searchResults.find(result => result.id === video.id)?.score || 0
        }));
      
      // 7. 응답 반환
      return res.status(200).json({
        videos: orderedVideos,
        lastVisible: null,
        totalCount: orderedVideos.length,
      });
    } catch (firestoreError) {
      console.error("Firestore 데이터 조회 중 오류 발생:", firestoreError);
      
      // Firestore 오류 발생 시 Pinecone 결과만 반환 (대체 응답)
      const fallbackResults = searchResults.map(match => ({
        id: match.id,
        title: match.metadata?.title || "",
        duration: match.metadata?.duration || 0,
        createdAt: match.metadata?.createdAt || new Date().toISOString(),
        similarity: match.score || 0,
        _fallback: true // 대체 응답임을 표시
      }));
      
      return res.status(200).json({
        videos: fallbackResults,
        lastVisible: null,
        totalCount: fallbackResults.length,
        _warning: "Firestore 데이터 조회 중 오류가 발생하여 제한된 정보만 제공됩니다."
      });
    }
  } catch (error) {
    console.error("검색 중 오류 발생:", error);
    return res.status(500).json({
      error: "검색 처리 중 오류가 발생했습니다.",
      message: error.message
    });
  }
});