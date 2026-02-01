chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeJob') {
    const jobData = scrapeJobDetails();
    sendResponse(jobData);
  }
  return true;
});

function scrapeJobDetails() {
  const selectors = {
    title: [
      '[data-automation-id="jobPostingHeader"]',
      'h2[data-automation-id="jobPostingHeader"]',
      '.jobPostingHeader',
      'h1',
      '.job-title'
    ],
    description: [
      '[data-automation-id="jobPostingDescription"]',
      '.Job_Description',
      '[data-automation-id="job-description"]',
      '.job-description',
      'div[class*="description"]'
    ],
    company: [
      '[data-automation-id="companyName"]',
      '.company-name',
      '[data-automation-id="company"]'
    ],
    location: [
      '[data-automation-id="location"]',
      '.job-location',
      '[data-automation-id="jobLocation"]'
    ],
    requirements: [
      '[data-automation-id="qualifications"]',
      '.qualifications',
      'div[class*="requirement"]'
    ]
  };

  function getElementText(selectorArray) {
    for (const selector of selectorArray) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  }

  const jobData = {
    title: getElementText(selectors.title),
    description: getElementText(selectors.description),
    company: getElementText(selectors.company),
    location: getElementText(selectors.location),
    requirements: getElementText(selectors.requirements),
    url: window.location.href,
    scrapedAt: new Date().toISOString()
  };

  if (jobData.description.length > 4000) {
    jobData.description = jobData.description.slice(0, 4000) + '...';
  }

  console.log('Scraped job data:', jobData);
  return jobData;
}

function addExtensionIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'cover-letter-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    cursor: pointer;
  `;
  indicator.textContent = '✓ Cover Letter Extension Active';
  
  indicator.addEventListener('click', () => {
    indicator.remove();
  });
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.5s';
      setTimeout(() => indicator.remove(), 500);
    }
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addExtensionIndicator);
} else {
  addExtensionIndicator();
}