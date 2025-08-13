# Firebase Video Search Engine

A vector search engine based on Firebase Functions v2, utilizing OpenAI embeddings and Pinecone to implement semantic search for video content.

## Key Features

- **Semantic Search**: A search system that understands the meaning of content beyond simple keyword matching
- **Multilingual Support**: Search for content written in various languages including English, Korean, and more
- **Filtering Options**: Support for various filters such as video length and creation date
- **Real-time Vectorization**: Automatically vectorizes descriptions and adds them to the search index when new videos are uploaded
- **Scalable Architecture**: Expandable architecture using Firebase Functions v2 and Pinecone

## Technology Stack

- **Firebase Functions v2**: Serverless function execution environment
- **Firestore**: Video metadata storage
- **OpenAI API**: Text embedding generation
- **Pinecone**: Vector database and similarity search
- **Node.js**: Runtime environment (Node.js 20 recommended)

## Installation

### Prerequisites

- Firebase project
- OpenAI API key
- Pinecone account and index
- Node.js 20 or higher

### Installation Steps

1. Clone the repository
   ```bash
   git clone https://github.com/Hawon-Oh/filmfields-functions.git
   cd filmfields-functions
   ```

2. Install dependencies
   ```bash
   cd functions
   npm install
   ```

3. Set environment variables
   ```bash
   firebase functions:config:set openai.apikey="sk-your-openai-api-key" pinecone.apikey="your-pinecone-api-key" pinecone.indexname="video-search-index"
   ```

4. Create Pinecone index
   - Create a new index in the Pinecone console
   - Dimensions: 1536 (for OpenAI text-embedding-ada-002) or 3072 (for text-embedding-3-large)
   - Metric: cosine

5. Deploy
   ```bash
   firebase deploy --only functions
   ```

## Usage

### Automatic Vectorization on Video Upload

When a new document is created in the 'videos' collection in Firestore, the description text is automatically vectorized and stored in Pinecone.

Required fields:
- `title`: Video title
- `description`: Video description (target for vectorization)
- `duration`: Video length (in seconds)
- `createdAt`: Creation time (Firestore timestamp)

### Using the Search API

#### GET Request

```
https://your-region-your-project.cloudfunctions.net/search?query=searchterm&limit=10&minDuration=60&maxDuration=300
```

Parameters:
- `query`: Search term (required)
- `limit`: Number of results to return (optional, default: 10)
- `minDuration`: Minimum length (in seconds) (optional)
- `maxDuration`: Maximum length (in seconds) (optional)
- `startDate`: Start date (optional, ISO format)
- `endDate`: End date (optional, ISO format)

#### POST Request

```javascript
fetch("https://your-region-your-project.cloudfunctions.net/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "searchterm",
    limit: 10,
    filters: {
      minDuration: 60,
      maxDuration: 300,
      startDate: "2023-01-01",
      endDate: "2023-12-31"
    }
  }),
})
```

### Example Usage in React

```javascript
// Video search function
export async function searchVideos(query: string): Promise<Video[]> {
  try {
    const response = await fetch("https://your-region-your-project.cloudfunctions.net/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.videos || [];
  } catch (error) {
    console.error("Error searching videos:", error);
    throw error;
  }
}
```

## Customization

### Improving Multilingual Search

Upgrade to the latest OpenAI embedding model to enhance multilingual search performance:

```javascript
// Modify openai-service.js file
async createEmbedding(text, model = "text-embedding-3-large") {
  const response = await this.client.embeddings.create({
    model: model,
    input: text,
  });
  
  return response.data[0].embedding;
}
```

### Extending Filtering Options

To implement additional filtering options, modify the filter processing part of the search function:

```javascript
// Example of additional filter: category
if (filters.category) {
  pineconeFilter.category = filters.category;
}
```

## Troubleshooting

### Deployment Errors

If you encounter a "Container Healthcheck failed" error:
- Verify that environment variables are correctly set
- Move initialization code inside the function
- Check that the Node.js version matches the engines field in package.json

### No Search Results

If no search results are returned:
- Check if there is data in the Pinecone index
- Verify that the OpenAI API key is valid
- Check if the search term is too specific

## License

MIT

## Contributing

Issues and pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
