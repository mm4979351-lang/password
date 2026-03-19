/**
 * Advanced Password Generator - Professional JavaScript
 * Features: Secure crypto.random, strength meter, history, regenerate, accessibility
 */

class PasswordGenerator {
  constructor() {
    this.state = {
      length: 24,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeAmbiguous: true,
      password: '',
      strength: 0,
      history: JSON.parse(localStorage.getItem('pwdHistory')) || [],
      theme: localStorage.getItem('theme') || 'dark',
      isGenerating: false
    };

    this.charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '23456789', 
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\\\'\"€£¥¢§¶'
    };

    this.ambiguous = '01lIOo';
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.applyTheme();
    this.updateDisplay();
    this.renderHistory();
  }

  bindEvents() {
    // Generation
    document.getElementById('generateBtn').addEventListener('click', () => this.generate());
    
    // Copy
    document.getElementById('copyBtn').addEventListener('click', () => this.copyPassword());
    
    // Length slider
    document.getElementById('lengthSlider').addEventListener('input', (e) => {
      this.state.length = parseInt(e.target.value);
      this.updateLengthDisplay();
    });
    
    // Mode selector
    document.getElementById('modeSelect').addEventListener('change', (e) => {
      this.state.mode = e.target.value;
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    
    // History
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-item')) {
        this.useHistoryPassword(e.target.dataset.password);
      } else if (e.target.classList.contains('btn-regenerate')) {
        this.regenerateSimilar(e.target.dataset.password);
      }
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.generate();
      } else if (e.key === 'c' && e.ctrlKey && this.state.password) {
        this.copyPassword();
      }
    });
  }

  toggleOption(type) {
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    this.state[`include${capitalize(type)}`] = !this.state[`include${capitalize(type)}`];
    
    const toggle = document.getElementById(`${type}Toggle`);
    toggle.classList.toggle('active', this.state[`include${capitalize(type)}`]);
    
    const hasValidCharset = this.getValidCharset().length > 0;
    document.getElementById('generateBtn').disabled = !hasValidCharset;
    
    if (this.state.password) {
      this.generate(); // Regenerate to reflect changes
    }
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.state.theme);
    localStorage.setItem('theme', this.state.theme);
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
  }

  getValidCharset() {
    let charset = '';
    
    if (this.state.includeUppercase) charset += this.charset.uppercase;
    if (this.state.includeLowercase) charset += this.charset.lowercase;
    if (this.state.includeNumbers) charset += this.charset.numbers;
    if (this.state.includeSymbols) charset += this.charset.symbols;
    
    if (this.state.excludeAmbiguous) {
      charset = charset.split('').filter(char => !this.ambiguous.includes(char)).join('');
    }
    
    return charset;
  }

  generate() {
    const charset = this.getValidCharset();
    
    if (charset.length === 0) {
      this.showToast('Please select at least one character type!', 'danger');
      return;
    }

    this.state.isGenerating = true;
    document.getElementById('generateBtn').classList.add('loading');
    document.getElementById('generateBtn').textContent = '';
    
    // Simulate async for loading animation
    setTimeout(() => {
      // STEP 1: Force 1 char from each enabled type for diversity
      let password = '';
      const types = [];
      if (this.state.includeUppercase) types.push(this.charset.uppercase);
      if (this.state.includeLowercase) types.push(this.charset.lowercase);
      if (this.state.includeNumbers) types.push(this.charset.numbers);
      if (this.state.includeSymbols) types.push(this.charset.symbols);
      
      // Add one from each type
      const typeArray = new Uint32Array(types.length);
      crypto.getRandomValues(typeArray);
      for (let i = 0; i < types.length; i++) {
        password += types[i][typeArray[i] % types[i].length];
      }
      
      // STEP 2: Fill remaining with full charset (shuffle logic)
      const remainingLength = this.state.length - types.length;
      const fullArray = new Uint32Array(remainingLength);
      crypto.getRandomValues(fullArray);
      
      for (let i = 0; i < remainingLength; i++) {
        password += charset[fullArray[i] % charset.length];
      }
      
      // STEP 3: Shuffle for maximum randomness (Fisher-Yates)
      const pwdArray = password.split('');
      for (let i = pwdArray.length - 1; i > 0; i--) {
        const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000 * (i + 1));
        [pwdArray[i], pwdArray[j]] = [pwdArray[j], pwdArray[i]];
      }
      
      password = pwdArray.join('');
      
      // STEP 4: Dedupe check (optional - replace repeats)
      const charCount = {};
      password.split('').forEach(char => charCount[char] = (charCount[char] || 0) + 1);
      let maxRepeat = Math.max(...Object.values(charCount));
      if (maxRepeat > Math.ceil(password.length * 0.15)) {
        // Regenerate if too repetitive (rare)
        return this.generate();
      }
      
      this.state.password = password;
      this.state.strength = this.calculateStrength(password);
      
      this.updateDisplay();
      this.addToHistory(password);
      
      document.getElementById('generateBtn').classList.remove('loading');
      document.getElementById('generateBtn').textContent = 'Generate Password';
      this.state.isGenerating = false;
      
      this.showToast(`Ultra-hard password generated! Entropy: ${this.getEntropy(password).toFixed(0)} bits`, 'success');
    }, 1200);
  }

  calculateStrength(password) {
    const entropy = this.getEntropy(password);
    const lengthScore = Math.min(password.length * 5, 40);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?/~`€£]/.test(password);
    
    const typeScore = (hasUpper ? 12 : 0) + (hasLower ? 12 : 0) + (hasNumbers ? 18 : 0) + (hasSymbols ? 20 : 0);
    const repeats = password.length - new Set(password).size;
    const repeatPenalty = Math.max(0, repeats * 3);
    const sequencePenalty = this.hasSequences(password) ? 15 : 0;
    
    const score = Math.min(100, Math.max(0, (lengthScore + typeScore + (entropy / 4) - repeatPenalty - sequencePenalty) * 1.8));
    
    if (score < 50) return { level: 'weak', score: Math.round((score / 100) * 33), label: 'Weak' };
    if (score < 80) return { level: 'medium', score: Math.round(33 + (score / 100) * 33), label: 'Medium' };
    return { level: 'strong', score: Math.round(66 + (score / 100) * 34), label: 'Very Strong' };
  }

  getEntropy(password) {
    const counts = {};
    password.split('').forEach(char => {
      counts[char] = (counts[char] || 0) + 1;
    });
    const len = password.length;
    return -len * Object.values(counts).reduce((sum, count) => sum + (count/len) * Math.log2(count/len), 0);
  }

  hasSequences(password) {
    // Check for sequential patterns (abc, 123, etc.)
    const seq = password.toLowerCase().match(/(.)\1{2,}|abc|def|ghi|jkl|mno|pqr|stu|vwx|123|456|789|!@#|\$%\^/);
    return !!seq;
  }

  updateDisplay() {
    const display = document.getElementById('passwordDisplay');
    const strengthBar = document.getElementById('strengthBar');
    const strengthLabel = document.getElementById('strengthLabel');
    const tips = document.getElementById('securityTips');
    
    display.textContent = this.state.password || 'Click Generate to create a secure password';
    display.classList.toggle('empty', !this.state.password);
    
    if (this.state.password) {
      const strength = this.calculateStrength(this.state.password);
      strengthBar.className = `strength-bar ${strength.level}`;
      strengthBar.style.width = `${strength.score}%`;
      strengthLabel.textContent = `${strength.label} (${strength.score}%)`;
      
      const tipsText = this.getSecurityTips(strength);
      tips.textContent = tipsText;
    }
    
    // Validate generate button
    const hasValidCharset = this.getValidCharset().length > 0;
    document.getElementById('generateBtn').disabled = !hasValidCharset;
  }

  updateLengthDisplay() {
    document.getElementById('lengthValue').textContent = this.state.length;
  }

  copyPassword() {
    if (!this.state.password) return;
    
    navigator.clipboard.writeText(this.state.password).then(() => {
      const btn = document.getElementById('copyBtn');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
      
      this.showToast('Password copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = this.state.password;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast('Password copied!', 'success');
    });
  }

  addToHistory(password) {
    this.state.history.unshift(password);
    this.state.history = this.state.history.slice(0, 5);
    localStorage.setItem('pwdHistory', JSON.stringify(this.state.history));
    this.renderHistory();
  }

  renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    
    container.innerHTML = this.state.history.map(pwd => 
      `<div class="history-item" data-password="${pwd}" role="button" tabindex="0" aria-label="Use password: ${pwd.slice(0,10)}...">
        ${pwd}
        <button class="btn-regenerate" data-password="${pwd}" aria-label="Regenerate similar">🔄</button>
      </div>`
    ).join('');
  }

  useHistoryPassword(password) {
    this.state.password = password;
    this.updateDisplay();
    this.showToast('Password restored from history', 'success');
  }

  regenerateSimilar(originalPassword) {
    // Parse length from original
    this.state.length = originalPassword.length;
    document.getElementById('lengthSlider').value = this.state.length;
    document.getElementById('lengthValue').textContent = this.state.length;
    
    // Use same charset types (heuristic based on content)
    this.state.includeUppercase = /[A-Z]/.test(originalPassword);
    this.state.includeLowercase = /[a-z]/.test(originalPassword);
    this.state.includeNumbers = /\d/.test(originalPassword);
    this.state.includeSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(originalPassword);
    
    // Update toggles
    ['uppercase', 'lowercase', 'numbers', 'symbols'].forEach(type => {
      const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
      const toggle = document.getElementById(`${type}Toggle`);
      if (toggle) {
        toggle.classList.toggle('active', this.state[`include${capitalize(type)}`]);
      }
    });
    
    this.generate();
  }

  getSecurityTips(strength) {
    const tips = {
      weak: 'Use longer passwords (20+ chars), mix all character types, avoid common words.',
      medium: 'Good start! Add more symbols and increase length to 20+ characters.',
      strong: 'Excellent! This password has high entropy and resists brute-force attacks.'
    };
    return tips[strength.level];
  }

  showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new PasswordGenerator();
});

// Service Worker for PWA (bonus advanced feature)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed'));
  });
}
