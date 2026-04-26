const BACKEND = "http://127.0.0.1:8000";

function refreshFocus() {
  chrome.storage.local.get(["focusedText"], (r) => {
    if (r.focusedText) {
      document.getElementById("focus-preview").textContent =
        r.focusedText.slice(0, 160) + (r.focusedText.length > 160 ? "…" : "");
    }
  });
}
refreshFocus();
setInterval(refreshFocus, 1500);

function getFocusedText() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["focusedText"], (r) =>
      resolve(r.focusedText || "")
    );
  });
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

function speakText(text) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  
  const setVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes("Google") || v.name.includes("Natural")
    );
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
    setStatus("Speaking…");
    utterance.onend = () => setStatus("");
  };
  
  // Check if voices are loaded, if not wait for them
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    setVoiceAndSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      setVoiceAndSpeak();
    };
    // Fallback: try speaking anyway after a short delay
    setTimeout(setVoiceAndSpeak, 100);
  }
}

async function askQuestion(speakAloud) {
  const question = document.getElementById("question").value.trim();
  if (!question) {
    alert("Please type a question first!");
    return;
  }
  const context = await getFocusedText();
  const answerEl = document.getElementById("answer");
  answerEl.textContent = "Thinking…";
  setStatus("Calling Groq LLaMA3…");

  try {
    const res = await fetch(`${BACKEND}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    answerEl.textContent = data.answer;
    setStatus("");
    if (speakAloud) speakText(data.answer);
  } catch (e) {
    answerEl.textContent = "Error: Make sure the backend is running!";
    setStatus("Error: " + e.message);
  }
}

function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Voice input only works in Chrome."); return; }
  const recog = new SR();
  recog.lang = "en-US";
  recog.onresult = (e) => {
    document.getElementById("question").value = e.results[0][0].transcript;
    setStatus("Voice captured — hit Ask or Ask + Speak");
  };
  recog.onerror = (e) => setStatus("Mic error: " + e.error);
  recog.onend = () => { 
    document.getElementById("btn-mic").innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>`; 
  };
  document.getElementById("btn-mic").innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="6" y="4" width="4" height="16"></rect>
    <rect x="14" y="4" width="4" height="16"></rect>
  </svg>`;
  setStatus("Listening…");
  recog.start();
}

document.getElementById("btn-ask").addEventListener("click", () => askQuestion(false));
document.getElementById("btn-speak").addEventListener("click", () => askQuestion(true));
document.getElementById("btn-mic").addEventListener("click", startVoiceInput);