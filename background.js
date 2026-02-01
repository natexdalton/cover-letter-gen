console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'generateCoverLetter') {
    handleCoverLetterGeneration(request.data)
      .then(result => {
        console.log('Generation successful:', result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Generation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function handleCoverLetterGeneration(data) {
  console.log('Starting cover letter generation...');
  const { resume, jobPosting, hfToken } = data;
  
  console.log('Building prompt...');
  const prompt = buildPrompt(resume, jobPosting);
  console.log('Prompt length:', prompt.length, 'characters');
  console.log('Prompt preview:', prompt.substring(0, 200) + '...');
  
  console.log('Calling Hugging Face API...');
  const coverLetter = await callHuggingFace(prompt, hfToken);
  console.log('Cover letter generated, length:', coverLetter.length, 'characters');
  
  return { coverLetter };
}

function buildPrompt(resume, jobPosting) {
  return `Write a professional cover letter for this job application.

Job Title: ${jobPosting.title}
Company: ${jobPosting.company}
Location: ${jobPosting.location}

Job Description:
${jobPosting.description}

Candidate's Resume:
${resume}

Generate a compelling cover letter that highlights relevant experience and explains why the candidate is a great fit for this position.`;
}

async function callHuggingFace(prompt, token) {

  // modify line below to set the API URL
  const API_URL = 'https://router.huggingface.co/v1/chat/completions';
  
  try {
    console.log('Sending request to Hugging Face...');
    const requestBody = {
      // change the model below 
      model: 'meta-llama/Llama-3.2-3B-Instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
      stream: false
    };


    console.log('Request parameters:', requestBody);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API error response:', error);
      if (response.status === 503) {
        throw new Error('Model is loading.');
      }
      throw new Error(`HuggingFace API error (${response.status}): ${error}`);
    }
    
    const result = await response.json();
    console.log('API response:', result);
    
    const generatedText = result.choices[0].message.content;

    
    console.log('Extracted text length:', generatedText.length);
    
    return generatedText.trim();
    
  } catch (error) {
    console.error('Error calling Hugging Face:', error);
    throw error;
  }
}