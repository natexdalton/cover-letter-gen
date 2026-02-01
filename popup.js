chrome.storage.local.get(['hfToken', 'resumeText'], (data) => {
  if (data.hfToken) document.getElementById('hfToken').value = data.hfToken;
  console.log('=== STORED DATA CHECK ===');
  console.log('Has token:', !!data.hfToken);
  console.log('Has resume:', !!data.resumeText);
  console.log('Resume length:', data.resumeText?.length || 0);
  console.log('Resume preview:', data.resumeText?.substring(0, 100));
  console.log('========================');
  
  if (data.hfToken) {
    document.getElementById('hfToken').value = data.hfToken;
  }
  
  // Show resume status
  if (data.resumeText && data.resumeText.length > 0) {
    document.getElementById('resumeStatus').textContent = `Resume loaded (${data.resumeText.length} characters)`;
    document.getElementById('resumeStatus').style.color = '#28a745';
    console.log('Resume is loaded and ready');
  } else {
    document.getElementById('resumeStatus').textContent = 'No resume uploaded';
    document.getElementById('resumeStatus').style.color = '#666';
    console.log('No resume found in storage');
  }
  console.log('===========================');
});

// Save token
document.getElementById('saveToken').addEventListener('click', async () => {
  const token = document.getElementById('hfToken').value.trim();
  if (!token) {
    showStatus('Please enter a Hugging Face token', 'error');
    return;
  }
  
  await chrome.storage.local.set({ hfToken: token });
  showStatus('Token saved!', 'success');
});

document.getElementById('resumeFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
  showStatus('Reading resume...', 'info');
  
  try {
    let resumeText = '';
    
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      console.log('Reading as text file...');
      resumeText = await file.text();
      console.log('Resume text length:', resumeText.length);
      console.log('Resume preview:', resumeText.substring(0, 200));
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      showStatus('PDF parsing requires pdf.js. Please convert to .txt for now', 'error');
      return;
    } else {
      showStatus('Please upload a .txt file (PDF support coming soon)', 'error');
      return;
    }
    
    if (!resumeText || resumeText.length < 50) {
      showStatus('Resume seems too short or empty. Please check the file.', 'error');
      return;
    }
    
    console.log('Saving resume to storage...');
    await chrome.storage.local.set({ resumeText });
    
    // Verify it was saved
    const verify = await chrome.storage.local.get(['resumeText']);
    console.log('Verification - Resume saved:', !!verify.resumeText, 'Length:', verify.resumeText?.length);
    
    // Update UI
    document.getElementById('resumeStatus').textContent = `Resume loaded (${resumeText.length} characters)`;
    document.getElementById('resumeStatus').style.color = '#28a745';
    
    showStatus('Resume saved successfully!', 'success');
  } catch (error) {
    console.error('Error reading resume:', error);
    showStatus('Error reading resume: ' + error.message, 'error');
  }
});



// Generate cover letter
// Generate cover letter
document.getElementById('generateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  
  // Show progress bar
  const progressDiv = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const statusDiv = document.getElementById('status');
  
  progressDiv.style.display = 'block';
  statusDiv.style.display = 'none';
  
  function updateProgress(percent, message) {
    progressBar.style.width = percent + '%';
    progressBar.textContent = percent + '%';
    progressText.textContent = message;
    console.log(`[Progress ${percent}%] ${message}`);
  }
  
  try {
    updateProgress(10, 'Loading settings...');
    const data = await chrome.storage.local.get(['hfToken', 'resumeText']);
    
    if (!data.resumeText) {
      progressDiv.style.display = 'none';
      showStatus('Please upload resume first', 'error');
      btn.disabled = false;
      return;
    }
    
    if (!data.hfToken) {
      progressDiv.style.display = 'none';
      showStatus('Please add your Hugging Face token', 'error');
      btn.disabled = false;
      return;
    }
    
    console.log('Settings loaded:', { hasResume: !!data.resumeText, hasToken: !!data.hfToken });
    
    updateProgress(20, 'Getting current tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab URL:', tab.url);
    
    updateProgress(30, 'Scraping job posting...');
    console.log('Injecting content script...');
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobPosting
    });
    
    const jobData = results[0].result;
    console.log('Scraped job data:', jobData);
    
    if (!jobData || !jobData.description) {
      progressDiv.style.display = 'none';
      showStatus('Could not extract job posting. Make sure you are on a job details page.', 'error');
      btn.disabled = false;
      return;
    }
    
    updateProgress(50, 'Sending to AI model...');
    console.log('Sending message to background script...');
    
    chrome.runtime.sendMessage({
      action: 'generateCoverLetter',
      data: {
        resume: data.resumeText,
        jobPosting: jobData,
        hfToken: data.hfToken
      }
    }, (response) => {
      console.log('Response from background:', response);
      
      if (response.success) {
        updateProgress(100, 'Complete! Downloading...');
        setTimeout(() => {
          progressDiv.style.display = 'none';
          showStatus('Cover letter generated and downloaded!', 'success');

        displayCoverLetter(response.data.coverLetter, jobData);
        }, 1000);
      } else {
        progressDiv.style.display = 'none';
        showStatus('Error: ' + response.error, 'error');
        console.error('Generation error:', response.error);
      }
      btn.disabled = false;
    });
    
  } catch (error) {
    progressDiv.style.display = 'none';
    showStatus('Error: ' + error.message, 'error');
    console.error('Extension error:', error);
    btn.disabled = false;
  }
});

function scrapeJobPosting() {
  const jobTitle = document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent || 
                   document.querySelector('h2[data-automation-id="jobPostingHeader"]')?.textContent ||
                   document.querySelector('h1')?.textContent || '';
  
  const jobDescription = document.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent ||
                        document.querySelector('.Job_Description')?.textContent ||
                        document.body.textContent || '';
  
  const company = document.querySelector('[data-automation-id="companyName"]')?.textContent || '';
  const location = document.querySelector('[data-automation-id="location"]')?.textContent || '';
  
  return {
    title: jobTitle.trim(),
    description: jobDescription.trim().slice(0, 3000),
    company: company.trim(),
    location: location.trim()
  };
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}


function displayCoverLetter(coverLetterText, jobData) {
  const resultSection = document.getElementById('resultSection');
  const outputDiv = document.getElementById('coverLetterOutput');
  
  // Format the cover letter
  const formattedLetter = `COVER LETTER
${jobData.company ? `For: ${jobData.company}` : ''}
${jobData.title ? `Position: ${jobData.title}` : ''}

${coverLetterText}`;
  
  outputDiv.textContent = formattedLetter;
  resultSection.style.display = 'block';
  
  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
  
  // Store the current cover letter for copy/download
  window.currentCoverLetter = formattedLetter;
  window.currentJobData = jobData;
}

// Copy to clipboard
document.getElementById('copyBtn').addEventListener('click', async () => {
  if (window.currentCoverLetter) {
    try {
      await navigator.clipboard.writeText(window.currentCoverLetter);
      showStatus('Copied to clipboard!', 'success');
    } catch (error) {
      showStatus('Failed to copy: ' + error.message, 'error');
    }
  }
});


// Download as text file
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (window.currentCoverLetter && window.currentJobData) {
    const blob = new Blob([window.currentCoverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CoverLetter_${window.currentJobData.company || 'Job'}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Download started!', 'success');
  }
});