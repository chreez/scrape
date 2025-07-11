import { chromium } from 'playwright';

async function extractInstagramSongs(profileUrl, options = {}) {
  const {
    headless = false,
    maxReels = 20,
    delay = 2000
  } = options;

  const browser = await chromium.launch({ 
    headless,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log(`Navigating to ${profileUrl}...`);
    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const reelLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/reel/"]'));
      return links.map(link => link.href).slice(0, 20);
    });
    
    console.log(`Found ${reelLinks.length} reels to process`);
    
    const songs = [];
    
    for (let i = 0; i < Math.min(reelLinks.length, maxReels); i++) {
      const reelUrl = reelLinks[i];
      console.log(`Processing reel ${i + 1}/${Math.min(reelLinks.length, maxReels)}: ${reelUrl}`);
      
      try {
        await page.goto(reelUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(delay);
        
        const songData = await page.evaluate(() => {
          const audioLinks = Array.from(document.querySelectorAll('a'))
            .filter(node => (node.href || '').includes('/reels/audio/'));
          
          if (audioLinks.length > 0) {
            const audioLink = audioLinks[0];
            const textContent = audioLink.textContent || audioLink.innerText || '';
            const parts = textContent.split('•').map(s => s.trim());
            
            if (parts.length >= 2) {
              return {
                artist: parts[0],
                song: parts[1],
                audioId: audioLink.href.match(/\/reels\/audio\/(\d+)/)?.[1],
                reelUrl: window.location.href
              };
            } else if (textContent) {
              return {
                artist: '',
                song: textContent,
                audioId: audioLink.href.match(/\/reels\/audio\/(\d+)/)?.[1],
                reelUrl: window.location.href
              };
            }
          }
          
          return null;
        });
        
        if (songData) {
          songs.push(songData);
          console.log(`Found: ${songData.artist} - ${songData.song}`);
        } else {
          console.log(`No song found for reel ${i + 1}`);
        }
        
      } catch (error) {
        console.log(`Error processing reel ${i + 1}: ${error.message}`);
      }
    }
    
    return songs;
    
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node instagram-songs.js <instagram-profile-url> [options]

Examples:
  node instagram-songs.js https://www.instagram.com/skeleton.jellly/
  node instagram-songs.js https://www.instagram.com/username/ --max-reels=10 --headless

Options:
  --max-reels=N    Limit number of reels to process (default: 20)
  --headless       Run browser in headless mode (default: false)
  --delay=N        Delay between actions in ms (default: 2000)
    `);
    process.exit(1);
  }
  
  const profileUrl = args[0];
  const options = {};
  
  args.slice(1).forEach(arg => {
    if (arg === '--headless') options.headless = true;
    if (arg.startsWith('--max-reels=')) options.maxReels = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--delay=')) options.delay = parseInt(arg.split('=')[1]);
  });
  
  try {
    console.log('Extracting songs from Instagram profile...');
    const songs = await extractInstagramSongs(profileUrl, options);
    
    console.log('\n=== EXTRACTED SONGS ===');
    songs.forEach((song, index) => {
      console.log(`${index + 1}. ${song.artist} - ${song.song}`);
      console.log(`   Audio ID: ${song.audioId}`);
      console.log(`   Reel: ${song.reelUrl}`);
      console.log('');
    });
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `instagram-songs-${timestamp}.json`;
    
    await import('fs').then(fs => {
      fs.writeFileSync(filename, JSON.stringify(songs, null, 2));
    });
    
    console.log(`Results saved to: ${filename}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractInstagramSongs };